import asyncpg
from fastapi import APIRouter, Depends
from database import get_db
from auth import get_current_user, get_dukkan_id
from datetime import date

router = APIRouter(prefix="/giderler", tags=["gider"])


@router.get("/")
async def list_giderler(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    bugun = date.today()
    ay_basi = bugun.replace(day=1).isoformat()
    rows = await db.fetch(
        "SELECT * FROM giderler WHERE dukkan_id = $1 AND tarih >= $2 ORDER BY tarih DESC, id DESC",
        dukkan_id, ay_basi,
    )
    rows = [dict(r) for r in rows]
    toplam = sum(r["tutar"] for r in rows)
    return {"toplam": toplam, "giderler": rows}


@router.post("/")
async def create_gider(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    tarih = body.get("tarih", date.today().isoformat())
    async with db.transaction():
        row = await db.fetchrow(
            "INSERT INTO giderler (dukkan_id, kategori, tutar, aciklama, tarih) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            dukkan_id, body["kategori"], float(body["tutar"]), body.get("aciklama"), tarih,
        )
        await db.execute(
            """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
               VALUES ($1, $2, 'cikis', $3, $4, $5, 'gider')""",
            dukkan_id, tarih, body.get("odeme_yontemi", "nakit"), float(body["tutar"]),
            f"{body['kategori']}: {body.get('aciklama', '')}".strip(),
        )
    return {"id": row["id"]}


@router.delete("/{gider_id}")
async def delete_gider(
    gider_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute("DELETE FROM giderler WHERE id = $1 AND dukkan_id = $2", gider_id, dukkan_id)
    return {"ok": True}
