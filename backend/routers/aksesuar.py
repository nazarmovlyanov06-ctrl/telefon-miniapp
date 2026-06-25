from fastapi import APIRouter, Depends, HTTPException
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date

router = APIRouter(prefix="/aksesuarlar", tags=["aksesuar"])


@router.get("/")
async def list_aksesuar(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT * FROM aksesuarlar ORDER BY ad ASC")
    return [dict(r) for r in await cur.fetchall()]


@router.post("/")
async def create_aksesuar(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "INSERT INTO aksesuarlar (ad, stok, alis_fiyati, satis_fiyati) VALUES (?, ?, ?, ?)",
        (body["ad"], int(body.get("stok", 0)), float(body["alis_fiyati"]), float(body["satis_fiyati"])),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.put("/{aksesuar_id}")
async def update_aksesuar(
    aksesuar_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute(
        "UPDATE aksesuarlar SET ad=?, stok=?, alis_fiyati=?, satis_fiyati=? WHERE id=?",
        (body.get("ad"), int(body.get("stok", 0)), float(body.get("alis_fiyati", 0)),
         float(body.get("satis_fiyati", 0)), aksesuar_id),
    )
    await db.commit()
    return {"ok": True}


@router.post("/{aksesuar_id}/sat")
async def sat_aksesuar(
    aksesuar_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT * FROM aksesuarlar WHERE id = ?", (aksesuar_id,))
    aks = await cur.fetchone()
    if not aks:
        raise HTTPException(404, "Aksesuar bulunamadi")
    aks = dict(aks)
    miktar = int(body.get("miktar", 1))
    if aks["stok"] < miktar:
        raise HTTPException(400, "Yetersiz stok")
    toplam = body.get("toplam") or (miktar * aks["satis_fiyati"])
    tarih = body.get("tarih", date.today().isoformat())
    await db.execute(
        "UPDATE aksesuarlar SET stok = stok - ? WHERE id = ?", (miktar, aksesuar_id)
    )
    cur = await db.execute(
        """INSERT INTO aksesuar_satislar (aksesuar_id, miktar, toplam, musteri_adi, tarih)
           VALUES (?, ?, ?, ?, ?)""",
        (aksesuar_id, miktar, toplam, body.get("musteri_adi"), tarih),
    )
    await db.execute(
        """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
           VALUES (?, 'giris', ?, ?, ?, 'aksesuar')""",
        (tarih, body.get("odeme_yontemi", "nakit"), toplam, f"Aksesuar: {aks['ad']} x{miktar}"),
    )
    await db.commit()
    return {"id": cur.lastrowid, "toplam": toplam}
