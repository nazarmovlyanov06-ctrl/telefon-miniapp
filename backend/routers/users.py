from fastapi import APIRouter, Depends, HTTPException
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from config import ROLE_PATRON

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def me(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    return user


@router.get("/")
async def list_users(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if user["role"] != ROLE_PATRON:
        raise HTTPException(403, "Sadece patron gorebilir")
    cur = await db.execute(
        "SELECT id, telegram_id, name, role, active, created_at FROM users ORDER BY role, name"
    )
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.put("/{user_id}/role")
async def change_role(
    user_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if user["role"] != ROLE_PATRON:
        raise HTTPException(403, "Sadece patron degistirebilir")
    new_role = body.get("role")
    if new_role not in ("patron", "satis", "teknisyen", "cirak"):
        raise HTTPException(400, "Gecersiz rol")
    await db.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, user_id))
    await db.commit()
    return {"ok": True}
