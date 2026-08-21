import json
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from database import get_db
from auth import get_current_user, get_dukkan_id
from photo_storage import save_upload, save_photo, delete_photo
from odeme_yardimci import kaydet_odeme
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


async def _diger_tablo_eslesmeler(db: asyncpg.Connection, dukkan_id: int, imei_kosulu: str, deger):
    """IMEI geçmişi sadece ikinci_el içinde aranıyordu — aynı IMEI'nin daha
    önce Sıfır Cihaz veya Tamir kaydına da girmiş olması (ör. çalıntı/iade
    cihazın farklı bir modül üzerinden tekrar satılmaya çalışılması) hiç
    görünmüyordu. Bu iki tabloyu da ayrıca kontrol edip özet döndürüyor."""
    sifir = await db.fetch(
        f"SELECT id, model, durum, alis_fiyati, satis_fiyati, created_at FROM sifir_cihazlar WHERE {imei_kosulu} AND dukkan_id = $2 ORDER BY created_at DESC",
        deger, dukkan_id,
    )
    tamir = await db.fetch(
        f"SELECT repair_no, device_model, status, created_at FROM repairs WHERE {imei_kosulu} AND dukkan_id = $2 ORDER BY created_at DESC",
        deger, dukkan_id,
    )
    return {"sifir_cihaz": [dict(r) for r in sifir], "tamir": [dict(r) for r in tamir]}


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
    sonuc = await _with_masraflar(db, dukkan_id, rows)
    diger = await _diger_tablo_eslesmeler(db, dukkan_id, "imei = $1", imei)
    return {"ikinci_el": sonuc, **diger}


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
    sonuc = await _with_masraflar(db, dukkan_id, rows)
    diger = await _diger_tablo_eslesmeler(db, dukkan_id, "imei LIKE $1", f"%{son4}")
    return {"ikinci_el": sonuc, **diger}


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


