import asyncpg
from fastapi import APIRouter, Depends
from database import get_db
from auth import get_current_user, get_dukkan_id
from datetime import date

router = APIRouter(prefix="/toptanci", tags=["toptanci"])


@router.get("/")
async def list_toptanci(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch("SELECT * FROM toptancilar WHERE dukkan_id = $1 ORDER BY ad ASC", dukkan_id)
    return [dict(r) for r in rows]


@router.post("/")
async def create_toptanci(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "INSERT INTO toptancilar (dukkan_id, ad, telefon, sehir, notlar) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        dukkan_id, body["ad"], body.get("telefon"), body.get("sehir"), body.get("notlar"),
    )
    return {"id": row["id"]}


@router.put("/{toptanci_id}")
async def update_toptanci(
    toptanci_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE toptancilar SET ad=$1, telefon=$2, sehir=$3, notlar=$4 WHERE id=$5 AND dukkan_id=$6",
        body.get("ad"), body.get("telefon"), body.get("sehir"), body.get("notlar"), toptanci_id, dukkan_id,
    )
    return {"ok": True}


@router.delete("/{toptanci_id}")
async def delete_toptanci(
    toptanci_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute("DELETE FROM toptancilar WHERE id = $1 AND dukkan_id = $2", toptanci_id, dukkan_id)
    return {"ok": True}


@router.get("/{toptanci_id}/alislar")
async def list_alislar(
    toptanci_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM toptanci_alislar WHERE toptanci_id = $1 AND dukkan_id = $2 ORDER BY tarih DESC, id DESC",
        toptanci_id, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/{toptanci_id}/alislar")
async def create_alis(
    toptanci_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    miktar = int(body.get("miktar", 1))
    birim = float(body["birim_fiyat"])
    toplam = body.get("toplam") or (miktar * birim)
    row = await db.fetchrow(
        """INSERT INTO toptanci_alislar
           (dukkan_id, toptanci_id, urun, miktar, birim_fiyat, toplam, tarih, notlar)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id""",
        dukkan_id, toptanci_id, body["urun"], miktar, birim, toplam,
        body.get("tarih", date.today().isoformat()), body.get("notlar"),
    )
    return {"id": row["id"], "toplam": toplam}
