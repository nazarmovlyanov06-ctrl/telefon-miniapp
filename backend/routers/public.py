import asyncpg
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from database import get_db
from photo_storage import save_upload

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/planlar")
async def planlar(db: asyncpg.Connection = Depends(get_db)):
    rows = await db.fetch("SELECT tur, ad, fiyat FROM platform_planlar ORDER BY fiyat")
    return [dict(r) for r in rows]


async def _dukkan_by_slug(db: asyncpg.Connection, slug: str):
    row = await db.fetchrow(
        "SELECT id, ad, slug, telefon, adres, sehir, vitrin_aktif, vitrin_aciklama, calisma_saatleri, hizmetler FROM dukkanlar WHERE slug = $1",
        slug,
    )
    if not row or not row["vitrin_aktif"]:
        raise HTTPException(404, "Dükkan bulunamadı")
    return row


@router.get("/dukkan/{slug}")
async def dukkan_vitrin(slug: str, db: asyncpg.Connection = Depends(get_db)):
    d = await _dukkan_by_slug(db, slug)
    return dict(d)


@router.get("/dukkan/{slug}/tamir-durumu")
async def tamir_durumu(slug: str, q: str, db: asyncpg.Connection = Depends(get_db)):
    """Telefon numarası veya tamir no ile arama — sadece TAM eşleşme, kısmi
    aramaya izin verilmez (başka müşterilerin verisini sızdırmamak için)."""
    d = await _dukkan_by_slug(db, slug)
    q = q.strip()
    if not q:
        raise HTTPException(400, "Arama terimi gerekli")
    rows = await db.fetch(
        """SELECT r.repair_no, r.device_model, r.fault_desc, r.status, r.created_at, r.delivered_at
           FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.dukkan_id = $1 AND (r.repair_no = $2 OR c.phone = $2)
           ORDER BY r.created_at DESC LIMIT 10""",
        d["id"], q,
    )
    return [dict(r) for r in rows]


@router.get("/dukkan/{slug}/cihazlar")
async def satilik_cihazlar(slug: str, db: asyncpg.Connection = Depends(get_db)):
    d = await _dukkan_by_slug(db, slug)
    ikinci_el = await db.fetch(
        """SELECT id, model, renk, depolama, ram, satis_fiyati, 'ikinci_el' AS kaynak
           FROM ikinci_el WHERE dukkan_id = $1 AND durum = 'stokta' ORDER BY created_at DESC""",
        d["id"],
    )
    sifir = await db.fetch(
        """SELECT id, model, renk, depolama, satis_fiyati, 'sifir' AS kaynak
           FROM sifir_cihazlar WHERE dukkan_id = $1 AND durum = 'stokta' ORDER BY created_at DESC""",
        d["id"],
    )
    aksesuar = await db.fetch(
        """SELECT id, ad, kategori, satis_fiyati FROM aksesuarlar
           WHERE dukkan_id = $1 AND stok > 0 ORDER BY kategori, ad""",
        d["id"],
    )
    return {
        "ikinci_el": [dict(r) for r in ikinci_el],
        "sifir": [dict(r) for r in sifir],
        "aksesuar": [dict(r) for r in aksesuar],
    }


@router.post("/dukkan/{slug}/randevu")
async def randevu_talebi(slug: str, body: dict, db: asyncpg.Connection = Depends(get_db)):
    d = await _dukkan_by_slug(db, slug)
    musteri_adi = (body.get("musteri_adi") or "").strip()
    telefon = (body.get("telefon") or "").strip()
    if not musteri_adi or not telefon:
        raise HTTPException(400, "Ad ve telefon gerekli")
    await db.execute(
        """INSERT INTO randevu_talepleri (dukkan_id, musteri_adi, telefon, cihaz_model, aciklama)
           VALUES ($1, $2, $3, $4, $5)""",
        d["id"], musteri_adi, telefon, body.get("cihaz_model"), body.get("aciklama"),
    )
    return {"ok": True}


@router.get("/dukkan/{slug}/garanti-durumu")
async def garanti_durumu(slug: str, q: str, db: asyncpg.Connection = Depends(get_db)):
    """Sadece TAM telefon numarası eşleşmesi — başka müşterinin verisi sızmasın."""
    d = await _dukkan_by_slug(db, slug)
    q = q.strip()
    if not q:
        raise HTTPException(400, "Telefon numarası gerekli")
    rows = await db.fetch(
        """SELECT cihaz, tamir_aciklama, baslangic_tarihi, bitis_tarihi, aktif
           FROM garantiler WHERE dukkan_id = $1 AND telefon = $2
           ORDER BY bitis_tarihi DESC LIMIT 10""",
        d["id"], q,
    )
    return [dict(r) for r in rows]


