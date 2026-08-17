"""
Kapsamlı demo dükkân oluşturucu — SaaS'ı tanıtmak için her modülü gerçekçi
veriyle doldurur (müşteri, tamir, stok, kasa, borç, garanti, 2.el, sıfır,
aksesuar, maaş, vitrin, portal...).

Kullanım (container içinde):  python seed_demo_full.py
Aynı slug varsa önce siler, tekrar tekrar çalıştırılabilir.

Görseller: telif riski olmaması için dışarıdan indirilmez, SVG olarak
üretilir (uploads altına yazılır, StaticFiles servis eder).
"""
import asyncio
import json
import os
import random
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta

import asyncpg

from auth import hash_sifre
from config import DATABASE_URL

SLUG = "yildiz-teknik"
DUKKAN_AD = "Yıldız Teknik Servis"
PATRON_EMAIL = "demo@telefonservis.com"
PATRON_SIFRE = "Demo1234"

UPLOAD_ROOT = os.path.join(os.path.dirname(__file__), "..", "data", "uploads")
BUGUN = datetime.now()

random.seed(20260817)  # her çalıştırmada aynı demo


def g(n):
    """n gün önce (datetime)."""
    return BUGUN - timedelta(days=n)


def gs(n):
    """n gün önce (TEXT tarih kolonları için 'YYYY-MM-DD')."""
    return g(n).strftime("%Y-%m-%d")


# ── Görsel üretimi ────────────────────────────────────────────────────────

MARKA_RENK = {
    "iPhone": ("#2b5876", "#4e4376"), "Samsung": ("#1e3c72", "#2a5298"),
    "Xiaomi": ("#c94b4b", "#4b134f"), "Huawei": ("#870000", "#190a05"),
    "Oppo": ("#134e5e", "#71b280"), "Realme": ("#f2994a", "#f2c94c"),
    "Poco": ("#ee9ca7", "#3d3d3d"), "Tecno": ("#485563", "#29323c"),
}


def _renk(model: str):
    for marka, renk in MARKA_RENK.items():
        if marka.lower() in model.lower():
            return renk
    return ("#3a3f47", "#1c1f24")


def _yaz(subdir: str, dukkan_id: int, icerik: str) -> str:
    klasor = os.path.join(UPLOAD_ROOT, subdir, str(dukkan_id))
    os.makedirs(klasor, exist_ok=True)
    ad = f"{uuid.uuid4().hex}.svg"
    with open(os.path.join(klasor, ad), "w", encoding="utf-8") as f:
        f.write(icerik)
    return f"/uploads/{subdir}/{dukkan_id}/{ad}"


_UA = "TelefonServisDemoSeed/1.0 (demo veri doldurucu)"
_gorsel_onbellek = {}


