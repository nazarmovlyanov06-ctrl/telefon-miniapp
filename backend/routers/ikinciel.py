import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db
from auth import get_current_user, get_dukkan_id
from datetime import date

router = APIRouter(prefix="/ikinciel", tags=["ikinciel"])


async def _with_masraflar(db: asyncpg.Connection, dukkan_id: int, rows: list) -> list:
    out = [dict(r) for r in rows]
    for r in out:
        m = await db.fetch(
            "SELECT * FROM ikinci_el_masraflar WHERE cihaz_id=$1 AND dukkan_id=$2 ORDER BY tarih",
            r["id"], dukkan_id,
        )
        r["masraflar"] = [dict(x) for x in m]
    return out


@router.get("/imei-tam/{imei}")
async def imei_tam_gecmis(
    imei: str,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT c.*,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m
                            WHERE m.cihaz_id = c.id), 0) as toplam_masraf
           FROM ikinci_el c
           WHERE c.imei = $1 AND c.dukkan_id = $2
           ORDER BY c.created_at ASC""",
        imei, dukkan_id,
    )
    return await _with_masraflar(db, dukkan_id, rows)


@router.get("/imei-gecmis/{son4}")
async def imei_gecmis(
    son4: str,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT c.*,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m
                            WHERE m.cihaz_id = c.id), 0) as toplam_masraf
           FROM ikinci_el c
           WHERE c.dukkan_id = $1 AND c.imei LIKE $2 AND c.imei IS NOT NULL AND c.imei != ''
           ORDER BY c.created_at ASC""",
        dukkan_id, f"%{son4}",
    )
    return await _with_masraflar(db, dukkan_id, rows)


