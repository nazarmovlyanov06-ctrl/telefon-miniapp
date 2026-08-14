from datetime import timedelta

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from database import get_db
from auth import get_current_user, get_dukkan_id
from photo_storage import save_upload
from destek_ai import ai_yanit_uret

router = APIRouter(prefix="/destek", tags=["destek"])

_SILME_BEKLEME_GUN = 30


@router.get("/hesap-durumu")
async def hesap_durumu(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow("SELECT silme_talep_tarihi FROM dukkanlar WHERE id = $1", dukkan_id)
    talep = row["silme_talep_tarihi"] if row else None
    return {
        "silme_talep_tarihi": talep,
        "kalici_silme_tarihi": (talep + timedelta(days=_SILME_BEKLEME_GUN)) if talep else None,
    }


@router.get("/mesajlarim")
async def mesajlarim(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT id, gonderen_rol, gonderen_ad, mesaj, dosya_url, dosya_adi, dosya_tipi, created_at
           FROM destek_mesajlari WHERE dukkan_id = $1 ORDER BY id""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/mesajlarim")
async def mesaj_gonder(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    mesaj = (body.get("mesaj") or "").strip()
    if not mesaj:
        raise HTTPException(400, "Mesaj boş olamaz")
    if len(mesaj) > 2000:
        raise HTTPException(400, "Mesaj çok uzun (max 2000 karakter)")
    await db.execute(
        "INSERT INTO destek_mesajlari (dukkan_id, gonderen_rol, gonderen_ad, mesaj, okundu) VALUES ($1, 'dukkan', $2, $3, false)",
        dukkan_id, user.get("ad"), mesaj,
    )

    # Basit sorulara en iyi çaba ile otomatik AI yanıtı — başarısız olursa sessizce geçilir,
    # bir insan platform tarafından yanıtlayana kadar bekler.
    onceki_mesaj_sayisi = await db.fetchval(
        "SELECT COUNT(*) FROM destek_mesajlari WHERE dukkan_id = $1", dukkan_id
    )
    if onceki_mesaj_sayisi <= 1:
        ai_cevap = await ai_yanit_uret(mesaj)
        if ai_cevap:
            await db.execute(
                "INSERT INTO destek_mesajlari (dukkan_id, gonderen_rol, gonderen_ad, mesaj, okundu) VALUES ($1, 'ai', 'Destek Asistanı', $2, true)",
                dukkan_id, ai_cevap,
            )
    return {"ok": True}


@router.post("/mesajlarim/dosya")
async def mesaj_dosya_gonder(
    dosya: UploadFile = File(...),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    try:
        url, ad, tip = await save_upload(dosya, "destek", dukkan_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute(
        """INSERT INTO destek_mesajlari (dukkan_id, gonderen_rol, gonderen_ad, mesaj, okundu, dosya_url, dosya_adi, dosya_tipi)
           VALUES ($1, 'dukkan', $2, '', false, $3, $4, $5)""",
        dukkan_id, user.get("ad"), url, ad, tip,
    )
    return {"ok": True, "dosya_url": url}


@router.get("/duyurularim")
async def duyurularim(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT d.id, d.mesaj, d.created_at
           FROM platform_duyuru_alicilari a
           JOIN platform_duyurular d ON d.id = a.duyuru_id
           WHERE a.dukkan_id = $1 AND a.gorundu = false
           ORDER BY d.created_at DESC""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/duyurularim/{duyuru_id}/gorundu")
async def duyuru_gorundu(
    duyuru_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE platform_duyuru_alicilari SET gorundu = true WHERE duyuru_id = $1 AND dukkan_id = $2",
        duyuru_id, dukkan_id,
    )
    return {"ok": True}


@router.post("/hesap-silme-talebi")
async def hesap_silme_talebi(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron hesap silme talebinde bulunabilir")
    await db.execute(
        "UPDATE dukkanlar SET silme_talep_tarihi = now() WHERE id = $1 AND silme_talep_tarihi IS NULL",
        dukkan_id,
    )
    return {"ok": True}


@router.post("/hesap-silme-talebi/iptal")
async def hesap_silme_talebi_iptal(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron iptal edebilir")
    await db.execute("UPDATE dukkanlar SET silme_talep_tarihi = NULL WHERE id = $1", dukkan_id)
    return {"ok": True}
