from fastapi import APIRouter, Depends
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from config import GEMINI_API_KEY
import httpx
from datetime import date, timedelta

router = APIRouter(prefix="/ai", tags=["ai"])


async def _servis_verisi(db: Connection) -> str:
    bugun = date.today().isoformat()
    ay_basi = date.today().replace(day=1).isoformat()
    yil_basi = date.today().replace(month=1, day=1).isoformat()
    dk = date.today() - timedelta(days=30)
    son30 = dk.isoformat()

    satirlar = [f"=== SERVİS VERİTABANI ({bugun}) ===\n"]

    # ── TAMİRLER ──────────────────────────────────────────────
    cur = await db.execute(
        "SELECT COUNT(*) as c FROM repairs WHERE DATE(created_at) = ?", (bugun,)
    )
    bugun_tamir = (await cur.fetchone())["c"]

    cur = await db.execute(
        "SELECT status, COUNT(*) as c FROM repairs GROUP BY status"
    )
    durum_sayilari = {r["status"]: r["c"] for r in await cur.fetchall()}

    cur = await db.execute(
        """SELECT r.repair_no, c.name as musteri, r.device_model, r.fault_desc,
                  r.estimated_price, r.final_price, r.status, r.created_at
           FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.status NOT IN ('teslim')
           ORDER BY r.created_at DESC LIMIT 20"""
    )
    aktif_tamirler = [dict(r) for r in await cur.fetchall()]

    cur = await db.execute(
        """SELECT r.repair_no, c.name as musteri, r.device_model, r.final_price, r.delivered_at
           FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.status = 'teslim' AND DATE(r.delivered_at) >= ?
           ORDER BY r.delivered_at DESC LIMIT 10""", (son30,)
    )
    son_teslimler = [dict(r) for r in await cur.fetchall()]

    cur = await db.execute(
        "SELECT COALESCE(SUM(final_price),0) as t FROM repairs WHERE status='teslim' AND DATE(delivered_at) >= ?",
        (ay_basi,)
    )
    ay_tamir_ciro = (await cur.fetchone())["t"]

    cur = await db.execute(
        "SELECT COALESCE(SUM(final_price),0) as t FROM repairs WHERE status='teslim' AND DATE(delivered_at) >= ?",
        (yil_basi,)
    )
    yil_tamir_ciro = (await cur.fetchone())["t"]

    satirlar.append("## TAMİRLER")
    satirlar.append(f"Bugün açılan: {bugun_tamir} tamir")
    satirlar.append(f"Durum dağılımı: {durum_sayilari}")
    satirlar.append(f"Bu ay teslim cirosu: {ay_tamir_ciro:.0f}₺ | Bu yıl: {yil_tamir_ciro:.0f}₺")
    satirlar.append(f"Aktif tamirler ({len(aktif_tamirler)} adet):")
    for t in aktif_tamirler:
        fiyat = t['final_price'] or t['estimated_price'] or 0
        satirlar.append(f"  #{t['repair_no']} | {t['musteri']} | {t['device_model']} | {t['fault_desc'] or '-'} | {t['status']} | {fiyat:.0f}₺ | {str(t['created_at'])[:10]}")
    if son_teslimler:
        satirlar.append(f"Son 30 günde teslim ({len(son_teslimler)}):")
        for t in son_teslimler:
            satirlar.append(f"  #{t['repair_no']} | {t['musteri']} | {t['device_model']} | {(t['final_price'] or 0):.0f}₺ | {str(t['delivered_at'])[:10]}")

    # ── MÜŞTERİLER ────────────────────────────────────────────
    cur = await db.execute("SELECT COUNT(*) as c FROM customers")
    musteri_toplam = (await cur.fetchone())["c"]

    cur = await db.execute(
        "SELECT name, phone, created_at FROM customers ORDER BY created_at DESC LIMIT 10"
    )
    son_musteriler = [dict(r) for r in await cur.fetchall()]

    satirlar.append("\n## MÜŞTERİLER")
    satirlar.append(f"Toplam kayıtlı müşteri: {musteri_toplam}")
    satirlar.append("Son eklenen müşteriler:")
    for m in son_musteriler:
        satirlar.append(f"  {m['name']} | {m['phone'] or '-'} | {str(m['created_at'])[:10]}")

    # ── KASA ──────────────────────────────────────────────────
    cur = await db.execute(
        "SELECT tur, COALESCE(SUM(tutar),0) as t FROM kasa_hareketleri WHERE tarih=? GROUP BY tur", (bugun,)
    )
    bugun_kasa = {r["tur"]: r["t"] for r in await cur.fetchall()}

    cur = await db.execute(
        "SELECT tur, COALESCE(SUM(tutar),0) as t FROM kasa_hareketleri WHERE tarih>=? GROUP BY tur", (ay_basi,)
    )
    ay_kasa = {r["tur"]: r["t"] for r in await cur.fetchall()}

    cur = await db.execute(
        "SELECT tur, COALESCE(SUM(tutar),0) as t FROM kasa_hareketleri WHERE tarih>=? GROUP BY tur", (yil_basi,)
    )
    yil_kasa = {r["tur"]: r["t"] for r in await cur.fetchall()}

    cur = await db.execute(
        "SELECT tarih, tur, tutar, aciklama, kaynak FROM kasa_hareketleri ORDER BY created_at DESC LIMIT 15"
    )
    son_kasa = [dict(r) for r in await cur.fetchall()]

    bugun_gelir = bugun_kasa.get("gelir", 0)
    bugun_gider = bugun_kasa.get("gider", 0)
    ay_gelir = ay_kasa.get("gelir", 0)
    ay_gider = ay_kasa.get("gider", 0)
    yil_gelir = yil_kasa.get("gelir", 0)
    yil_gider = yil_kasa.get("gider", 0)

    satirlar.append("\n## KASA")
    satirlar.append(f"Bugün: Gelir {bugun_gelir:.0f}₺ | Gider {bugun_gider:.0f}₺ | Net {(bugun_gelir - bugun_gider):.0f}₺")
    satirlar.append(f"Bu ay: Gelir {ay_gelir:.0f}₺ | Gider {ay_gider:.0f}₺ | Net {(ay_gelir - ay_gider):.0f}₺")
    satirlar.append(f"Bu yıl: Gelir {yil_gelir:.0f}₺ | Gider {yil_gider:.0f}₺ | Net {(yil_gelir - yil_gider):.0f}₺")
    satirlar.append("Son işlemler:")
    for k in son_kasa:
        satirlar.append(f"  {k['tarih']} | {k['tur']} | {k['tutar']:.0f}₺ | {k['aciklama'] or '-'} | {k['kaynak'] or '-'}")

    # ── STOK / PARÇA ──────────────────────────────────────────
    cur = await db.execute(
        "SELECT name, category, quantity, min_quantity, cost_price, sale_price, supplier FROM parts ORDER BY quantity ASC"
    )
    parcalar = [dict(r) for r in await cur.fetchall()]

    cur = await db.execute(
        "SELECT COUNT(*) as c FROM part_orders WHERE status='siparis_verildi'"
    )
    bekleyen_siparis = (await cur.fetchone())["c"]

    cur = await db.execute(
        """SELECT po.*, t.ad as toptanci_adi
           FROM part_orders po LEFT JOIN toptancilar t ON po.toptanci_id = t.id
           WHERE po.status = 'siparis_verildi'
           ORDER BY po.ordered_at DESC LIMIT 10"""
    )
    bekleyen_siparisler = [dict(r) for r in await cur.fetchall()]

    satirlar.append("\n## STOK / PARÇALAR")
    satirlar.append(f"Toplam {len(parcalar)} çeşit parça")
    dusuk = [p for p in parcalar if p['quantity'] <= (p['min_quantity'] or 2)]
    if dusuk:
        satirlar.append(f"Düşük/tükenmiş stok ({len(dusuk)} kalem):")
        for p in dusuk:
            satirlar.append(f"  {p['name']} | {p['category'] or '-'} | Stok: {p['quantity']} | Min: {p['min_quantity'] or 0}")
    satirlar.append("Tüm stok:")
    for p in parcalar:
        satirlar.append(f"  {p['name']} | {p['category'] or '-'} | {p['quantity']} adet | Alış: {p['cost_price']:.0f}₺ | Satış: {p['sale_price']:.0f}₺ | {p['supplier'] or '-'}")
    satirlar.append(f"Bekleyen sipariş: {bekleyen_siparis} adet")
    for s in bekleyen_siparisler:
        satirlar.append(f"  {s['toptanci_adi'] or s.get('supplier','-')} | {s.get('part_id','?')} | {s['quantity']} adet | {s['unit_cost']:.0f}₺ | {str(s['ordered_at'])[:10]}")

    # ── 2. EL CİHAZLAR ────────────────────────────────────────
    cur = await db.execute(
        """SELECT model, renk, depolama, ram, alis_fiyati, kimden, durum,
                  satis_fiyati, musteri_adi, satis_tarihi, created_at,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m WHERE m.cihaz_id = c.id),0) as masraf
           FROM ikinci_el c ORDER BY created_at DESC"""
    )
    ikinciel = [dict(r) for r in await cur.fetchall()]
    stokta_2el = [c for c in ikinciel if c['durum'] == 'stokta']
    satilan_2el = [c for c in ikinciel if c['durum'] == 'satildi']

    kar_2el = sum((c['satis_fiyati'] or 0) - (c['alis_fiyati'] or 0) - (c['masraf'] or 0) for c in satilan_2el)

    satirlar.append("\n## 2. EL CİHAZLAR")
    satirlar.append(f"Stokta: {len(stokta_2el)} cihaz | Toplam satılan: {len(satilan_2el)} | Toplam kâr: {kar_2el:.0f}₺")
    if stokta_2el:
        satirlar.append("Stokta olanlar:")
        for c in stokta_2el:
            maliyet = (c['alis_fiyati'] or 0) + (c['masraf'] or 0)
            ozellik = " ".join(filter(None, [c['renk'], c['depolama'], c['ram']]))
            satirlar.append(f"  {c['model']} | {ozellik or '-'} | Alış: {c['alis_fiyati']:.0f}₺ | Masraf: {c['masraf']:.0f}₺ | Maliyet: {maliyet:.0f}₺ | {c['kimden'] or '-'} | {str(c['created_at'])[:10]}")
    if satilan_2el:
        satirlar.append(f"Son satılanlar ({min(10, len(satilan_2el))}):")
        for c in list(reversed(satilan_2el))[:10]:
            kar = (c['satis_fiyati'] or 0) - (c['alis_fiyati'] or 0) - (c['masraf'] or 0)
            satirlar.append(f"  {c['model']} | Satış: {c['satis_fiyati']:.0f}₺ | Kâr: {kar:.0f}₺ | {c['musteri_adi'] or '-'} | {c['satis_tarihi'] or '-'}")

    # ── SIFIR CİHAZLAR ────────────────────────────────────────
    cur = await db.execute("SELECT * FROM sifir_cihazlar ORDER BY created_at DESC")
    sifir = [dict(r) for r in await cur.fetchall()]
    stokta_sifir = [c for c in sifir if c['durum'] == 'stokta']
    satilan_sifir = [c for c in sifir if c['durum'] == 'satildi']
    kar_sifir = sum((c['satis_fiyati'] or 0) - (c['alis_fiyati'] or 0) for c in satilan_sifir)

    satirlar.append("\n## SIFIR CİHAZLAR")
    satirlar.append(f"Stokta: {len(stokta_sifir)} | Satılan: {len(satilan_sifir)} | Toplam kâr: {kar_sifir:.0f}₺")
    for c in stokta_sifir:
        satirlar.append(f"  {c['model']} | {c.get('renk','-')} {c.get('depolama','')} | Alış: {c['alis_fiyati']:.0f}₺")

    # ── GARANTİ ───────────────────────────────────────────────
    cur = await db.execute(
        """SELECT musteri_adi, telefon, cihaz, tamir_aciklama, baslangic_tarihi, bitis_tarihi, aktif
           FROM garantiler ORDER BY bitis_tarihi ASC"""
    )
    garantiler = [dict(r) for r in await cur.fetchall()]
    aktif_garanti = [g for g in garantiler if g['aktif'] == 1]
    suresi_dolan = [g for g in aktif_garanti if g['bitis_tarihi'] < bugun]
    bitmek_uzere = [g for g in aktif_garanti if bugun <= g['bitis_tarihi'] <= (date.today() + timedelta(days=7)).isoformat()]

    satirlar.append("\n## GARANTİ")
    satirlar.append(f"Aktif garanti: {len(aktif_garanti)} | Süresi dolan: {len(suresi_dolan)} | 7 günde bitecek: {len(bitmek_uzere)}")
    for g in aktif_garanti[:15]:
        durum = "⚠️DOLDU" if g['bitis_tarihi'] < bugun else ("⏰YAKINDA" if g['bitis_tarihi'] <= (date.today() + timedelta(days=7)).isoformat() else "✅aktif")
        satirlar.append(f"  {g['musteri_adi']} | {g['cihaz']} | {g['tamir_aciklama'][:30]} | {g['bitis_tarihi']} {durum}")

    # ── BORÇLAR ───────────────────────────────────────────────
    cur = await db.execute(
        """SELECT d.*, c.name as musteri_adi
           FROM debts d LEFT JOIN customers c ON d.customer_id = c.id
           WHERE d.status != 'odendi'
           ORDER BY d.created_at DESC"""
    )
    borclar = [dict(r) for r in await cur.fetchall()]
    toplam_borc = sum((b.get('total_amount') or b.get('amount') or 0) - (b.get('paid_amount') or b.get('paid') or 0) for b in borclar)

    satirlar.append("\n## BORÇLAR")
    satirlar.append(f"Toplam {len(borclar)} açık borç | Toplam kalan: {toplam_borc:.0f}₺")
    for b in borclar:
        kalan = (b.get('total_amount') or b.get('amount') or 0) - (b.get('paid_amount') or b.get('paid') or 0)
        satirlar.append(f"  {b['musteri_adi'] or '-'} | {b.get('description') or b.get('notes') or 'Borç'} | Kalan: {kalan:.0f}₺ | Vade: {b.get('due_date') or '-'}")

    # ── YEDEK TELEFON (LOANER) ────────────────────────────────
    cur = await db.execute(
        """SELECT musteri_adi, cihaz, teslim_tarihi, iade_tarihi, aktif, notlar
           FROM loaner_cihazlar ORDER BY aktif DESC, teslim_tarihi DESC"""
    )
    loanerlar = [dict(r) for r in await cur.fetchall()]
    aktif_loaner = [l for l in loanerlar if l['aktif'] == 1]

    satirlar.append("\n## YEDEK TELEFON")
    satirlar.append(f"Dışarıda: {len(aktif_loaner)} cihaz | Toplam kayıt: {len(loanerlar)}")
    for l in aktif_loaner:
        gun = (date.today() - date.fromisoformat(l['teslim_tarihi'])).days if l['teslim_tarihi'] else '?'
        satirlar.append(f"  {l['musteri_adi']} | {l['cihaz']} | {gun} gün dışarıda | {l['notlar'] or '-'}")

    # ── AKSESUAR ──────────────────────────────────────────────
    cur = await db.execute(
        "SELECT ad, kategori, stok, alis_fiyati, satis_fiyati FROM aksesuarlar ORDER BY stok ASC"
    )
    aksesuarlar = [dict(r) for r in await cur.fetchall()]

    cur = await db.execute(
        "SELECT COALESCE(SUM(toplam),0) as t FROM aksesuar_satislar WHERE tarih>=?", (ay_basi,)
    )
    ay_aksesuar = (await cur.fetchone())["t"]

    satirlar.append("\n## AKSESUAR")
    satirlar.append(f"Toplam {len(aksesuarlar)} çeşit | Bu ay satış: {ay_aksesuar:.0f}₺")
    for a in aksesuarlar:
        uyari = " ⚠️" if a['stok'] <= 3 else ""
        satirlar.append(f"  {a['ad']} | {a['kategori'] or '-'} | Stok: {a['stok']}{uyari} | Satış: {a['satis_fiyati']:.0f}₺")

    # ── TOPTANCILAR ───────────────────────────────────────────
    cur = await db.execute("SELECT ad, telefon, sehir FROM toptancilar")
    toptancilar = [dict(r) for r in await cur.fetchall()]

    satirlar.append("\n## TOPTANCILAR")
    for t in toptancilar:
        satirlar.append(f"  {t['ad']} | {t['telefon'] or '-'} | {t['sehir'] or '-'}")

    # ── ÇALIŞANLAR / MAAŞ ─────────────────────────────────────
    cur = await db.execute(
        "SELECT ad, aylik_maas, aktif FROM calisanlar WHERE aktif=1"
    )
    calisanlar = [dict(r) for r in await cur.fetchall()]

    ay = date.today().month
    yil = date.today().year
    cur = await db.execute(
        """SELECT c.ad, mo.maas, mo.odendi, mo.odeme_tarihi
           FROM maas_odemeleri mo JOIN calisanlar c ON mo.calisan_id = c.id
           WHERE mo.yil=? AND mo.ay=?""", (yil, ay)
    )
    bu_ay_maas = [dict(r) for r in await cur.fetchall()]

    satirlar.append("\n## PERSONEL")
    for c in calisanlar:
        satirlar.append(f"  {c['ad']} | Maaş: {c['aylik_maas']:.0f}₺/ay")
    odenmemis = [m for m in bu_ay_maas if not m['odendi']]
    if odenmemis:
        satirlar.append(f"Bu ay ödenmemiş maaş: {', '.join(m['ad'] for m in odenmemis)}")

    # ── HEDEF ─────────────────────────────────────────────────
    cur = await db.execute(
        "SELECT hedef_tutar FROM aylik_hedefler WHERE yil=? AND ay=?", (yil, ay)
    )
    hedef_row = await cur.fetchone()
    if hedef_row:
        hedef = hedef_row["hedef_tutar"]
        gerceklesen = ay_gelir
        yuzde = (gerceklesen / hedef * 100) if hedef else 0
        satirlar.append(f"\n## AYLIK HEDEF")
        satirlar.append(f"Hedef: {hedef:.0f}₺ | Gerçekleşen: {gerceklesen:.0f}₺ | %{yuzde:.0f}")

    # ── KARA LİSTE ─────────────────────────────────────────────
    cur = await db.execute("SELECT ad, telefon, sebep FROM kara_liste ORDER BY created_at DESC LIMIT 10")
    kara = [dict(r) for r in await cur.fetchall()]
    if kara:
        satirlar.append("\n## KARA LİSTE")
        for k in kara:
            satirlar.append(f"  {k['ad'] or '-'} | {k['telefon'] or '-'} | {k['sebep']}")

    return "\n".join(satirlar)


