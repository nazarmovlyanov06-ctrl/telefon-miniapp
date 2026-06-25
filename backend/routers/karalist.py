from fastapi import APIRouter, Depends, Query
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user

router = APIRouter(prefix="/kara-liste", tags=["kara-liste"])


@router.get("/")
async def list_kara(
    q: str = Query(None),
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if q:
        cur = await db.execute(
            "SELECT * FROM kara_liste WHERE ad LIKE ? OR telefon LIKE ? OR imei LIKE ? ORDER BY created_at DESC",
            (f"%{q}%", f"%{q}%", f"%{q}%"),
        )
    else:
        cur = await db.execute("SELECT * FROM kara_liste ORDER BY created_at DESC")
    return [dict(r) for r in await cur.fetchall()]


@router.post("/")
async def add_kara(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "INSERT INTO kara_liste (ad, telefon, imei, sebep, notlar) VALUES (?, ?, ?, ?, ?)",
        (body.get("ad"), body.get("telefon"), body.get("imei"), body["sebep"], body.get("notlar")),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.delete("/{kara_id}")
async def delete_kara(
    kara_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute("DELETE FROM kara_liste WHERE id = ?", (kara_id,))
    await db.commit()
    return {"ok": True}
