import io
import math
from datetime import datetime, timedelta

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from database import get_db
from auth import require_super_admin
from photo_storage import save_upload

router = APIRouter(prefix="/admin", tags=["admin"])

_GECERLI_DURUMLAR = ("deneme", "aktif", "askida", "iptal")
_SILME_BEKLEME_GUN = 30


async def _audit(db: asyncpg.Connection, dukkan_id: int | None, dukkan_ad: str | None, aksiyon: str, detay: str | None = None):
    await db.execute(
        "INSERT INTO platform_audit_log (dukkan_id, dukkan_ad, aksiyon, detay) VALUES ($1, $2, $3, $4)",
        dukkan_id, dukkan_ad, aksiyon, detay,
    )


def _kalan_gun(abonelik_bitis) -> int | None:
    if abonelik_bitis is None:
        return None
    delta = abonelik_bitis - datetime.utcnow()
    return math.ceil(delta.total_seconds() / 86400)


# ── DÜKKÂNLAR ────────────────────────────────────────────────────────────

@router.get("/dukkanlar")
async def list_dukkanlar(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT d.id, d.ad, d.slug, d.telefon, d.sehir, d.abonelik_durumu,
                  d.abonelik_bitis, d.created_at, d.plan, d.referans_kod, d.silme_talep_tarihi,
                  (SELECT COUNT(*) FROM kullanicilar k WHERE k.dukkan_id = d.id) AS kullanici_sayisi,
                  (SELECT COUNT(*) FROM repairs r WHERE r.dukkan_id = d.id) AS tamir_sayisi,
                  (SELECT ad FROM kullanicilar k WHERE k.dukkan_id = d.id AND k.rol = 'patron' ORDER BY k.id LIMIT 1) AS patron_ad,
                  (SELECT email FROM kullanicilar k WHERE k.dukkan_id = d.id AND k.rol = 'patron' ORDER BY k.id LIMIT 1) AS patron_email,
                  (SELECT MAX(son_giris_at) FROM kullanicilar k WHERE k.dukkan_id = d.id) AS son_giris
           FROM dukkanlar d
           WHERE d.silme_talep_tarihi IS NULL
           ORDER BY d.created_at DESC"""
    )
    out = []
    for r in rows:
        d = dict(r)
        d["kalan_gun"] = _kalan_gun(d["abonelik_bitis"])
        out.append(d)
    return out


@router.patch("/dukkanlar/{dukkan_id}/abonelik")
async def set_abonelik_durumu(
    dukkan_id: int,
    body: dict,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    durum = body.get("durum")
    if durum not in _GECERLI_DURUMLAR:
        raise HTTPException(400, f"Geçersiz durum — biri olmalı: {', '.join(_GECERLI_DURUMLAR)}")
    row = await db.fetchrow("SELECT ad FROM dukkanlar WHERE id = $1", dukkan_id)
    if not row:
        raise HTTPException(404, "Dükkan bulunamadı")
    await db.execute("UPDATE dukkanlar SET abonelik_durumu = $1 WHERE id = $2", durum, dukkan_id)
    await _audit(db, dukkan_id, row["ad"], "durum", f"-> {durum}")
    return {"ok": True}


@router.put("/dukkanlar/{dukkan_id}/plan")
async def set_plan(
    dukkan_id: int,
    body: dict,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    plan = body.get("plan")
    gecerli = await db.fetchval("SELECT 1 FROM platform_planlar WHERE tur = $1", plan)
    if not gecerli:
        raise HTTPException(400, "Geçersiz plan")
    row = await db.fetchrow("SELECT ad FROM dukkanlar WHERE id = $1", dukkan_id)
    if not row:
        raise HTTPException(404, "Dükkan bulunamadı")
    await db.execute("UPDATE dukkanlar SET plan = $1 WHERE id = $2", plan, dukkan_id)
    await _audit(db, dukkan_id, row["ad"], "plan", f"-> {plan}")
    return {"ok": True}


@router.post("/dukkanlar/{dukkan_id}/sure")
async def sure_uzat(
    dukkan_id: int,
    body: dict,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow("SELECT ad, abonelik_bitis FROM dukkanlar WHERE id = $1", dukkan_id)
    if not row:
        raise HTTPException(404, "Dükkan bulunamadı")

    if body.get("suresiz"):
        await db.execute("UPDATE dukkanlar SET abonelik_bitis = NULL WHERE id = $1", dukkan_id)
        await _audit(db, dukkan_id, row["ad"], "sure_uzat", "süresiz yapıldı")
        return {"ok": True, "abonelik_bitis": None}

    if body.get("tarih"):
        yeni_tarih = datetime.fromisoformat(body["tarih"])
        await db.execute("UPDATE dukkanlar SET abonelik_bitis = $1 WHERE id = $2", yeni_tarih, dukkan_id)
        await _audit(db, dukkan_id, row["ad"], "sure_uzat", f"kesin tarih: {yeni_tarih.date()}")
        return {"ok": True, "abonelik_bitis": yeni_tarih}

    gun = int(body.get("gun") or 0)
    if gun <= 0:
        raise HTTPException(400, "gun, tarih veya suresiz alanlarından biri gerekli")
    baslangic = max(row["abonelik_bitis"] or datetime.utcnow(), datetime.utcnow())
    yeni = baslangic + timedelta(days=gun)
    await db.execute("UPDATE dukkanlar SET abonelik_bitis = $1 WHERE id = $2", yeni, dukkan_id)
    await _audit(db, dukkan_id, row["ad"], "sure_uzat", f"+{gun} gün")
    return {"ok": True, "abonelik_bitis": yeni}


@router.post("/dukkanlar/toplu-sure")
async def toplu_sure_uzat(
    body: dict,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    ids = body.get("dukkan_ids") or []
    gun = int(body.get("gun") or 0)
    if not ids or gun <= 0:
        raise HTTPException(400, "dukkan_ids ve gun gerekli")
    for did in ids:
        row = await db.fetchrow("SELECT ad, abonelik_bitis FROM dukkanlar WHERE id = $1", did)
        if not row:
            continue
        baslangic = max(row["abonelik_bitis"] or datetime.utcnow(), datetime.utcnow())
        yeni = baslangic + timedelta(days=gun)
        await db.execute("UPDATE dukkanlar SET abonelik_bitis = $1 WHERE id = $2", yeni, did)
        await _audit(db, did, row["ad"], "sure_uzat", f"toplu +{gun} gün")
    return {"ok": True, "guncellenen": len(ids)}


# ── HESAP KALICI SİLME ─────────────────────────────────────────────────────

@router.get("/silinecek-dukkanlar")
async def silinecek_dukkanlar(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT id, ad, silme_talep_tarihi FROM dukkanlar WHERE silme_talep_tarihi IS NOT NULL ORDER BY silme_talep_tarihi"
    )
    out = []
    for r in rows:
        d = dict(r)
        kalici_tarih = d["silme_talep_tarihi"] + timedelta(days=_SILME_BEKLEME_GUN)
        d["kalici_silme_tarihi"] = kalici_tarih
        d["silinebilir"] = datetime.utcnow() >= kalici_tarih
        out.append(d)
    return out


@router.post("/dukkanlar/{dukkan_id}/silme-iptal")
async def silme_iptal(
    dukkan_id: int,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow("SELECT ad FROM dukkanlar WHERE id = $1", dukkan_id)
    if not row:
        raise HTTPException(404, "Dükkan bulunamadı")
    await db.execute("UPDATE dukkanlar SET silme_talep_tarihi = NULL WHERE id = $1", dukkan_id)
    await _audit(db, dukkan_id, row["ad"], "silme_iptal")
    return {"ok": True}


@router.post("/dukkanlar/{dukkan_id}/kalici-sil")
async def kalici_sil(
    dukkan_id: int,
    body: dict,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow("SELECT ad, silme_talep_tarihi FROM dukkanlar WHERE id = $1", dukkan_id)
    if not row:
        raise HTTPException(404, "Dükkan bulunamadı")
    if not row["silme_talep_tarihi"]:
        raise HTTPException(400, "Bu dükkan için silme talebi yok")
    kalici_tarih = row["silme_talep_tarihi"] + timedelta(days=_SILME_BEKLEME_GUN)
    if datetime.utcnow() < kalici_tarih:
        raise HTTPException(400, f"30 günlük bekleme süresi dolmadı (bitiş: {kalici_tarih.date()})")
    if (body.get("onay_adi") or "").strip() != row["ad"]:
        raise HTTPException(400, "Onay için dükkan adını birebir aynı yazmalısınız")

    # dukkan_id kolonlu tüm tablolar ON DELETE CASCADE ile bağlı — dükkan silinince
    # otomatik temizlenir. platform_audit_log SET NULL ile ayrık tutulur (geçmiş kalsın).
    await db.execute("DELETE FROM dukkanlar WHERE id = $1", dukkan_id)
    await _audit(db, None, row["ad"], "kalici_silme", f"dukkan_id={dukkan_id} kalıcı silindi")
    return {"ok": True}


# ── İSTATİSTİK ───────────────────────────────────────────────────────────

@router.get("/istatistik")
async def genel_istatistik(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    toplam_dukkan = await db.fetchval("SELECT COUNT(*) FROM dukkanlar")
    aktif_dukkan = await db.fetchval("SELECT COUNT(*) FROM dukkanlar WHERE abonelik_durumu = 'aktif'")
    deneme_dukkan = await db.fetchval("SELECT COUNT(*) FROM dukkanlar WHERE abonelik_durumu = 'deneme'")
    askida_dukkan = await db.fetchval("SELECT COUNT(*) FROM dukkanlar WHERE abonelik_durumu = 'askida'")
    toplam_kullanici = await db.fetchval("SELECT COUNT(*) FROM kullanicilar WHERE aktif = true")
    toplam_tamir = await db.fetchval("SELECT COUNT(*) FROM repairs")
    son_30gun_dukkan = await db.fetchval(
        "SELECT COUNT(*) FROM dukkanlar WHERE created_at >= now() - interval '30 days'"
    )

    kayit_tarihleri = await db.fetch("SELECT created_at FROM dukkanlar ORDER BY created_at")
    tarihler = [r["created_at"] for r in kayit_tarihleri]
    bugun = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    pazartesi = bugun - timedelta(days=bugun.weekday())
    haftalar = []
    for i in range(9, -1, -1):
        bas = pazartesi - timedelta(days=7 * i)
        son = bas + timedelta(days=7)
        yeni = sum(1 for t in tarihler if bas <= t < son)
        kumulatif = sum(1 for t in tarihler if t < son)
        haftalar.append({"bas": bas.date().isoformat(), "yeni": yeni, "kumulatif": kumulatif})

    return {
        "toplam_dukkan": toplam_dukkan,
        "aktif_dukkan": aktif_dukkan,
        "deneme_dukkan": deneme_dukkan,
        "askida_dukkan": askida_dukkan,
        "toplam_kullanici": toplam_kullanici,
        "toplam_tamir": toplam_tamir,
        "son_30gun_yeni_dukkan": son_30gun_dukkan,
        "haftalik_buyume": haftalar,
    }


@router.get("/ozet")
async def ozet(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    yaklasan = await db.fetchval(
        """SELECT COUNT(*) FROM dukkanlar
           WHERE abonelik_durumu = 'aktif' AND abonelik_bitis IS NOT NULL
             AND abonelik_bitis <= now() + interval '5 days'"""
    )
    destek_okunmamis = await db.fetchval(
        "SELECT COUNT(*) FROM destek_mesajlari WHERE gonderen_rol = 'dukkan' AND okundu = false"
    )
    silme_bekleyen = await db.fetchval("SELECT COUNT(*) FROM dukkanlar WHERE silme_talep_tarihi IS NOT NULL")
    return {
        "abonelik_yaklasan": yaklasan or 0,
        "destek_okunmamis": destek_okunmamis or 0,
        "silme_bekleyen": silme_bekleyen or 0,
    }


# ── PLANLAR ──────────────────────────────────────────────────────────────

@router.get("/planlar")
async def planlar(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch("SELECT tur, ad, fiyat FROM platform_planlar ORDER BY fiyat")
    return [dict(r) for r in rows]


@router.put("/planlar/{tur}")
async def plan_fiyat_guncelle(
    tur: str,
    body: dict,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    fiyat = body.get("fiyat")
    if fiyat is None:
        raise HTTPException(400, "fiyat gerekli")
    result = await db.execute("UPDATE platform_planlar SET fiyat = $1 WHERE tur = $2", float(fiyat), tur)
    if result == "UPDATE 0":
        raise HTTPException(404, "Plan bulunamadı")
    await _audit(db, None, None, "plan_fiyat", f"{tur} -> {fiyat}₺")
    return {"ok": True}


# ── MALİ DURUM ───────────────────────────────────────────────────────────

@router.get("/mali-durum")
async def mali_durum(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    aktif_sayisi = await db.fetchval("SELECT COUNT(*) FROM dukkanlar WHERE abonelik_durumu = 'aktif'")
    gelir = await db.fetchval(
        """SELECT COALESCE(SUM(p.fiyat), 0) FROM dukkanlar d
           JOIN platform_planlar p ON p.tur = d.plan
           WHERE d.abonelik_durumu = 'aktif'"""
    )
    giderler = await db.fetch("SELECT id, tur, tutar, aciklama, tarih FROM platform_giderler ORDER BY tarih DESC, id DESC")
    toplam_gider = sum((g["tutar"] or 0) for g in giderler)
    return {
        "aktif_dukkan_sayisi": aktif_sayisi,
        "tahmini_aylik_gelir": gelir or 0,
        "toplam_gider": toplam_gider,
        "net": (gelir or 0) - toplam_gider,
        "giderler": [dict(g) for g in giderler],
    }


@router.post("/giderler")
async def gider_ekle(
    body: dict,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    tur = body.get("tur")
    tutar = body.get("tutar")
    tarih = body.get("tarih")
    if not tur or not tutar or not tarih:
        raise HTTPException(400, "tur, tutar ve tarih gerekli")
    row = await db.fetchrow(
        "INSERT INTO platform_giderler (tur, tutar, aciklama, tarih) VALUES ($1, $2, $3, $4) RETURNING id",
        tur, float(tutar), body.get("aciklama"), tarih,
    )
    return {"ok": True, "id": row["id"]}


@router.delete("/giderler/{gider_id}")
async def gider_sil(
    gider_id: int,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    result = await db.execute("DELETE FROM platform_giderler WHERE id = $1", gider_id)
    if result == "DELETE 0":
        raise HTTPException(404, "Gider bulunamadı")
    return {"ok": True}


@router.get("/mali-durum/export")
async def mali_durum_export(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    from openpyxl import Workbook

    giderler = await db.fetch("SELECT tur, tutar, aciklama, tarih FROM platform_giderler ORDER BY tarih DESC")
    wb = Workbook()
    ws = wb.active
    ws.title = "Giderler"
    ws.append(["Tür", "Tutar (₺)", "Açıklama", "Tarih"])
    for g in giderler:
        ws.append([g["tur"], g["tutar"], g["aciklama"] or "", g["tarih"]])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=mali-durum.xlsx"},
    )


# ── DESTEK ───────────────────────────────────────────────────────────────

@router.get("/destek")
async def destek_konusmalari(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT d.id AS dukkan_id, d.ad AS dukkan_ad,
                  (SELECT mesaj FROM destek_mesajlari m WHERE m.dukkan_id = d.id ORDER BY m.created_at DESC LIMIT 1) AS son_mesaj,
                  (SELECT created_at FROM destek_mesajlari m WHERE m.dukkan_id = d.id ORDER BY m.created_at DESC LIMIT 1) AS son_tarih,
                  (SELECT COUNT(*) FROM destek_mesajlari m WHERE m.dukkan_id = d.id AND m.gonderen_rol = 'dukkan' AND m.okundu = false) AS okunmamis
           FROM dukkanlar d
           WHERE EXISTS (SELECT 1 FROM destek_mesajlari m WHERE m.dukkan_id = d.id)
           ORDER BY okunmamis DESC, son_tarih DESC NULLS LAST"""
    )
    return [dict(r) for r in rows]


