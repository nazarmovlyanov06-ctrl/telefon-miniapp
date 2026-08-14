import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import get_current_user, get_dukkan_id

router = APIRouter(prefix="/destek", tags=["destek"])


@router.get("/mesajlarim")
async def mesajlarim(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT id, gonderen_rol, gonderen_ad, mesaj, created_at FROM destek_mesajlari WHERE dukkan_id = $1 ORDER BY id",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/mesajlarim")
async def mesaj_gonder(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    mesaj = (body.get("mesaj") or "").strip()
    if not mesaj:
        raise HTTPException(400, "Mesaj boş olamaz")
    if len(mesaj) > 2000:
        raise HTTPException(400, "Mesaj çok uzun (max 2000 karakter)")
    await db.execute(
        "INSERT INTO destek_mesajlari (dukkan_id, gonderen_rol, gonderen_ad, mesaj, okundu) VALUES ($1, 'dukkan', $2, $3, false)",
        dukkan_id, user.get("ad"), mesaj,
    )
    return {"ok": True}


@router.get("/duyurularim")
async def duyurularim(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT d.id, d.mesaj, d.created_at
           FROM platform_duyuru_alicilari a
           JOIN platform_duyurular d ON d.id = a.duyuru_id
           WHERE a.dukkan_id = $1 AND a.gorundu = false
           ORDER BY d.created_at DESC""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/duyurularim/{duyuru_id}/gorundu")
async def duyuru_gorundu(
    duyuru_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE platform_duyuru_alicilari SET gorundu = true WHERE duyuru_id = $1 AND dukkan_id = $2",
        duyuru_id, dukkan_id,
    )
    return {"ok": True}