@router.post("/stt")
async def stt(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    audio_b64 = body.get("audio", "")
    mime = body.get("mime", "audio/webm")
    if not audio_b64:
        return {"text": ""}
    if not GEMINI_API_KEY:
        return {"text": ""}

    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {"text": "Bu ses kaydındaki Türkçe konuşmayı sadece yazıya dök. Başka hiçbir şey ekleme, noktalama koyma."},
                {"inline_data": {"mime_type": mime, "data": audio_b64}},
            ],
        }],
        "generationConfig": {"maxOutputTokens": 200, "temperature": 0},
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            for model in ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash"]:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}",
                    json=payload,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    return {"text": text.strip()}
                elif resp.status_code == 429:
                    continue
        return {"text": ""}
    except Exception:
        return {"text": ""}


@router.post("/sor")
async def sor(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    soru = (body.get("soru") or "").strip()
    if not soru:
        return {"cevap": "Lütfen bir soru yazın."}

    if not GEMINI_API_KEY:
        return {"cevap": "AI özelliği aktif değil. Railway'de GEMINI_API_KEY ortam değişkenini ayarlayın."}

    servis_verisi = await _servis_verisi(db)

    sistem_mesaji = f"""Sen 'Telefoncu Tayfun' servisinin akıllı asistanısın.
Türkçe konuşuyorsun. Kısa, net ve yardımcı cevaplar veriyorsun.
Sayısal verilerde ₺ sembolünü kullan. Gerektiğinde liste formatında yaz.
Sana servisin TÜM güncel veritabanı verisi verilmiştir — tamirler, müşteriler,
stok, kasa, 2.el cihazlar, sıfır cihazlar, garanti, borç, yedek telefon,
aksesuar, personel ve kara liste dahil.

{servis_verisi}

Kullanıcının sorusuna SADECE bu verilere dayanarak cevap ver.
Eğer sorulan bilgi veride yoksa bunu açıkça belirt."""

    MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"]
    payload = {
        "contents": [{"role": "user", "parts": [{"text": sistem_mesaji + "\n\nSoru: " + soru}]}],
        "generationConfig": {"maxOutputTokens": 600, "temperature": 0.4}
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            for model in MODELS:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}",
                    json=payload,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    cevap = data["candidates"][0]["content"]["parts"][0]["text"]
                    return {"cevap": cevap}
                elif resp.status_code == 429:
                    continue
                else:
                    return {"cevap": f"AI hatası ({model}): {resp.status_code}"}
            return {"cevap": "AI şu an yoğun, lütfen birazdan tekrar dene."}
    except Exception as e:
        return {"cevap": f"Bağlantı hatası: {str(e)[:100]}"}
