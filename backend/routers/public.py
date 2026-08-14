import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from database import get_db

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/planlar")
async def planlar(db: asyncpg.Connection = Depends(get_db)):
    rows = await db.fetch("SELECT tur, ad, fiyat FROM platform_planlar ORDER BY fiyat")
    return [dict(r) for r in rows]


async def _dukkan_by_slug(db: asyncpg.Connection, slug: str):
    row = await db.fetchrow(
        "SELECT id, ad, slug, telefon, adres, sehir, vitrin_aktif, vitrin_aciklama, calisma_saatleri, hizmetler FROM dukkanlar WHERE slug = $1",
        slug,
    )
    if not row or not row["vitrin_aktif"]:
        raise HTTPException(404, "Dükkan bulunamadı")
    return row


@router.get("/dukkan/{slug}")
async def dukkan_vitrin(slug: str, db: asyncpg.Connection = Depends(get_db)):
    d = await _dukkan_by_slug(db, slug)
    return dict(d)


@router.get("/dukkan/{slug}/tamir-durumu")
async def tamir_durumu(slug: str, q: str, db: asyncpg.Connection = Depends(get_db)):
    """Telefon numarası veya tamir no ile arama — sadece TAM eşleşme, kısmi
    aramaya izin verilmez (başka müşterilerin verisini sızdırmamak için)."""
    d = await _dukkan_by_slug(db, slug)
    q = q.strip()
    if not q:
        raise HTTPException(400, "Arama terimi gerekli")
    rows = await db.fetch(
        """SELECT r.repair_no, r.device_model, r.fault_desc, r.status, r.created_at, r.delivered_at
           FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.dukkan_id = $1 AND (r.repair_no = $2 OR c.phone = $2)
           ORDER BY r.created_at DESC LIMIT 10""",
        d["id"], q,
    )
    return [dict(r) for r in rows]


@router.get("/dukkan/{slug}/cihazlar")
async def satilik_cihazlar(slug: str, db: asyncpg.Connection = Depends(get_db)):
    d = await _dukkan_by_slug(db, slug)
    ikinci_el = await db.fetch(
        """SELECT id, model, renk, depolama, ram, satis_fiyati, 'ikinci_el' AS kaynak
           FROM ikinci_el WHERE dukkan_id = $1 AND durum = 'stokta' ORDER BY created_at DESC""",
        d["id"],
    )
    sifir = await db.fetch(
        """SELECT id, model, renk, depolama, satis_fiyati, 'sifir' AS kaynak
           FROM sifir_cihazlar WHERE dukkan_id = $1 AND durum = 'stokta' ORDER BY created_at DESC""",
        d["id"],
    )
    return {"ikinci_el": [dict(r) for r in ikinci_el], "sifir": [dict(r) for r in sifir]}


@router.post("/dukkan/{slug}/randevu")
async def randevu_talebi(slug: str, body: dict, db: asyncpg.Connection = Depends(get_db)):
    d = await _dukkan_by_slug(db, slug)
    musteri_adi = (body.get("musteri_adi") or "").strip()
    telefon = (body.get("telefon") or "").strip()
    if not musteri_adi or not telefon:
        raise HTTPException(400, "Ad ve telefon gerekli")
    await db.execute(
        """INSERT INTO randevu_talepleri (dukkan_id, musteri_adi, telefon, cihaz_model, aciklama)
           VALUES ($1, $2, $3, $4, $5)""",
        d["id"], musteri_adi, telefon, body.get("cihaz_model"), body.get("aciklama"),
    )
    return {"ok": True}
