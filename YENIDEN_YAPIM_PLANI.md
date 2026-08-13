# Telefon Servis — Yeniden Yapım Planı

Hazırlık: 13 Ağustos 2026. Karar toplantısı sonrası netleşen kapsam.

---

## 0. Alınan Kararlar (değişmez)

| Konu | Karar | Gerekçe |
|---|---|---|
| **Mimari** | Çok dükkânlı SaaS (multi-tenant) | Tek kurulum, yüzlerce telefoncu. Abonelik modeli. |
| **Veritabanı** | SQLite → **PostgreSQL** | Eşzamanlı yazmada kilitlenme yok. Sunucuda zaten kurulu. |
| **Arayüz** | Tek kod tabanı + responsive | Masaüstü: sol menü + tablo. Mobil: alt menü + kart. Bakım tek yerden. |
| **Tasarım dili** | OCAK malzemesi + modül renkleri korunur | Kabartma/gömme yüzey, gölge grameri, grain OCAK'tan. Renk paleti şimdilik korunuyor — beğenilmezse tam OCAK'a (4 renk) geçilir. |
| **Stok yapısı** | Marka → Model → Parça tipi hiyerarşisi | VarmiStok'un `brands.js` / `modelKutuphanesi.js` / `parcaTipleri.js` kütüphaneleri yeniden kullanılır. |
| **Portal adresi** | `dukkanadi.telefon.varmistok.com` | Wildcard SSL zaten var. İleride kendi domain'e taşınacak. |
| **Mobil uygulama** | Capacitor → Android APK → Play Store | Web paneliyle tek kod. VarmiStok'un `MOBIL_PLAN.md` izin haritası aynen geçerli. |

---

## 🔴 ACİL — Plandan önce yapılacak

`backend/auth.py:13`:

```python
if DEV_MODE or init_data == "mock_dev_mode":
    return {"id": DEV_TELEGRAM_ID, "first_name": "Dev"}
```

Frontend Telegram dışında açılınca `"mock_dev_mode"` gönderiyor, backend **koşulsuz kabul ediyor**.
`https://telefon.varmistok.com` şu an herkese açık — adresi bilen patron yetkisiyle giriyor.

**Yapılacak:** Faz 1 bitene kadar geçici HTTP Basic Auth (Nginx katmanında) veya
`mock_dev_mode` dalının prod'da kapatılması.

---

## Faz 0 — Altyapı (her şeyin temeli)

Bu faz bitmeden diğerlerine başlanmaz; tümü veri modeline bağlı.

### 0.1 PostgreSQL kurulumu
- Sunucuda ikinci Postgres veritabanı (`telefon_db`), parca_db'den ayrı container
- Bağlantı havuzu, yedekleme cron'u

### 0.2 Şema yeniden tasarımı — kiracı izolasyonu
- Yeni tablo: `dukkanlar` (id, ad, slug, telefon, adres, abonelik_durumu, abonelik_bitis, created_at)
- **Mevcut 41 tablonun tamamına `dukkan_id` kolonu** + foreign key + index
- Her sorguya `WHERE dukkan_id = :aktif_dukkan` zorunluluğu (deps katmanında merkezî)
- SQLAlchemy'ye geçiş (raw SQL → ORM), VarmiStok'un `models/` deseni

### 0.3 Kimlik doğrulama
- `kullanicilar` tablosu: e-posta, şifre (bcrypt), dukkan_id, rol, durum
- JWT token (access + refresh), `X-Init-Data` header'ı kaldırılır
- Roller korunur: patron / satis / teknisyen / cirak + **super_admin** (dükkânüstü)
- İlk kayıt olan = o dükkânın patronu, sonrakiler onay bekler (mevcut mantık)

### 0.4 Telegram bağımlılığının kaldırılması
- `tg.js` silinir, `telegram-web-app.js` script'i kaldırılır
- `auth.py` tamamen yeniden yazılır
- Telegram bildirimleri opsiyonel entegrasyon olarak kalır (bot token dükkân ayarında)

