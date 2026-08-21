import re
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db
from auth import get_current_user, get_dukkan_id

router = APIRouter(prefix="/kara-liste", tags=["kara-liste"])

KATEGORILER = ["odeme_yapmadi", "kotu_niyet", "sahte_cihaz", "hakaret_tehdit", "diger"]


def _telefon_hane(tel):
    """Karşılaştırma için telefonu sadece rakamlara indirger — '0555 123 45 67'
    ile '5551234567' gibi farklı yazımların eşleşmesini sağlar; ham ILIKE
    substring karşılaştırması format farkında kırılıyordu."""
    return re.sub(r"\D", "", tel or "")


@router.get("/")
async def list_kara(
    q: str = Query(None),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    base = """SELECT k.*, u.ad as ekleyen_adi, c.name as musteri_adi_baglantili
              FROM kara_liste k
              LEFT JOIN kullanicilar u ON u.id = k.created_by
              LEFT JOIN customers c ON c.id = k.customer_id
              WHERE k.dukkan_id=$1"""
    params = [dukkan_id]
    if q:
        like = f"%{q}%"
        params.append(like)
        idx = len(params)
        hane = _telefon_hane(q)
        cond = f"(k.ad ILIKE ${idx} OR k.imei ILIKE ${idx} OR k.telefon ILIKE ${idx}"
        if hane:
            params.append(f"%{hane}%")
            cond += f" OR regexp_replace(k.telefon, '\\D', '', 'g') LIKE ${len(params)}"
        cond += ")"
        base += f" AND {cond}"
    rows = await db.fetch(base + " ORDER BY k.created_at DESC", *params)
    return [dict(r) for r in rows]


@router.post("/")
async def add_kara(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    sebep = (body.get("sebep") or "").strip()
    if not sebep:
        raise HTTPException(400, "Sebep gerekli")
    kategori = body.get("kategori")
    if kategori and kategori not in KATEGORILER:
        kategori = None
    row = await db.fetchrow(
        """INSERT INTO kara_liste (dukkan_id, ad, telefon, imei, sebep, kategori, notlar, customer_id, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id""",
        dukkan_id, body.get("ad"), body.get("telefon"), body.get("imei"), sebep,
        kategori, body.get("notlar"), body.get("customer_id"), user["id"],
    )
    return {"id": row["id"]}


@router.put("/{kara_id}")
async def update_kara(
    kara_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    sebep = (body.get("sebep") or "").strip()
    if not sebep:
        raise HTTPException(400, "Sebep gerekli")
    kategori = body.get("kategori")
    if kategori and kategori not in KATEGORILER:
        kategori = None
    result = await db.execute(
        """UPDATE kara_liste SET ad=$1, telefon=$2, imei=$3, sebep=$4, kategori=$5,
           notlar=$6, customer_id=$7, updated_at=now()
           WHERE id=$8 AND dukkan_id=$9""",
        body.get("ad"), body.get("telefon"), body.get("imei"), sebep, kategori,
        body.get("notlar"), body.get("customer_id"), kara_id, dukkan_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(404, "Kayıt bulunamadı")
    return {"ok": True}


@router.delete("/{kara_id}")
async def delete_kara(
    kara_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute("DELETE FROM kara_liste WHERE id = $1 AND dukkan_id = $2", kara_id, dukkan_id)
    return {"ok": True}
