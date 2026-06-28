from fastapi import APIRouter, Depends
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user

router = APIRouter(prefix="/geri-bildirim", tags=["geri-bildirim"])


@router.get("/bildirim")
async def bildirim_sayisi(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT COUNT(*) FROM calisan_geri_bildirim WHERE hedef_id=? AND goruldu=0",
        (user["id"],),
    )
    count = (await cur.fetchone())[0]
    return {"bekleyen": int(count)}


@router.get("/")
async def list_bildirimler(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))

    if user["role"] == "patron":
        cur = await db.execute(
            """SELECT cb.*,
                      ug.first_name as gonderen_adi,
                      uh.first_name as hedef_adi
               FROM calisan_geri_bildirim cb
               LEFT JOIN users ug ON cb.gonderen_id = ug.id
               LEFT JOIN users uh ON cb.hedef_id = uh.id
               ORDER BY cb.created_at DESC LIMIT 200"""
        )
    else:
        cur = await db.execute(
            """SELECT cb.id, cb.tur, cb.mesaj, cb.goruldu, cb.created_at,
                      NULL as gonderen_adi,
                      uh.first_name as hedef_adi
               FROM calisan_geri_bildirim cb
               LEFT JOIN users uh ON cb.hedef_id = uh.id
               WHERE cb.hedef_id = ?
               ORDER BY cb.created_at DESC LIMIT 100""",
            (user["id"],),
        )
    return [dict(r) for r in await cur.fetchall()]


@router.get("/skor")
async def skor(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT u.id, u.first_name,
                  SUM(CASE WHEN cb.tur='sikayet' THEN 1 ELSE 0 END) as sikayet_sayisi,
                  SUM(CASE WHEN cb.tur='ovgu'    THEN 1 ELSE 0 END) as ovgu_sayisi
           FROM users u
           LEFT JOIN calisan_geri_bildirim cb ON u.id = cb.hedef_id
           GROUP BY u.id
           ORDER BY ovgu_sayisi DESC, sikayet_sayisi ASC"""
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/")
async def create_bildirim(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    hedef_id = body["hedef_id"]
    if hedef_id == user["id"]:
        from fastapi import HTTPException
        raise HTTPException(400, "Kendinize bildirim gönderemezsiniz")
    cur = await db.execute(
        """INSERT INTO calisan_geri_bildirim (gonderen_id, hedef_id, tur, mesaj)
           VALUES (?, ?, ?, ?)""",
        (user["id"], hedef_id, body["tur"], body["mesaj"]),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.post("/goruldu")
async def mark_goruldu(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute(
        "UPDATE calisan_geri_bildirim SET goruldu=1 WHERE hedef_id=?",
        (user["id"],),
    )
    await db.commit()
    return {"ok": True}