@router.get("/katalog")
async def katalog(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Müşteriye elde gösterilecek vitrin listesi — alış fiyatı, kimden/imei/
    notlar gibi dükkan-içi bilgiler bilinçli olarak SELECT'e hiç alınmıyor,
    sadece liste_fiyati (varsa) dönüyor; böylece bir ekran görüntüsü ya da
    ağ isteği incelemesiyle bile maliyet asla sızmaz."""
    rows = await db.fetch(
        """SELECT id, model, renk, depolama, ram, gorsel_url, liste_fiyati, kaynak,
                  aksesuarlar, degisen_parca, garanti_var, garanti_aciklama, fatura_var
           FROM ikinci_el WHERE dukkan_id = $1 AND durum = 'stokta'
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
    aksesuarlar = json.dumps(body["aksesuarlar"], ensure_ascii=False) if body.get("aksesuarlar") else None
    liste_fiyati = float(body["liste_fiyati"]) if body.get("liste_fiyati") not in (None, "") else None
    async with db.transaction():
        row = await db.fetchrow(
            """INSERT INTO ikinci_el
               (dukkan_id, model, imei, renk, depolama, ram, ozellikler,
                kimden, kimden_telefon, alis_fiyati, notlar, durum, kaynak, aksesuarlar, liste_fiyati,
                degisen_parca, garanti_var, garanti_aciklama, fatura_var)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'stokta', $12, $13::jsonb, $14, $15, $16, $17, $18)
               RETURNING id""",
            dukkan_id, body["model"], body.get("imei"), body.get("renk"), body.get("depolama"),
            body.get("ram"), body.get("ozellikler"),
            kimden, kimden_telefon,
            float(body["alis_fiyati"]), body.get("notlar"),
            body.get("kaynak", "dukkan"), aksesuarlar, liste_fiyati,
            body.get("degisen_parca") or None, bool(body.get("garanti_var")),
            body.get("garanti_aciklama") or None, bool(body.get("fatura_var")),
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


@router.put("/{cihaz_id}")
async def update_cihaz(
    cihaz_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Aksesuar/Parça'nın aksine 2.El'de düzenleme hiç yoktu — bir yazım
    hatasını (model/renk/depolama) veya alış fiyatını düzeltmek için kaydı
    silip yeniden girmek gerekiyordu, bu da masraf geçmişini ve satış
    bağlantısını kaybettiriyordu. Not: satış/durum bilgisi kasıtlı olarak
    burada değiştirilmiyor — o akış hâlâ /sat üzerinden yürüyor."""
    if not body.get("model") or body.get("alis_fiyati") is None:
        raise HTTPException(400, "Model ve alış fiyatı zorunlu")
    liste_fiyati = float(body["liste_fiyati"]) if body.get("liste_fiyati") not in (None, "") else None
    result = await db.execute(
        """UPDATE ikinci_el SET model=$1, imei=$2, renk=$3, depolama=$4, ram=$5,
           ozellikler=$6, kimden=$7, kimden_telefon=$8, alis_fiyati=$9, notlar=$10, liste_fiyati=$11,
           degisen_parca=$12, garanti_var=$13, garanti_aciklama=$14, fatura_var=$15
           WHERE id=$16 AND dukkan_id=$17""",
        body["model"], body.get("imei"), body.get("renk"), body.get("depolama"),
        body.get("ram"), body.get("ozellikler"), body.get("kimden"), body.get("kimden_telefon"),
        float(body["alis_fiyati"]), body.get("notlar"), liste_fiyati,
        body.get("degisen_parca") or None, bool(body.get("garanti_var")),
        body.get("garanti_aciklama") or None, bool(body.get("fatura_var")),
        cihaz_id, dukkan_id,
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
            """UPDATE ikinci_el SET durum='satildi', satis_fiyati=$1, satis_kanali=$2,
               satis_tarihi=$3, musteri_adi=$4, musteri_telefon=$5, customer_id=$6 WHERE id=$7 AND dukkan_id=$8""",
            satis_fiyati, body.get("satis_kanali", "Dükkan"),
            satis_tarihi, musteri_adi, musteri_telefon, customer_id, cihaz_id, dukkan_id,
        )

        aciklama = f"2.El Satış: {cihaz.get('model', '')} → {musteri_adi}".strip(" →")
        await kaydet_odeme(
            db, dukkan_id, body.get("odemeler"), satis_fiyati, "gelir", "2el_satis", aciklama, user["id"],
            customer_id=customer_id, taksit_sayi=body.get("taksit_sayi") or 1, tarih=satis_tarihi,
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
    # Toplam alış SADECE satılan cihazların maliyeti (alış + masraf) — stoktaki
    # cihazın alış fiyatı da buna dahil edilirse Alış-Satış-Kâr üçlüsü artık
    # birbirini tutmaz (henüz hiç satılmamış bir cihazın maliyeti kâra hiç
    # girmediği halde toplama eklenmiş olurdu).
    toplam_alis = toplam_satis = kar = 0.0
    stokta = satildi = 0
    for r in rows:
        if r["durum"] == "satildi":
            satildi += 1
            satis = r["satis_fiyati"] or 0
            maliyet = (r["alis_fiyati"] or 0) + (r["toplam_masraf"] or 0)
            toplam_satis += satis
            toplam_alis += maliyet
            kar += satis - maliyet
        else:
            stokta += 1
    return {
        "stokta_adet": stokta,
        "satilan_adet": satildi,
        "toplam_alis": toplam_alis,
        "toplam_satis": toplam_satis,
        "net_kar": kar,
    }


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
        "SELECT 1 FROM ikinci_el WHERE id = $1 AND dukkan_id = $2", kayit_id, dukkan_id
    )
    if not var_mi:
        raise HTTPException(404, "Kayit bulunamadi")
    try:
        url, _, _ = await save_upload(dosya, "ikincel", dukkan_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute(
        "UPDATE ikinci_el SET gorsel_url = $1 WHERE id = $2 AND dukkan_id = $3",
        url, kayit_id, dukkan_id,
    )
    return {"url": url}


# ── Ek fotoğraflar (durum/hasar kanıtı) ─────────────────────────────────
# gorsel_url tek bir "vitrin" fotoğrafı — yenisi yüklenince eskisinin üstüne
# yazılıyordu. İkinci el bir cihazın durumunu (çizik, ekran, arka kapak)
# göstermek için tek fotoğraf yetersiz kalıyordu; Tamir/Yedek Telefon'daki
# çoklu-fotoğraf deseni (ayrı tablo) buraya da taşındı — bunlar gorsel_url'i
# DEĞİŞTİRMEZ, ona ek olarak eklenir.

@router.get("/{cihaz_id}/fotograflar")
async def cihaz_fotolar(
    cihaz_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT id, foto, aciklama, created_at FROM ikinci_el_fotograflari WHERE cihaz_id = $1 AND dukkan_id = $2 ORDER BY created_at",
        cihaz_id, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/{cihaz_id}/fotograflar")
async def cihaz_foto_ekle(
    cihaz_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    foto = body.get("foto", "")
    if not foto:
        raise HTTPException(400, "Fotoğraf verisi gerekli")
    try:
        foto_path = save_photo(foto, "ikincielfoto", cihaz_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute(
        "INSERT INTO ikinci_el_fotograflari (dukkan_id, cihaz_id, foto, aciklama) VALUES ($1, $2, $3, $4)",
        dukkan_id, cihaz_id, foto_path, body.get("aciklama"),
    )
    return {"ok": True}


@router.delete("/{cihaz_id}/fotograflar/{foto_id}")
async def cihaz_foto_sil(
    cihaz_id: int,
    foto_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT foto FROM ikinci_el_fotograflari WHERE id = $1 AND cihaz_id = $2 AND dukkan_id = $3",
        foto_id, cihaz_id, dukkan_id,
    )
    await db.execute(
        "DELETE FROM ikinci_el_fotograflari WHERE id = $1 AND cihaz_id = $2 AND dukkan_id = $3",
        foto_id, cihaz_id, dukkan_id,
    )
    if row:
        delete_photo(row["foto"])
    return {"ok": True}
