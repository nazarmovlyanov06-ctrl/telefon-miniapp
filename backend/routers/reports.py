import asyncpg
from fastapi import APIRouter, Depends, Query
from database import get_db
from auth import get_current_user, get_dukkan_id
import datetime

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard")
async def dashboard(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    today_date = datetime.date.today()
    today = today_date.isoformat()
    month_start_date = today_date.replace(day=1)
    month_start = month_start_date.isoformat()
    iki_gun_once = today_date - datetime.timedelta(days=2)
    yedi_gun_sonra = (today_date + datetime.timedelta(days=7)).isoformat()

    async def scalar(sql, *params):
        return await db.fetchval(sql, *params) or 0

    rows = await db.fetch(
        "SELECT status, COUNT(*) as c FROM repairs WHERE dukkan_id=$1 AND status != 'teslim' GROUP BY status",
        dukkan_id,
    )
    tamir_durumlar = {r["status"]: r["c"] for r in rows}

    # ⚠️ Uygulama genelinde kasa_hareketleri.tur için İKİ farklı yazım kullanılıyor:
    # bazı router'lar 'giris'/'cikis' yazıyor (aksesuar, parça iade), bazıları
    # 'gelir' yazıyor (tamir, 2.el, sıfır), giderler ise hep 'cikis' yazıyor —
    # literal 'gider' hiçbir yerde YAZILMIYOR. Eskiden burada sadece tur='gelir'/
    # 'gider' aranıyordu; sonuç: "Bugün Gider" her zaman 0 görünüyordu (gerçek
    # giderler 'cikis' olarak kayıtlı) ve "Bugün Gelir" aksesuar/parça iade
    # gelirini kaçırıyordu. IN (...) ile ikisi de kapsanıyor — kasa.py/ozet
    # endpoint'i zaten bu şekilde doğru hesaplıyordu.
    kasa_gelir_bugun = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tarih=$2 AND tur IN ('giris','gelir')",
        dukkan_id, today,
    )
    kasa_gider_bugun = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tarih=$2 AND tur IN ('cikis','gider')",
        dukkan_id, today,
    )

    stok_uyari = [dict(r) for r in await db.fetch(
        """SELECT name, quantity, min_quantity FROM parts
           WHERE dukkan_id=$1 AND (quantity <= COALESCE(min_quantity, 0) OR quantity = 0)
           ORDER BY quantity ASC LIMIT 5""",
        dukkan_id,
    )]

    # 2.El'de 60+ gündür stokta bekleyen cihazlar — sayfaya girip "Durgun
    # Önce" sıralamasını seçmeden dükkan sahibi bunu Ana Sayfa'da görsün diye.
    durgun_2el_uyari = [dict(r) for r in await db.fetch(
        """SELECT id, model, alis_fiyati,
                  (now()::date - created_at::date) as gun
           FROM ikinci_el
           WHERE dukkan_id=$1 AND durum='stokta' AND created_at <= now() - interval '60 days'
           ORDER BY created_at ASC LIMIT 5""",
        dukkan_id,
    )]

    # Aynı durgun stok mantığı Sıfır Cihaz için de — yeni bir telefon aylarca
    # satılmadan beklerse (özellikle 2.El'den bile daha hızlı değer kaybeder)
    # bunu da Ana Sayfa'da görsün.
    durgun_sifir_uyari = [dict(r) for r in await db.fetch(
        """SELECT id, model, alis_fiyati,
                  (now()::date - created_at::date) as gun
           FROM sifir_cihazlar
           WHERE dukkan_id=$1 AND durum='stokta' AND created_at <= now() - interval '60 days'
           ORDER BY created_at ASC LIMIT 5""",
        dukkan_id,
    )]

    # Dashboard'daki satırlara tıklayınca ayrı bir istek atmadan detay penceresi
    # açılabilsin diye buradaki sorgular sadece uyarı satırı için değil, o
    # kaydın tam detayını göstermeye yetecek kolonları da döndürüyor.
    garanti_uyari = [dict(r) for r in await db.fetch(
        """SELECT id, musteri_adi, telefon, cihaz, tamir_aciklama,
                  baslangic_tarihi, sure_gun, bitis_tarihi FROM garantiler
           WHERE dukkan_id=$1 AND aktif=true AND bitis_tarihi >= $2 AND bitis_tarihi <= $3
           ORDER BY bitis_tarihi ASC LIMIT 5""",
        dukkan_id, today, yedi_gun_sonra,
    )]

    borc_uyari = [dict(r) for r in await db.fetch(
        """SELECT d.id, COALESCE(c.name, d.alacakli_adi) as musteri_adi,
                  d.total_amount, d.paid_amount, d.total_amount - d.paid_amount as kalan,
                  d.payment_type, d.installment_count, d.due_date, d.notes
           FROM debts d LEFT JOIN customers c ON d.customer_id = c.id
           WHERE d.dukkan_id=$1 AND d.due_date < $2 AND d.total_amount > d.paid_amount
           ORDER BY d.due_date ASC LIMIT 5""",
        dukkan_id, today,
    )]

    aranacaklar = [dict(r) for r in await db.fetch(
        """SELECT r.id, r.repair_no, c.name as musteri_adi, c.phone as telefon,
                  r.device_model, r.fault_desc, r.diagnosis, r.final_price,
                  r.estimated_price, r.completed_at
           FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.dukkan_id=$1 AND r.status='hazir' AND (r.completed_at <= $2 OR r.completed_at IS NULL)
           ORDER BY r.completed_at ASC LIMIT 10""",
        dukkan_id, iki_gun_once,
    )]

    son_tamirler = [dict(r) for r in await db.fetch(
        """SELECT r.id, r.repair_no, c.name as musteri_adi, r.device_model,
                  r.fault_desc, r.status, r.created_at, r.final_price
           FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.dukkan_id=$1
           ORDER BY r.created_at DESC LIMIT 5""",
        dukkan_id,
    )]

    # "Bu ay kazanç" — kasa_hareketleri üzerinden, kaynak bazlı döküm ile birlikte
    # (yalnızca teslim edilmiş tamir gelirini değil, 2.el/sıfır/aksesuar/parça iade
    # gelirini de kapsar — kart üstündeki toplamla döküm listesi böylece birbirini tutar).
    kaynak_rows = await db.fetch(
        """SELECT COALESCE(kaynak,'diger') as k, COALESCE(SUM(tutar),0) as t
           FROM kasa_hareketleri
           WHERE dukkan_id=$1 AND tur IN ('giris','gelir') AND tarih>=$2 AND tarih<=$3
           GROUP BY k ORDER BY t DESC""",
        dukkan_id, month_start, today,
    )
    kaynak_ham = {r["k"]: float(r["t"]) for r in kaynak_rows}
    KAYNAK_LABEL = {
        "tamir": "Tamir gelirleri", "2el_satis": "2. El satış", "sifir_satis": "Sıfır cihaz",
        "aksesuar": "Aksesuar satış", "parca_iade": "Parça iade",
    }
    bu_ay_kaynaklar = []
    for k, label in KAYNAK_LABEL.items():
        t = kaynak_ham.pop(k, 0)
        if t > 0:
            bu_ay_kaynaklar.append({"kaynak": k, "label": label, "tutar": t})
    diger = sum(kaynak_ham.values())
    if diger > 0:
        bu_ay_kaynaklar.append({"kaynak": "diger", "label": "Diğer", "tutar": diger})
    bu_ay_gelir = sum(x["tutar"] for x in bu_ay_kaynaklar)

    bu_ay_tamir = await scalar(
        "SELECT COUNT(*) FROM repairs WHERE dukkan_id=$1 AND created_at >= $2", dukkan_id, month_start_date
    )

    # Kasa artık sadece patron'a açık (bkz. routers/kasa.py) — bu özet uç
    # noktası da aynı kısıtlamayı uygulamazsa, dashboard'daki "Bugün Gelir/
    # Gider" ve "Bu Ay Kazanç" kartları kapatılsa bile veri ağ isteğinde
    # (network sekmesi) hâlâ görünür kalırdı. Patron değilse bu alanlar sıfır.
    patron_mu = user["rol"] == "patron"

    return {
        "tamir_durumlar": tamir_durumlar,
        "kasa_bugun": {
            "gelir": kasa_gelir_bugun if patron_mu else 0,
            "gider": kasa_gider_bugun if patron_mu else 0,
            "net": (kasa_gelir_bugun - kasa_gider_bugun) if patron_mu else 0,
        },
        "bu_ay": {
            "gelir": bu_ay_gelir if patron_mu else 0,
            "tamir": bu_ay_tamir,
            "kaynaklar": bu_ay_kaynaklar if patron_mu else [],
        },
        "uyarilar": {
            "stok": stok_uyari, "garanti": garanti_uyari, "borc": borc_uyari,
            "durgun_2el": durgun_2el_uyari, "durgun_sifir": durgun_sifir_uyari,
        },
        "aranacaklar": aranacaklar,
        "son_tamirler": son_tamirler,
        "bugun": {
            "tamir_sayisi": await scalar(
                "SELECT COUNT(*) FROM repairs WHERE dukkan_id=$1 AND DATE(created_at)=$2", dukkan_id, today_date
            ),
            "teslim_sayisi": await scalar(
                "SELECT COUNT(*) FROM repairs WHERE dukkan_id=$1 AND DATE(delivered_at)=$2", dukkan_id, today_date
            ),
            "gelir": kasa_gelir_bugun if patron_mu else 0,
        },
        "bekleyen": {
            "tamir": sum(tamir_durumlar.get(s, 0) for s in ["bekliyor", "tamirde", "parca_bekleniyor"]),
            "borc": await scalar(
                "SELECT COUNT(*) FROM debts WHERE dukkan_id=$1 AND total_amount > paid_amount", dukkan_id
            ),
        },
        "stok_uyari": len(stok_uyari),
    }