@router.get("/destek/{dukkan_id}")
async def destek_gecmisi(
    dukkan_id: int,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE destek_mesajlari SET okundu = true WHERE dukkan_id = $1 AND gonderen_rol = 'dukkan'",
        dukkan_id,
    )
    rows = await db.fetch(
        """SELECT id, gonderen_rol, gonderen_ad, mesaj, dosya_url, dosya_adi, dosya_tipi, created_at
           FROM destek_mesajlari WHERE dukkan_id = $1 ORDER BY id""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/destek/{dukkan_id}")
async def destek_yanitla(
    dukkan_id: int,
    body: dict,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    mesaj = (body.get("mesaj") or "").strip()
    if not mesaj:
        raise HTTPException(400, "Mesaj boş olamaz")
    dukkan = await db.fetchrow("SELECT ad FROM dukkanlar WHERE id = $1", dukkan_id)
    if not dukkan:
        raise HTTPException(404, "Dükkan bulunamadı")
    await db.execute(
        "INSERT INTO destek_mesajlari (dukkan_id, gonderen_rol, gonderen_ad, mesaj, okundu) VALUES ($1, 'platform', 'Destek', $2, true)",
        dukkan_id, mesaj,
    )
    await _audit(db, dukkan_id, dukkan["ad"], "destek_yanit", mesaj[:200])
    return {"ok": True}


@router.post("/destek/{dukkan_id}/dosya")
async def destek_dosya_yanitla(
    dukkan_id: int,
    dosya: UploadFile = File(...),
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    dukkan = await db.fetchrow("SELECT ad FROM dukkanlar WHERE id = $1", dukkan_id)
    if not dukkan:
        raise HTTPException(404, "Dükkan bulunamadı")
    try:
        url, ad, tip = await save_upload(dosya, "destek", dukkan_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute(
        """INSERT INTO destek_mesajlari (dukkan_id, gonderen_rol, gonderen_ad, mesaj, okundu, dosya_url, dosya_adi, dosya_tipi)
           VALUES ($1, 'platform', 'Destek', '', true, $2, $3, $4)""",
        dukkan_id, url, ad, tip,
    )
    await _audit(db, dukkan_id, dukkan["ad"], "destek_yanit", f"[dosya: {ad}]")
    return {"ok": True, "dosya_url": url}


# ── AKTİVİTE ─────────────────────────────────────────────────────────────

@router.get("/audit")
async def audit_log(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT id, dukkan_id, dukkan_ad, aksiyon, detay, created_at FROM platform_audit_log ORDER BY created_at DESC LIMIT 100"
    )
    return [dict(r) for r in rows]


@router.get("/audit/export")
async def audit_export(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    from openpyxl import Workbook

    rows = await db.fetch(
        "SELECT dukkan_ad, aksiyon, detay, created_at FROM platform_audit_log ORDER BY created_at DESC"
    )
    wb = Workbook()
    ws = wb.active
    ws.title = "Aktivite"
    ws.append(["Tarih", "Dükkân", "İşlem", "Detay"])
    for r in rows:
        ws.append([r["created_at"].strftime("%Y-%m-%d %H:%M"), r["dukkan_ad"] or "—", r["aksiyon"], r["detay"] or ""])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=aktivite.xlsx"},
    )


# ── DUYURU ───────────────────────────────────────────────────────────────

@router.post("/duyuru-gonder")
async def duyuru_gonder(
    body: dict,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    dukkan_ids = body.get("dukkan_ids") or []
    mesaj = (body.get("mesaj") or "").strip()
    if not dukkan_ids or not mesaj:
        raise HTTPException(400, "dukkan_ids ve mesaj gerekli")
    row = await db.fetchrow("INSERT INTO platform_duyurular (mesaj) VALUES ($1) RETURNING id", mesaj)
    duyuru_id = row["id"]
    for did in dukkan_ids:
        await db.execute(
            "INSERT INTO platform_duyuru_alicilari (duyuru_id, dukkan_id) VALUES ($1, $2)", duyuru_id, did
        )
        d = await db.fetchrow("SELECT ad FROM dukkanlar WHERE id = $1", did)
        await _audit(db, did, d["ad"] if d else None, "duyuru", mesaj[:200])
    return {"ok": True, "gonderilen": len(dukkan_ids)}


@router.get("/duyurular")
async def duyuru_gecmisi(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT d.id, d.mesaj, d.created_at,
                  (SELECT COUNT(*) FROM platform_duyuru_alicilari a WHERE a.duyuru_id = d.id) AS gonderilen,
                  (SELECT COUNT(*) FROM platform_duyuru_alicilari a WHERE a.duyuru_id = d.id AND a.gorundu = true) AS gorulme
           FROM platform_duyurular d ORDER BY d.created_at DESC LIMIT 30"""
    )
    return [dict(r) for r in rows]


