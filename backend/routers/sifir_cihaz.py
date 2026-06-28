from fastapi import APIRouter, Depends, HTTPException, Query
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date

router = APIRouter(prefix="/sifir-cihaz", tags=["sifir-cihaz"])


@router.get("/imei-tam/{imei}")
async def imei_tam_gecmis(
    imei: str,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT * FROM sifir_cihazlar WHERE imei = ? ORDER BY created_at ASC",
        (imei,)
    )
    return [dict(r) for r in await cur.fetchall()]


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
    kimden = body.get("kimden") or ""
    kimden_telefon = body.get("kimden_telefon") or ""
    cur = await db.execute(
        """INSERT INTO sifir_cihazlar
           (model, imei, renk, depolama, kimden, kimden_telefon, kaynak, alis_fiyati, notlar, alis_tarihi)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (body["model"], body.get("imei"), body.get("renk"), body.get("depolama"),
         kimden, kimden_telefon, body.get("kaynak", "dukkan"),
         float(body["alis_fiyati"]), body.get("notlar"),
         body.get("alis_tarihi", date.today().isoformat())),
    )
    # Satıcıyı müşteri olarak kaydet
    if kimden and kimden_telefon:
        cur2 = await db.execute(
            "SELECT id FROM customers WHERE name = ? OR phone = ?",
            (kimden, kimden_telefon)
        )
        if not await cur2.fetchone():
            await db.execute(
                "INSERT INTO customers (name, phone) VALUES (?, ?)",
                (kimden, kimden_telefon)
            )
    await db.commit()
    return {"id": cur.lastrowid}


@router.delete("/{cihaz_id}")
async def delete_cihaz(
    cihaz_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if user["role"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    await db.execute("DELETE FROM sifir_cihazlar WHERE id = ?", (cihaz_id,))
    await db.commit()
    return {"ok": True}


@router.post("/{cihaz_id}/sat")
async def sat_cihaz(
    cihaz_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT * FROM sifir_cihazlar WHERE id = ?", (cihaz_id,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Cihaz bulunamadi")
    cihaz = dict(row)
    satis_fiyati = float(body["satis_fiyati"])
    satis_tarihi = body.get("satis_tarihi", date.today().isoformat())
    musteri_adi = body.get("musteri_adi") or ""
    musteri_telefon = body.get("musteri_telefon") or ""
    odeme = body.get("odeme_yontemi", "nakit")
    taksit_sayi = int(body.get("taksit_sayi") or 1)
    pesinat = float(body.get("pesinat") or 0)

    await db.execute(
        """UPDATE sifir_cihazlar SET durum='satildi', satis_fiyati=?, satis_kanali=?,
           satis_tarihi=?, musteri_adi=?, musteri_telefon=?, odeme_yontemi=?
           WHERE id=?""",
        (satis_fiyati, body.get("satis_kanali", "Dükkan"),
         satis_tarihi, musteri_adi, musteri_telefon, odeme, cihaz_id),
    )

    # Müşteri bul veya oluştur
    customer_id = None
    if musteri_adi:
        lookup = [musteri_adi]
        sql = "SELECT id FROM customers WHERE name = ?"
        if musteri_telefon:
            sql += " OR phone = ?"
            lookup.append(musteri_telefon)
        cur2 = await db.execute(sql, lookup)
        row2 = await cur2.fetchone()
        if row2:
            customer_id = row2["id"]
        else:
            ins = await db.execute(
                "INSERT INTO customers (name, phone) VALUES (?, ?)",
                (musteri_adi, musteri_telefon or None)
            )
            customer_id = ins.lastrowid

    aciklama = f"Sıfır Satış: {cihaz.get('model', '')} → {musteri_adi}".strip(" →")

    if odeme == "taksit":
        if pesinat > 0:
            await db.execute(
                """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
                   VALUES (?, 'gelir', 'nakit', ?, ?, 'sifir_satis')""",
                (satis_tarihi, pesinat, aciklama + " (peşinat)"),
            )
        kalan = satis_fiyati - pesinat
        if kalan > 0 and customer_id:
            await db.execute(
                """INSERT INTO debts
                   (customer_id, borc_turu, source_type, amount, total_amount,
                    payment_type, installment_count, notes, created_by)
                   VALUES (?, 'alacak', 'sifir_taksit', ?, ?, 'taksit', ?, ?, ?)""",
                (customer_id, kalan, kalan, taksit_sayi,
                 aciklama, user["id"]),
            )
    else:
        await db.execute(
            """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
               VALUES (?, 'gelir', ?, ?, ?, 'sifir_satis')""",
            (satis_tarihi, odeme, satis_fiyati, aciklama),
        )

    await db.commit()
    return {"ok": True}
