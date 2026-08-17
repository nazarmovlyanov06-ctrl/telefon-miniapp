import asyncpg
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from database import get_db
from auth import get_current_user, get_dukkan_id
from photo_storage import save_upload
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
    musteri_adi = body.get("musteri_adi") or ""
    musteri_telefon = body.get("musteri_telefon") or ""
    async with db.transaction():
        await db.execute(
            "UPDATE aksesuarlar SET stok = stok - $1 WHERE id = $2 AND dukkan_id = $3", miktar, aksesuar_id, dukkan_id
        )

        customer_id = None
        if musteri_adi:
            if musteri_telefon:
                row2 = await db.fetchrow(
                    "SELECT id FROM customers WHERE dukkan_id=$1 AND (name = $2 OR phone = $3)",
                    dukkan_id, musteri_adi, musteri_telefon,
                )
            else:
                row2 = await db.fetchrow(
                    "SELECT id FROM customers WHERE dukkan_id=$1 AND name = $2", dukkan_id, musteri_adi
                )
            if row2:
                customer_id = row2["id"]
            else:
                ins = await db.fetchrow(
                    "INSERT INTO customers (dukkan_id, name, phone) VALUES ($1, $2, $3) RETURNING id",
                    dukkan_id, musteri_adi, musteri_telefon or None,
                )
                customer_id = ins["id"]

        row = await db.fetchrow(
            """INSERT INTO aksesuar_satislar (dukkan_id, aksesuar_id, miktar, toplam, musteri_adi, musteri_telefon, tarih, customer_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id""",
            dukkan_id, aksesuar_id, miktar, toplam, musteri_adi or None, musteri_telefon or None, tarih, customer_id,
        )
        await db.execute(
            """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
               VALUES ($1, $2, 'giris', $3, $4, $5, 'aksesuar')""",
            dukkan_id, tarih, body.get("odeme_yontemi", "nakit"), toplam, f"Aksesuar: {aks['ad']} x{miktar}",
        )
    return {"id": row["id"], "toplam": toplam}


@router.post("/{kayit_id}/gorsel")
async def gorsel_yukle(
    kayit_id: int,
    dosya: UploadFile = File(...),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Vitrinde gosterilecek urun fotografi."""
    var_mi = await db.fetchval(
        "SELECT 1 FROM aksesuarlar WHERE id = $1 AND dukkan_id = $2", kayit_id, dukkan_id
    )
    if not var_mi:
        raise HTTPException(404, "Kayit bulunamadi")
    try:
        url, _, _ = await save_upload(dosya, "aksesuar", dukkan_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute(
        "UPDATE aksesuarlar SET gorsel_url = $1 WHERE id = $2 AND dukkan_id = $3",
        url, kayit_id, dukkan_id,
    )
    return {"url": url}
