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
    # Seed hizli kalsin diye burada ag istegi YAPILMIYOR — gercek urun
    # fotograflarini demo_duzelt.py sonradan indirip bunlarin uzerine yaziyor.
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


# ── Veri havuzları ────────────────────────────────────────────────────────

ERKEK = ["Ahmet", "Mehmet", "Mustafa", "Ali", "Hüseyin", "Hasan", "İbrahim", "Osman",
         "Yusuf", "Murat", "Ömer", "Ramazan", "Kemal", "Selim", "Burak", "Emre",
         "Onur", "Serkan", "Tolga", "Cem", "Barış", "Kaan", "Eren", "Furkan",
         "Berk", "Umut", "Arda", "Volkan", "Tuncay", "Serdar", "Erhan", "Okan",
         "Sinan", "Levent", "Bülent", "Fatih", "Yasin", "Uğur", "Koray", "Deniz"]
KADIN = ["Fatma", "Ayşe", "Emine", "Hatice", "Zeynep", "Elif", "Meryem", "Zehra",
         "Merve", "Büşra", "Esra", "Derya", "Selin", "Ceyda", "Pelin", "Nur",
         "Gizem", "Aslı", "Tuğba", "Melis", "Ebru", "Şeyma", "Damla", "Sema",
         "Betül", "Özge", "Yasemin", "Nihan", "Burcu", "Duygu", "Sevgi", "Hande"]
SOYAD = ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız", "Yıldırım", "Öztürk",
         "Aydın", "Özdemir", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara",
         "Koç", "Kurt", "Özkan", "Şimşek", "Polat", "Erdoğan", "Korkmaz", "Güneş",
         "Aksoy", "Bulut", "Erdem", "Turan", "Şen", "Acar", "Ateş", "Bilir",
         "Uysal", "Sarı", "Ünal", "Taş", "Duran", "Avcı", "Keskin", "Tekin"]

MUSTERI_NOT = [None, None, None, None, "Sürekli müşteri", "Kurumsal hesap",
               "Fiyat konusunda hassas", "Kargoyla gönderiyor", "Taksitli alışveriş yapıyor",
               "Toptan parça alıyor", "Tavsiye üzerine geldi", "Aksesuar müşterisi"]

PARCALAR = [
    ("iPhone 15 Komple Ekran", "iPhone 15", "Komple Ekran", 8, 3, 6200, 8400),
    ("iPhone 14 Komple Ekran", "iPhone 14", "Komple Ekran", 6, 3, 4200, 5600),
    ("iPhone 13 Komple Ekran", "iPhone 13", "Komple Ekran", 9, 3, 3400, 4600),
    ("iPhone 12 Komple Ekran", "iPhone 12", "Komple Ekran", 4, 3, 2900, 3950),
    ("iPhone 11 Komple Ekran", "iPhone 11", "Komple Ekran", 2, 3, 2100, 2950),
    ("iPhone XR Komple Ekran", "iPhone XR", "Komple Ekran", 3, 2, 1750, 2500),
    ("iPhone 15 Batarya", "iPhone 15", "Batarya (Pil)", 11, 4, 950, 1500),
    ("iPhone 14 Batarya", "iPhone 14", "Batarya (Pil)", 10, 4, 850, 1350),
    ("iPhone 13 Batarya", "iPhone 13", "Batarya (Pil)", 12, 4, 780, 1250),
    ("iPhone 12 Batarya", "iPhone 12", "Batarya (Pil)", 7, 4, 690, 1150),
    ("iPhone 11 Batarya", "iPhone 11", "Batarya (Pil)", 3, 4, 620, 1050),
    ("iPhone 13 Şarj Bordu", "iPhone 13", "Şarj Bordu", 6, 3, 420, 750),
    ("iPhone 14 Şarj Bordu", "iPhone 14", "Şarj Bordu", 5, 3, 480, 820),
    ("iPhone 12 Arka Kapak", "iPhone 12", "Arka Kapak", 4, 2, 560, 950),
    ("iPhone 13 Arka Kapak", "iPhone 13", "Arka Kapak", 5, 2, 620, 1050),
    ("iPhone 13 Ön Kamera", "iPhone 13", "Ön Kamera", 6, 3, 520, 900),
    ("iPhone 13 Arka Kamera", "iPhone 13", "Arka Kamera", 3, 2, 1100, 1750),
    ("iPhone 14 Arka Kamera", "iPhone 14", "Arka Kamera", 2, 2, 1350, 2100),
    ("Samsung S24 Komple Ekran", "Samsung Galaxy S24", "Komple Ekran", 4, 2, 4600, 6200),
    ("Samsung S23 Komple Ekran", "Samsung Galaxy S23", "Komple Ekran", 5, 3, 3900, 5300),
    ("Samsung S22 Komple Ekran", "Samsung Galaxy S22", "Komple Ekran", 3, 2, 3300, 4500),
    ("Samsung S21 Komple Ekran", "Samsung Galaxy S21", "Komple Ekran", 2, 2, 2800, 3900),
    ("Samsung A55 Komple Ekran", "Samsung Galaxy A55", "Komple Ekran", 7, 3, 1900, 2800),
    ("Samsung A54 Komple Ekran", "Samsung Galaxy A54", "Komple Ekran", 8, 3, 1750, 2600),
    ("Samsung A53 Komple Ekran", "Samsung Galaxy A53", "Komple Ekran", 2, 3, 1600, 2400),
    ("Samsung A34 Komple Ekran", "Samsung Galaxy A34", "Komple Ekran", 5, 3, 1450, 2200),
    ("Samsung A54 Batarya", "Samsung Galaxy A54", "Batarya (Pil)", 9, 4, 480, 850),
    ("Samsung S23 Batarya", "Samsung Galaxy S23", "Batarya (Pil)", 6, 3, 620, 1050),
    ("Samsung S23 Şarj Soketi", "Samsung Galaxy S23", "Şarj Soketi", 7, 3, 360, 680),
    ("Samsung A54 Şarj Soketi", "Samsung Galaxy A54", "Şarj Soketi", 8, 3, 290, 560),
    ("Xiaomi Redmi Note 13 Ekran", "Xiaomi Redmi Note 13", "Komple Ekran", 6, 3, 1350, 2100),
    ("Xiaomi Redmi Note 12 Ekran", "Xiaomi Redmi Note 12", "Komple Ekran", 7, 3, 1250, 1950),
    ("Xiaomi 13T Ekran", "Xiaomi 13T", "Komple Ekran", 3, 2, 2200, 3100),
    ("Xiaomi Redmi Note 12 Batarya", "Xiaomi Redmi Note 12", "Batarya (Pil)", 8, 4, 390, 720),
    ("Huawei P60 Ekran", "Huawei P60", "Komple Ekran", 2, 2, 2600, 3600),
    ("Huawei Nova 11 Ekran", "Huawei Nova 11", "Komple Ekran", 3, 2, 1850, 2700),
    ("Oppo A78 Ekran", "Oppo A78", "Komple Ekran", 4, 2, 1150, 1800),
    ("Oppo Reno 8 Ekran", "Oppo Reno 8", "Komple Ekran", 3, 2, 1650, 2450),
    ("Realme C55 Ekran", "Realme C55", "Komple Ekran", 3, 2, 980, 1600),
    ("Tecno Spark 10 Ekran", "Tecno Spark 10", "Komple Ekran", 4, 2, 780, 1350),
    ("Titreşim Motoru — Genel", "Genel", "Titreşim Motoru", 18, 6, 90, 200),
    ("Buzzer Hoparlör — iPhone", "iPhone Genel", "Buzzer (Hoparlör)", 14, 5, 130, 290),
    ("Ahize — iPhone Genel", "iPhone Genel", "Ahize (İç kulaklık)", 12, 5, 110, 250),
    ("Sim Kart Tepsisi — Genel", "Genel", "Sim Kart Tepsisi", 25, 8, 35, 90),
    ("Kalem Havya Ucu", "Genel", "Yedek Havya Ucu", 20, 6, 45, 110),
    ("Çift Taraflı Bant (Rulo)", "Genel", "Çift Taraflı Bant", 16, 5, 60, 140),
]