@router.get("/repairs-by-status")
async def repairs_by_status(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT status, COUNT(*) as count FROM repairs WHERE dukkan_id=$1 GROUP BY status", dukkan_id
    )
    return {r["status"]: r["count"] for r in rows}


@router.get("/genel")
async def genel_stats(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    today = datetime.date.today()

    son7gun = []
    for i in range(6, -1, -1):
        gun = (today - datetime.timedelta(days=i)).isoformat()
        gelir = await db.fetchval(
            "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tarih=$2 AND tur IN ('gelir','giris')",
            dukkan_id, gun,
        )
        gider = await db.fetchval(
            "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tarih=$2 AND tur='gider'",
            dukkan_id, gun,
        )
        son7gun.append({"gun": gun, "gelir": float(gelir), "gider": float(gider)})

    son6ay = []
    for i in range(5, -1, -1):
        ay = today.month - i
        yil = today.year
        while ay <= 0:
            ay += 12
            yil -= 1
        ay_basi = f"{yil}-{ay:02d}-01"
        ay_sonu = f"{yil+1}-01-01" if ay == 12 else f"{yil}-{ay+1:02d}-01"
        gelir = await db.fetchval(
            "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tarih>=$2 AND tarih<$3 AND tur IN ('gelir','giris')",
            dukkan_id, ay_basi, ay_sonu,
        )
        gider = await db.fetchval(
            "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tarih>=$2 AND tarih<$3 AND tur='gider'",
            dukkan_id, ay_basi, ay_sonu,
        )
        son6ay.append({"ay": f"{yil}-{ay:02d}", "gelir": float(gelir), "gider": float(gider)})

    ariza_top = [dict(r) for r in await db.fetch(
        """SELECT fault_desc, COUNT(*) as c FROM repairs
           WHERE dukkan_id=$1 AND fault_desc IS NOT NULL AND fault_desc != ''
           GROUP BY LOWER(TRIM(fault_desc)), fault_desc ORDER BY c DESC LIMIT 8""",
        dukkan_id,
    )]

    musteri_top = [dict(r) for r in await db.fetch(
        """SELECT c.name, COALESCE(SUM(r.final_price),0) as toplam
           FROM customers c JOIN repairs r ON r.customer_id = c.id
           WHERE c.dukkan_id=$1 AND r.status='teslim' AND r.final_price > 0
           GROUP BY c.id ORDER BY toplam DESC LIMIT 6""",
        dukkan_id,
    )]

    rows = await db.fetch("SELECT status, COUNT(*) as c FROM repairs WHERE dukkan_id=$1 GROUP BY status", dukkan_id)
    tamir_durum = {r["status"]: r["c"] for r in rows}

    # Hangi toptancı parça iadelerini en çok reddediyor — sonuçlanmış (red/kabul/
    # değişim) iadeler üzerinden oran hesaplanır, hâlâ bekleyen/gönderilmiş
    # olanlar sayıma girmez (henüz sonuç belli değil).
    toptanci_red_rows = await db.fetch(
        """SELECT COALESCE(t.ad, 'Toptancı belirtilmedi') as toptanci_adi,
                  COUNT(*) FILTER (WHERE p.durum = 'reddedildi') as red_sayisi,
                  COUNT(*) FILTER (WHERE p.durum IN ('reddedildi', 'para_iade_alindi', 'parca_degisimi')) as sonuclanan
           FROM parca_iadeler p
           LEFT JOIN toptancilar t ON p.toptanci_id = t.id
           WHERE p.dukkan_id = $1
           GROUP BY t.id, t.ad
           HAVING COUNT(*) FILTER (WHERE p.durum = 'reddedildi') > 0
           ORDER BY red_sayisi DESC, sonuclanan DESC
           LIMIT 10""",
        dukkan_id,
    )
    toptanci_red = [
        {
            "toptanci_adi": r["toptanci_adi"],
            "red_sayisi": r["red_sayisi"],
            "sonuclanan": r["sonuclanan"],
            "red_orani": round(r["red_sayisi"] / r["sonuclanan"] * 100) if r["sonuclanan"] else 0,
        }
        for r in toptanci_red_rows
    ]

    # En çok satan aksesuarlar + toplam kâr — önceden aksesuar satışlarının
    # hiçbir özeti yoktu, hangi ürün en çok satıyor hiç görünmüyordu. Kâr,
    # ürünün GÜNCEL alış fiyatı üzerinden tahmini hesaplanır (satış anındaki
    # tarihsel alış fiyatı ayrıca saklanmıyor) — kesin muhasebe değil, kaba
    # bir gösterge.
    aksesuar_top_rows = await db.fetch(
        """SELECT a.ad, SUM(s.miktar) as adet, SUM(s.toplam) as ciro,
                  SUM(s.miktar * a.alis_fiyati) as maliyet
           FROM aksesuar_satislar s JOIN aksesuarlar a ON a.id = s.aksesuar_id
           WHERE s.dukkan_id=$1
           GROUP BY a.id, a.ad
           ORDER BY ciro DESC LIMIT 8""",
        dukkan_id,
    )
    aksesuar_top = [
        {"ad": r["ad"], "adet": r["adet"], "ciro": float(r["ciro"]), "kar": float(r["ciro"] - r["maliyet"])}
        for r in aksesuar_top_rows
    ]
    aksesuar_kar_toplam = await db.fetchval(
        """SELECT COALESCE(SUM(s.toplam - s.miktar * a.alis_fiyati), 0)
           FROM aksesuar_satislar s JOIN aksesuarlar a ON a.id = s.aksesuar_id
           WHERE s.dukkan_id=$1""",
        dukkan_id,
    ) or 0

    # 2.El için Aksesuar'daki gibi hiçbir analiz yoktu — sadece stok adedi
    # görünüyordu. En çok satan modeller + kâr + ortalama satış süresi
    # (alım-satım arası kaç gün geçtiği, "durgun stok" farkındalığı için).
    ikinciel_top_rows = await db.fetch(
        """SELECT model, COUNT(*) as adet, SUM(satis_fiyati) as ciro,
                  SUM(alis_fiyati) as alis_toplam,
                  SUM(COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m WHERE m.cihaz_id=c.id), 0)) as masraf_toplam
           FROM ikinci_el c
           WHERE c.dukkan_id=$1 AND c.durum='satildi'
           GROUP BY model
           ORDER BY ciro DESC LIMIT 8""",
        dukkan_id,
    )
    ikinciel_top = [
        {"model": r["model"], "adet": r["adet"], "ciro": float(r["ciro"] or 0),
         "kar": float((r["ciro"] or 0) - (r["alis_toplam"] or 0) - (r["masraf_toplam"] or 0))}
        for r in ikinciel_top_rows
    ]
    ikinciel_kar_toplam = await db.fetchval(
        """SELECT COALESCE(SUM(c.satis_fiyati - c.alis_fiyati -
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m WHERE m.cihaz_id=c.id), 0)), 0)
           FROM ikinci_el c WHERE c.dukkan_id=$1 AND c.durum='satildi'""",
        dukkan_id,
    ) or 0
    ikinciel_ort_satis_gun = await db.fetchval(
        """SELECT AVG(satis_tarihi::date - created_at::date)
           FROM ikinci_el WHERE dukkan_id=$1 AND durum='satildi'
                 AND satis_tarihi IS NOT NULL AND satis_tarihi != ''""",
        dukkan_id,
    )

    # Sıfır Cihaz için de aynı analiz — bkz. yukarıdaki ikinciel_top.
    sifir_top_rows = await db.fetch(
        """SELECT model, COUNT(*) as adet, SUM(satis_fiyati) as ciro,
                  SUM(alis_fiyati) as alis_toplam,
                  SUM(COALESCE((SELECT SUM(m.tutar) FROM sifir_cihaz_masraflar m WHERE m.cihaz_id=c.id), 0)) as masraf_toplam
           FROM sifir_cihazlar c
           WHERE c.dukkan_id=$1 AND c.durum='satildi'
           GROUP BY model
           ORDER BY ciro DESC LIMIT 8""",
        dukkan_id,
    )
    sifir_top = [
        {"model": r["model"], "adet": r["adet"], "ciro": float(r["ciro"] or 0),
         "kar": float((r["ciro"] or 0) - (r["alis_toplam"] or 0) - (r["masraf_toplam"] or 0))}
        for r in sifir_top_rows
    ]
    sifir_kar_toplam = await db.fetchval(
        """SELECT COALESCE(SUM(c.satis_fiyati - c.alis_fiyati -
                  COALESCE((SELECT SUM(m.tutar) FROM sifir_cihaz_masraflar m WHERE m.cihaz_id=c.id), 0)), 0)
           FROM sifir_cihazlar c WHERE c.dukkan_id=$1 AND c.durum='satildi'""",
        dukkan_id,
    ) or 0
    sifir_ort_satis_gun = await db.fetchval(
        """SELECT AVG(satis_tarihi::date - created_at::date)
           FROM sifir_cihazlar WHERE dukkan_id=$1 AND durum='satildi'
                 AND satis_tarihi IS NOT NULL AND satis_tarihi != ''""",
        dukkan_id,
    )

    async def scalar(sql, *params):
        return await db.fetchval(sql, *params) or 0

    return {
        "son7gun": son7gun,
        "son6ay": son6ay,
        "ariza_top": ariza_top,
        "musteri_top": musteri_top,
        "tamir_durum": tamir_durum,
        "toptanci_red": toptanci_red,
        "aksesuar_top": aksesuar_top,
        "aksesuar_kar_toplam": aksesuar_kar_toplam,
        "ikinciel_top": ikinciel_top,
        "ikinciel_kar_toplam": ikinciel_kar_toplam,
        "ikinciel_ort_satis_gun": float(ikinciel_ort_satis_gun) if ikinciel_ort_satis_gun is not None else None,
        "sifir_top": sifir_top,
        "sifir_kar_toplam": sifir_kar_toplam,
        "sifir_ort_satis_gun": float(sifir_ort_satis_gun) if sifir_ort_satis_gun is not None else None,
        "sayilar": {
            "musteri": await scalar("SELECT COUNT(*) FROM customers WHERE dukkan_id=$1", dukkan_id),
            "tamir_toplam": await scalar("SELECT COUNT(*) FROM repairs WHERE dukkan_id=$1", dukkan_id),
            "ikinciel_stok": await scalar(
                "SELECT COUNT(*) FROM ikinci_el WHERE dukkan_id=$1 AND durum='stokta'", dukkan_id
            ),
            "sifir_stok": await scalar(
                "SELECT COUNT(*) FROM sifir_cihazlar WHERE dukkan_id=$1 AND durum='stokta'", dukkan_id
            ),
            "parca_cesit": await scalar("SELECT COUNT(*) FROM parts WHERE dukkan_id=$1", dukkan_id),
            "aksesuar_cesit": await scalar("SELECT COUNT(*) FROM aksesuarlar WHERE dukkan_id=$1", dukkan_id),
        },
    }


@router.get("/monthly")
async def monthly_report(
    year: int = Query(None),
    month: int = Query(None),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    now = datetime.date.today()
    year = year or now.year
    month = month or now.month
    start = datetime.date(year, month, 1)
    end = datetime.date(year + 1, 1, 1) if month == 12 else datetime.date(year, month + 1, 1)

    rows = await db.fetch(
        """SELECT DATE(created_at) as day, COUNT(*) as count,
                  COALESCE(SUM(final_price),0) as gelir
           FROM repairs WHERE dukkan_id=$1 AND created_at >= $2 AND created_at < $3
           GROUP BY DATE(created_at) ORDER BY day""",
        dukkan_id, start, end,
    )
    return [dict(r) for r in rows]


@router.get("/feed")
async def aktivite_feed(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    today = datetime.date.today()
    rows = await db.fetch(
        """SELECT r.id, r.repair_no, r.device_model, r.status,
                  c.name as musteri_adi,
                  u.ad as guncelleyen,
                  r.updated_at
           FROM repairs r
           LEFT JOIN customers c ON r.customer_id = c.id
           LEFT JOIN kullanicilar u ON u.id = r.son_guncelleyen_id
           WHERE r.dukkan_id = $1 AND r.son_guncelleyen_id IS NOT NULL
             AND DATE(r.updated_at) = $2
           ORDER BY r.updated_at DESC LIMIT 30""",
        dukkan_id, today,
    )
    return [dict(r) for r in rows]