### 0.5 Veri taşıma
- Mevcut SQLite verisi → PostgreSQL, tek dükkân olarak (`dukkan_id=1`)

---

## Faz 1 — OCAK tasarım sistemi + responsive düzen

### 1.1 OCAK CSS temeli
- `ocak.css` portu: `.raised` / `.inset` yüzey reçeteleri, `--edge-lit` / `--edge-dark` / `--lift`
- Grain dokusu (`::after`, opacity `.035`, `mix-blend-mode: overlay`)
- Arkaplan `#191b20`, `color-scheme: dark`, açık tema yok
- Tipografi: `tabular-nums`, Türk sayı biçimi (`1.234,56`), sistem font yığını
- Yasaklar uygulanır: sonsuz animasyon yok, `backdrop-filter` yok, `border: 1px solid` yok

### 1.2 Renk politikası (karar: OCAK malzemesi + mevcut renkler)
- Yüzey/gölge/grain OCAK'tan birebir
- Modül renkleri (mor/mavi/yeşil/turuncu/kırmızı/pembe/turkuaz) korunur
- **Ama OCAK kuralı geçerli:** renkli ışık nesnenin ALTINDAN sızar (backlit katman),
  nesnenin kendisine `box-shadow: 0 0 Npx <renk>` neon verilmez
- Gölge grameri zorunlu: kabartma = eylem yapılabilir, gömme = pasif/kilitli

