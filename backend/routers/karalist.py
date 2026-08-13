import asyncpg
from fastapi import APIRouter, Depends, Query
from database import get_db
from auth import get_current_user, get_dukkan_id

router = APIRouter(prefix="/kara-liste", tags=["kara-liste"])


@router.get("/")
async def list_kara(
    q: str = Query(None),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if q:
        like = f"%{q}%"
        rows = await db.fetch(
            "SELECT * FROM kara_liste WHERE dukkan_id=$1 AND (ad ILIKE $2 OR telefon ILIKE $2 OR imei ILIKE $2) ORDER BY created_at DESC",
            dukkan_id, like,
        )
    else:
        rows = await db.fetch("SELECT * FROM kara_liste WHERE dukkan_id=$1 ORDER BY created_at DESC", dukkan_id)
    return [dict(r) for r in rows]


@router.post("/")
async def add_kara(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "INSERT INTO kara_liste (dukkan_id, ad, telefon, imei, sebep, notlar) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        dukkan_id, body.get("ad"), body.get("telefon"), body.get("imei"), body["sebep"], body.get("notlar"),
    )
    return {"id": row["id"]}


@router.delete("/{kara_id}")
async def delete_kara(
    kara_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute("DELETE FROM kara_liste WHERE id = $1 AND dukkan_id = $2", kara_id, dukkan_id)
    return {"ok": True}
