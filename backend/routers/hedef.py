from fastapi import APIRouter, Depends
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date

router = APIRouter(prefix="/hedef", tags=["hedef"])


@router.get("/bu-ay")
async def bu_ay(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    bugun = date.today()
    yil, ay = bugun.year, bugun.month
    ay_basi = bugun.replace(day=1).isoformat()

    cur = await db.execute(
        "SELECT hedef_tutar FROM aylik_hedefler WHERE yil = ? AND ay = ?", (yil, ay)
    )
    row = await cur.fetchone()
    hedef = dict(row)["hedef_tutar"] if row else 0.0

    cur = await db.execute(
        "SELECT COALESCE(SUM(tutar), 0) as g FROM kasa_hareketleri WHERE tur = 'giris' AND tarih >= ?",
        (ay_basi,),
    )
    gerceklesen = dict(await cur.fetchone())["g"]

    yuzde = (gerceklesen / hedef * 100) if hedef > 0 else 0
    return {
        "yil": yil, "ay": ay,
        "hedef_tutar": hedef,
        "gerceklesen": gerceklesen,
        "yuzde": round(yuzde, 1),
        "kalan": max(hedef - gerceklesen, 0),
    }


@router.post("/")
async def set_hedef(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    bugun = date.today()
    yil = int(body.get("yil", bugun.year))
    ay = int(body.get("ay", bugun.month))
    await db.execute(
        """INSERT INTO aylik_hedefler (yil, ay, hedef_tutar) VALUES (?, ?, ?)
           ON CONFLICT(yil, ay) DO UPDATE SET hedef_tutar = excluded.hedef_tutar""",
        (yil, ay, float(body["hedef_tutar"])),
    )
    await db.commit()
    return {"ok": True}
