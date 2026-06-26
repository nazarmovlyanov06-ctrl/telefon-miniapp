from fastapi import APIRouter, Depends, HTTPException
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user

router = APIRouter(prefix="/sablonlar", tags=["sablonlar"])


@router.get("/")
async def list_sablonlar(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT * FROM tamir_sablonlar ORDER BY kullanim_sayisi DESC, ad ASC"
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/")
async def create_sablon(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """INSERT INTO tamir_sablonlar (ad, cihaz_model, ariza, tahmini_ucret, notlar)
           VALUES (?, ?, ?, ?, ?)""",
        (body["ad"], body.get("cihaz_model"), body.get("ariza"), body.get("tahmini_ucret"), body.get("notlar")),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.put("/{sablon_id}")
async def update_sablon(
    sablon_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute(
        """UPDATE tamir_sablonlar SET ad=?, cihaz_model=?, ariza=?, tahmini_ucret=?, notlar=?
           WHERE id=?""",
        (body["ad"], body.get("cihaz_model"), body.get("ariza"), body.get("tahmini_ucret"), body.get("notlar"), sablon_id),
    )
    await db.commit()
    return {"ok": True}


@router.delete("/{sablon_id}")
async def delete_sablon(
    sablon_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute("DELETE FROM tamir_sablonlar WHERE id=?", (sablon_id,))
    await db.commit()
    return {"ok": True}


@router.post("/{sablon_id}/kullan")
async def sablon_kullan(
    sablon_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute(
        "UPDATE tamir_sablonlar SET kullanim_sayisi = kullanim_sayisi + 1 WHERE id=?",
        (sablon_id,),
    )
    await db.commit()
    return {"ok": True}
