from fastapi import APIRouter, Depends
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date

router = APIRouter(prefix="/kasa", tags=["kasa"])


async def _gun_ozet(db: Connection, tarih: str) -> dict:
    cur = await db.execute(
        "SELECT * FROM kasa_hareketleri WHERE tarih = ? ORDER BY id DESC", (tarih,)
    )
    rows = [dict(r) for r in await cur.fetchall()]
    giris = cikis = nakit = kart = 0.0
    for r in rows:
        if r["tur"] == "giris":
            giris += r["tutar"]
        else:
            cikis += r["tutar"]
        if r["odeme_yontemi"] == "kart":
            kart += r["tutar"] if r["tur"] == "giris" else -r["tutar"]
        else:
            nakit += r["tutar"] if r["tur"] == "giris" else -r["tutar"]
    return {
        "tarih": tarih,
        "toplam_giris": giris,
        "toplam_cikis": cikis,
        "net": giris - cikis,
        "nakit": nakit,
        "kart": kart,
        "hareketler": rows,
    }


@router.get("/bugun")
async def bugun(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    return await _gun_ozet(db, date.today().isoformat())


@router.get("/tarih/{tarih}")
async def belirli_gun(
    tarih: str,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    return await _gun_ozet(db, tarih)


@router.post("/gider")
async def manuel_hareket(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (body.get("tarih", date.today().isoformat()),
         body.get("tur", "cikis"),
         body.get("odeme_yontemi", "nakit"),
         float(body["tutar"]),
         body.get("aciklama"),
         body.get("kaynak", "manuel")),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.post("/duzelt")
async def manuel_duzelt(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    from fastapi import HTTPException
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if user["role"] != "patron":
        raise HTTPException(403, "Sadece patron")
    await db.execute(
        """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (body.get("tarih", date.today().isoformat()),
         body.get("tur", "cikis"),
         body.get("odeme_yontemi", "nakit"),
         float(body["tutar"]),
         body.get("aciklama", "Manuel düzeltme"),
         "duzeltme"),
    )
    await db.commit()
    return {"ok": True}