def _wikimedia_indir(sorgu: str, subdir: str, dukkan_id: int):
    """Wikimedia Commons'tan gerçek ürün fotoğrafı indirir.
    Bulunamazsa/başarısız olursa None döner, çağıran SVG'ye düşer."""
    if sorgu in _gorsel_onbellek:
        return _gorsel_onbellek[sorgu]
    try:
        api = ("https://commons.wikimedia.org/w/api.php?action=query&generator=search"
               "&gsrsearch=" + urllib.parse.quote(sorgu) +
               "&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|mime"
               "&iiurlwidth=800&format=json")
        req = urllib.request.Request(api, headers={"User-Agent": _UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.load(r)
        sayfalar = (data.get("query") or {}).get("pages") or {}
        aday = None
        for p in sayfalar.values():
            ii = (p.get("imageinfo") or [{}])[0]
            if ii.get("mime") in ("image/jpeg", "image/png") and ii.get("thumburl"):
                aday = ii["thumburl"]
                break
        if not aday:
            return None

        req2 = urllib.request.Request(aday, headers={"User-Agent": _UA})
        with urllib.request.urlopen(req2, timeout=25) as r:
            icerik = r.read()
        if len(icerik) < 3000:
            return None

        uzanti = "png" if aday.lower().endswith(".png") else "jpg"
        klasor = os.path.join(UPLOAD_ROOT, subdir, str(dukkan_id))
        os.makedirs(klasor, exist_ok=True)
        ad = f"{uuid.uuid4().hex}.{uzanti}"
        with open(os.path.join(klasor, ad), "wb") as f:
            f.write(icerik)
        url = f"/uploads/{subdir}/{dukkan_id}/{ad}"
        _gorsel_onbellek[sorgu] = url
        print(f"  foto indirildi: {sorgu}")
        return url
    except Exception as e:
        print(f"  foto alinamadi ({sorgu}): {e}")
        return None


def telefon_gorseli(dukkan_id: int, model: str, subdir: str) -> str:
    gercek = _wikimedia_indir(f"{model} smartphone", subdir, dukkan_id)
    if gercek:
        return gercek
    return _telefon_svg(dukkan_id, model, subdir)


def _telefon_svg(dukkan_id: int, model: str, subdir: str) -> str:
    r1, r2 = _renk(model)
    return _yaz(subdir, dukkan_id, f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="{r1}"/><stop offset="1" stop-color="{r2}"/></linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0.6" y2="1">
<stop offset="0" stop-color="#ffffff" stop-opacity="0.20"/>
<stop offset="1" stop-color="#ffffff" stop-opacity="0.02"/></linearGradient></defs>
<rect width="600" height="600" fill="url(#a)"/>
<g transform="translate(300 285)">
<rect x="-92" y="-170" width="184" height="340" rx="26" fill="#0e1013" opacity="0.55"/>
<rect x="-86" y="-164" width="172" height="328" rx="22" fill="#15181d"/>
<rect x="-78" y="-156" width="156" height="312" rx="17" fill="url(#s)"/>
<rect x="-26" y="-152" width="52" height="11" rx="5" fill="#0e1013"/>
<circle cx="52" cy="-116" r="15" fill="#0b0d10" opacity="0.85"/>
<circle cx="52" cy="-116" r="7" fill="#2a3038"/>
</g>
<text x="300" y="545" text-anchor="middle" fill="#ffffff" font-family="Segoe UI,Arial,sans-serif"
 font-size="34" font-weight="700" opacity="0.95">{model}</text>
</svg>""")


AKSESUAR_SORGU = {
    "Şarj Aleti": "usb power adapter charger",
    "Kablo": "usb cable",
    "Kılıf": "smartphone case cover",
    "Kırılmaz Cam": "smartphone screen protector",
    "Kulaklık": "earphones headphones",
    "Powerbank": "power bank battery charger",
}


def aksesuar_gorseli(dukkan_id: int, ad: str, kategori: str) -> str:
    gercek = _wikimedia_indir(AKSESUAR_SORGU.get(kategori, kategori), "aksesuar", dukkan_id)
    if gercek:
        return gercek
    return _aksesuar_svg(dukkan_id, ad, kategori)


def _aksesuar_svg(dukkan_id: int, ad: str, kategori: str) -> str:
    renkler = {
        "Şarj Aleti": ("#f2994a", "#8e2de2"), "Kılıf": ("#11998e", "#38ef7d"),
        "Kırılmaz Cam": ("#2193b0", "#6dd5ed"), "Kulaklık": ("#5f2c82", "#49a09d"),
        "Powerbank": ("#414345", "#232526"), "Kablo": ("#e65c00", "#f9d423"),
    }
    r1, r2 = renkler.get(kategori, ("#3a3f47", "#1c1f24"))
    kisa = ad if len(ad) <= 22 else ad[:21] + "…"
    return _yaz("aksesuar", dukkan_id, f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="{r1}"/><stop offset="1" stop-color="{r2}"/></linearGradient></defs>
<rect width="600" height="600" fill="url(#a)"/>
<circle cx="300" cy="265" r="132" fill="#ffffff" opacity="0.13"/>
<circle cx="300" cy="265" r="96" fill="#0e1013" opacity="0.30"/>
<text x="300" y="283" text-anchor="middle" fill="#ffffff" font-family="Segoe UI,Arial,sans-serif"
 font-size="72" font-weight="800" opacity="0.9">{kategori[0]}</text>
<text x="300" y="500" text-anchor="middle" fill="#ffffff" font-family="Segoe UI,Arial,sans-serif"
 font-size="30" font-weight="700" opacity="0.95">{kisa}</text>
<text x="300" y="536" text-anchor="middle" fill="#ffffff" font-family="Segoe UI,Arial,sans-serif"
 font-size="21" opacity="0.65">{kategori}</text>
</svg>""")


GALERI_SORGU = {
    "Dükkânımız": "mobile phone repair shop interior",
    "Tamir Masamız": "electronics repair workbench soldering",
    "Teşhir Reyonu": "mobile phone store display",
    "Ekibimiz": "phone repair technician working",
}


def galeri_gorseli(dukkan_id: int, baslik: str, r1: str, r2: str) -> str:
    gercek = _wikimedia_indir(GALERI_SORGU.get(baslik, baslik), "galeri", dukkan_id)
    if gercek:
        return gercek
    return _galeri_svg(dukkan_id, baslik, r1, r2)


def _galeri_svg(dukkan_id: int, baslik: str, r1: str, r2: str) -> str:
    return _yaz("galeri", dukkan_id, f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="{r1}"/><stop offset="1" stop-color="{r2}"/></linearGradient></defs>
<rect width="800" height="600" fill="url(#a)"/>
<g opacity="0.16" fill="#ffffff">
<rect x="70" y="360" width="660" height="170" rx="16"/>
<rect x="110" y="250" width="150" height="110" rx="10"/>
<rect x="300" y="215" width="200" height="145" rx="10"/>
<rect x="540" y="265" width="150" height="95" rx="10"/></g>
<text x="400" y="120" text-anchor="middle" fill="#ffffff" font-family="Segoe UI,Arial,sans-serif"
 font-size="44" font-weight="800" opacity="0.95">{baslik}</text>
</svg>""")


def logo_gorseli(dukkan_id: int) -> str:
    return _yaz("dukkan-logo", dukkan_id, """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#f6a24a"/><stop offset="1" stop-color="#b9761f"/></linearGradient></defs>
<rect width="300" height="300" rx="70" fill="#191b20"/>
<circle cx="150" cy="150" r="104" fill="none" stroke="url(#a)" stroke-width="9"/>
<path d="M150 74 l19 55 h58 l-47 34 18 55 -48-34 -48 34 18-55 -47-34 h58 z" fill="url(#a)"/>
</svg>""")


def kapak_gorseli(dukkan_id: int) -> str:
    return _yaz("dukkan-kapak", dukkan_id, """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 600">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#20262e"/><stop offset="0.5" stop-color="#2f3742"/>
<stop offset="1" stop-color="#14171b"/></linearGradient></defs>
<rect width="1600" height="600" fill="url(#a)"/>
<g opacity="0.10" fill="#f6a24a">
<circle cx="240" cy="150" r="150"/><circle cx="1380" cy="470" r="200"/>
<circle cx="820" cy="90" r="90"/></g>
<g opacity="0.20" fill="none" stroke="#f6a24a" stroke-width="3">
<rect x="640" y="170" width="150" height="270" rx="26"/>
<rect x="830" y="210" width="120" height="230" rx="22"/></g>
</svg>""")


# ── Veri sabitleri ────────────────────────────────────────────────────────

MUSTERILER = [
    ("Ahmet Yılmaz", "05321112233", "Sürekli müşteri, toptan ekran alıyor", 9),
    ("Fatma Kaya", "05452223344", "", 4),
    ("Mehmet Demir", "05553334455", "Kurumsal — Demir Ticaret", 12),
    ("Ayşe Çelik", "05414445566", "", 2),
    ("Mustafa Şahin", "05515556677", "Fiyat konusunda hassas", 5),
    ("Zeynep Arslan", "05366667788", "", 3),
    ("İbrahim Koç", "05427778899", "Kargoyla gönderiyor", 7),
    ("Hatice Güneş", "05538889900", "", 1),
    ("Ali Polat", "05349990011", "Taksitli alışveriş yapıyor", 6),
    ("Emine Yıldız", "05480001122", "", 2),
    ("Burak Aydın", "05321234501", "", 3),
    ("SelinÖztürk", "05337654321", "Aksesuar müşterisi", 8),
    ("Kemal Doğan", "05391112244", "", 1),
    ("Nur Erdem", "05356667711", "", 2),
]

PARCALAR = [
    ("iPhone 13 Komple Ekran", "iPhone 13", "Komple Ekran", 6, 2, 3400, 4600),
    ("iPhone 14 Komple Ekran", "iPhone 14", "Komple Ekran", 4, 2, 4200, 5600),
    ("iPhone 12 Komple Ekran", "iPhone 12", "Komple Ekran", 3, 2, 2900, 3950),
    ("iPhone 11 Komple Ekran", "iPhone 11", "Komple Ekran", 1, 2, 2100, 2950),
    ("iPhone 13 Batarya", "iPhone 13", "Batarya (Pil)", 9, 3, 780, 1250),
    ("iPhone 12 Batarya", "iPhone 12", "Batarya (Pil)", 7, 3, 690, 1150),
    ("iPhone 11 Batarya", "iPhone 11", "Batarya (Pil)", 2, 3, 620, 1050),
    ("iPhone 13 Şarj Bordu", "iPhone 13", "Şarj Bordu", 5, 2, 420, 750),
    ("iPhone 12 Arka Kapak", "iPhone 12", "Arka Kapak", 4, 2, 560, 950),
    ("Samsung S23 Komple Ekran", "Samsung Galaxy S23", "Komple Ekran", 3, 2, 3900, 5300),
    ("Samsung S22 Komple Ekran", "Samsung Galaxy S22", "Komple Ekran", 2, 2, 3300, 4500),
    ("Samsung A54 Komple Ekran", "Samsung Galaxy A54", "Komple Ekran", 6, 3, 1750, 2600),
    ("Samsung A53 Komple Ekran", "Samsung Galaxy A53", "Komple Ekran", 1, 3, 1600, 2400),
    ("Samsung A54 Batarya", "Samsung Galaxy A54", "Batarya (Pil)", 8, 3, 480, 850),
    ("Samsung S23 Şarj Soketi", "Samsung Galaxy S23", "Şarj Soketi", 5, 2, 360, 680),
    ("Xiaomi Redmi Note 12 Ekran", "Xiaomi Redmi Note 12", "Komple Ekran", 4, 2, 1250, 1950),
    ("Xiaomi 13T Ekran", "Xiaomi 13T", "Komple Ekran", 2, 2, 2200, 3100),
    ("Xiaomi Redmi Note 12 Batarya", "Xiaomi Redmi Note 12", "Batarya (Pil)", 6, 3, 390, 720),
    ("Huawei P60 Ekran", "Huawei P60", "Komple Ekran", 1, 1, 2600, 3600),
    ("Oppo A78 Ekran", "Oppo A78", "Komple Ekran", 3, 2, 1150, 1800),
    ("Realme C55 Ekran", "Realme C55", "Komple Ekran", 2, 2, 980, 1600),
    ("Ön Kamera — iPhone 13", "iPhone 13", "Ön Kamera", 4, 2, 520, 900),
    ("Arka Kamera — iPhone 13", "iPhone 13", "Arka Kamera", 2, 2, 1100, 1750),
    ("Titreşim Motoru — Genel", "Genel", "Titreşim Motoru", 12, 4, 90, 200),
    ("Buzzer Hoparlör — iPhone", "iPhone Genel", "Buzzer (Hoparlör)", 10, 4, 130, 290),
    ("Kalem Havya Ucu", "Genel", "Yedek Havya Ucu", 15, 5, 45, 110),
]

TOPTANCILAR = [
    ("Mega Parça Elektronik", "02124445566", "İstanbul", "Ekran ve batarya — 2 gün kargo"),
    ("Anadolu Teknik", "03124443322", "Ankara", "Uygun fiyat, kargo 3 gün"),
    ("Ege Mobil Parça", "02324441199", "İzmir", "Samsung parçalarında iyi"),
    ("Star Aksesuar", "02123338877", "İstanbul", "Aksesuar toptan"),
]

ARIZALAR = [
    ("Ekran kırık, dokunmatik çalışmıyor", "Komple ekran değişimi yapıldı"),
    ("Şarj olmuyor", "Şarj bordu değişti, test edildi"),
    ("Batarya çabuk bitiyor", "Batarya değişimi, kapasite %100"),
    ("Su hasarı — açılmıyor", "Anakart temizliği yapıldı, kurutuldu"),
    ("Hoparlörden ses gelmiyor", "Buzzer değişimi"),
    ("Ön kamera bulanık", "Ön kamera modülü değişti"),
    ("Arka cam kırık", "Arka kapak değişimi"),
    ("Titreşim çalışmıyor", "Titreşim motoru değişti"),
    ("Ekranda çizgiler var", "Ekran değişimi"),
    ("Cihaz çok ısınıyor", "Termal macun yenilendi, yazılım güncellendi"),
]

CIHAZ_MODELLERI = [
    "iPhone 13", "iPhone 14", "iPhone 12", "iPhone 11", "iPhone 15 Pro",
    "Samsung Galaxy S23", "Samsung Galaxy A54", "Samsung Galaxy S22",
    "Xiaomi Redmi Note 12", "Xiaomi 13T", "Huawei P60", "Oppo A78", "Realme C55",
]

AKSESUARLAR = [
    ("Apple 20W USB-C Adaptör", "Şarj Aleti", 18, 320, 590),
    ("Samsung 25W Hızlı Şarj", "Şarj Aleti", 14, 280, 520),
    ("USB-C to Lightning Kablo 1m", "Kablo", 25, 90, 220),
    ("USB-C to USB-C Kablo 2m", "Kablo", 20, 110, 260),
    ("iPhone 13 Şeffaf Silikon Kılıf", "Kılıf", 30, 45, 150),
    ("iPhone 14 Deri Kılıf", "Kılıf", 12, 180, 420),
    ("Samsung A54 Darbeye Dayanıklı Kılıf", "Kılıf", 16, 60, 190),
    ("iPhone 13 Kırılmaz Cam", "Kırılmaz Cam", 40, 25, 120),
    ("Samsung S23 Kırılmaz Cam", "Kırılmaz Cam", 22, 30, 140),
    ("Privacy Ekran Koruyucu", "Kırılmaz Cam", 9, 55, 180),
    ("Bluetooth Kulaklık TWS", "Kulaklık", 11, 340, 750),
    ("Kablolu Kulaklık 3.5mm", "Kulaklık", 26, 60, 160),
    ("10000mAh Powerbank", "Powerbank", 8, 380, 790),
    ("20000mAh Hızlı Powerbank", "Powerbank", 5, 640, 1250),
]


async def main():
    db = await asyncpg.connect(DATABASE_URL)
    print("Bağlandı.")

    # Aynı demo varsa temizle (CASCADE tüm alt tabloları siler)
    await db.execute("DELETE FROM dukkanlar WHERE slug = $1", SLUG)

    dukkan_id = await db.fetchval(
        """INSERT INTO dukkanlar
           (ad, slug, telefon, adres, sehir, abonelik_durumu, abonelik_bitis, plan,
            vitrin_aktif, vitrin_aciklama, calisma_saatleri, hizmetler, created_at)
           VALUES ($1,$2,$3,$4,$5,'aktif',$6,'pro',true,$7,$8,$9,$10) RETURNING id""",
        DUKKAN_AD, SLUG, "0216 555 44 33", "Bağdat Cad. No:128, Kadıköy", "İstanbul",
        BUGUN + timedelta(days=210),
        "2009'dan beri Kadıköy'de telefon tamiri, sıfır ve ikinci el cihaz satışı. "
        "Orijinal parça, garantili işçilik, aynı gün teslim.",
        "Hafta içi 09:00-19:30 · Cumartesi 10:00-18:00",
        "Ekran Değişimi, Batarya Değişimi, Su Hasarı Onarımı, Anakart Tamiri, "
        "Kamera Değişimi, Yazılım Güncelleme, Veri Kurtarma",
        g(400),
    )
    print(f"Dükkan: {dukkan_id}")

    await db.execute("UPDATE dukkanlar SET logo_url=$1, kapak_url=$2 WHERE id=$3",
                     logo_gorseli(dukkan_id), kapak_gorseli(dukkan_id), dukkan_id)

    for baslik, r1, r2 in [
        ("Dükkânımız", "#1f4037", "#99f2c8"), ("Tamir Masamız", "#42275a", "#734b6d"),
        ("Teşhir Reyonu", "#232526", "#414345"), ("Ekibimiz", "#0f2027", "#2c5364"),
    ]:
        await db.execute("INSERT INTO dukkan_galeri (dukkan_id, foto_url, baslik) VALUES ($1,$2,$3)",
                         dukkan_id, galeri_gorseli(dukkan_id, baslik, r1, r2), baslik)

    # ── Kullanıcılar ──────────────────────────────────────────────────
    patron_id = await db.fetchval(
        """INSERT INTO kullanicilar (dukkan_id, email, sifre_hash, ad, rol, durum, aktif, created_at, son_giris_at)
           VALUES ($1,$2,$3,$4,'patron','aktif',true,$5,$6) RETURNING id""",
        dukkan_id, PATRON_EMAIL, hash_sifre(PATRON_SIFRE), "Yusuf Yıldız", g(400), g(0))
    personel = {}
    for email, ad, rol in [
        ("emre@telefonservis.com", "Emre Şen", "teknisyen"),
        ("selin@telefonservis.com", "Selin Ak", "satis"),
        ("burak@telefonservis.com", "Burak Tan", "cirak"),
    ]:
        personel[rol] = await db.fetchval(
            """INSERT INTO kullanicilar (dukkan_id, email, sifre_hash, ad, rol, durum, aktif, created_at, son_giris_at)
               VALUES ($1,$2,$3,$4,$5,'aktif',true,$6,$7) RETURNING id""",
            dukkan_id, email, hash_sifre("Demo1234"), ad, rol, g(300), g(random.randint(0, 3)))

    calisanlar = {}
    for ad, tel, maas in [("Emre Şen", "05321110001", 42000), ("Selin Ak", "05321110002", 38000),
                          ("Burak Tan", "05321110003", 26000)]:
        calisanlar[ad] = await db.fetchval(
            "INSERT INTO calisanlar (dukkan_id, ad, telefon, aylik_maas, aktif) VALUES ($1,$2,$3,$4,true) RETURNING id",
            dukkan_id, ad, tel, maas)

    # ── Müşteriler ────────────────────────────────────────────────────
    musteri_id = {}
    for i, (ad, tel, not_, ziyaret) in enumerate(MUSTERILER):
        portal = i in (0, 2, 11)
        musteri_id[ad] = await db.fetchval(
            """INSERT INTO customers (dukkan_id, name, phone, notes, visit_count, created_at,
                                      sifre_hash, portal_kayit_at, dukkan_gordu)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id""",
            dukkan_id, ad, tel, not_ or None, ziyaret, g(random.randint(60, 380)),
            hash_sifre("Demo1234") if portal else None,
            g(random.randint(2, 40)) if portal else None,
            not (i == 11))  # Selin Öztürk yeni üye bildirimi olarak dursun

    # ── Toptancılar + alışlar ────────────────────────────────────────
    toptanci_id = {}
    for ad, tel, sehir, notlar in TOPTANCILAR:
        toptanci_id[ad] = await db.fetchval(
            "INSERT INTO toptancilar (dukkan_id, ad, telefon, sehir, notlar, created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
            dukkan_id, ad, tel, sehir, notlar, g(random.randint(120, 360)))

    for _ in range(14):
        t = random.choice(list(toptanci_id.values()))
        urun = random.choice(PARCALAR)
        miktar = random.randint(2, 8)
        birim = urun[5]
        gun = random.randint(3, 110)
        await db.execute(
            """INSERT INTO toptanci_alislar (dukkan_id, toptanci_id, urun, miktar, birim_fiyat, toplam, tarih, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""",
            dukkan_id, t, urun[0], miktar, birim, miktar * birim, gs(gun), g(gun))

    # ── Parçalar ──────────────────────────────────────────────────────
    part_id = {}
    for ad, model, tip, adet, minim, alis, satis in PARCALAR:
        part_id[ad] = await db.fetchval(
            """INSERT INTO parts (dukkan_id, name, category, device_model, part_type, quantity,
                                  min_quantity, cost_price, purchase_price, sale_price, supplier, created_by, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12) RETURNING id""",
            dukkan_id, ad, tip, model, tip, adet, minim, alis, satis,
            random.choice([t[0] for t in TOPTANCILAR]), patron_id, g(random.randint(20, 200)))

    # ── Tamirler ──────────────────────────────────────────────────────
    durumlar = (["teslim"] * 12) + ["hazir", "hazir", "tamirde", "tamirde", "tamirde",
                                    "parca_bekleniyor", "parca_bekleniyor", "bekliyor", "bekliyor", "bekliyor"]
    random.shuffle(durumlar)
    tamir_bilgi = []
    for i, durum in enumerate(durumlar):
        ad = random.choice(list(musteri_id.keys()))
        model = random.choice(CIHAZ_MODELLERI)
        ariza, teshis = random.choice(ARIZALAR)
        acilis = random.randint(1, 95) if durum == "teslim" else random.randint(0, 18)
        ucret = random.choice([950, 1250, 1650, 1950, 2400, 2900, 3400, 3900, 4600, 5300])
        repair_no = f"T{(BUGUN - timedelta(days=acilis)).strftime('%y%m%d')}{i+1:04d}"
        imei = "35" + "".join(str(random.randint(0, 9)) for _ in range(13))

        tamirde_at = g(acilis - 0.2) if durum != "bekliyor" else None
        completed_at = g(max(acilis - 1, 0)) if durum in ("hazir", "teslim") else None
        delivered_at = g(max(acilis - 2, 0)) if durum == "teslim" else None
        kilit = random.choice([("pin", "1234"), ("pin", "4728"), ("desen", "0-1-2-5-8"), (None, None)])

        rid = await db.fetchval(
            """INSERT INTO repairs (dukkan_id, repair_no, customer_id, device_model, imei, problem,
                   fault_desc, diagnosis, status, estimated_price, final_price, payment_type,
                   warranty_days, screen_lock_type, screen_lock_value, notes, assigned_to,
                   created_by, son_guncelleyen_id, created_at, updated_at,
                   tamirde_at, completed_at, delivered_at)
               VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17,$18,$19,$20,$21,$22)
               RETURNING id""",
            dukkan_id, repair_no, musteri_id[ad], model, imei, ariza,
            teshis if durum in ("hazir", "teslim", "tamirde") else None, durum,
            ucret, ucret if durum == "teslim" else None,
            random.choice(["nakit", "kart", "havale"]) if durum == "teslim" else None,
            random.choice([90, 180, 90, 0]),
            kilit[0], kilit[1],
            random.choice([None, None, "Müşteri acele istiyor", "Yedek parça sipariş edildi"]),
            personel["teknisyen"], patron_id,
            g(acilis), g(max(acilis - 2, 0)), tamirde_at, completed_at, delivered_at)
        tamir_bilgi.append((rid, repair_no, ad, model, durum, ucret, acilis, teshis))

        # Kullanılan parça (uygun model varsa)
        uygun = [k for k in part_id if model.split()[0].lower() in k.lower()]
        if uygun and durum in ("tamirde", "hazir", "teslim"):
            pad = random.choice(uygun)
            pfiyat = next(p[6] for p in PARCALAR if p[0] == pad)
            await db.execute(
                "INSERT INTO repair_parts (dukkan_id, repair_id, part_id, quantity, unit_price) VALUES ($1,$2,$3,1,$4)",
                dukkan_id, rid, part_id[pad], pfiyat)
            await db.execute(
                """INSERT INTO stok_hareketleri (dukkan_id, part_id, hareket, miktar, sebep, aciklama, tarih, created_by, created_at)
                   VALUES ($1,$2,'cikis',1,'tamir',$3,$4,$5,$6)""",
                dukkan_id, part_id[pad], f"{repair_no} tamirinde kullanıldı", gs(acilis), patron_id, g(acilis))

        await db.execute(
            """INSERT INTO imei_history (dukkan_id, imei, device_model, customer_id, repair_id, action, notes, created_at)
               VALUES ($1,$2,$3,$4,$5,'tamir',$6,$7)""",
            dukkan_id, imei, model, musteri_id[ad], rid, ariza, g(acilis))

        if durum == "teslim":
            await db.execute(
                """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak, created_at)
                   VALUES ($1,$2,'gelir',$3,$4,$5,'tamir',$6)""",
                dukkan_id, gs(max(acilis - 2, 0)), random.choice(["nakit", "kart"]), ucret,
                f"Tamir geliri — {repair_no} ({model})", g(max(acilis - 2, 0)))

    print(f"Tamir: {len(tamir_bilgi)}")

    # ── Garantiler (teslim edilenlerden) ─────────────────────────────
    for rid, rno, ad, model, durum, ucret, acilis, teshis in tamir_bilgi:
        if durum != "teslim":
            continue
        sure = random.choice([90, 180])
        bas = max(acilis - 2, 0)
        tel = next(m[1] for m in MUSTERILER if m[0] == ad)
        await db.execute(
            """INSERT INTO garantiler (dukkan_id, musteri_adi, telefon, tamir_id, cihaz, tamir_aciklama,
                   baslangic_tarihi, sure_gun, bitis_tarihi, aktif)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)""",
            dukkan_id, ad, tel, rid, model, teshis or "Tamir",
            gs(bas), sure, (g(bas) + timedelta(days=sure)).strftime("%Y-%m-%d"))

    # ── 2. El cihazlar ────────────────────────────────────────────────
    ikinci = [
        ("iPhone 13", "Mavi", "128GB", "4GB", 24500, 29900, "satildi"),
        ("iPhone 12", "Siyah", "64GB", "4GB", 17500, 21900, "satildi"),
        ("Samsung Galaxy S22", "Yeşil", "256GB", "8GB", 16800, 21500, "satildi"),
        ("iPhone 11", "Beyaz", "64GB", "4GB", 12500, None, "stokta"),
        ("iPhone 14", "Mor", "128GB", "6GB", 31000, None, "stokta"),
        ("Samsung Galaxy S23", "Siyah", "256GB", "8GB", 27500, None, "stokta"),
        ("Xiaomi 13T", "Mavi", "256GB", "12GB", 14500, None, "stokta"),
        ("Huawei P60", "Gümüş", "256GB", "8GB", 15800, 19500, "satildi"),
        ("Oppo A78", "Siyah", "128GB", "8GB", 6800, None, "stokta"),
    ]
    for model, renk, dep, ram, alis, satis, durum in ikinci:
        gun = random.randint(10, 120)
        alici = random.choice(list(musteri_id.keys())) if durum == "satildi" else None
        cid = await db.fetchval(
            """INSERT INTO ikinci_el (dukkan_id, model, imei, renk, depolama, ram, kimden, kimden_telefon,
                   alis_fiyati, durum, satis_fiyati, satis_kanali, satis_tarihi, musteri_adi,
                   musteri_telefon, customer_id, gorsel_url, kaynak, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'dukkan',$18) RETURNING id""",
            dukkan_id, model, "35" + "".join(str(random.randint(0, 9)) for _ in range(13)),
            renk, dep, ram, random.choice([m[0] for m in MUSTERILER]),
            random.choice([m[1] for m in MUSTERILER]), alis, durum, satis,
            "Dükkan" if durum == "satildi" else None,
            gs(max(gun - 12, 0)) if durum == "satildi" else None,
            alici, next((m[1] for m in MUSTERILER if m[0] == alici), None) if alici else None,
            musteri_id[alici] if alici else None,
            telefon_gorseli(dukkan_id, model, "ikincel"), g(gun))
        await db.execute(
            "INSERT INTO ikinci_el_masraflar (dukkan_id, cihaz_id, aciklama, tutar, tarih) VALUES ($1,$2,$3,$4,$5)",
            dukkan_id, cid, random.choice(["Ekran değişimi", "Batarya değişimi", "Temizlik + kapak"]),
            random.choice([650, 900, 1250]), gs(max(gun - 3, 0)))
        if durum == "satildi":
            await db.execute(
                """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak, created_at)
                   VALUES ($1,$2,'gelir','nakit',$3,$4,'2el_satis',$5)""",
                dukkan_id, gs(max(gun - 12, 0)), satis, f"2.El Satış: {model} → {alici}", g(max(gun - 12, 0)))

    # ── Sıfır cihazlar ────────────────────────────────────────────────
    sifir = [
        ("iPhone 15 Pro", "Titanyum", "256GB", 52000, 61900, "satildi"),
        ("iPhone 15", "Siyah", "128GB", 41000, 48900, "stokta"),
        ("Samsung Galaxy S23", "Krem", "256GB", 33000, 39900, "satildi"),
        ("Samsung Galaxy A54", "Mavi", "128GB", 14500, 18900, "stokta"),
        ("Xiaomi Redmi Note 12", "Gri", "128GB", 8200, 11500, "stokta"),
        ("Realme C55", "Altın", "128GB", 6400, 8900, "stokta"),
        ("iPhone 14", "Mavi", "128GB", 36000, 43500, "satildi"),
    ]
    for model, renk, dep, alis, satis, durum in sifir:
        gun = random.randint(8, 90)
        alici = random.choice(list(musteri_id.keys())) if durum == "satildi" else None
        await db.execute(
            """INSERT INTO sifir_cihazlar (dukkan_id, model, imei, renk, depolama, kimden, kaynak,
                   alis_fiyati, alis_tarihi, durum, satis_fiyati, satis_tarihi, satis_kanali,
                   musteri_adi, musteri_telefon, customer_id, odeme_yontemi, gorsel_url, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,'dukkan',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)""",
            dukkan_id, model, "35" + "".join(str(random.randint(0, 9)) for _ in range(13)),
            renk, dep, random.choice([t[0] for t in TOPTANCILAR]), alis, gs(gun), durum,
            satis if durum == "satildi" else None,
            gs(max(gun - 10, 0)) if durum == "satildi" else None,
            "Dükkan" if durum == "satildi" else None,
            alici, next((m[1] for m in MUSTERILER if m[0] == alici), None) if alici else None,
            musteri_id[alici] if alici else None,
            random.choice(["nakit", "kart", "taksit"]) if durum == "satildi" else "nakit",
            telefon_gorseli(dukkan_id, model, "sifir"), g(gun))
        if durum == "satildi":
            await db.execute(
                """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak, created_at)
                   VALUES ($1,$2,'gelir','kart',$3,$4,'sifir_satis',$5)""",
                dukkan_id, gs(max(gun - 10, 0)), satis, f"Sıfır Satış: {model} → {alici}", g(max(gun - 10, 0)))

    # ── Aksesuarlar + satışları ──────────────────────────────────────
    for ad, kat, stok, alis, satis in AKSESUARLAR:
        aid = await db.fetchval(
            """INSERT INTO aksesuarlar (dukkan_id, ad, stok, alis_fiyati, satis_fiyati, kategori, gorsel_url)
               VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id""",
            dukkan_id, ad, stok, alis, satis, kat, aksesuar_gorseli(dukkan_id, ad, kat))
        for _ in range(random.randint(1, 4)):
            gun = random.randint(1, 70)
            miktar = random.randint(1, 3)
            alici = random.choice(list(musteri_id.keys()))
            await db.execute(
                """INSERT INTO aksesuar_satislar (dukkan_id, aksesuar_id, miktar, toplam, musteri_adi,
                       musteri_telefon, customer_id, tarih, created_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
                dukkan_id, aid, miktar, miktar * satis, alici,
                next(m[1] for m in MUSTERILER if m[0] == alici), musteri_id[alici], gs(gun), g(gun))
            await db.execute(
                """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak, created_at)
                   VALUES ($1,$2,'gelir','nakit',$3,$4,'aksesuar',$5)""",
                dukkan_id, gs(gun), miktar * satis, f"Aksesuar: {ad} x{miktar}", g(gun))

    # ── Giderler ──────────────────────────────────────────────────────
    for ay in range(3):
        temel = ay * 30 + random.randint(1, 6)
        for kategori, tutar, aciklama in [
            ("Kira", 28000, "Dükkan kirası"), ("Elektrik", 3400, "Elektrik faturası"),
            ("Su", 620, "Su faturası"), ("İnternet", 890, "Fiber internet"),
            ("Maaş", 106000, "Personel maaşları"), ("Malzeme", random.randint(4000, 12000), "Sarf malzeme"),
            ("Kargo", random.randint(800, 2200), "Kargo giderleri"),
        ]:
            await db.execute(
                "INSERT INTO giderler (dukkan_id, kategori, tutar, aciklama, tarih, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
                dukkan_id, kategori, tutar, aciklama, gs(temel), g(temel))
            await db.execute(
                """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak, created_at)
                   VALUES ($1,$2,'gider','havale',$3,$4,'gider',$5)""",
                dukkan_id, gs(temel), tutar, f"{kategori} — {aciklama}", g(temel))

    # ── Borçlar / taksitler ──────────────────────────────────────────
    borclar = [
        ("Ali Polat", 12000, 4000, 3, "iPhone 14 taksitli satış"),
        ("Mehmet Demir", 8500, 8500, 1, "Toplu ekran alımı"),
        ("Mustafa Şahin", 3200, 0, 1, "Tamir ücreti — sonra ödeyecek"),
        ("Burak Aydın", 21000, 7000, 6, "Sıfır cihaz taksit"),
        ("İbrahim Koç", 5400, 2700, 2, "2.El cihaz kalan bakiye"),
    ]
    for ad, toplam, odenen, taksit, aciklama in borclar:
        gun = random.randint(10, 80)
        did = await db.fetchval(
            """INSERT INTO debts (dukkan_id, customer_id, borc_turu, source_type, amount, total_amount,
                   paid_amount, payment_type, installment_count, due_date, notes, created_by, created_at)
               VALUES ($1,$2,'alacak','manuel',$3,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id""",
            dukkan_id, musteri_id[ad], toplam, odenen,
            "taksit" if taksit > 1 else "borc", taksit,
            (g(gun) + timedelta(days=60)).strftime("%Y-%m-%d"), aciklama, patron_id, g(gun))
        if odenen > 0:
            await db.execute(
                """INSERT INTO debt_payments (dukkan_id, debt_id, amount, payment_type, notes, created_by, paid_at)
                   VALUES ($1,$2,$3,'nakit','Taksit ödemesi',$4,$5)""",
                dukkan_id, did, odenen, patron_id, g(max(gun - 20, 0)))

    # ── Garanti dışı modüller ────────────────────────────────────────
    for ad, cihaz, gun_teslim, iade in [
        ("Ayşe Çelik", "Samsung Galaxy A12", 4, None),
        ("Zeynep Arslan", "iPhone SE 2020", 18, 12),
        ("Kemal Doğan", "Xiaomi Redmi 9", 30, 24),
    ]:
        await db.execute(
            """INSERT INTO loaner_cihazlar (dukkan_id, musteri_adi, cihaz, teslim_tarihi, iade_tarihi, notlar, aktif)
               VALUES ($1,$2,$3,$4,$5,$6,$7)""",
            dukkan_id, ad, cihaz, gs(gun_teslim), gs(iade) if iade else None,
            "Tamir süresince verildi", iade is None)

    for ad, tel, sebep in [
        ("Hasan Kurt", "05339998877", "Ödeme yapmadan cihazı aldı, iletişim kurulamıyor"),
        ("Serkan Ay", "05421119933", "Sahte cihaz getirdi, tartışma çıkardı"),
    ]:
        await db.execute(
            "INSERT INTO kara_liste (dukkan_id, ad, telefon, sebep, created_at) VALUES ($1,$2,$3,$4,$5)",
            dukkan_id, ad, tel, sebep, g(random.randint(30, 200)))

    for ad, cid in calisanlar.items():
        maas = 42000 if "Emre" in ad else 38000 if "Selin" in ad else 26000
        for ay_geri in range(3):
            t = BUGUN - timedelta(days=ay_geri * 30)
            await db.execute(
                """INSERT INTO maas_odemeleri (dukkan_id, calisan_id, yil, ay, maas, odendi, odeme_tarihi)
                   VALUES ($1,$2,$3,$4,$5,$6,$7)""",
                dukkan_id, cid, t.year, t.month, maas, ay_geri > 0,
                gs(ay_geri * 30) if ay_geri > 0 else None)
        await db.execute(
            "INSERT INTO avanslar (dukkan_id, calisan_id, tutar, tarih, notlar) VALUES ($1,$2,$3,$4,$5)",
            dukkan_id, cid, random.choice([2000, 3000, 5000]), gs(random.randint(5, 25)), "Avans talebi")

    await db.execute(
        "INSERT INTO aylik_hedefler (dukkan_id, yil, ay, hedef_tutar) VALUES ($1,$2,$3,$4)",
        dukkan_id, BUGUN.year, BUGUN.month, 250000)

    for parca, miktar, sebep, durum in [
        ("iPhone 13 Komple Ekran", 1, "Ölü piksel", "bekliyor"),
        ("Samsung A54 Batarya", 2, "Şişmiş geldi", "kabul"),
        ("Xiaomi 13T Ekran", 1, "Dokunmatik çalışmıyor", "bekliyor"),
    ]:
        await db.execute(
            """INSERT INTO parca_iadeler (dukkan_id, toptanci_id, parca, miktar, sebep, durum, part_id, beklenen_tutar, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
            dukkan_id, random.choice(list(toptanci_id.values())), parca, miktar, sebep, durum,
            part_id.get(parca), next((p[5] for p in PARCALAR if p[0] == parca), 0) * miktar,
            g(random.randint(3, 40)))

    for item, adet, oncelik in [("iPhone 15 Ekran", 3, "yuksek"), ("Samsung S24 Batarya", 5, "normal"),
                                ("Isı tabancası ucu", 2, "dusuk"), ("Kapton bant", 10, "normal"),
                                ("iPhone 14 Arka Kapak", 2, "yuksek")]:
        await db.execute(
            "INSERT INTO shopping_list (dukkan_id, item, quantity, priority, bought, created_at) VALUES ($1,$2,$3,$4,false,$5)",
            dukkan_id, item, adet, oncelik, g(random.randint(1, 20)))

    for ad, model, ariza, ucret in [
        ("iPhone Ekran Değişimi", "iPhone Genel", "Ekran kırık", 4600),
        ("Batarya Değişimi", "Genel", "Batarya çabuk bitiyor", 1250),
        ("Şarj Soketi Onarımı", "Genel", "Şarj olmuyor", 950),
        ("Su Hasarı Bakımı", "Genel", "Su hasarı", 1800),
        ("Arka Cam Değişimi", "iPhone Genel", "Arka cam kırık", 1650),
    ]:
        await db.execute(
            """INSERT INTO tamir_sablonlar (dukkan_id, ad, cihaz_model, ariza, tahmini_ucret, kullanim_sayisi, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7)""",
            dukkan_id, ad, model, ariza, ucret, random.randint(3, 40), g(random.randint(60, 250)))

    # ── Vitrin / portal verileri ─────────────────────────────────────
    teslimler = [t for t in tamir_bilgi if t[4] == "teslim"]
    yorumlar = [
        (5, "Ekranımı aynı gün değiştirdiler, fiyat da gayet uygundu. Teşekkürler."),
        (5, "İlgili ve dürüst esnaf. Gereksiz işlem önermediler, sadece bataryayı değiştirdiler."),
        (4, "İşçilik güzel, biraz beklemek gerekti ama sonuç iyi."),
        (5, "Su almış telefonumu kurtardılar, ümidim yoktu açıkçası."),
        (5, "İkinci el aldığım telefon tertemiz çıktı, garanti de verdiler."),
        (4, "Fiyatlar makul, iletişim çok iyi."),
        (5, "Kadıköy'de tek gittiğim yer. Tavsiye ederim."),
    ]
    for i, (puan, yorum) in enumerate(yorumlar):
        if i >= len(teslimler):
            break
        rid, rno, ad, model, durum, ucret, acilis, teshis = teslimler[i]
        await db.execute(
            """INSERT INTO degerlendirmeler (dukkan_id, repair_no, musteri_adi, puan, yorum, onaylandi, created_at)
               VALUES ($1,$2,$3,$4,$5,true,$6)""",
            dukkan_id, rno, ad, puan, yorum, g(random.randint(2, 50)))
    if len(teslimler) > len(yorumlar):
        rid, rno, ad, *_ = teslimler[len(yorumlar)]
        await db.execute(
            """INSERT INTO degerlendirmeler (dukkan_id, repair_no, musteri_adi, puan, yorum, onaylandi, created_at)
               VALUES ($1,$2,$3,4,$4,false,$5)""",
            dukkan_id, rno, ad, "Hizmet iyiydi, otopark sorunu var sadece.", g(1))

    for ad, tel, model, aciklama, durum in [
        ("Okan Bilir", "05331234455", "iPhone 13 Pro", "Ekranım kırıldı, bugün gelebilir miyim?", "yeni"),
        ("Derya Ateş", "05445556677", "Samsung S21", "Batarya değişimi fiyatı nedir?", "yeni"),
        ("Tolga Ün", "05327778811", "Xiaomi 12", "Şarj olmuyor, yarın uğrayacağım", "goruldu"),
        ("Ceyda Kara", "05519990022", "iPhone 11", "Arka cam değişimi", "tamire_donusturuldu"),
    ]:
        await db.execute(
            """INSERT INTO randevu_talepleri (dukkan_id, musteri_adi, telefon, cihaz_model, aciklama, durum, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7)""",
            dukkan_id, ad, tel, model, aciklama, durum, g(random.randint(0, 12)))

    for ad, tel, model, aciklama, durum, teklif in [
        ("Sinan Ergün", "05336669900", "iPhone 12 128GB", "Ekranda çizik yok, kutulu", "teklif_verildi", 16500),
        ("Pelin Aksu", "05427771144", "Samsung S21 Ultra", "Batarya %85, arka cam çatlak", "yeni", None),
        ("Onur Kılıç", "05553338822", "Xiaomi Note 11", "Temiz kullanılmış", "kabul_edildi", 5200),
    ]:
        await db.execute(
            """INSERT INTO takas_teklifleri (dukkan_id, musteri_adi, telefon, cihaz_model, aciklama, durum, teklif_tutari, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""",
            dukkan_id, ad, tel, model, aciklama, durum, teklif, g(random.randint(1, 25)))

    for ad, mesajlar in [
        ("Ahmet Yılmaz", [("musteri", "Merhaba, telefonum hazır mı acaba?"),
                          ("dukkan", "Merhaba Ahmet Bey, ekran değişimi bitti, bugün 17:00'den sonra alabilirsiniz."),
                          ("musteri", "Süper, teşekkürler!")]),
        ("Mehmet Demir", [("musteri", "10 adet iPhone 13 ekranı lazım, stok var mı?"),
                          ("dukkan", "Şu an 6 adet var, kalanı 2 gün içinde tedarik ederiz.")]),
    ]:
        for i, (gonderen, mesaj) in enumerate(mesajlar):
            await db.execute(
                """INSERT INTO musteri_mesajlari (dukkan_id, customer_id, gonderen, mesaj, okundu, created_at)
                   VALUES ($1,$2,$3,$4,$5,$6)""",
                dukkan_id, musteri_id[ad], gonderen, mesaj,
                not (gonderen == "musteri" and i == len(mesajlar) - 1),
                g(3) + timedelta(minutes=i * 7))

    for gonderen, hedef, tur, mesaj in [
        (patron_id, personel["teknisyen"], "ovgu", "Bu ay su hasarı onarımlarında çok başarılıydın, tebrikler."),
        (patron_id, personel["cirak"], "sikayet", "Tezgah düzeni konusunda daha dikkatli olmalısın."),
        (personel["satis"], patron_id, "ovgu", "Yeni stok sistemi işimizi çok kolaylaştırdı."),
    ]:
        await db.execute(
            """INSERT INTO calisan_geri_bildirim (dukkan_id, gonderen_id, hedef_id, tur, mesaj, goruldu, created_at)
               VALUES ($1,$2,$3,$4,$5,false,$6)""",
            dukkan_id, gonderen, hedef, tur, mesaj, g(random.randint(2, 30)))

    await db.execute(
        """INSERT INTO destek_mesajlari (dukkan_id, gonderen_rol, gonderen_ad, mesaj, okundu, created_at)
           VALUES ($1,'dukkan','Yusuf Yıldız',$2,false,$3)""",
        dukkan_id, "Merhaba, ikinci bir şube açacağız. Aynı hesaptan iki dükkan yönetebilir miyiz?", g(2))

    ozet = {}
    for t in ["customers", "repairs", "parts", "ikinci_el", "sifir_cihazlar", "aksesuarlar",
              "kasa_hareketleri", "giderler", "debts", "garantiler", "degerlendirmeler",
              "randevu_talepleri", "takas_teklifleri", "toptancilar", "dukkan_galeri"]:
        ozet[t] = await db.fetchval(f"SELECT COUNT(*) FROM {t} WHERE dukkan_id = $1", dukkan_id)

    await db.close()
    print("\n=== DEMO HAZIR ===")
    print(f"Dükkan   : {DUKKAN_AD}  (id={dukkan_id})")
    print(f"Vitrin   : /magaza/{SLUG}")
    print(f"Giriş    : {PATRON_EMAIL} / {PATRON_SIFRE}")
    print(f"Personel : emre@ / selin@ / burak@telefonservis.com — Demo1234")
    print(f"Portal   : 05321112233 / Demo1234 (Ahmet Yılmaz)")
    for k, v in ozet.items():
        print(f"  {k:22} {v}")


if __name__ == "__main__":
    asyncio.run(main())
