from fastapi import APIRouter, Depends, HTTPException, Query
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date

router = APIRouter(prefix="/sifir-cihaz", tags=["sifir-cihaz"])


@router.get("/listesi")
async def list_stok(
    kaynak: str = Query(None),
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    where = ["durum = 'stokta'"]
    params = []
    if kaynak:
        where.append("COALESCE(kaynak, 'dukkan') = ?")
        params.append(kaynak)
    cur = await db.execute(
        f"SELECT * FROM sifir_cihazlar WHERE {' AND '.join(where)} ORDER BY created_at DESC",
        params
    )
    return [dict(r) for r in await cur.fetchall()]


@router.get("/satilanlar")
async def list_satilanlar(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT * FROM sifir_cihazlar WHERE durum = 'satildi' ORDER BY satis_tarihi DESC"
    )
    return [dict(r) for r in await cur.fetchall()]


@router.get("/ozet")
async def ozet(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT * FROM sifir_cihazlar")
    rows = [dict(r) for r in await cur.fetchall()]
    stokta = satildi = 0
    kar = 0.0
    for r in rows:
        if r["durum"] == "stokta":
            stokta += 1
        elif r["durum"] == "satildi":
            satildi += 1
            kar += (r["satis_fiyati"] or 0) - (r["alis_fiyati"] or 0)
    return {"stokta_adet": stokta, "satilan_adet": satildi, "net_kar": kar}


@router.post("/")
async def create_cihaz(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """INSERT INTO sifir_cihazlar
           (model, imei, renk, depolama, kimden, kaynak, alis_fiyati, notlar, alis_tarihi)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (body["model"], body.get("imei"), body.get("renk"), body.get("depolama"),
         body.get("kimden"), body.get("kaynak", "dukkan"),
         float(body["alis_fiyati"]), body.get("notlar"),
         body.get("alis_tarihi", date.today().isoformat())),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.post("/{cihaz_id}/sat")
async def sat_cihaz(
    cihaz_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT * FROM sifir_cihazlar WHERE id = ?", (cihaz_id,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Cihaz bulunamadi")
    cihaz = dict(row)
    satis_fiyati = float(body["satis_fiyati"])
    satis_tarihi = body.get("satis_tarihi", date.today().isoformat())
    musteri_adi = body.get("musteri_adi") or ""
    musteri_telefon = body.get("musteri_telefon") or ""

    await db.execute(
        """UPDATE sifir_cihazlar SET durum='satildi', satis_fiyati=?, satis_kanali=?,
           satis_tarihi=?, musteri_adi=?, musteri_telefon=?, odeme_yontemi=?
           WHERE id=?""",
        (satis_fiyati, body.get("satis_kanali", "Dükkan"),
         satis_tarihi, musteri_adi, musteri_telefon,
         body.get("odeme_yontemi", "nakit"), cihaz_id),
    )

    # Kasaya yaz
    await db.execute(
        """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
           VALUES (?, 'gelir', ?, ?, ?, 'sifir_satis')""",
        (satis_tarihi, body.get("odeme_yontemi", "nakit"), satis_fiyati,
         f"Sıfır Satış: {cihaz.get('model', '')} → {musteri_adi}".strip(" →")),
    )

    # Yeni müşteri otomatik kayıt
    if musteri_adi and musteri_telefon:
        cur2 = await db.execute(
            "SELECT id FROM customers WHERE name = ? OR phone = ?",
            (musteri_adi, musteri_telefon)
        )
        existing = await cur2.fetchone()
        if not existing:
            await db.execute(
                "INSERT INTO customers (name, phone) VALUES (?, ?)",
                (musteri_adi, musteri_telefon)
            )

    await db.commit()
    return {"ok": True}