TOPTANCILAR = [
    ("Mega Parça Elektronik", "02124445566", "İstanbul", "Ekran ve batarya — 2 gün kargo"),
    ("Anadolu Teknik", "03124443322", "Ankara", "Uygun fiyat, kargo 3 gün"),
    ("Ege Mobil Parça", "02324441199", "İzmir", "Samsung parçalarında iyi"),
    ("Star Aksesuar", "02123338877", "İstanbul", "Aksesuar toptan"),
    ("Marmara Cep Ticaret", "02128887744", "İstanbul", "Sıfır cihaz tedariki"),
    ("Güney Telekom", "03224445511", "Adana", "Xiaomi / Oppo parçaları"),
]

ARIZALAR = [
    ("Ekran kırık, dokunmatik çalışmıyor", "Komple ekran değişimi yapıldı, test edildi"),
    ("Şarj olmuyor", "Şarj bordu değişti, şarj testi yapıldı"),
    ("Batarya çabuk bitiyor", "Batarya değişimi, kapasite %100"),
    ("Su hasarı — açılmıyor", "Anakart ultrasonik temizlik, kurutma sonrası çalışıyor"),
    ("Hoparlörden ses gelmiyor", "Buzzer değişimi yapıldı"),
    ("Ön kamera bulanık", "Ön kamera modülü değişti"),
    ("Arka cam kırık", "Arka kapak değişimi, yapıştırma yenilendi"),
    ("Titreşim çalışmıyor", "Titreşim motoru değişti"),
    ("Ekranda çizgiler var", "Ekran değişimi yapıldı"),
    ("Cihaz çok ısınıyor", "Termal macun yenilendi, yazılım güncellendi"),
    ("Mikrofon duyulmuyor", "Şarj bordu (mikrofon dahil) değişti"),
    ("Ahize sesi kısık", "Ahize değişimi, ses testi yapıldı"),
    ("Sim kart görmüyor", "Sim okuyucu temizlendi, tepsi değişti"),
    ("Wi-Fi bağlanmıyor", "Anten soketi yeniden lehimlendi"),
    ("Açılış logosunda kalıyor", "Yazılım yeniden yüklendi, veriler korundu"),
    ("Ekran dokunmatiği kendi kendine çalışıyor", "Ekran değişimi (hayalet dokunma)"),
    ("Face ID çalışmıyor", "Ön kamera flex kontrol edildi, modül değişti"),
    ("Şarj soketi gevşek", "Şarj soketi değişimi"),
]

CIHAZ_MODELLERI = [
    "iPhone 15 Pro", "iPhone 15", "iPhone 14 Pro", "iPhone 14", "iPhone 13",
    "iPhone 12", "iPhone 11", "iPhone XR", "Samsung Galaxy S24", "Samsung Galaxy S23",
    "Samsung Galaxy S22", "Samsung Galaxy A55", "Samsung Galaxy A54", "Samsung Galaxy A34",
    "Xiaomi Redmi Note 13", "Xiaomi Redmi Note 12", "Xiaomi 13T", "Huawei P60",
    "Huawei Nova 11", "Oppo A78", "Oppo Reno 8", "Realme C55", "Tecno Spark 10",
]

# Vitrinde fotoğrafı olacak modeller (Wikipedia'da makalesi olanlar)
FOTO_MODELLERI = ["iPhone 15 Pro", "iPhone 15", "iPhone 14", "iPhone 13", "iPhone 12",
                  "iPhone 11", "Samsung Galaxy S24", "Samsung Galaxy S23", "Samsung Galaxy A54",
                  "Xiaomi Redmi Note 12", "Huawei P60", "Oppo A78", "Realme C55"]

AKSESUARLAR = [
    ("Apple 20W USB-C Adaptör", "Şarj Aleti", 24, 320, 590),
    ("Samsung 25W Hızlı Şarj", "Şarj Aleti", 20, 280, 520),
    ("Anker 30W GaN Adaptör", "Şarj Aleti", 12, 520, 950),
    ("Araç Şarj Aleti 36W", "Şarj Aleti", 15, 190, 420),
    ("Kablosuz Şarj Standı 15W", "Şarj Aleti", 9, 340, 690),
    ("USB-C to Lightning Kablo 1m", "Kablo", 35, 90, 220),
    ("USB-C to USB-C Kablo 2m", "Kablo", 28, 110, 260),
    ("Örgülü Şarj Kablosu 1.5m", "Kablo", 30, 70, 190),
    ("HDMI Dönüştürücü", "Kablo", 8, 240, 490),
    ("iPhone 15 Şeffaf Silikon Kılıf", "Kılıf", 26, 45, 150),
    ("iPhone 14 Deri Kılıf", "Kılıf", 14, 180, 420),
    ("iPhone 13 Şeffaf Silikon Kılıf", "Kılıf", 32, 45, 150),
    ("Samsung A54 Darbeye Dayanıklı Kılıf", "Kılıf", 18, 60, 190),
    ("Samsung S23 Cüzdanlı Kılıf", "Kılıf", 11, 130, 320),
    ("Xiaomi Note 12 Silikon Kılıf", "Kılıf", 22, 40, 140),
    ("iPhone 15 Kırılmaz Cam", "Kırılmaz Cam", 45, 25, 120),
    ("iPhone 13 Kırılmaz Cam", "Kırılmaz Cam", 48, 25, 120),
    ("Samsung S23 Kırılmaz Cam", "Kırılmaz Cam", 26, 30, 140),
    ("Privacy Ekran Koruyucu", "Kırılmaz Cam", 12, 55, 180),
    ("Kamera Lens Koruyucu", "Kırılmaz Cam", 30, 20, 90),
    ("Bluetooth Kulaklık TWS", "Kulaklık", 16, 340, 750),
    ("Kablolu Kulaklık 3.5mm", "Kulaklık", 30, 60, 160),
    ("Oyuncu Kulaklığı RGB", "Kulaklık", 7, 480, 990),
    ("Spor Bluetooth Kulaklık", "Kulaklık", 10, 260, 590),
    ("10000mAh Powerbank", "Powerbank", 13, 380, 790),
    ("20000mAh Hızlı Powerbank", "Powerbank", 8, 640, 1250),
    ("MagSafe Powerbank 5000mAh", "Powerbank", 6, 520, 1050),
    ("Telefon Tutucu (Araç)", "Kılıf", 19, 85, 230),
    ("Selfie Çubuğu Tripod", "Kılıf", 9, 140, 350),
    ("Hafıza Kartı 128GB", "Kablo", 14, 180, 390),
]

