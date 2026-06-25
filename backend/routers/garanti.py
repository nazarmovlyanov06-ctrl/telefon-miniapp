from fastapi import APIRouter, Depends, Query
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date, timedelta, datetime

router = APIRouter(prefix="/garantiler", tags=["garanti"])


@router.get("/")
async def list_garanti(
    q: str = Query(None),
    goster: str = Query("aktif"),  # aktif | bitmis | kapali | hepsi
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    where = []
    params = []
    bugun = date.today().isoformat()

    if goster == "aktif":
        where.append("aktif = 1 AND bitis_tarihi >= ?")
        params.append(bugun)
    elif goster == "bitmis":
        where.append("aktif = 1 AND bitis_tarihi < ?")
        params.append(bugun)
    elif goster == "kapali":
        where.append("aktif = 0")

    if q:
        where.append("(musteri_adi LIKE ? OR cihaz LIKE ? OR telefon LIKE ?)")
        params += [f"%{q}%"] * 3

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    cur = await db.execute(
        f"SELECT * FROM garantiler {where_sql} ORDER BY bitis_tarihi ASC",
        params
    )
    rows = [dict(r) for r in await cur.fetchall()]
    for r in rows:
        r["suresi_doldu"] = r["bitis_tarihi"] < bugun
    return rows


@router.post("/")
async def create_garanti(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    baslangic = body.get("baslangic_tarihi", date.today().isoformat())
    sure = int(body.get("sure_gun", 30))
    b = datetime.fromisoformat(baslangic).date() + timedelta(days=sure)
    bitis = b.isoformat()
    cur = await db.execute(
        """INSERT INTO garantiler
           (musteri_adi, telefon, cihaz, tamir_aciklama, baslangic_tarihi, sure_gun, bitis_tarihi, aktif)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)""",
        (body["musteri_adi"], body.get("telefon"), body["cihaz"],
         body["tamir_aciklama"], baslangic, sure, bitis),
    )
    await db.commit()
    return {"id": cur.lastrowid, "bitis_tarihi": bitis}


@router.put("/{garanti_id}/kapat")
async def kapat_garanti(
    garanti_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute("UPDATE garantiler SET aktif = 0 WHERE id = ?", (garanti_id,))
    await db.commit()
    return {"ok": True}
