import asyncpg
from fastapi import APIRouter, Depends, Query
from database import get_db
from auth import get_current_user, get_dukkan_id
from datetime import date, timedelta, datetime

router = APIRouter(prefix="/garantiler", tags=["garanti"])


@router.get("/")
async def list_garanti(
    q: str = Query(None),
    goster: str = Query("aktif"),  # aktif | bitmis | kapali | hepsi
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    where = ["dukkan_id = $1"]
    params = [dukkan_id]
    bugun = date.today().isoformat()

    if goster == "aktif":
        where.append(f"aktif = true AND bitis_tarihi >= ${len(params) + 1}")
        params.append(bugun)
    elif goster == "bitmis":
        where.append(f"aktif = true AND bitis_tarihi < ${len(params) + 1}")
        params.append(bugun)
    elif goster == "kapali":
        where.append("aktif = false")

    if q:
        idx = len(params) + 1
        where.append(f"(musteri_adi ILIKE ${idx} OR cihaz ILIKE ${idx + 1} OR telefon ILIKE ${idx + 2})")
        params += [f"%{q}%"] * 3

    where_sql = "WHERE " + " AND ".join(where)
    rows = await db.fetch(
        f"SELECT * FROM garantiler {where_sql} ORDER BY bitis_tarihi ASC",
        *params,
    )
    rows = [dict(r) for r in rows]
    for r in rows:
        r["suresi_doldu"] = r["bitis_tarihi"] < bugun
    return rows


@router.post("/")
async def create_garanti(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    baslangic = body.get("baslangic_tarihi", date.today().isoformat())
    sure = int(body.get("sure_gun", 30))
    b = datetime.fromisoformat(baslangic).date() + timedelta(days=sure)
    bitis = b.isoformat()
    row = await db.fetchrow(
        """INSERT INTO garantiler
           (dukkan_id, musteri_adi, telefon, cihaz, tamir_aciklama, baslangic_tarihi, sure_gun, bitis_tarihi, aktif)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING id""",
        dukkan_id, body["musteri_adi"], body.get("telefon"), body["cihaz"],
        body["tamir_aciklama"], baslangic, sure, bitis,
    )
    return {"id": row["id"], "bitis_tarihi": bitis}


@router.put("/{garanti_id}/kapat")
async def kapat_garanti(
    garanti_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE garantiler SET aktif = false WHERE id = $1 AND dukkan_id = $2",
        garanti_id, dukkan_id,
    )
    return {"ok": True}