@router.get("/listesi")
async def list_stok(
    kaynak: str = Query(None),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    where = ["c.dukkan_id = $1", "c.durum = 'stokta'"]
    params = [dukkan_id]
    if kaynak:
        params.append(kaynak)
        where.append(f"COALESCE(c.kaynak, 'dukkan') = ${len(params)}")
    rows = await db.fetch(
        f"""SELECT c.*,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m
                            WHERE m.cihaz_id = c.id), 0) as toplam_masraf
           FROM ikinci_el c
           WHERE {' AND '.join(where)}
           ORDER BY c.created_at DESC""",
        *params,
    )
    return await _with_masraflar(db, dukkan_id, rows)


@router.get("/satilanlar")
async def list_satilanlar(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT c.*,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m
                            WHERE m.cihaz_id = c.id), 0) as toplam_masraf
           FROM ikinci_el c
           WHERE c.dukkan_id = $1 AND c.durum = 'satildi'
           ORDER BY c.satis_tarihi DESC""",
        dukkan_id,
    )
    return await _with_masraflar(db, dukkan_id, rows)


@router.get("/{cihaz_id}/masraflar")
async def get_masraflar(
    cihaz_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM ikinci_el_masraflar WHERE cihaz_id=$1 AND dukkan_id=$2 ORDER BY tarih",
        cihaz_id, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/")
async def create_cihaz(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    kimden = body.get("kimden") or ""
    kimden_telefon = body.get("kimden_telefon") or ""
    async with db.transaction():
        row = await db.fetchrow(
            """INSERT INTO ikinci_el
               (dukkan_id, model, imei, renk, depolama, ram, ozellikler,
                kimden, kimden_telefon, alis_fiyati, notlar, durum, kaynak)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'stokta', $12)
               RETURNING id""",
            dukkan_id, body["model"], body.get("imei"), body.get("renk"), body.get("depolama"),
            body.get("ram"), body.get("ozellikler"),
            kimden, kimden_telefon,
            float(body["alis_fiyati"]), body.get("notlar"),
            body.get("kaynak", "dukkan"),
        )
        if kimden and kimden_telefon:
            existing = await db.fetchrow(
                "SELECT id FROM customers WHERE dukkan_id=$1 AND (name = $2 OR phone = $3)",
                dukkan_id, kimden, kimden_telefon,
            )
            if not existing:
                await db.execute(
                    "INSERT INTO customers (dukkan_id, name, phone) VALUES ($1, $2, $3)",
                    dukkan_id, kimden, kimden_telefon,
                )
    return {"id": row["id"]}


@router.delete("/{cihaz_id}")
async def delete_cihaz(
    cihaz_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    async with db.transaction():
        await db.execute("DELETE FROM ikinci_el_masraflar WHERE cihaz_id = $1 AND dukkan_id = $2", cihaz_id, dukkan_id)
        await db.execute("DELETE FROM ikinci_el WHERE id = $1 AND dukkan_id = $2", cihaz_id, dukkan_id)
    return {"ok": True}


@router.post("/{cihaz_id}/masraf")
async def add_masraf(
    cihaz_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "INSERT INTO ikinci_el_masraflar (dukkan_id, cihaz_id, aciklama, tutar, tarih) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        dukkan_id, cihaz_id, body["aciklama"], float(body["tutar"]),
        body.get("tarih", date.today().isoformat()),
    )
    return {"id": row["id"]}


@router.post("/{cihaz_id}/sat")
async def sat_cihaz(
    cihaz_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    cihaz_row = await db.fetchrow("SELECT * FROM ikinci_el WHERE id = $1 AND dukkan_id = $2", cihaz_id, dukkan_id)
    if not cihaz_row:
        raise HTTPException(404, "Cihaz bulunamadi")
    cihaz = dict(cihaz_row)
    satis_fiyati = float(body["satis_fiyati"])
    satis_tarihi = body.get("satis_tarihi", date.today().isoformat())

    musteri_adi = body.get("musteri_adi") or ""
    musteri_telefon = body.get("musteri_telefon") or ""
    odeme = body.get("odeme_yontemi", "nakit")
    taksit_sayi = int(body.get("taksit_sayi") or 1)
    pesinat = float(body.get("pesinat") or 0)

    async with db.transaction():
        await db.execute(
            """UPDATE ikinci_el SET durum='satildi', satis_fiyati=$1, satis_kanali=$2,
               satis_tarihi=$3, musteri_adi=$4, musteri_telefon=$5 WHERE id=$6 AND dukkan_id=$7""",
            satis_fiyati, body.get("satis_kanali", "Dükkan"),
            satis_tarihi, musteri_adi, musteri_telefon, cihaz_id, dukkan_id,
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

        aciklama = f"2.El Satış: {cihaz.get('model', '')} → {musteri_adi}".strip(" →")

        if odeme == "taksit":
            if pesinat > 0:
                await db.execute(
                    """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
                       VALUES ($1, $2, 'gelir', 'nakit', $3, $4, '2el_satis')""",
                    dukkan_id, satis_tarihi, pesinat, aciklama + " (peşinat)",
                )
            kalan = satis_fiyati - pesinat
            if kalan > 0 and customer_id:
                await db.execute(
                    """INSERT INTO debts
                       (dukkan_id, customer_id, borc_turu, source_type, amount, total_amount,
                        payment_type, installment_count, notes, created_by)
                       VALUES ($1, $2, 'alacak', '2el_taksit', $3, $4, 'taksit', $5, $6, $7)""",
                    dukkan_id, customer_id, kalan, kalan, taksit_sayi, aciklama, user["id"],
                )
        else:
            await db.execute(
                """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
                   VALUES ($1, $2, 'gelir', $3, $4, $5, '2el_satis')""",
                dukkan_id, satis_tarihi, odeme, satis_fiyati, aciklama,
            )
    return {"ok": True}


@router.get("/ozet")
async def ozet(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT c.id, c.model, c.alis_fiyati, c.satis_fiyati, c.durum,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m
                            WHERE m.cihaz_id = c.id), 0) as toplam_masraf
           FROM ikinci_el c WHERE c.dukkan_id = $1""",
        dukkan_id,
    )
    rows = [dict(r) for r in rows]
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
