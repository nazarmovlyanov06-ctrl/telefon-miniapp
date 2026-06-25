from fastapi import APIRouter, Depends
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date

router = APIRouter(prefix="/giderler", tags=["gider"])


@router.get("/")
async def list_giderler(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    bugun = date.today()
    ay_basi = bugun.replace(day=1).isoformat()
    cur = await db.execute(
        "SELECT * FROM giderler WHERE tarih >= ? ORDER BY tarih DESC, id DESC",
        (ay_basi,),
    )
    rows = [dict(r) for r in await cur.fetchall()]
    toplam = sum(r["tutar"] for r in rows)
    return {"toplam": toplam, "giderler": rows}


@router.post("/")
async def create_gider(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    tarih = body.get("tarih", date.today().isoformat())
    cur = await db.execute(
        "INSERT INTO giderler (kategori, tutar, aciklama, tarih) VALUES (?, ?, ?, ?)",
        (body["kategori"], float(body["tutar"]), body.get("aciklama"), tarih),
    )
    await db.execute(
        """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
           VALUES (?, 'cikis', ?, ?, ?, 'gider')""",
        (tarih, body.get("odeme_yontemi", "nakit"), float(body["tutar"]),
         f"{body['kategori']}: {body.get('aciklama', '')}".strip()),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.delete("/{gider_id}")
async def delete_gider(
    gider_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute("DELETE FROM giderler WHERE id = ?", (gider_id,))
    await db.commit()
    return {"ok": True}
