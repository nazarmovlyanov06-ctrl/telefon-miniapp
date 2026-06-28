from fastapi import APIRouter, Depends, Query
from typing import Optional
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user

router = APIRouter(prefix="/geri-bildirim", tags=["geri-bildirim"])


@router.get("/")
async def list_bildirimler(
    tur: Optional[str] = Query(None),
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    where = "WHERE g.tur = ?" if tur else ""
    params = (tur,) if tur else ()
    cur = await db.execute(
        f"""SELECT g.*, r.customer_name, r.device_model
            FROM geri_bildirimler g
            LEFT JOIN repairs r ON g.repair_id = r.id
            {where}
            ORDER BY g.created_at DESC LIMIT 200""",
        params,
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/")
async def create_bildirim(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """INSERT INTO geri_bildirimler
           (tur, musteri_adi, telefon, repair_id, puan, mesaj, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            body["tur"],
            body.get("musteri_adi"),
            body.get("telefon"),
            body.get("repair_id"),
            body.get("puan"),
            body["mesaj"],
            user["id"],
        ),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.put("/{bid}/durum")
async def update_durum(
    bid: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute(
        "UPDATE geri_bildirimler SET durum = ? WHERE id = ?",
        (body.get("durum", "incelendi"), bid),
    )
    await db.commit()
    return {"ok": True}


@router.delete("/{bid}")
async def delete_bildirim(
    bid: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute("DELETE FROM geri_bildirimler WHERE id = ?", (bid,))
    await db.commit()
    return {"ok": True}
