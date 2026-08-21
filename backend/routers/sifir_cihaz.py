import json
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from database import get_db
from auth import get_current_user, get_dukkan_id
from photo_storage import save_upload
from odeme_yardimci import kaydet_odeme
from datetime import date

router = APIRouter(prefix="/sifir-cihaz", tags=["sifir-cihaz"])


@router.get("/imei-tam/{imei}")
async def imei_tam_gecmis(
    imei: str,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM sifir_cihazlar WHERE imei = $1 AND dukkan_id = $2 ORDER BY created_at ASC",
        imei, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.get("/listesi")
async def list_stok(
    kaynak: str = Query(None),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    where = ["dukkan_id = $1", "durum = 'stokta'"]
    params = [dukkan_id]
    if kaynak:
        params.append(kaynak)
        where.append(f"COALESCE(kaynak, 'dukkan') = ${len(params)}")
    rows = await db.fetch(
        f"SELECT * FROM sifir_cihazlar WHERE {' AND '.join(where)} ORDER BY created_at DESC", *params
    )
    return [dict(r) for r in rows]


@router.get("/katalog")
async def katalog(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Bkz. ikinciel.py'deki katalog uç noktası — aynı gerekçeyle alış
    fiyatı/kimden/imei/notlar SELECT'e hiç alınmıyor."""
    rows = await db.fetch(
        """SELECT id, model, renk, depolama, gorsel_url, liste_fiyati, kaynak, fatura_turu
           FROM sifir_cihazlar WHERE dukkan_id = $1 AND durum = 'stokta'
           ORDER BY liste_fiyati ASC NULLS LAST, created_at DESC""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.get("/satilanlar")
async def list_satilanlar(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM sifir_cihazlar WHERE dukkan_id = $1 AND durum = 'satildi' ORDER BY satis_tarihi DESC",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.get("/ozet")
async def ozet(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch("SELECT * FROM sifir_cihazlar WHERE dukkan_id = $1", dukkan_id)
    rows = [dict(r) for r in rows]
    stokta = satildi = 0
    toplam_alis = toplam_satis = kar = 0.0
    for r in rows:
        if r["durum"] == "stokta":
            stokta += 1
        elif r["durum"] == "satildi":
            satildi += 1
            satis = r["satis_fiyati"] or 0
            alis = r["alis_fiyati"] or 0
            toplam_satis += satis
            toplam_alis += alis
            kar += satis - alis
    return {
        "stokta_adet": stokta, "satilan_adet": satildi,
        "toplam_alis": toplam_alis, "toplam_satis": toplam_satis, "net_kar": kar,
    }


@router.post("/")
async def create_cihaz(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    kimden = body.get("kimden") or ""
    kimden_telefon = body.get("kimden_telefon") or ""
    aksesuarlar = json.dumps(body["aksesuarlar"], ensure_ascii=False) if body.get("aksesuarlar") else None
    liste_fiyati = float(body["liste_fiyati"]) if body.get("liste_fiyati") not in (None, "") else None
    fatura_turu = body.get("fatura_turu") or None
    async with db.transaction():
        row = await db.fetchrow(
            """INSERT INTO sifir_cihazlar
               (dukkan_id, model, imei, renk, depolama, kimden, kimden_telefon, kaynak, alis_fiyati, notlar, alis_tarihi, aksesuarlar, liste_fiyati, fatura_turu)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14) RETURNING id""",
            dukkan_id, body["model"], body.get("imei"), body.get("renk"), body.get("depolama"),
            kimden, kimden_telefon, body.get("kaynak", "dukkan"),
            float(body["alis_fiyati"]), body.get("notlar"),
            body.get("alis_tarihi", date.today().isoformat()), aksesuarlar, liste_fiyati, fatura_turu,
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


@router.put("/{cihaz_id}/katalog-detay")
async def katalog_detay_guncelle(
    cihaz_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Sıfır Cihaz'da henüz genel bir düzenleme formu yok — katalog fiyatını
    ve fatura türünü (MF/AF) zaten stokta olan cihazlar için de girebilsin
    diye bu uç nokta eklendi."""
    liste_fiyati = float(body["liste_fiyati"]) if body.get("liste_fiyati") not in (None, "") else None
    fatura_turu = body.get("fatura_turu") or None
    result = await db.execute(
        "UPDATE sifir_cihazlar SET liste_fiyati=$1, fatura_turu=$2 WHERE id=$3 AND dukkan_id=$4",
        liste_fiyati, fatura_turu, cihaz_id, dukkan_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(404, "Cihaz bulunamadı")
    return {"ok": True}


@router.delete("/{cihaz_id}")
async def delete_cihaz(
    cihaz_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    await db.execute("DELETE FROM sifir_cihazlar WHERE id = $1 AND dukkan_id = $2", cihaz_id, dukkan_id)
    return {"ok": True}


@router.post("/{cihaz_id}/sat")
async def sat_cihaz(
    cihaz_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow("SELECT * FROM sifir_cihazlar WHERE id = $1 AND dukkan_id = $2", cihaz_id, dukkan_id)
    if not row:
        raise HTTPException(404, "Cihaz bulunamadi")
    cihaz = dict(row)
    satis_fiyati = float(body["satis_fiyati"])
    satis_tarihi = body.get("satis_tarihi", date.today().isoformat())
    musteri_adi = body.get("musteri_adi") or ""
    musteri_telefon = body.get("musteri_telefon") or ""
    odeme = body.get("odeme_yontemi", "nakit")  # sadece kayıtta gösterim etiketi

    async with db.transaction():
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

        await db.execute(
            """UPDATE sifir_cihazlar SET durum='satildi', satis_fiyati=$1, satis_kanali=$2,
               satis_tarihi=$3, musteri_adi=$4, musteri_telefon=$5, odeme_yontemi=$6, customer_id=$7
               WHERE id=$8 AND dukkan_id=$9""",
            satis_fiyati, body.get("satis_kanali", "Dükkan"),
            satis_tarihi, musteri_adi, musteri_telefon, odeme, customer_id, cihaz_id, dukkan_id,
        )

        aciklama = f"Sıfır Satış: {cihaz.get('model', '')} → {musteri_adi}".strip(" →")
        await kaydet_odeme(
            db, dukkan_id, body.get("odemeler"), satis_fiyati, "gelir", "sifir_satis", aciklama, user["id"],
            customer_id=customer_id, taksit_sayi=body.get("taksit_sayi") or 1, tarih=satis_tarihi,
        )
    return {"ok": True}


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
        "SELECT 1 FROM sifir_cihazlar WHERE id = $1 AND dukkan_id = $2", kayit_id, dukkan_id
    )
    if not var_mi:
        raise HTTPException(404, "Kayit bulunamadi")
    try:
        url, _, _ = await save_upload(dosya, "sifir", dukkan_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute(
        "UPDATE sifir_cihazlar SET gorsel_url = $1 WHERE id = $2 AND dukkan_id = $3",
        url, kayit_id, dukkan_id,
    )
    return {"url": url}
