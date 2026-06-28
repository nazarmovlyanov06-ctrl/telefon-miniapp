from fastapi import APIRouter, Depends, HTTPException
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from config import ROLE_PATRON, DAVET_KODU

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
        "SELECT id, telegram_id, name, role, active, durum, created_at FROM users ORDER BY durum DESC, role, name"
    )
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.post("/davet")
async def davet_kodu_gir(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if user.get("durum") == "aktif":
        return {"ok": True, "mesaj": "Zaten aktifsin"}
    kod = body.get("kod", "").strip()
    if not DAVET_KODU or kod != DAVET_KODU:
        raise HTTPException(400, "Geçersiz davet kodu")
    await db.execute("UPDATE users SET durum='aktif' WHERE id=?", (user["id"],))
    await db.commit()
    return {"ok": True, "mesaj": "Onaylandı! Sayfayı yenile."}


@router.put("/{user_id}/onayla")
async def onayla_user(
    user_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    patron = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if patron["role"] != ROLE_PATRON:
        raise HTTPException(403, "Sadece patron onaylayabilir")
    await db.execute("UPDATE users SET durum='aktif' WHERE id=?", (user_id,))
    await db.commit()
    return {"ok": True}


@router.delete("/{user_id}/reddet")
async def reddet_user(
    user_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    patron = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if patron["role"] != ROLE_PATRON:
        raise HTTPException(403, "Sadece patron reddedebilir")
    await db.execute("DELETE FROM users WHERE id=? AND role != 'patron'", (user_id,))
    await db.commit()
    return {"ok": True}


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