GALERI_BASLIKLARI = ["Dükkânımız", "Tamir Masamız", "Teşhir Reyonu", "Ekibimiz",
                     "Yedek Parça Deposu", "Mikroskop Altında Onarım"]

YORUMLAR = [
    (5, "Ekranımı aynı gün değiştirdiler, fiyat da gayet uygundu. Teşekkürler."),
    (5, "İlgili ve dürüst esnaf. Gereksiz işlem önermediler, sadece bataryayı değiştirdiler."),
    (4, "İşçilik güzel, biraz beklemek gerekti ama sonuç iyi."),
    (5, "Su almış telefonumu kurtardılar, ümidim yoktu açıkçası."),
    (5, "İkinci el aldığım telefon tertemiz çıktı, garanti de verdiler."),
    (4, "Fiyatlar makul, iletişim çok iyi."),
    (5, "Kadıköy'de tek gittiğim yer. Tavsiye ederim."),
    (5, "Telefonu 2 saatte teslim ettiler, çok hızlılar."),
    (4, "Parça orijinal, fiyat piyasanın altında. Memnun kaldım."),
    (5, "Anakart tamiri yaptılar, başka yerler 'olmaz' demişti."),
    (5, "Garantili iş yapıyorlar, fatura da veriyorlar."),
    (4, "Yoğun oldukları için biraz beklettiler ama iş kaliteli."),
    (5, "Kızımın telefonunu aynı gün hallettiler, çok ilgililer."),
    (5, "Fiyatı önceden söylediler, sürpriz çıkmadı. Dürüst yer."),
    (4, "Aksesuar çeşidi de bol, ekran koruyucu taktılar hediye."),
    (5, "Yıllardır buradan alışveriş yapıyorum, güvenilir."),
    (5, "Şarj soketi sorunumu 20 dakikada çözdüler."),
    (4, "Telefonu kargoyla gönderdim, sorunsuz geri geldi."),
    (5, "Ekran değişiminden sonra hiç sorun yaşamadım, 6 ay oldu."),
    (5, "Personel çok kibar, işini bilen insanlar."),
]

RANDEVU_MESAJ = [
    "Ekranım kırıldı, bugün gelebilir miyim?", "Batarya değişimi fiyatı nedir?",
    "Şarj olmuyor, yarın uğrayacağım", "Arka cam değişimi yaptırmak istiyorum",
    "Telefonum suya düştü, acil bakabilir misiniz?", "Hoparlörden ses gelmiyor",
    "Kamera bulanık çekiyor, randevu almak istiyorum", "Ekran değişimi için stok var mı?",
    "Cihazım açılmıyor, ne yapabiliriz?", "Fiyat bilgisi alabilir miyim?",
]

TAKAS_ACIKLAMA = [
    "Ekranda çizik yok, kutulu", "Batarya %85, arka cam çatlak", "Temiz kullanılmış",
    "Faturası mevcut, garantisi devam ediyor", "Ekran değişmiş, orijinal değil",
    "Hiç tamir görmedi, kutusu var", "Az kullanıldı, aksesuarları tam",
]


# ── Görsel seçimi: en temiz ürün fotoğrafını bulmaya çalışır ──────────────
# Öncelik: Wikipedia'nın vektör ürün render'ı (beyaz zemin, e-ticaret görünümü)
# > makale ana görseli > Openverse (Flickr/Commons) arama sonucu.

KOTU_KELIMELER = ("shop", "store", "box", "unboxing", "hand", "teardown", "repair",
                  "screenshot", "settings", "menu", "logo", "advert", "billboard")


def _temiz_mi(url: str) -> bool:
    ad = url.rsplit("/", 1)[-1].lower()
    return not any(k in ad for k in KOTU_KELIMELER)



# ── Ana akış ──────────────────────────────────────────────────────────────

YIL = 365          # kaç günlük geçmiş üretilecek
TAMIR_SAYISI = 420
MUSTERI_SAYISI = 180


def _isimler(n):
    """n adet benzersiz Türkçe ad-soyad + telefon üretir."""
    kullanilan, cikti = set(), []
    while len(cikti) < n:
        ad = random.choice(ERKEK + KADIN)
        soyad = random.choice(SOYAD)
        tam = f"{ad} {soyad}"
        if tam in kullanilan:
            continue
        kullanilan.add(tam)
        tel = "05" + random.choice("2334455") + str(random.randint(1000000, 9999999))
        cikti.append((tam, tel))
    return cikti


