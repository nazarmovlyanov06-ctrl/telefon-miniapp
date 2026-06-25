from fastapi import APIRouter, Depends, HTTPException
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date

router = APIRouter(prefix="/toptanci", tags=["toptanci"])


@router.get("/")
async def list_toptanci(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT * FROM toptancilar ORDER BY ad ASC")
    return [dict(r) for r in await cur.fetchall()]


@router.post("/")
async def create_toptanci(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "INSERT INTO toptancilar (ad, telefon, sehir, notlar) VALUES (?, ?, ?, ?)",
        (body["ad"], body.get("telefon"), body.get("sehir"), body.get("notlar")),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.put("/{toptanci_id}")
async def update_toptanci(
    toptanci_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute(
        "UPDATE toptancilar SET ad=?, telefon=?, sehir=?, notlar=? WHERE id=?",
        (body.get("ad"), body.get("telefon"), body.get("sehir"), body.get("notlar"), toptanci_id),
    )
    await db.commit()
    return {"ok": True}


@router.delete("/{toptanci_id}")
async def delete_toptanci(
    toptanci_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute("DELETE FROM toptancilar WHERE id = ?", (toptanci_id,))
    await db.commit()
    return {"ok": True}


@router.get("/{toptanci_id}/alislar")
async def list_alislar(
    toptanci_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT * FROM toptanci_alislar WHERE toptanci_id = ? ORDER BY tarih DESC, id DESC",
        (toptanci_id,),
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/{toptanci_id}/alislar")
async def create_alis(
    toptanci_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    miktar = int(body.get("miktar", 1))
    birim = float(body["birim_fiyat"])
    toplam = body.get("toplam") or (miktar * birim)
    cur = await db.execute(
        """INSERT INTO toptanci_alislar
           (toptanci_id, urun, miktar, birim_fiyat, toplam, tarih, notlar)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (toptanci_id, body["urun"], miktar, birim, toplam,
         body.get("tarih", date.today().isoformat()), body.get("notlar")),
    )
    await db.commit()
    return {"id": cur.lastrowid, "toplam": toplam}
