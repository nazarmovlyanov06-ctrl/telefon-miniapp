import asyncpg
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from database import get_db
from auth import get_current_user, get_dukkan_id, require_patron
from photo_storage import save_upload

router = APIRouter(prefix="/vitrin", tags=["vitrin"])


@router.get("/ayarlarim")
async def ayarlarim(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """SELECT slug, ad, telefon, adres, sehir, vitrin_aktif, vitrin_aciklama,
                  calisma_saatleri, hizmetler, logo_url, kapak_url FROM dukkanlar WHERE id = $1""",
        dukkan_id,
    )
    return dict(row)


@router.post("/logo")
async def logo_yukle(
    dosya: UploadFile = File(...),
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    try:
        url, _, _ = await save_upload(dosya, "dukkan-logo", dukkan_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute("UPDATE dukkanlar SET logo_url = $1 WHERE id = $2", url, dukkan_id)
    return {"url": url}


@router.post("/kapak")
async def kapak_yukle(
    dosya: UploadFile = File(...),
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    try:
        url, _, _ = await save_upload(dosya, "dukkan-kapak", dukkan_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute("UPDATE dukkanlar SET kapak_url = $1 WHERE id = $2", url, dukkan_id)
    return {"url": url}


@router.put("/ayarlarim")
async def ayarlari_guncelle(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        """UPDATE dukkanlar SET telefon = $1, adres = $2, sehir = $3, vitrin_aktif = $4,
                  vitrin_aciklama = $5, calisma_saatleri = $6, hizmetler = $7
           WHERE id = $8""",
        body.get("telefon"), body.get("adres"), body.get("sehir"),
        bool(body.get("vitrin_aktif", True)), body.get("vitrin_aciklama"),
        body.get("calisma_saatleri"), body.get("hizmetler"), dukkan_id,
    )
    return {"ok": True}


@router.get("/etiket-ayarlari")
async def etiket_ayarlari_getir(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """SELECT etiket_genislik_mm, etiket_yukseklik_mm, etiket_logo_goster,
                  etiket_kategori_goster, etiket_ayirici_cizgi_goster,
                  etiket_logo_x_pct, etiket_logo_y_pct,
                  etiket_logo_genislik_mm, etiket_logo_yukseklik_mm,
                  etiket_metin_x_pct, etiket_metin_y_pct,
                  etiket_metin_genislik_mm, etiket_metin_yukseklik_mm,
                  etiket_barkot_x_pct, etiket_barkot_y_pct,
                  etiket_barkot_genislik_mm, etiket_barkot_yukseklik_mm,
                  etiket_tamir_genislik_mm, etiket_tamir_yukseklik_mm, logo_url
           FROM dukkanlar WHERE id=$1""",
        dukkan_id,
    )
    return dict(row)


@router.put("/etiket-ayarlari")
async def etiket_ayarlari_guncelle(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    genislik = float(body.get("etiket_genislik_mm") or 40)
    yukseklik = float(body.get("etiket_yukseklik_mm") or 30)
    if not (10 <= genislik <= 200) or not (10 <= yukseklik <= 200):
        raise HTTPException(400, "Etiket boyutu 10-200mm aralığında olmalı")

    def pct(alan, varsayilan):
        deger = body.get(alan)
        return max(0, min(100, float(deger if deger is not None else varsayilan)))

    def olcu(alan, varsayilan, ust_sinir):
        deger = body.get(alan)
        return max(3, min(ust_sinir, float(deger if deger is not None else varsayilan)))

    logo_x, logo_y = pct("etiket_logo_x_pct", 50), pct("etiket_logo_y_pct", 15)
    logo_genislik = olcu("etiket_logo_genislik_mm", 15, genislik)
    logo_yukseklik = olcu("etiket_logo_yukseklik_mm", 8, yukseklik)
    metin_x, metin_y = pct("etiket_metin_x_pct", 50), pct("etiket_metin_y_pct", 42)
    metin_genislik = olcu("etiket_metin_genislik_mm", 34, genislik)
    metin_yukseklik = olcu("etiket_metin_yukseklik_mm", 13, yukseklik)
    barkot_x, barkot_y = pct("etiket_barkot_x_pct", 50), pct("etiket_barkot_y_pct", 80)
    barkot_genislik = olcu("etiket_barkot_genislik_mm", 34, genislik)
    barkot_yukseklik = olcu("etiket_barkot_yukseklik_mm", 10, yukseklik)

    tamir_genislik = float(body.get("etiket_tamir_genislik_mm") or 70)
    tamir_yukseklik = float(body.get("etiket_tamir_yukseklik_mm") or 50)
    if not (10 <= tamir_genislik <= 200) or not (10 <= tamir_yukseklik <= 200):
        raise HTTPException(400, "Tamir stiker boyutu 10-200mm aralığında olmalı")

    await db.execute(
        """UPDATE dukkanlar SET etiket_genislik_mm=$1, etiket_yukseklik_mm=$2,
           etiket_logo_goster=$3, etiket_kategori_goster=$4,
           etiket_ayirici_cizgi_goster=$5, etiket_logo_x_pct=$6, etiket_logo_y_pct=$7,
           etiket_logo_genislik_mm=$8, etiket_logo_yukseklik_mm=$9,
           etiket_metin_x_pct=$10, etiket_metin_y_pct=$11,
           etiket_metin_genislik_mm=$12, etiket_metin_yukseklik_mm=$13,
           etiket_barkot_x_pct=$14, etiket_barkot_y_pct=$15,
           etiket_barkot_genislik_mm=$16, etiket_barkot_yukseklik_mm=$17,
           etiket_tamir_genislik_mm=$18, etiket_tamir_yukseklik_mm=$19
           WHERE id=$20""",
        genislik, yukseklik, bool(body.get("etiket_logo_goster", False)),
        bool(body.get("etiket_kategori_goster", True)),
        bool(body.get("etiket_ayirici_cizgi_goster", False)), logo_x, logo_y,
        logo_genislik, logo_yukseklik, metin_x, metin_y, metin_genislik, metin_yukseklik,
        barkot_x, barkot_y, barkot_genislik, barkot_yukseklik,
        tamir_genislik, tamir_yukseklik, dukkan_id,
    )
    return {"ok": True}


@router.get("/randevu-talepleri")
async def randevu_talepleri(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT r.id, r.musteri_adi, r.telefon, r.cihaz_model, r.aciklama, r.durum, r.created_at,
                  EXISTS(
                      SELECT 1 FROM kara_liste k WHERE k.dukkan_id = r.dukkan_id
                      AND k.telefon IS NOT NULL AND r.telefon IS NOT NULL
                      AND regexp_replace(k.telefon, '\\D', '', 'g') = regexp_replace(r.telefon, '\\D', '', 'g')
                      AND regexp_replace(k.telefon, '\\D', '', 'g') != ''
                  ) AS is_blacklisted
           FROM randevu_talepleri r WHERE r.dukkan_id = $1 ORDER BY r.created_at DESC""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.put("/randevu-talepleri/{talep_id}/durum")
async def randevu_durum_guncelle(
    talep_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    durum = body.get("durum")
    if durum not in ("yeni", "goruldu", "tamire_donusturuldu", "reddedildi"):
        raise HTTPException(400, "Geçersiz durum")
    result = await db.execute(
        "UPDATE randevu_talepleri SET durum = $1 WHERE id = $2 AND dukkan_id = $3",
        durum, talep_id, dukkan_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(404, "Talep bulunamadı")
    return {"ok": True}


# ── DEĞERLENDİRME MODERASYONU ──────────────────────────────────────────

@router.get("/degerlendirmeler")
async def degerlendirmeler_hepsi(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT id, repair_no, musteri_adi, puan, yorum, onaylandi, created_at
           FROM degerlendirmeler WHERE dukkan_id = $1 ORDER BY created_at DESC""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.put("/degerlendirmeler/{id}/onay")
async def degerlendirme_onayla(
    id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    result = await db.execute(
        "UPDATE degerlendirmeler SET onaylandi = $1 WHERE id = $2 AND dukkan_id = $3",
        bool(body.get("onaylandi", True)), id, dukkan_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(404, "Değerlendirme bulunamadı")
    return {"ok": True}


@router.delete("/degerlendirmeler/{id}")
async def degerlendirme_sil(
    id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    result = await db.execute("DELETE FROM degerlendirmeler WHERE id = $1 AND dukkan_id = $2", id, dukkan_id)
    if result == "DELETE 0":
        raise HTTPException(404, "Değerlendirme bulunamadı")
    return {"ok": True}


# ── TAKAS TEKLİFLERİ ─────────────────────────────────────────────────────

@router.get("/takas-teklifleri")
async def takas_teklifleri(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT id, musteri_adi, telefon, cihaz_model, aciklama, foto_url, durum, teklif_tutari, created_at
           FROM takas_teklifleri WHERE dukkan_id = $1 ORDER BY created_at DESC""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


# ── GALERİ ───────────────────────────────────────────────────────────────

@router.get("/galeri")
async def galeri_listele(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT id, foto_url, baslik, created_at FROM dukkan_galeri WHERE dukkan_id = $1 ORDER BY id DESC",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/galeri")
async def galeri_ekle(
    dosya: UploadFile = File(...),
    baslik: str = Form(""),
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    try:
        url, _, _ = await save_upload(dosya, "galeri", dukkan_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    row = await db.fetchrow(
        "INSERT INTO dukkan_galeri (dukkan_id, foto_url, baslik) VALUES ($1, $2, $3) RETURNING id",
        dukkan_id, url, baslik or None,
    )
    return {"id": row["id"], "foto_url": url}


@router.delete("/galeri/{foto_id}")
async def galeri_sil(
    foto_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    sonuc = await db.execute("DELETE FROM dukkan_galeri WHERE id = $1 AND dukkan_id = $2", foto_id, dukkan_id)
    if sonuc == "DELETE 0":
        raise HTTPException(404, "Fotoğraf bulunamadı")
    return {"ok": True}


# ── MÜŞTERİ MESAJLARI (dükkan tarafı) ────────────────────────────────────

@router.get("/musteri-mesajlari")
async def musteri_mesaj_konusmalari(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Müşteri başına son mesaj + okunmamış sayısı — sohbet listesi."""
    rows = await db.fetch(
        """SELECT m.customer_id, c.name AS musteri_adi, c.phone AS telefon,
                  MAX(m.created_at) AS son_mesaj_at,
                  COUNT(*) FILTER (WHERE m.gonderen = 'musteri' AND m.okundu = false) AS okunmamis
           FROM musteri_mesajlari m JOIN customers c ON c.id = m.customer_id
           WHERE m.dukkan_id = $1
           GROUP BY m.customer_id, c.name, c.phone
           ORDER BY son_mesaj_at DESC""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.get("/musteri-mesajlari/{customer_id}")
async def musteri_mesaj_gecmisi(
    customer_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT id, gonderen, mesaj, created_at FROM musteri_mesajlari
           WHERE dukkan_id = $1 AND customer_id = $2 ORDER BY created_at""",
        dukkan_id, customer_id,
    )
    await db.execute(
        """UPDATE musteri_mesajlari SET okundu = true
           WHERE dukkan_id = $1 AND customer_id = $2 AND gonderen = 'musteri' AND okundu = false""",
        dukkan_id, customer_id,
    )
    return [dict(r) for r in rows]


@router.post("/musteri-mesajlari/{customer_id}")
async def musteri_mesaj_yanitla(
    customer_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    mesaj = (body.get("mesaj") or "").strip()
    if not mesaj:
        raise HTTPException(400, "Mesaj boş olamaz")
    sahibi = await db.fetchval(
        "SELECT 1 FROM customers WHERE id = $1 AND dukkan_id = $2", customer_id, dukkan_id
    )
    if not sahibi:
        raise HTTPException(404, "Müşteri bulunamadı")
    await db.execute(
        """INSERT INTO musteri_mesajlari (dukkan_id, customer_id, gonderen, mesaj)
           VALUES ($1, $2, 'dukkan', $3)""",
        dukkan_id, customer_id, mesaj,
    )
    return {"ok": True}


@router.put("/takas-teklifleri/{id}")
async def takas_teklifi_guncelle(
    id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    durum = body.get("durum")
    if durum not in ("yeni", "teklif_verildi", "kabul_edildi", "reddedildi"):
        raise HTTPException(400, "Geçersiz durum")
    teklif_tutari = body.get("teklif_tutari")

    mevcut = await db.fetchrow(
        "SELECT durum, musteri_adi, telefon, cihaz_model, aciklama, foto_url, teklif_tutari FROM takas_teklifleri WHERE id = $1 AND dukkan_id = $2",
        id, dukkan_id,
    )
    if not mevcut:
        raise HTTPException(404, "Teklif bulunamadı")

    # Kabul edilince müşterinin zaten girdiği model/açıklama/fotoğraf/teklif
    # tutarı BOŞA GİTMESİN diye 2.El stoğuna otomatik eklenir — daha önce
    # dükkan sahibi aynı bilgileri elle IkinciEl.jsx'e tekrar giriyordu.
    # Yalnızca durum İLK KEZ "kabul_edildi"ye geçerken eklenir (tekrar
    # kaydedilirse ikinci bir kayıt oluşmasın diye).
    yeni_tutar = float(teklif_tutari) if teklif_tutari else mevcut["teklif_tutari"]
    if durum == "kabul_edildi" and mevcut["durum"] != "kabul_edildi":
        if not yeni_tutar:
            raise HTTPException(400, "Kabul etmeden önce bir teklif tutarı girilmeli")
        await db.execute(
            """INSERT INTO ikinci_el (dukkan_id, model, kimden, kimden_telefon, alis_fiyati,
               notlar, durum, kaynak, gorsel_url)
               VALUES ($1, $2, $3, $4, $5, $6, 'stokta', 'takas', $7)""",
            dukkan_id, mevcut["cihaz_model"], mevcut["musteri_adi"], mevcut["telefon"],
            yeni_tutar, mevcut["aciklama"], mevcut["foto_url"],
        )

    result = await db.execute(
        "UPDATE takas_teklifleri SET durum = $1, teklif_tutari = $2 WHERE id = $3 AND dukkan_id = $4",
        durum, yeni_tutar, id, dukkan_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(404, "Teklif bulunamadı")
    return {"ok": True}
