import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import require_super_admin

router = APIRouter(prefix="/admin", tags=["admin"])

_GECERLI_DURUMLAR = ("deneme", "aktif", "askida", "iptal")


@router.get("/dukkanlar")
async def list_dukkanlar(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT d.id, d.ad, d.slug, d.telefon, d.sehir, d.abonelik_durumu,
                  d.abonelik_bitis, d.created_at,
                  (SELECT COUNT(*) FROM kullanicilar k WHERE k.dukkan_id = d.id) AS kullanici_sayisi,
                  (SELECT COUNT(*) FROM repairs r WHERE r.dukkan_id = d.id) AS tamir_sayisi
           FROM dukkanlar d
           ORDER BY d.created_at DESC"""
    )
    return [dict(r) for r in rows]


@router.patch("/dukkanlar/{dukkan_id}/abonelik")
async def set_abonelik_durumu(
    dukkan_id: int,
    body: dict,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    durum = body.get("durum")
    if durum not in _GECERLI_DURUMLAR:
        raise HTTPException(400, f"Geçersiz durum — biri olmalı: {', '.join(_GECERLI_DURUMLAR)}")
    result = await db.execute(
        "UPDATE dukkanlar SET abonelik_durumu = $1 WHERE id = $2", durum, dukkan_id
    )
    if result == "UPDATE 0":
        raise HTTPException(404, "Dükkan bulunamadı")
    return {"ok": True}


@router.get("/istatistik")
async def genel_istatistik(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    toplam_dukkan = await db.fetchval("SELECT COUNT(*) FROM dukkanlar")
    aktif_dukkan = await db.fetchval("SELECT COUNT(*) FROM dukkanlar WHERE abonelik_durumu = 'aktif'")
    deneme_dukkan = await db.fetchval("SELECT COUNT(*) FROM dukkanlar WHERE abonelik_durumu = 'deneme'")
    askida_dukkan = await db.fetchval("SELECT COUNT(*) FROM dukkanlar WHERE abonelik_durumu = 'askida'")
    toplam_kullanici = await db.fetchval("SELECT COUNT(*) FROM kullanicilar WHERE aktif = true")
    toplam_tamir = await db.fetchval("SELECT COUNT(*) FROM repairs")
    son_30gun_dukkan = await db.fetchval(
        "SELECT COUNT(*) FROM dukkanlar WHERE created_at >= now() - interval '30 days'"
    )
    return {
        "toplam_dukkan": toplam_dukkan,
        "aktif_dukkan": aktif_dukkan,
        "deneme_dukkan": deneme_dukkan,
        "askida_dukkan": askida_dukkan,
        "toplam_kullanici": toplam_kullanici,
        "toplam_tamir": toplam_tamir,
        "son_30gun_yeni_dukkan": son_30gun_dukkan,
    }
