import asyncpg
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from database import get_db
from auth import get_current_user, get_dukkan_id, require_patron
from photo_storage import save_upload

router = APIRouter(prefix="/vitrin", tags=["vitrin"])


@router.get("/ayarlarim")
async def ayarlarim(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """SELECT slug, ad, telefon, adres, sehir, vitrin_aktif, vitrin_aciklama,
                  calisma_saatleri, hizmetler, logo_url, kapak_url FROM dukkanlar WHERE id = $1""",
        dukkan_id,
    )
    return dict(row)


@router.post("/logo")
async def logo_yukle(
    dosya: UploadFile = File(...),
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    try:
        url, _, _ = await save_upload(dosya, "dukkan-logo", dukkan_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute("UPDATE dukkanlar SET logo_url = $1 WHERE id = $2", url, dukkan_id)
    return {"url": url}


@router.post("/kapak")
async def kapak_yukle(
    dosya: UploadFile = File(...),
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    try:
        url, _, _ = await save_upload(dosya, "dukkan-kapak", dukkan_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute("UPDATE dukkanlar SET kapak_url = $1 WHERE id = $2", url, dukkan_id)
    return {"url": url}


@router.put("/ayarlarim")
async def ayarlari_guncelle(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        """UPDATE dukkanlar SET telefon = $1, adres = $2, sehir = $3, vitrin_aktif = $4,
                  vitrin_aciklama = $5, calisma_saatleri = $6, hizmetler = $7
           WHERE id = $8""",
        body.get("telefon"), body.get("adres"), body.get("sehir"),
        bool(body.get("vitrin_aktif", True)), body.get("vitrin_aciklama"),
        body.get("calisma_saatleri"), body.get("hizmetler"), dukkan_id,
    )
    return {"ok": True}


@router.get("/randevu-talepleri")
async def randevu_talepleri(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT id, musteri_adi, telefon, cihaz_model, aciklama, durum, created_at
           FROM randevu_talepleri WHERE dukkan_id = $1 ORDER BY created_at DESC""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.put("/randevu-talepleri/{talep_id}/durum")
async def randevu_durum_guncelle(
    talep_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    durum = body.get("durum")
    if durum not in ("yeni", "goruldu", "tamire_donusturuldu", "reddedildi"):
        raise HTTPException(400, "Geçersiz durum")
    result = await db.execute(
        "UPDATE randevu_talepleri SET durum = $1 WHERE id = $2 AND dukkan_id = $3",
        durum, talep_id, dukkan_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(404, "Talep bulunamadı")
    return {"ok": True}


# ── DEĞERLENDİRME MODERASYONU ──────────────────────────────────────────

@router.get("/degerlendirmeler")
async def degerlendirmeler_hepsi(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT id, repair_no, musteri_adi, puan, yorum, onaylandi, created_at
           FROM degerlendirmeler WHERE dukkan_id = $1 ORDER BY created_at DESC""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.put("/degerlendirmeler/{id}/onay")
async def degerlendirme_onayla(
    id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    result = await db.execute(
        "UPDATE degerlendirmeler SET onaylandi = $1 WHERE id = $2 AND dukkan_id = $3",
        bool(body.get("onaylandi", True)), id, dukkan_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(404, "Değerlendirme bulunamadı")
    return {"ok": True}


@router.delete("/degerlendirmeler/{id}")
async def degerlendirme_sil(
    id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    result = await db.execute("DELETE FROM degerlendirmeler WHERE id = $1 AND dukkan_id = $2", id, dukkan_id)
    if result == "DELETE 0":
        raise HTTPException(404, "Değerlendirme bulunamadı")
    return {"ok": True}


# ── TAKAS TEKLİFLERİ ─────────────────────────────────────────────────────

@router.get("/takas-teklifleri")
async def takas_teklifleri(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT id, musteri_adi, telefon, cihaz_model, aciklama, foto_url, durum, teklif_tutari, created_at
           FROM takas_teklifleri WHERE dukkan_id = $1 ORDER BY created_at DESC""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.put("/takas-teklifleri/{id}")
async def takas_teklifi_guncelle(
    id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    durum = body.get("durum")
    if durum not in ("yeni", "teklif_verildi", "kabul_edildi", "reddedildi"):
        raise HTTPException(400, "Geçersiz durum")
    teklif_tutari = body.get("teklif_tutari")
    result = await db.execute(
        "UPDATE takas_teklifleri SET durum = $1, teklif_tutari = $2 WHERE id = $3 AND dukkan_id = $4",
        durum, float(teklif_tutari) if teklif_tutari else None, id, dukkan_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(404, "Teklif bulunamadı")
    return {"ok": True}
