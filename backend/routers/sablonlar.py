import asyncpg
from fastapi import APIRouter, Depends
from database import get_db
from auth import get_current_user, get_dukkan_id

router = APIRouter(prefix="/sablonlar", tags=["sablonlar"])


@router.get("/")
async def list_sablonlar(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM tamir_sablonlar WHERE dukkan_id=$1 ORDER BY kullanim_sayisi DESC, ad ASC", dukkan_id
    )
    return [dict(r) for r in rows]


@router.post("/")
async def create_sablon(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """INSERT INTO tamir_sablonlar (dukkan_id, ad, cihaz_model, ariza, tahmini_ucret, notlar)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id""",
        dukkan_id, body["ad"], body.get("cihaz_model"), body.get("ariza"), body.get("tahmini_ucret"), body.get("notlar"),
    )
    return {"id": row["id"]}


@router.put("/{sablon_id}")
async def update_sablon(
    sablon_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        """UPDATE tamir_sablonlar SET ad=$1, cihaz_model=$2, ariza=$3, tahmini_ucret=$4, notlar=$5
           WHERE id=$6 AND dukkan_id=$7""",
        body["ad"], body.get("cihaz_model"), body.get("ariza"), body.get("tahmini_ucret"), body.get("notlar"),
        sablon_id, dukkan_id,
    )
    return {"ok": True}


@router.delete("/{sablon_id}")
async def delete_sablon(
    sablon_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute("DELETE FROM tamir_sablonlar WHERE id=$1 AND dukkan_id=$2", sablon_id, dukkan_id)
    return {"ok": True}


@router.post("/{sablon_id}/kullan")
async def sablon_kullan(
    sablon_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE tamir_sablonlar SET kullanim_sayisi = kullanim_sayisi + 1 WHERE id=$1 AND dukkan_id=$2",
        sablon_id, dukkan_id,
    )
    return {"ok": True}
