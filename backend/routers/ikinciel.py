from fastapi import APIRouter, Depends, HTTPException, Query
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date

router = APIRouter(prefix="/ikinciel", tags=["ikinciel"])


@router.get("/imei-tam/{imei}")
async def imei_tam_gecmis(
    imei: str,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT c.*,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m
                            WHERE m.cihaz_id = c.id), 0) as toplam_masraf
           FROM ikinci_el c
           WHERE c.imei = ?
           ORDER BY c.created_at ASC""",
        (imei,)
    )
    rows = [dict(r) for r in await cur.fetchall()]
    for r in rows:
        cur2 = await db.execute(
            "SELECT * FROM ikinci_el_masraflar WHERE cihaz_id=? ORDER BY tarih",
            (r["id"],)
        )
        r["masraflar"] = [dict(m) for m in await cur2.fetchall()]
    return rows


@router.get("/imei-gecmis/{son4}")
async def imei_gecmis(
    son4: str,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT c.*,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m
                            WHERE m.cihaz_id = c.id), 0) as toplam_masraf
           FROM ikinci_el c
           WHERE c.imei LIKE ? AND c.imei IS NOT NULL AND c.imei != ''
           ORDER BY c.created_at ASC""",
        (f"%{son4}",)
    )
    rows = [dict(r) for r in await cur.fetchall()]
    for r in rows:
        cur2 = await db.execute(
            "SELECT * FROM ikinci_el_masraflar WHERE cihaz_id=? ORDER BY tarih",
            (r["id"],)
        )
        r["masraflar"] = [dict(m) for m in await cur2.fetchall()]
    return rows


@router.get("/listesi")
async def list_stok(
    kaynak: str = Query(None),
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    where = ["c.durum = 'stokta'"]
    params = []
    if kaynak:
        where.append("COALESCE(c.kaynak, 'dukkan') = ?")
        params.append(kaynak)
    cur = await db.execute(
        f"""SELECT c.*,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m
                            WHERE m.cihaz_id = c.id), 0) as toplam_masraf
           FROM ikinci_el c
           WHERE {' AND '.join(where)}
           ORDER BY c.created_at DESC""",
        params
    )
    rows = [dict(r) for r in await cur.fetchall()]
    for r in rows:
        cur2 = await db.execute(
            "SELECT * FROM ikinci_el_masraflar WHERE cihaz_id=? ORDER BY tarih",
            (r["id"],)
        )
        r["masraflar"] = [dict(m) for m in await cur2.fetchall()]
    return rows


@router.get("/satilanlar")
async def list_satilanlar(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT c.*,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m
                            WHERE m.cihaz_id = c.id), 0) as toplam_masraf
           FROM ikinci_el c
           WHERE c.durum = 'satildi'
           ORDER BY c.satis_tarihi DESC"""
    )
    rows = [dict(r) for r in await cur.fetchall()]
    for r in rows:
        cur2 = await db.execute(
            "SELECT * FROM ikinci_el_masraflar WHERE cihaz_id=? ORDER BY tarih",
            (r["id"],)
        )
        r["masraflar"] = [dict(m) for m in await cur2.fetchall()]
    return rows


@router.get("/{cihaz_id}/masraflar")
async def get_masraflar(
    cihaz_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT * FROM ikinci_el_masraflar WHERE cihaz_id=? ORDER BY tarih",
        (cihaz_id,)
    )
    return [dict(r) for r in await cur.fetchall()]


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
        """INSERT INTO ikinci_el
           (model, imei, renk, depolama, ram, ozellikler,
            kimden, kimden_telefon, alis_fiyati, notlar, durum, kaynak)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'stokta', ?)""",
        (body["model"], body.get("imei"), body.get("renk"), body.get("depolama"),
         body.get("ram"), body.get("ozellikler"),
         kimden, kimden_telefon,
         float(body["alis_fiyati"]), body.get("notlar"),
         body.get("kaynak", "dukkan")),
    )
    # Alıcıyı müşteri olarak kaydet
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
    await db.execute("DELETE FROM ikinci_el_masraflar WHERE cihaz_id = ?", (cihaz_id,))
    await db.execute("DELETE FROM ikinci_el WHERE id = ?", (cihaz_id,))
    await db.commit()
    return {"ok": True}


@router.post("/{cihaz_id}/masraf")
async def add_masraf(
    cihaz_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "INSERT INTO ikinci_el_masraflar (cihaz_id, aciklama, tutar, tarih) VALUES (?, ?, ?, ?)",
        (cihaz_id, body["aciklama"], float(body["tutar"]),
         body.get("tarih", date.today().isoformat())),
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
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT * FROM ikinci_el WHERE id = ?", (cihaz_id,))
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
        """UPDATE ikinci_el SET durum='satildi', satis_fiyati=?, satis_kanali=?,
           satis_tarihi=?, musteri_adi=?, musteri_telefon=? WHERE id=?""",
        (satis_fiyati, body.get("satis_kanali", "Dükkan"),
         satis_tarihi, musteri_adi, musteri_telefon, cihaz_id),
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

    aciklama = f"2.El Satış: {cihaz.get('model', '')} → {musteri_adi}".strip(" →")

    if odeme == "taksit":
        # Peşinat varsa kasaya yaz
        if pesinat > 0:
            await db.execute(
                """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
                   VALUES (?, 'gelir', 'nakit', ?, ?, '2el_satis')""",
                (satis_tarihi, pesinat, aciklama + f" (peşinat)"),
            )
        # Kalan tutar → borç kaydı
        kalan = satis_fiyati - pesinat
        if kalan > 0 and customer_id:
            await db.execute(
                """INSERT INTO debts
                   (customer_id, borc_turu, source_type, amount, total_amount,
                    payment_type, installment_count, notes, created_by)
                   VALUES (?, 'alacak', '2el_taksit', ?, ?, 'taksit', ?, ?, ?)""",
                (customer_id, kalan, kalan, taksit_sayi,
                 aciklama, user["id"]),
            )
    else:
        # Nakit / kart — tamamı kasaya
        await db.execute(
            """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
               VALUES (?, 'gelir', ?, ?, ?, '2el_satis')""",
            (satis_tarihi, odeme, satis_fiyati, aciklama),
        )

    await db.commit()
    return {"ok": True}


@router.get("/ozet")
async def ozet(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT c.id, c.model, c.alis_fiyati, c.satis_fiyati, c.durum,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m
                            WHERE m.cihaz_id = c.id), 0) as toplam_masraf
           FROM ikinci_el c"""
    )
    rows = [dict(r) for r in await cur.fetchall()]
    toplam_alis = toplam_masraf = toplam_satis = kar = 0.0
    stokta = satildi = 0
    for r in rows:
        toplam_alis += r["alis_fiyati"] or 0
        toplam_masraf += r["toplam_masraf"] or 0
        if r["durum"] == "satildi":
            satildi += 1
            satis = r["satis_fiyati"] or 0
            toplam_satis += satis
            kar += satis - (r["alis_fiyati"] or 0) - (r["toplam_masraf"] or 0)
        else:
            stokta += 1
    return {
        "stokta_adet": stokta,
        "satilan_adet": satildi,
        "toplam_alis": toplam_alis,
        "toplam_masraf": toplam_masraf,
        "toplam_satis": toplam_satis,
        "net_kar": kar,
    }