@router.get("/dukkan/{slug}/fis/{repair_no}")
async def dijital_fis(slug: str, repair_no: str, telefon: str, db: asyncpg.Connection = Depends(get_db)):
    """QR ile açılan dijital fiş — telefon eşleşmesi zorunlu (repair_no tek başına tahmin edilebilir)."""
    d = await _dukkan_by_slug(db, slug)
    row = await db.fetchrow(
        """SELECT r.id, r.repair_no, r.device_model, r.fault_desc, r.status, r.final_price,
                  r.payment_type, r.created_at, r.delivered_at, c.name AS musteri_adi
           FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.dukkan_id = $1 AND r.repair_no = $2 AND c.phone = $3""",
        d["id"], repair_no, telefon.strip(),
    )
    if not row:
        raise HTTPException(404, "Fiş bulunamadı")
    parcalar = await db.fetch(
        """SELECT p.name, rp.quantity, rp.unit_price FROM repair_parts rp
           JOIN parts p ON p.id = rp.part_id WHERE rp.repair_id = $1""",
        row["id"],
    )
    tamir = dict(row)
    tamir.pop("id")
    return {"dukkan_ad": d["ad"], "tamir": tamir, "parcalar": [dict(p) for p in parcalar]}


@router.get("/dukkan/{slug}/fiyat-sorgu")
async def fiyat_sorgu(slug: str, model: str, db: asyncpg.Connection = Depends(get_db)):
    """Geçmiş teslim edilmiş tamirlere göre TAHMİNİ ortalama ücret — kesin fiyat değil."""
    d = await _dukkan_by_slug(db, slug)
    model = model.strip()
    if len(model) < 2:
        raise HTTPException(400, "Model adı gerekli")
    rows = await db.fetch(
        """SELECT fault_desc, final_price FROM repairs
           WHERE dukkan_id = $1 AND status = 'teslim' AND final_price IS NOT NULL
             AND device_model ILIKE $2
           ORDER BY delivered_at DESC LIMIT 20""",
        d["id"], f"%{model}%",
    )
    if not rows:
        return {"adet": 0, "ortalama": None, "ornekler": []}
    fiyatlar = [r["final_price"] for r in rows]
    return {
        "adet": len(fiyatlar),
        "ortalama": round(sum(fiyatlar) / len(fiyatlar)),
        "ornekler": [{"aciklama": r["fault_desc"], "fiyat": r["final_price"]} for r in rows[:5]],
    }


@router.post("/dukkan/{slug}/degerlendirme")
async def degerlendirme_ekle(slug: str, body: dict, db: asyncpg.Connection = Depends(get_db)):
    """Sadece gerçekten teslim edilmiş bir tamire (repair_no+telefon eşleşmesi) değerlendirme bırakılabilir — spam engeli."""
    d = await _dukkan_by_slug(db, slug)
    repair_no = (body.get("repair_no") or "").strip()
    telefon = (body.get("telefon") or "").strip()
    puan = body.get("puan")
    if not repair_no or not telefon or not puan or not (1 <= int(puan) <= 5):
        raise HTTPException(400, "repair_no, telefon ve 1-5 arası puan gerekli")
    row = await db.fetchrow(
        """SELECT r.id, c.name FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.dukkan_id = $1 AND r.repair_no = $2 AND c.phone = $3 AND r.status = 'teslim'""",
        d["id"], repair_no, telefon,
    )
    if not row:
        raise HTTPException(404, "Bu bilgilerle teslim edilmiş bir tamir bulunamadı")
    zaten_var = await db.fetchval(
        "SELECT 1 FROM degerlendirmeler WHERE dukkan_id = $1 AND repair_no = $2", d["id"], repair_no
    )
    if zaten_var:
        raise HTTPException(400, "Bu tamir için zaten değerlendirme yapılmış")
    await db.execute(
        """INSERT INTO degerlendirmeler (dukkan_id, repair_no, musteri_adi, puan, yorum)
           VALUES ($1, $2, $3, $4, $5)""",
        d["id"], repair_no, row["name"] or "Müşteri", int(puan), body.get("yorum"),
    )
    return {"ok": True}


@router.get("/dukkan/{slug}/degerlendirmeler")
async def degerlendirmeler(slug: str, db: asyncpg.Connection = Depends(get_db)):
    d = await _dukkan_by_slug(db, slug)
    rows = await db.fetch(
        """SELECT musteri_adi, puan, yorum, created_at FROM degerlendirmeler
           WHERE dukkan_id = $1 AND onaylandi = true ORDER BY created_at DESC LIMIT 30""",
        d["id"],
    )
    ortalama = await db.fetchval(
        "SELECT AVG(puan) FROM degerlendirmeler WHERE dukkan_id = $1 AND onaylandi = true", d["id"]
    )
    return {"ortalama": round(float(ortalama), 1) if ortalama else None, "adet": len(rows), "yorumlar": [dict(r) for r in rows]}


@router.post("/dukkan/{slug}/takas-teklifi")
async def takas_teklifi(
    slug: str,
    musteri_adi: str = Form(...),
    telefon: str = Form(...),
    cihaz_model: str = Form(...),
    aciklama: str = Form(""),
    foto: UploadFile | None = File(None),
    db: asyncpg.Connection = Depends(get_db),
):
    d = await _dukkan_by_slug(db, slug)
    foto_url = None
    if foto is not None:
        try:
            foto_url, _, _ = await save_upload(foto, "takas", d["id"])
        except ValueError as e:
            raise HTTPException(400, str(e))
    await db.execute(
        """INSERT INTO takas_teklifleri (dukkan_id, musteri_adi, telefon, cihaz_model, aciklama, foto_url)
           VALUES ($1, $2, $3, $4, $5, $6)""",
        d["id"], musteri_adi.strip(), telefon.strip(), cihaz_model.strip(), aciklama or None, foto_url,
    )
    return {"ok": True}
