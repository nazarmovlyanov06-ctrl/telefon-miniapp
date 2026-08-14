import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import get_current_user, get_dukkan_id, require_patron

router = APIRouter(prefix="/vitrin", tags=["vitrin"])


@router.get("/ayarlarim")
async def ayarlarim(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """SELECT slug, ad, telefon, adres, sehir, vitrin_aktif, vitrin_aciklama,
                  calisma_saatleri, hizmetler FROM dukkanlar WHERE id = $1""",
        dukkan_id,
    )
    return dict(row)


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
