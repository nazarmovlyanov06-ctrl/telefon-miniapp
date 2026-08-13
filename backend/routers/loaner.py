import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import get_current_user, get_dukkan_id
from photo_storage import save_photo
from datetime import date

router = APIRouter(prefix="/loaner", tags=["loaner"])


@router.get("/")
async def list_loaner(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM loaner_cihazlar WHERE dukkan_id = $1 AND aktif = true ORDER BY teslim_tarihi DESC",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/")
async def create_loaner(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """INSERT INTO loaner_cihazlar (dukkan_id, musteri_adi, cihaz, teslim_tarihi, notlar, aktif)
           VALUES ($1, $2, $3, $4, $5, true) RETURNING id""",
        dukkan_id, body["musteri_adi"], body["cihaz"],
        body.get("teslim_tarihi", date.today().isoformat()), body.get("notlar"),
    )
    return {"id": row["id"]}


@router.get("/gecmis")
async def list_gecmis(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM loaner_cihazlar WHERE dukkan_id = $1 AND aktif = false ORDER BY iade_tarihi DESC LIMIT 50",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/{loaner_id}/hasar")
async def hasar_ekle(
    loaner_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE loaner_cihazlar SET hasar_notu=$1, hasar_tutar=$2 WHERE id=$3 AND dukkan_id=$4",
        body.get("notu"), float(body.get("tutar") or 0), loaner_id, dukkan_id,
    )
    return {"ok": True}


@router.put("/{loaner_id}/iade")
async def iade_loaner(
    loaner_id: int,
    body: dict = None,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    iade_tarihi = (body or {}).get("iade_tarihi", date.today().isoformat())
    await db.execute(
        "UPDATE loaner_cihazlar SET aktif = false, iade_tarihi = $1 WHERE id = $2 AND dukkan_id = $3",
        iade_tarihi, loaner_id, dukkan_id,
    )
    return {"ok": True}


@router.get("/{loaner_id}/fotolar")
async def get_fotolar(
    loaner_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT id, foto, aciklama, created_at FROM loaner_fotograflari WHERE loaner_id=$1 AND dukkan_id=$2 ORDER BY created_at",
        loaner_id, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/{loaner_id}/fotolar")
async def add_foto(
    loaner_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    foto = body.get("foto", "")
    if not foto:
        raise HTTPException(400, "Fotoğraf verisi gerekli")
    try:
        foto_path = save_photo(foto, "loaner", loaner_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute(
        "INSERT INTO loaner_fotograflari (dukkan_id, loaner_id, foto, aciklama) VALUES ($1, $2, $3, $4)",
        dukkan_id, loaner_id, foto_path, body.get("aciklama"),
    )
    return {"ok": True}