async def main():
    db = await asyncpg.connect(DATABASE_URL)
    print("Bağlandı. Demo üretiliyor (1 yıllık geçmiş)...")

    await db.execute("DELETE FROM dukkanlar WHERE slug = $1", SLUG)

    dukkan_id = await db.fetchval(
        """INSERT INTO dukkanlar
           (ad, slug, telefon, adres, sehir, abonelik_durumu, abonelik_bitis, plan,
            vitrin_aktif, vitrin_aciklama, calisma_saatleri, hizmetler, created_at)
           VALUES ($1,$2,$3,$4,$5,'aktif',$6,'pro',true,$7,$8,$9,$10) RETURNING id""",
        DUKKAN_AD, SLUG, "0216 555 44 33", "Bağdat Cad. No:128, Kadıköy", "İstanbul",
        BUGUN + timedelta(days=240),
        "2009'dan beri Kadıköy'de telefon tamiri, sıfır ve ikinci el cihaz satışı. "
        "Orijinal parça, garantili işçilik, aynı gün teslim.",
        "Hafta içi 09:00-19:30 · Cumartesi 10:00-18:00",
        "Ekran Değişimi, Batarya Değişimi, Su Hasarı Onarımı, Anakart Tamiri, "
        "Kamera Değişimi, Yazılım Güncelleme, Veri Kurtarma",
        g(YIL + 40),
    )
    print(f"Dükkan id={dukkan_id}")

    await db.execute("UPDATE dukkanlar SET logo_url=$1, kapak_url=$2 WHERE id=$3",
                     logo_gorseli(dukkan_id), kapak_gorseli(dukkan_id), dukkan_id)

    # ── Kullanıcılar / çalışanlar ────────────────────────────────────
    patron_id = await db.fetchval(
        """INSERT INTO kullanicilar (dukkan_id, email, sifre_hash, ad, rol, durum, aktif, created_at, son_giris_at)
           VALUES ($1,$2,$3,$4,'patron','aktif',true,$5,$6) RETURNING id""",
        dukkan_id, PATRON_EMAIL, hash_sifre(PATRON_SIFRE), "Yusuf Yıldız", g(YIL + 40), g(0))
    personel = {}
    for email, ad, rol, gun in [
        ("emre@telefonservis.com", "Emre Şen", "teknisyen", YIL + 20),
        ("selin@telefonservis.com", "Selin Ak", "satis", YIL - 40),
        ("burak@telefonservis.com", "Burak Tan", "cirak", 150),
    ]:
        personel[rol] = await db.fetchval(
            """INSERT INTO kullanicilar (dukkan_id, email, sifre_hash, ad, rol, durum, aktif, created_at, son_giris_at)
               VALUES ($1,$2,$3,$4,$5,'aktif',true,$6,$7) RETURNING id""",
            dukkan_id, email, hash_sifre("Demo1234"), ad, rol, g(gun), g(random.randint(0, 2)))

    calisanlar = {}
    for ad, tel, maas in [("Emre Şen", "05321110001", 42000), ("Selin Ak", "05321110002", 38000),
                          ("Burak Tan", "05321110003", 26000)]:
        calisanlar[ad] = await db.fetchval(
            "INSERT INTO calisanlar (dukkan_id, ad, telefon, aylik_maas, aktif) VALUES ($1,$2,$3,$4,true) RETURNING id",
            dukkan_id, ad, tel, maas)

    # ── Müşteriler ────────────────────────────────────────────────────
    kisiler = _isimler(MUSTERI_SAYISI)
    musteri_kayit = []
    for i, (ad, tel) in enumerate(kisiler):
        portal = i % 9 == 0                       # ~20 portal üyesi
        yeni_uye = i in (3, 21, 57)               # bildirimde çıksın
        musteri_kayit.append((
            dukkan_id, ad, tel, random.choice(MUSTERI_NOT), random.randint(1, 14),
            g(random.randint(5, YIL + 30)),
            hash_sifre("Demo1234") if portal else None,
            g(random.randint(2, 200)) if portal else None,
            not yeni_uye,
        ))
    await db.executemany(
        """INSERT INTO customers (dukkan_id, name, phone, notes, visit_count, created_at,
                                  sifre_hash, portal_kayit_at, dukkan_gordu)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""", musteri_kayit)
    # Bilinen bir portal hesabı: ilk müşteri sabit numara alsın
    ilk_ad, _ = kisiler[0]
    await db.execute(
        "UPDATE customers SET phone='05321112233', sifre_hash=$1 WHERE dukkan_id=$2 AND name=$3",
        hash_sifre("Demo1234"), dukkan_id, ilk_ad)

    musteriler = await db.fetch("SELECT id, name, phone FROM customers WHERE dukkan_id=$1", dukkan_id)
    musteriler = [dict(m) for m in musteriler]
    print(f"Müşteri: {len(musteriler)}")

    # ── Toptancılar + alışlar ────────────────────────────────────────
    toptanci_id = []
    for ad, tel, sehir, notlar in TOPTANCILAR:
        toptanci_id.append(await db.fetchval(
            "INSERT INTO toptancilar (dukkan_id, ad, telefon, sehir, notlar, created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
            dukkan_id, ad, tel, sehir, notlar, g(random.randint(200, YIL + 20))))

    alislar = []
    for _ in range(95):
        urun = random.choice(PARCALAR)
        miktar, birim, gun = random.randint(2, 12), urun[5], random.randint(2, YIL)
        alislar.append((dukkan_id, random.choice(toptanci_id), urun[0], miktar, birim,
                        miktar * birim, gs(gun), g(gun)))
    await db.executemany(
        """INSERT INTO toptanci_alislar (dukkan_id, toptanci_id, urun, miktar, birim_fiyat, toplam, tarih, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""", alislar)

    # ── Parçalar ──────────────────────────────────────────────────────
    part_id = {}
    for ad, model, tip, adet, minim, alis, satis in PARCALAR:
        part_id[ad] = await db.fetchval(
            """INSERT INTO parts (dukkan_id, name, category, device_model, part_type, quantity,
                                  min_quantity, cost_price, purchase_price, sale_price, supplier, created_by, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12) RETURNING id""",
            dukkan_id, ad, tip, model, tip, adet, minim, alis, satis,
            random.choice([t[0] for t in TOPTANCILAR]), patron_id, g(random.randint(30, YIL)))
    print(f"Parça: {len(part_id)}")

    # ── Tamirler ──────────────────────────────────────────────────────
    tamir_kayit, teslim_bilgi = [], []
    for i in range(TAMIR_SAYISI):
        m = random.choice(musteriler)
        model = random.choice(CIHAZ_MODELLERI)
        ariza, teshis = random.choice(ARIZALAR)
        # Son 20 gün: karışık durumlar. Öncesi: hepsi teslim.
        if i < TAMIR_SAYISI - 14:
            durum = "teslim"
            # 2..YIL: cari ay da payini alsin, yoksa "bu ay geliri" bos kaliyor
            acilis = random.randint(2, YIL)
        else:
            durum = random.choice(["bekliyor", "bekliyor", "bekliyor", "tamirde", "tamirde",
                                   "tamirde", "parca_bekleniyor", "parca_bekleniyor", "hazir", "hazir", "hazir"])
            acilis = random.randint(0, 20)
        ucret = random.choice([950, 1250, 1450, 1650, 1950, 2400, 2900, 3400, 3900, 4600, 5300, 6200])
        repair_no = f"T{(BUGUN - timedelta(days=acilis)).strftime('%y%m%d')}{i+1:04d}"
        imei = "35" + "".join(str(random.randint(0, 9)) for _ in range(13))
        kilit = random.choice([("pin", "1234"), ("pin", "4728"), ("pin", "9080"),
                               ("desen", "0-1-2-5-8"), ("desen", "0-3-6-7-8"), (None, None)])
        tamirde_at = g(acilis) - timedelta(hours=-3) if durum != "bekliyor" else None
        completed_at = g(max(acilis - 1, 0)) if durum in ("hazir", "teslim") else None
        delivered_at = g(max(acilis - 2, 0)) if durum == "teslim" else None

        tamir_kayit.append((
            dukkan_id, repair_no, m["id"], model, imei, ariza,
            teshis if durum in ("hazir", "teslim", "tamirde") else None, durum,
            ucret, ucret if durum == "teslim" else None,
            random.choice(["nakit", "kart", "havale"]) if durum == "teslim" else None,
            random.choice([90, 180, 90, 0]), kilit[0], kilit[1],
            random.choice([None, None, None, "Müşteri acele istiyor", "Yedek parça sipariş edildi",
                           "Cihaz kutusuyla teslim alındı"]),
            personel["teknisyen"], patron_id, g(acilis), g(max(acilis - 2, 0)),
            tamirde_at, completed_at, delivered_at))
        if durum == "teslim":
            teslim_bilgi.append((repair_no, m, model, ucret, acilis, teshis))

    await db.executemany(
        """INSERT INTO repairs (dukkan_id, repair_no, customer_id, device_model, imei, problem,
               fault_desc, diagnosis, status, estimated_price, final_price, payment_type,
               warranty_days, screen_lock_type, screen_lock_value, notes, assigned_to,
               created_by, son_guncelleyen_id, created_at, updated_at, tamirde_at, completed_at, delivered_at)
           VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17,$18,$19,$20,$21,$22)""",
        tamir_kayit)
    print(f"Tamir: {TAMIR_SAYISI} ({len(teslim_bilgi)} teslim)")

    tamirler = {r["repair_no"]: r["id"] for r in
                await db.fetch("SELECT id, repair_no FROM repairs WHERE dukkan_id=$1", dukkan_id)}

    # Kullanılan parçalar + stok hareketi + IMEI geçmişi + kasa + garanti
    rp, sh, ih, kasa, gar = [], [], [], [], []
    for repair_no, m, model, ucret, acilis, teshis in teslim_bilgi:
        rid = tamirler[repair_no]
        uygun = [k for k in part_id if model.split()[0].lower() in k.lower()]
        if uygun and random.random() < 0.75:
            pad = random.choice(uygun)
            pfiyat = next(p[6] for p in PARCALAR if p[0] == pad)
            rp.append((dukkan_id, rid, part_id[pad], 1, pfiyat))
            sh.append((dukkan_id, part_id[pad], "cikis", 1, "tamir",
                       f"{repair_no} tamirinde kullanıldı", gs(acilis), patron_id, g(acilis)))
        ih.append((dukkan_id, "35" + "".join(str(random.randint(0, 9)) for _ in range(13)),
                   model, m["id"], rid, "tamir", teshis, g(acilis)))
        kasa.append((dukkan_id, gs(max(acilis - 2, 0)), "gelir", random.choice(["nakit", "kart"]),
                     ucret, f"Tamir geliri — {repair_no} ({model})", "tamir", g(max(acilis - 2, 0))))
        sure = random.choice([90, 180])
        bas = max(acilis - 2, 0)
        gar.append((dukkan_id, m["name"], m["phone"], rid, model, teshis or "Tamir",
                    gs(bas), sure, (g(bas) + timedelta(days=sure)).strftime("%Y-%m-%d")))

    await db.executemany(
        "INSERT INTO repair_parts (dukkan_id, repair_id, part_id, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)", rp)
    await db.executemany(
        """INSERT INTO stok_hareketleri (dukkan_id, part_id, hareket, miktar, sebep, aciklama, tarih, created_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""", sh)
    await db.executemany(
        """INSERT INTO imei_history (dukkan_id, imei, device_model, customer_id, repair_id, action, notes, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""", ih)
    await db.executemany(
        """INSERT INTO garantiler (dukkan_id, musteri_adi, telefon, tamir_id, cihaz, tamir_aciklama,
               baslangic_tarihi, sure_gun, bitis_tarihi, aktif) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)""", gar)

    # ── 2. El cihazlar ────────────────────────────────────────────────
    ikinci_gorsel = {}
    ikinci_kayit, ie_masraf = [], []
    for i in range(60):
        model = random.choice(FOTO_MODELLERI)
        satildi = i < 42
        alis = random.choice([6800, 9500, 12500, 14500, 16800, 17500, 21000, 24500, 27500, 31000, 38000])
        if satildi:
            satis_gun = random.randint(1, YIL - 20)
            gun = satis_gun + random.randint(10, 40)
            satis = int(alis * random.uniform(1.16, 1.30) / 50) * 50
            alici = random.choice(musteriler)
        else:
            gun, satis_gun, satis, alici = random.randint(5, 120), None, None, None
        if model not in ikinci_gorsel:
            ikinci_gorsel[model] = telefon_gorseli(dukkan_id, model, "ikincel")
        ikinci_kayit.append((
            dukkan_id, model, "35" + "".join(str(random.randint(0, 9)) for _ in range(13)),
            random.choice(["Siyah", "Beyaz", "Mavi", "Yeşil", "Mor", "Gümüş", "Altın"]),
            random.choice(["64GB", "128GB", "256GB", "512GB"]),
            random.choice(["4GB", "6GB", "8GB", "12GB"]),
            random.choice(musteriler)["name"], random.choice(musteriler)["phone"],
            alis, "satildi" if satildi else "stokta", satis,
            "Dükkan" if satildi else None, gs(satis_gun) if satildi else None,
            alici["name"] if alici else None, alici["phone"] if alici else None,
            alici["id"] if alici else None, ikinci_gorsel[model], g(gun)))
        if satildi:
            kasa.append((dukkan_id, gs(satis_gun), "gelir", "nakit", satis,
                         f"2.El Satış: {model} → {alici['name']}", "2el_satis", g(satis_gun)))

    await db.executemany(
        """INSERT INTO ikinci_el (dukkan_id, model, imei, renk, depolama, ram, kimden, kimden_telefon,
               alis_fiyati, durum, satis_fiyati, satis_kanali, satis_tarihi, musteri_adi,
               musteri_telefon, customer_id, gorsel_url, kaynak, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'dukkan',$18)""", ikinci_kayit)

    for r in await db.fetch("SELECT id, created_at FROM ikinci_el WHERE dukkan_id=$1", dukkan_id):
        ie_masraf.append((dukkan_id, r["id"],
                          random.choice(["Ekran değişimi", "Batarya değişimi", "Temizlik + kapak", "Arka cam"]),
                          random.choice([450, 650, 900, 1250]), r["created_at"].strftime("%Y-%m-%d")))
    await db.executemany(
        "INSERT INTO ikinci_el_masraflar (dukkan_id, cihaz_id, aciklama, tutar, tarih) VALUES ($1,$2,$3,$4,$5)",
        ie_masraf)

    # ── Sıfır cihazlar ────────────────────────────────────────────────
    sifir_gorsel, sifir_kayit = {}, []
    for i in range(45):
        model = random.choice(FOTO_MODELLERI)
        satildi = i < 32
        alis = random.choice([6400, 8200, 14500, 19000, 24000, 33000, 36000, 41000, 52000, 61000])
        if satildi:
            satis_gun = random.randint(1, YIL - 20)
            gun = satis_gun + random.randint(8, 30)
            satis = int(alis * random.uniform(1.13, 1.22) / 50) * 50
            alici = random.choice(musteriler)
        else:
            gun, satis_gun, satis, alici = random.randint(5, 90), None, None, None
        if model not in sifir_gorsel:
            sifir_gorsel[model] = telefon_gorseli(dukkan_id, model, "sifir")
        sifir_kayit.append((
            dukkan_id, model, "35" + "".join(str(random.randint(0, 9)) for _ in range(13)),
            random.choice(["Siyah", "Beyaz", "Mavi", "Titanyum", "Krem", "Gri"]),
            random.choice(["128GB", "256GB", "512GB"]),
            random.choice([t[0] for t in TOPTANCILAR]), alis, gs(gun),
            "satildi" if satildi else "stokta", satis,
            gs(satis_gun) if satildi else None, "Dükkan" if satildi else None,
            alici["name"] if alici else None, alici["phone"] if alici else None,
            alici["id"] if alici else None,
            random.choice(["nakit", "kart", "taksit"]) if satildi else "nakit",
            sifir_gorsel[model], g(gun)))
        if satildi:
            kasa.append((dukkan_id, gs(satis_gun), "gelir", "kart", satis,
                         f"Sıfır Satış: {model} → {alici['name']}", "sifir_satis", g(satis_gun)))

    await db.executemany(
        """INSERT INTO sifir_cihazlar (dukkan_id, model, imei, renk, depolama, kimden, kaynak,
               alis_fiyati, alis_tarihi, durum, satis_fiyati, satis_tarihi, satis_kanali,
               musteri_adi, musteri_telefon, customer_id, odeme_yontemi, gorsel_url, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,'dukkan',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)""", sifir_kayit)

    # ── Aksesuarlar + satışlar ───────────────────────────────────────
    aks_gorsel, aks_satis = {}, []
    for ad, kat, stok, alis, satis in AKSESUARLAR:
        if kat not in aks_gorsel:
            aks_gorsel[kat] = aksesuar_gorseli(dukkan_id, ad, kat)
        aid = await db.fetchval(
            """INSERT INTO aksesuarlar (dukkan_id, ad, stok, alis_fiyati, satis_fiyati, kategori, gorsel_url)
               VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id""",
            dukkan_id, ad, stok, alis, satis, kat, aks_gorsel[kat])
        for _ in range(random.randint(8, 22)):
            gun, miktar = random.randint(1, YIL), random.randint(1, 3)
            alici = random.choice(musteriler)
            aks_satis.append((dukkan_id, aid, miktar, miktar * satis, alici["name"],
                              alici["phone"], alici["id"], gs(gun), g(gun)))
            kasa.append((dukkan_id, gs(gun), "gelir", "nakit", miktar * satis,
                         f"Aksesuar: {ad} x{miktar}", "aksesuar", g(gun)))
    await db.executemany(
        """INSERT INTO aksesuar_satislar (dukkan_id, aksesuar_id, miktar, toplam, musteri_adi,
               musteri_telefon, customer_id, tarih, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""", aks_satis)
    print(f"Aksesuar satışı: {len(aks_satis)}")

    # ── Giderler (12 ay) ─────────────────────────────────────────────
    giderler = []
    for ay in range(12):
        temel = ay * 30 + random.randint(1, 8)
        for kategori, tutar, aciklama in [
            ("Kira", 28000, "Dükkan kirası"), ("Elektrik", random.randint(2800, 4200), "Elektrik faturası"),
            ("Su", random.randint(480, 780), "Su faturası"), ("İnternet", 890, "Fiber internet"),
            ("Maaş", 106000, "Personel maaşları"),
            ("Malzeme", random.randint(4000, 12000), "Sarf malzeme"),
            ("Kargo", random.randint(800, 2400), "Kargo giderleri"),
            ("Vergi", random.randint(3000, 9000), "Vergi / SGK"),
        ]:
            giderler.append((dukkan_id, kategori, tutar, aciklama, gs(temel), g(temel)))
            kasa.append((dukkan_id, gs(temel), "gider", "havale", tutar,
                         f"{kategori} — {aciklama}", "gider", g(temel)))
    await db.executemany(
        "INSERT INTO giderler (dukkan_id, kategori, tutar, aciklama, tarih, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
        giderler)

    await db.executemany(
        """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""", kasa)
    print(f"Kasa hareketi: {len(kasa)}")

    # ── Borçlar / taksitler ──────────────────────────────────────────
    for _ in range(26):
        m = random.choice(musteriler)
        toplam = random.choice([2400, 3200, 5400, 8500, 12000, 15000, 21000, 26000])
        odenen = random.choice([0, toplam * 0.3, toplam * 0.5, toplam])
        taksit = random.choice([1, 1, 2, 3, 6])
        gun = random.randint(5, 300)
        did = await db.fetchval(
            """INSERT INTO debts (dukkan_id, customer_id, borc_turu, source_type, amount, total_amount,
                   paid_amount, payment_type, installment_count, due_date, notes, created_by, created_at)
               VALUES ($1,$2,'alacak','manuel',$3,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id""",
            dukkan_id, m["id"], toplam, odenen, "taksit" if taksit > 1 else "borc", taksit,
            (g(gun) + timedelta(days=random.choice([30, 45, 60]))).strftime("%Y-%m-%d"),
            random.choice(["Cihaz taksitli satış", "Tamir ücreti kalan", "Toplu parça alımı",
                           "2.El cihaz kalan bakiye"]), patron_id, g(gun))
        if odenen > 0:
            await db.execute(
                """INSERT INTO debt_payments (dukkan_id, debt_id, amount, payment_type, notes, created_by, paid_at)
                   VALUES ($1,$2,$3,'nakit','Tahsilat',$4,$5)""",
                dukkan_id, did, odenen, patron_id, g(max(gun - 15, 0)))

    # ── Yedek telefon / kara liste / maaş / hedef ────────────────────
    loaner = []
    for i in range(22):
        m = random.choice(musteriler)
        teslim = random.randint(1, 300)
        iade = max(teslim - random.randint(3, 20), 0) if i >= 3 else None
        loaner.append((dukkan_id, m["name"], random.choice(
            ["Samsung Galaxy A12", "iPhone SE 2020", "Xiaomi Redmi 9", "Samsung A03", "iPhone 7"]),
            gs(teslim), gs(iade) if iade is not None else None,
            "Tamir süresince verildi", iade is None))
    await db.executemany(
        """INSERT INTO loaner_cihazlar (dukkan_id, musteri_adi, cihaz, teslim_tarihi, iade_tarihi, notlar, aktif)
           VALUES ($1,$2,$3,$4,$5,$6,$7)""", loaner)

    kara = [("Hasan Kurt", "05339998877", "Ödeme yapmadan cihazı aldı, iletişim kurulamıyor"),
            ("Serkan Ay", "05421119933", "Sahte cihaz getirdi, tartışma çıkardı"),
            ("Metin Zorlu", "05337776644", "Sürekli iade talep ediyor, tehditkâr davrandı"),
            ("Recep Sağlam", "05449998811", "Çalıntı IMEI'li cihaz getirdi"),
            ("Kadir Yavuz", "05356663311", "Ödeme sözünü 3 kez tutmadı"),
            ("Emrah Tunç", "05327774422", "Cihazı aldıktan sonra hasar iddiasında bulundu")]
    await db.executemany(
        "INSERT INTO kara_liste (dukkan_id, ad, telefon, sebep, created_at) VALUES ($1,$2,$3,$4,$5)",
        [(dukkan_id, a, t, s, g(random.randint(30, YIL))) for a, t, s in kara])

    maas_kayit, avans_kayit = [], []
    for ad, cid in calisanlar.items():
        maas = 42000 if "Emre" in ad else 38000 if "Selin" in ad else 26000
        for ay_geri in range(12):
            t = BUGUN - timedelta(days=ay_geri * 30)
            maas_kayit.append((dukkan_id, cid, t.year, t.month, maas, ay_geri > 0,
                               gs(ay_geri * 30) if ay_geri > 0 else None))
        for _ in range(random.randint(4, 9)):
            avans_kayit.append((dukkan_id, cid, random.choice([1500, 2000, 3000, 5000]),
                                gs(random.randint(5, YIL)), "Avans talebi"))
    await db.executemany(
        """INSERT INTO maas_odemeleri (dukkan_id, calisan_id, yil, ay, maas, odendi, odeme_tarihi)
           VALUES ($1,$2,$3,$4,$5,$6,$7)""", maas_kayit)
    await db.executemany(
        "INSERT INTO avanslar (dukkan_id, calisan_id, tutar, tarih, notlar) VALUES ($1,$2,$3,$4,$5)", avans_kayit)

    hedefler = []
    for ay_geri in range(12):
        t = BUGUN - timedelta(days=ay_geri * 30)
        hedefler.append((dukkan_id, t.year, t.month, random.choice([220000, 250000, 280000, 300000])))
    await db.executemany(
        "INSERT INTO aylik_hedefler (dukkan_id, yil, ay, hedef_tutar) VALUES ($1,$2,$3,$4)", hedefler)

    # ── Parça iade / alışveriş / şablon ──────────────────────────────
    iadeler = []
    for _ in range(16):
        parca = random.choice(PARCALAR)
        miktar = random.randint(1, 3)
        iadeler.append((dukkan_id, random.choice(toptanci_id), parca[0], miktar,
                        random.choice(["Ölü piksel", "Şişmiş geldi", "Dokunmatik çalışmıyor",
                                       "Yanlış model gönderildi", "Kırık geldi"]),
                        random.choice(["bekliyor", "kabul", "kabul", "red"]),
                        part_id.get(parca[0]), parca[5] * miktar, g(random.randint(3, 200))))
    await db.executemany(
        """INSERT INTO parca_iadeler (dukkan_id, toptanci_id, parca, miktar, sebep, durum, part_id, beklenen_tutar, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""", iadeler)

    alisveris = [("iPhone 16 Ekran", 3, "yuksek"), ("Samsung S24 Batarya", 5, "normal"),
                 ("Isı tabancası ucu", 2, "dusuk"), ("Kapton bant", 10, "normal"),
                 ("iPhone 14 Arka Kapak", 2, "yuksek"), ("Mikroskop lambası", 1, "dusuk"),
                 ("Ultrasonik temizleyici sıvısı", 4, "normal"), ("Vida seti", 6, "normal"),
                 ("Anti-statik bileklik", 3, "dusuk"), ("Xiaomi 14 Ekran", 2, "yuksek"),
                 ("Lehim teli 0.6mm", 5, "normal"), ("Cımbız seti", 2, "dusuk"),
                 ("iPhone 15 Kırılmaz Cam (koli)", 50, "normal"), ("Powerbank stoğu", 20, "normal"),
                 ("Ekran sökme vakumu", 1, "dusuk"), ("Flux pastası", 4, "normal")]
    await db.executemany(
        "INSERT INTO shopping_list (dukkan_id, item, quantity, priority, bought, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [(dukkan_id, i, q, p, random.random() < 0.35, g(random.randint(1, 120))) for i, q, p in alisveris])

    sablonlar = [("iPhone Ekran Değişimi", "iPhone Genel", "Ekran kırık", 4600),
                 ("Samsung Ekran Değişimi", "Samsung Genel", "Ekran kırık", 3900),
                 ("Batarya Değişimi", "Genel", "Batarya çabuk bitiyor", 1250),
                 ("Şarj Soketi Onarımı", "Genel", "Şarj olmuyor", 950),
                 ("Su Hasarı Bakımı", "Genel", "Su hasarı", 1800),
                 ("Arka Cam Değişimi", "iPhone Genel", "Arka cam kırık", 1650),
                 ("Ön Kamera Değişimi", "Genel", "Ön kamera bulanık", 1100),
                 ("Hoparlör Değişimi", "Genel", "Ses gelmiyor", 750),
                 ("Anakart Tamiri", "Genel", "Açılmıyor", 3500),
                 ("Yazılım Yükleme", "Genel", "Açılış logosunda kalıyor", 550),
                 ("Veri Kurtarma", "Genel", "Veriler kurtarılacak", 2200),
                 ("Titreşim Motoru", "Genel", "Titreşim çalışmıyor", 480)]
    await db.executemany(
        """INSERT INTO tamir_sablonlar (dukkan_id, ad, cihaz_model, ariza, tahmini_ucret, kullanim_sayisi, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)""",
        [(dukkan_id, a, m, ar, u, random.randint(5, 90), g(random.randint(100, YIL))) for a, m, ar, u in sablonlar])

    # ── Vitrin / portal ──────────────────────────────────────────────
    deg = []
    for i, (puan, yorum) in enumerate(YORUMLAR * 3):
        if i >= min(len(teslim_bilgi), 52):
            break
        repair_no, m, *_ = teslim_bilgi[i]
        deg.append((dukkan_id, repair_no, m["name"], puan, yorum,
                    i < 48, g(random.randint(2, 300))))
    await db.executemany(
        """INSERT INTO degerlendirmeler (dukkan_id, repair_no, musteri_adi, puan, yorum, onaylandi, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)""", deg)

    randevu = []
    for i in range(40):
        ad, tel = random.choice(_isimler(1))
        randevu.append((dukkan_id, ad, tel, random.choice(CIHAZ_MODELLERI),
                        random.choice(RANDEVU_MESAJ),
                        random.choice(["yeni", "yeni", "goruldu", "tamire_donusturuldu", "reddedildi"])
                        if i > 4 else "yeni",
                        g(random.randint(0, 120))))
    await db.executemany(
        """INSERT INTO randevu_talepleri (dukkan_id, musteri_adi, telefon, cihaz_model, aciklama, durum, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)""", randevu)

    takas = []
    for i in range(26):
        ad, tel = random.choice(_isimler(1))
        durum = random.choice(["yeni", "yeni", "teklif_verildi", "kabul_edildi", "reddedildi"]) if i > 3 else "yeni"
        takas.append((dukkan_id, ad, tel, random.choice(FOTO_MODELLERI),
                      random.choice(TAKAS_ACIKLAMA), durum,
                      random.choice([5200, 8400, 12000, 16500, 21000]) if durum in
                      ("teklif_verildi", "kabul_edildi") else None,
                      g(random.randint(0, 200))))
    await db.executemany(
        """INSERT INTO takas_teklifleri (dukkan_id, musteri_adi, telefon, cihaz_model, aciklama, durum, teklif_tutari, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""", takas)

    portal_musteriler = [dict(r) for r in await db.fetch(
        "SELECT id, name FROM customers WHERE dukkan_id=$1 AND sifre_hash IS NOT NULL LIMIT 12", dukkan_id)]
    sohbetler = [
        [("musteri", "Merhaba, telefonum hazır mı acaba?"),
         ("dukkan", "Merhaba, ekran değişimi bitti, bugün 17:00'den sonra alabilirsiniz."),
         ("musteri", "Süper, teşekkürler!")],
        [("musteri", "10 adet iPhone 13 ekranı lazım, stok var mı?"),
         ("dukkan", "Şu an 9 adet var, kalanı 2 gün içinde tedarik ederiz.")],
        [("musteri", "Garantim ne zaman bitiyor?"),
         ("dukkan", "Kaydınıza göre 3 ay daha garantiniz devam ediyor.")],
        [("musteri", "Batarya değişimi ne kadar sürer?"),
         ("dukkan", "Ortalama 45 dakika, stokta varsa beklerken yapıyoruz."),
         ("musteri", "Yarın uğrarım o zaman.")],
        [("musteri", "Cihazımı kargoyla gönderebilir miyim?"),
         ("dukkan", "Tabii, adresi WhatsApp'tan iletelim.")],
        [("musteri", "Taksit imkanı var mı?"),
         ("dukkan", "Kredi kartına 6 taksit yapabiliyoruz.")],
        [("musteri", "Eski telefonumu takas eder misiniz?"),
         ("dukkan", "Cihazı görüp değer biçelim, takas kabul ediyoruz.")],
    ]
    mesajlar = []
    for i, sohbet in enumerate(sohbetler):
        if i >= len(portal_musteriler):
            break
        m = portal_musteriler[i]
        temel = random.randint(1, 60)
        for j, (gonderen, mesaj) in enumerate(sohbet):
            mesajlar.append((dukkan_id, m["id"], gonderen, mesaj,
                             not (gonderen == "musteri" and j == len(sohbet) - 1),
                             g(temel) + timedelta(minutes=j * 9)))
    await db.executemany(
        """INSERT INTO musteri_mesajlari (dukkan_id, customer_id, gonderen, mesaj, okundu, created_at)
           VALUES ($1,$2,$3,$4,$5,$6)""", mesajlar)

    gb = [(patron_id, personel["teknisyen"], "ovgu", "Bu ay su hasarı onarımlarında çok başarılıydın, tebrikler."),
          (patron_id, personel["cirak"], "sikayet", "Tezgah düzeni konusunda daha dikkatli olmalısın."),
          (personel["satis"], patron_id, "ovgu", "Yeni stok sistemi işimizi çok kolaylaştırdı."),
          (patron_id, personel["satis"], "ovgu", "Aksesuar satışlarını ciddi artırdın."),
          (personel["teknisyen"], patron_id, "sikayet", "Havya istasyonunun yenilenmesi gerekiyor."),
          (patron_id, personel["teknisyen"], "ovgu", "Müşteri memnuniyeti puanımız 4.8'e çıktı."),
          (personel["cirak"], patron_id, "ovgu", "Eğitim desteği için teşekkürler."),
          (patron_id, personel["cirak"], "ovgu", "Son bir ayda gözle görülür ilerleme var.")]
    await db.executemany(
        """INSERT INTO calisan_geri_bildirim (dukkan_id, gonderen_id, hedef_id, tur, mesaj, goruldu, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)""",
        [(dukkan_id, a, b, t, m, random.random() < 0.5, g(random.randint(2, 200))) for a, b, t, m in gb])

    for baslik in GALERI_BASLIKLARI:
        await db.execute("INSERT INTO dukkan_galeri (dukkan_id, foto_url, baslik) VALUES ($1,$2,$3)",
                         dukkan_id, galeri_gorseli(dukkan_id, baslik, "#1f4037", "#99f2c8"), baslik)

    await db.executemany(
        """INSERT INTO destek_mesajlari (dukkan_id, gonderen_rol, gonderen_ad, mesaj, okundu, created_at)
           VALUES ($1,'dukkan','Yusuf Yıldız',$2,false,$3)""",
        [(dukkan_id, "Merhaba, ikinci bir şube açacağız. Aynı hesaptan iki dükkan yönetebilir miyiz?", g(2)),
         (dukkan_id, "Barkod okuyucu desteği eklenmesi mümkün mü?", g(40))])

    # ── Özet ──────────────────────────────────────────────────────────
    ozet = {}
    for t in ["customers", "repairs", "parts", "repair_parts", "ikinci_el", "sifir_cihazlar",
              "aksesuarlar", "aksesuar_satislar", "kasa_hareketleri", "giderler", "debts",
              "garantiler", "degerlendirmeler", "randevu_talepleri", "takas_teklifleri",
              "toptancilar", "toptanci_alislar", "dukkan_galeri", "loaner_cihazlar",
              "kara_liste", "maas_odemeleri", "avanslar", "parca_iadeler", "shopping_list",
              "tamir_sablonlar", "musteri_mesajlari", "imei_history", "stok_hareketleri"]:
        ozet[t] = await db.fetchval(f"SELECT COUNT(*) FROM {t} WHERE dukkan_id = $1", dukkan_id)

    await db.close()
    print("\n=== DEMO HAZIR (1 yıllık geçmiş) ===")
    print(f"Vitrin : /magaza/{SLUG}")
    print(f"Giriş  : {PATRON_EMAIL} / {PATRON_SIFRE}")
    print(f"Portal : 05321112233 / Demo1234")
    for k, v in ozet.items():
        print(f"  {k:22} {v}")


if __name__ == "__main__":
    asyncio.run(main())