### 1.3 Emoji → SVG ikon
- Tüm emoji'ler (🔧 📱 💰 ⏳ …) SVG çizgi ikona dönüşür
- `stroke: var(--seg); fill: none; stroke-width: 1.7–1.9; stroke-linecap: round`
- lucide-react kullanılabilir (VarmiStok'ta zaten var)

### 1.4 Responsive düzen
| | Masaüstü (≥1024px) | Mobil (<1024px) |
|---|---|---|
| Navigasyon | Sol sabit menü (sidebar) | Alt menü (bottom nav) + "Daha" |
| Liste | Tablo (sıralanabilir, çok sütun) | Kart yığını |
| Form | Çok sütunlu, geniş | Tek sütun, tam ekran |
| Detay | Yan panel (split view) | Ayrı sayfa |

- VarmiStok'un `tabloMobil.js` deseni alınır (tablo → kart otomatik dönüşümü)
- Tek kod tabanı; ayrı dosya yazılmaz

### 1.5 Sayfa dönüşümü
36 sayfanın tamamı yeni sisteme geçirilir. Öncelik sırası:
Dashboard → Tamirler → Yeni Tamir → Müşteriler → Stok → Kasa → diğerleri

---

## Faz 2 — Stok yeniden yapılandırma

### 2.1 Hiyerarşi
```
Marka (Apple)
  └── Model (iPhone 13)
        └── Parça tipi (Komple Ekran / Batarya / Şarj Bordu…)
              └── Stok kaydı (adet, alış, satış, kritik seviye)
```

### 2.2 VarmiStok'tan alınacak dosyalar
| Dosya | İçerik |
|---|---|
| `brands.js` | 32 marka + Simple Icons logo slug'ları |
| `modelKutuphanesi.js` | 9092 satır doğrulanmış marka/model referansı |
| `parcaTipleri.js` | Gruplu parça tipi listesi (Ekran, Güç, Kamera, Kasa…) |

### 2.3 Arayüz
- Marka logolu grid → model arama/seçim → parça tipi ikonlu seçim
- Serbest metin yerine listeden seçim (`EditableSelect` deseni: liste + "Yeni ekle…")
- Kritik stok rozetleri, toplu işlem, filtre

---

## Faz 3 — Super Admin paneli

VarmiStok'un `SuperAdmin.jsx` (1274 satır) sekme yapısı örnek alınır:

| Sekme | İçerik |
|---|---|
| **Dükkânlar** | Kayıtlı telefoncular, abonelik durumu, askıya alma, dükkân olarak giriş |
| **İstatistik** | Toplam dükkân, aktif kullanıcı, işlem hacmi, büyüme grafikleri |
| **Mali Durum** | Abonelik gelirleri, ödeme geçmişi, gecikmiş ödemeler |
| **Destek** | Dükkânlardan gelen talepler, mesajlaşma |
| **Aktivite** | Sistem geneli işlem logu |

---

## Faz 4 — Public taraf

### 4.1 Tanıtım sitesi (`telefon.varmistok.com`)
- Hero, özellikler, fiyatlandırma, SSS, iletişim
- "Ücretsiz Dene" → kayıt akışı
- VarmiStok'un `Landing.jsx` (708 satır) deseni

### 4.2 Kayıt / Giriş
- E-posta + şifre, e-posta doğrulama
- Dükkân bilgileri (ad, slug, telefon, adres)
- Slug'dan subdomain otomatik: `tayfun-gsm.telefon.varmistok.com`

### 4.3 Dükkân portalı (`dukkanadi.telefon.varmistok.com`)

**Onaylanan modüller:**
- Tamir durumu sorgulama (telefon no / tamir no ile)
- Dükkân vitrin sayfası (hizmetler, fiyat, saatler, harita, WhatsApp)
- Satılık cihaz listesi (2.el + sıfır stoktan otomatik)
- Randevu / tamir talebi formu

**Ek öneriler (onay bekliyor):**
- Garanti sorgulama
- Dijital fiş / QR ile tamir geçmişi
- Cihaz hazır olunca otomatik WhatsApp/SMS bildirimi + portal linki
- Model bazlı fiyat sorgulama
- Teslim sonrası değerlendirme (vitrinde görünür)
- Cihaz takas teklifi (müşteri fotoğraf yükler, dükkân teklif verir)

---

## Faz 5 — Android uygulaması

- **Capacitor** ile mevcut React paneli paketlenir
- İzinler: kamera (IMEI/fotoğraf), mikrofon (sesle kayıt), rehber, bluetooth (barkod/yazıcı), bildirim, biyometrik
- **Play Store'dan eden izinler kullanılmaz:** `READ_CALL_LOG`, SMS okuma/gönderme, görüşme kaydı, arka plan konumu
- **Uygulama içi satış YOK** — abonelik yalnızca web üzerinden (Play komisyonundan kaçınma)
- Google Developer hesabı: $25 tek seferlik

---

## Bilinen diğer sorunlar (tarama raporundan)

| # | Sorun | Faz |
|---|---|---|
| 1 | `mock_dev_mode` arka kapısı | ACİL |
| 2 | `/api/admin/reset-all-data?secret=SIFIRLA2024` — kodda açık şifre | 0 |
| 3 | CORS `allow_origins=["*"]` | 0 |
| 4 | Fotoğraflar base64 olarak DB'de — şişme riski | 0.2 (dosya/S3'e taşınacak) |
| 5 | AI context'e müşteri telefon/IMEI ham gidiyor | 0 (maskeleme) |
| 6 | Generic `except: pass` blokları, log yok | 0 |
| 7 | Test yok, README yok | süreç boyunca |
| 8 | IMEI API entegrasyonu yarım | 2 |

---

## Sıra

```
ACİL güvenlik yaması
   ↓
Faz 0  Altyapı (PostgreSQL + multi-tenant + login)
   ↓
Faz 1  OCAK + responsive          ←┐ paralel gidebilir
Faz 2  Stok hiyerarşisi            ←┘
   ↓
Faz 3  Super admin
   ↓
Faz 4  Tanıtım sitesi + portal
   ↓
Faz 5  Android APK
```

Faz 0 kritik yol üzerinde — bitmeden hiçbiri anlamlı ilerlemez.