# ── İŞBİRLİĞİ / REFERANS KODLARI ─────────────────────────────────────────

@router.get("/referans-kodlari")
async def referans_kodlari(
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch("SELECT id, kod, sahip_adi, aciklama, indirim_yuzdesi, komisyon_yuzdesi, aktif FROM referans_kodlari ORDER BY created_at DESC")
    out = []
    for r in rows:
        d = dict(r)
        d["kayit"] = await db.fetchval("SELECT COUNT(*) FROM dukkanlar WHERE referans_kod = $1", r["kod"])
        out.append(d)
    return out


@router.post("/referans-kodlari")
async def referans_kodu_ekle(
    body: dict,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    kod = (body.get("kod") or "").strip()
    sahip_adi = (body.get("sahip_adi") or "").strip()
    if not kod or not sahip_adi:
        raise HTTPException(400, "kod ve sahip_adi gerekli")
    var_mi = await db.fetchval("SELECT 1 FROM referans_kodlari WHERE kod = $1", kod)
    if var_mi:
        raise HTTPException(400, "Bu kod zaten var")
    await db.execute(
        """INSERT INTO referans_kodlari (kod, sahip_adi, aciklama, indirim_yuzdesi, komisyon_yuzdesi)
           VALUES ($1, $2, $3, $4, $5)""",
        kod, sahip_adi, body.get("aciklama"),
        int(body.get("indirim_yuzdesi") or 0), int(body.get("komisyon_yuzdesi") or 0),
    )
    await _audit(db, None, None, "referans_ekle", kod)
    return {"ok": True}


@router.put("/referans-kodlari/{ref_id}/aktif")
async def referans_kodu_aktiflik(
    ref_id: int,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow("SELECT aktif FROM referans_kodlari WHERE id = $1", ref_id)
    if not row:
        raise HTTPException(404, "Kod bulunamadı")
    await db.execute("UPDATE referans_kodlari SET aktif = $1 WHERE id = $2", not row["aktif"], ref_id)
    return {"ok": True}


@router.delete("/referans-kodlari/{ref_id}")
async def referans_kodu_sil(
    ref_id: int,
    user: dict = Depends(require_super_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    result = await db.execute("DELETE FROM referans_kodlari WHERE id = $1", ref_id)
    if result == "DELETE 0":
        raise HTTPException(404, "Kod bulunamadı")
    return {"ok": True}
