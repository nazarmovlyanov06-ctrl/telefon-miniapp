from fastapi import APIRouter, Depends, HTTPException
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date

router = APIRouter(prefix="/loaner", tags=["loaner"])


@router.get("/")
async def list_loaner(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT * FROM loaner_cihazlar WHERE aktif = 1 ORDER BY teslim_tarihi DESC"
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/")
async def create_loaner(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """INSERT INTO loaner_cihazlar (musteri_adi, cihaz, teslim_tarihi, notlar, aktif)
           VALUES (?, ?, ?, ?, 1)""",
        (body["musteri_adi"], body["cihaz"],
         body.get("teslim_tarihi", date.today().isoformat()), body.get("notlar")),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.get("/gecmis")
async def list_gecmis(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT * FROM loaner_cihazlar WHERE aktif = 0 ORDER BY iade_tarihi DESC LIMIT 50"
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/{loaner_id}/hasar")
async def hasar_ekle(
    loaner_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute(
        "UPDATE loaner_cihazlar SET hasar_notu=?, hasar_tutar=? WHERE id=?",
        (body.get("notu"), float(body.get("tutar") or 0), loaner_id)
    )
    await db.commit()
    return {"ok": True}


@router.put("/{loaner_id}/iade")
async def iade_loaner(
    loaner_id: int,
    body: dict = None,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    iade_tarihi = (body or {}).get("iade_tarihi", date.today().isoformat())
    await db.execute(
        "UPDATE loaner_cihazlar SET aktif = 0, iade_tarihi = ? WHERE id = ?",
        (iade_tarihi, loaner_id),
    )
    await db.commit()
    return {"ok": True}


@router.get("/{loaner_id}/fotolar")
async def get_fotolar(
    loaner_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT id, aciklama, created_at FROM loaner_fotograflari WHERE loaner_id=? ORDER BY created_at",
        (loaner_id,),
    )
    rows = [dict(r) for r in await cur.fetchall()]
    result = []
    for r in rows:
        cur2 = await db.execute("SELECT foto FROM loaner_fotograflari WHERE id=?", (r["id"],))
        frow = await cur2.fetchone()
        result.append({**r, "foto": frow["foto"] if frow else ""})
    return result


@router.post("/{loaner_id}/fotolar")
async def add_foto(
    loaner_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    foto = body.get("foto", "")
    if not foto:
        raise HTTPException(400, "Fotoğraf verisi gerekli")
    await db.execute(
        "INSERT INTO loaner_fotograflari (loaner_id, foto, aciklama) VALUES (?, ?, ?)",
        (loaner_id, foto, body.get("aciklama")),
    )
    await db.commit()
    return {"ok": True}
