import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import get_current_user, get_dukkan_id
from datetime import date

router = APIRouter(prefix="/aksesuarlar", tags=["aksesuar"])


@router.get("/")
async def list_aksesuar(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch("SELECT * FROM aksesuarlar WHERE dukkan_id = $1 ORDER BY ad ASC", dukkan_id)
    return [dict(r) for r in rows]


@router.post("/")
async def create_aksesuar(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "INSERT INTO aksesuarlar (dukkan_id, ad, stok, alis_fiyati, satis_fiyati, kategori) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        dukkan_id, body["ad"], int(body.get("stok", 0)), float(body["alis_fiyati"]), float(body["satis_fiyati"]),
        body.get("kategori", "Diğer"),
    )
    return {"id": row["id"]}


@router.put("/{aksesuar_id}")
async def update_aksesuar(
    aksesuar_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE aksesuarlar SET ad=$1, stok=$2, alis_fiyati=$3, satis_fiyati=$4, kategori=$5 WHERE id=$6 AND dukkan_id=$7",
        body.get("ad"), int(body.get("stok", 0)), float(body.get("alis_fiyati", 0)),
        float(body.get("satis_fiyati", 0)), body.get("kategori", "Diğer"), aksesuar_id, dukkan_id,
    )
    return {"ok": True}


@router.delete("/{aksesuar_id}")
async def delete_aksesuar(
    aksesuar_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    await db.execute("DELETE FROM aksesuarlar WHERE id = $1 AND dukkan_id = $2", aksesuar_id, dukkan_id)
    return {"ok": True}


@router.post("/{aksesuar_id}/sat")
async def sat_aksesuar(
    aksesuar_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    aks = await db.fetchrow("SELECT * FROM aksesuarlar WHERE id = $1 AND dukkan_id = $2", aksesuar_id, dukkan_id)
    if not aks:
        raise HTTPException(404, "Aksesuar bulunamadi")
    aks = dict(aks)
    miktar = int(body.get("miktar", 1))
    if aks["stok"] < miktar:
        raise HTTPException(400, "Yetersiz stok")
    toplam = body.get("toplam") or (miktar * aks["satis_fiyati"])
    tarih = body.get("tarih", date.today().isoformat())
    async with db.transaction():
        await db.execute(
            "UPDATE aksesuarlar SET stok = stok - $1 WHERE id = $2 AND dukkan_id = $3", miktar, aksesuar_id, dukkan_id
        )
        row = await db.fetchrow(
            """INSERT INTO aksesuar_satislar (dukkan_id, aksesuar_id, miktar, toplam, musteri_adi, tarih)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id""",
            dukkan_id, aksesuar_id, miktar, toplam, body.get("musteri_adi"), tarih,
        )
        await db.execute(
            """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
               VALUES ($1, $2, 'giris', $3, $4, $5, 'aksesuar')""",
            dukkan_id, tarih, body.get("odeme_yontemi", "nakit"), toplam, f"Aksesuar: {aks['ad']} x{miktar}",
        )
    return {"id": row["id"], "toplam": toplam}
