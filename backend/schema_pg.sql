-- Telefon Servis — PostgreSQL şeması (çok dükkânlı / multi-tenant)
-- Her iş tablosuna dukkan_id eklendi. users tablosu artık kimlik doğrulama içerir
-- (telegram_id yerine e-posta/şifre), tenant başına izole çalışır.

CREATE TABLE IF NOT EXISTS dukkanlar (
    id SERIAL PRIMARY KEY,
    ad TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    telefon TEXT,
    adres TEXT,
    sehir TEXT,
    abonelik_durumu TEXT DEFAULT 'deneme',   -- deneme / aktif / askida / iptal
    abonelik_bitis TIMESTAMP,
    silme_talep_tarihi TIMESTAMP,
    plan TEXT DEFAULT 'deneme',
    referans_kod TEXT,
    vitrin_aktif BOOLEAN DEFAULT true,
    vitrin_aciklama TEXT,
    calisma_saatleri TEXT,
    hizmetler TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kullanicilar (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER REFERENCES dukkanlar(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    sifre_hash TEXT NOT NULL,
    ad TEXT NOT NULL,
    rol TEXT DEFAULT 'cirak',        -- super_admin / patron / satis / teknisyen / cirak
    durum TEXT DEFAULT 'aktif',      -- aktif / bekliyor / pasif
    aktif BOOLEAN DEFAULT true,
    son_giris_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(dukkan_id, email)
);
-- super_admin kullanıcılarda dukkan_id NULL olabilir (dükkânüstü hesap)

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    visit_count INTEGER DEFAULT 0,
    sifre_hash TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repairs (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    repair_no TEXT,
    customer_id INTEGER REFERENCES customers(id),
    device_model TEXT NOT NULL,
    imei TEXT,
    fault_desc TEXT,
    estimated_price REAL DEFAULT 0,
    final_price REAL,
    payment_type TEXT DEFAULT 'nakit',
    paid_amount REAL DEFAULT 0,
    warranty_days INTEGER DEFAULT 0,
    status TEXT DEFAULT 'bekliyor',
    assigned_to INTEGER REFERENCES kullanicilar(id),
    notes TEXT,
    screen_lock_type TEXT,
    screen_lock_value TEXT,
    tamirde_at TIMESTAMP,
    completed_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_by INTEGER REFERENCES kullanicilar(id),
    son_guncelleyen_id INTEGER REFERENCES kullanicilar(id),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(dukkan_id, repair_no)
);

CREATE TABLE IF NOT EXISTS parts (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    device_model TEXT,
    part_type TEXT,
    quantity INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 0,
    cost_price REAL DEFAULT 0,
    purchase_price REAL DEFAULT 0,
    sale_price REAL DEFAULT 0,
    supplier TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES kullanicilar(id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS toptancilar (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    ad TEXT NOT NULL,
    telefon TEXT,
    sehir TEXT,
    notlar TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS part_orders (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    part_id INTEGER REFERENCES parts(id),
    supplier_id INTEGER REFERENCES toptancilar(id),
    part_name TEXT,
    device_model TEXT,
    repair_id INTEGER REFERENCES repairs(id),
    quantity INTEGER NOT NULL,
    unit_cost REAL DEFAULT 0,
    estimated_price REAL,
    supplier TEXT,
    status TEXT DEFAULT 'siparis_verildi',
    notes TEXT,
    ordered_by INTEGER REFERENCES kullanicilar(id),
    ordered_at TIMESTAMP DEFAULT now(),
    arrived_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS repair_parts (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    repair_id INTEGER REFERENCES repairs(id),
    part_id INTEGER REFERENCES parts(id),
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shopping_list (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    priority TEXT DEFAULT 'normal',
    bought BOOLEAN DEFAULT false,
    bought_price REAL,
    bought_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alisveris_listesi (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    part_name TEXT NOT NULL,
    device_model TEXT,
    quantity INTEGER DEFAULT 1,
    supplier_hint TEXT,
    estimated_price REAL,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'bekliyor',
    added_by INTEGER REFERENCES kullanicilar(id),
    bought_from TEXT,
    bought_by INTEGER REFERENCES kullanicilar(id),
    bought_price REAL,
    bought_at TIMESTAMP,
    added_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS imei_history (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    imei TEXT NOT NULL,
    device_model TEXT,
    customer_id INTEGER REFERENCES customers(id),
    repair_id INTEGER REFERENCES repairs(id),
    action TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS debts (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id),
    alacakli_adi TEXT,
    borc_turu TEXT DEFAULT 'alacak',
    source_type TEXT DEFAULT 'manuel',
    source_id INTEGER,
    amount REAL NOT NULL,
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    payment_type TEXT DEFAULT 'borc',
    installment_count INTEGER DEFAULT 1,
    due_date TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES kullanicilar(id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS debt_payments (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    debt_id INTEGER REFERENCES debts(id),
    amount REAL NOT NULL,
    payment_type TEXT DEFAULT 'nakit',
    notes TEXT,
    created_by INTEGER REFERENCES kullanicilar(id),
    paid_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS toptanci_alislar (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    toptanci_id INTEGER REFERENCES toptancilar(id),
    urun TEXT NOT NULL,
    miktar INTEGER DEFAULT 1,
    birim_fiyat REAL NOT NULL,
    toplam REAL NOT NULL,
    tarih TEXT NOT NULL,
    notlar TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ikinci_el (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    imei TEXT,
    renk TEXT,
    depolama TEXT,
    ram TEXT,
    ozellikler TEXT,
    kimden TEXT,
    kimden_telefon TEXT,
    alis_fiyati REAL NOT NULL,
    notlar TEXT,
    durum TEXT DEFAULT 'stokta',
    satis_fiyati REAL,
    satis_kanali TEXT,
    satis_tarihi TEXT,
    musteri_adi TEXT,
    musteri_telefon TEXT,
    kaynak TEXT DEFAULT 'dukkan',
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ikinci_el_masraflar (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    cihaz_id INTEGER REFERENCES ikinci_el(id),
    aciklama TEXT NOT NULL,
    tutar REAL NOT NULL,
    tarih TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS garantiler (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    musteri_adi TEXT NOT NULL,
    telefon TEXT,
    tamir_id INTEGER REFERENCES repairs(id),
    cihaz TEXT NOT NULL,
    tamir_aciklama TEXT NOT NULL,
    baslangic_tarihi TEXT NOT NULL,
    sure_gun INTEGER NOT NULL,
    bitis_tarihi TEXT NOT NULL,
    aktif BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS kasa_hareketleri (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    tarih TEXT NOT NULL,
    tur TEXT NOT NULL,
    odeme_yontemi TEXT DEFAULT 'nakit',
    tutar REAL NOT NULL,
    aciklama TEXT,
    kaynak TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS giderler (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    kategori TEXT NOT NULL,
    tutar REAL NOT NULL,
    aciklama TEXT,
    tarih TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loaner_cihazlar (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    musteri_adi TEXT NOT NULL,
    cihaz TEXT NOT NULL,
    teslim_tarihi TEXT NOT NULL,
    iade_tarihi TEXT,
    notlar TEXT,
    hasar_notu TEXT,
    hasar_tutar REAL,
    aktif BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS loaner_fotograflari (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    loaner_id INTEGER REFERENCES loaner_cihazlar(id),
    foto TEXT NOT NULL,
    aciklama TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aksesuarlar (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    ad TEXT NOT NULL,
    stok INTEGER DEFAULT 0,
    alis_fiyati REAL NOT NULL,
    satis_fiyati REAL NOT NULL,
    kategori TEXT DEFAULT 'Diğer'
);

CREATE TABLE IF NOT EXISTS aksesuar_satislar (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    aksesuar_id INTEGER REFERENCES aksesuarlar(id),
    miktar INTEGER NOT NULL,
    toplam REAL NOT NULL,
    musteri_adi TEXT,
    musteri_telefon TEXT,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    tarih TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aylik_hedefler (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    yil INTEGER NOT NULL,
    ay INTEGER NOT NULL,
    hedef_tutar REAL NOT NULL,
    UNIQUE(dukkan_id, yil, ay)
);

CREATE TABLE IF NOT EXISTS calisanlar (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    ad TEXT NOT NULL,
    telefon TEXT,
    aylik_maas REAL NOT NULL,
    aktif BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS maas_odemeleri (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    calisan_id INTEGER REFERENCES calisanlar(id),
    yil INTEGER NOT NULL,
    ay INTEGER NOT NULL,
    maas REAL NOT NULL,
    odendi BOOLEAN DEFAULT false,
    odeme_tarihi TEXT
);

CREATE TABLE IF NOT EXISTS avanslar (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    calisan_id INTEGER REFERENCES calisanlar(id),
    tutar REAL NOT NULL,
    tarih TEXT NOT NULL,
    notlar TEXT
);

CREATE TABLE IF NOT EXISTS kara_liste (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    ad TEXT,
    telefon TEXT,
    imei TEXT,
    sebep TEXT NOT NULL,
    notlar TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sifir_cihazlar (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    imei TEXT,
    renk TEXT,
    depolama TEXT,
    kimden TEXT,
    kimden_telefon TEXT,
    kaynak TEXT DEFAULT 'dukkan',
    alis_fiyati REAL NOT NULL,
    alis_tarihi TEXT,
    durum TEXT DEFAULT 'stokta',
    satis_fiyati REAL,
    satis_tarihi TEXT,
    satis_kanali TEXT,
    musteri_adi TEXT,
    musteri_telefon TEXT,
    odeme_yontemi TEXT DEFAULT 'nakit',
    notlar TEXT,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parca_iadeler (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    toptanci_id INTEGER REFERENCES toptancilar(id),
    part_id INTEGER REFERENCES parts(id),
    parca TEXT NOT NULL,
    miktar INTEGER DEFAULT 1,
    sebep TEXT,
    durum TEXT DEFAULT 'bekliyor',
    beklenen_tutar REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stok_hareketleri (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    part_id INTEGER REFERENCES parts(id),
    hareket TEXT NOT NULL,
    miktar INTEGER NOT NULL,
    sebep TEXT,
    aciklama TEXT,
    tarih TEXT NOT NULL,
    created_by INTEGER REFERENCES kullanicilar(id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tamir_sablonlar (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    ad TEXT NOT NULL,
    cihaz_model TEXT,
    ariza TEXT,
    tahmini_ucret REAL,
    notlar TEXT,
    kullanim_sayisi INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tamir_fotograflari (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    repair_id INTEGER REFERENCES repairs(id) ON DELETE CASCADE,
    foto TEXT NOT NULL,
    aciklama TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calisan_geri_bildirim (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    gonderen_id INTEGER REFERENCES kullanicilar(id),
    hedef_id INTEGER NOT NULL REFERENCES kullanicilar(id),
    tur TEXT NOT NULL,
    mesaj TEXT NOT NULL,
    goruldu BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now()
);

-- Süper admin paneli (Faz 3) — bkz. migrate_admin.sql (mevcut kurulumlar için)
CREATE TABLE IF NOT EXISTS platform_audit_log (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER REFERENCES dukkanlar(id) ON DELETE SET NULL,
    dukkan_ad TEXT,
    aksiyon TEXT NOT NULL,
    detay TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_giderler (
    id SERIAL PRIMARY KEY,
    tur TEXT NOT NULL,
    tutar REAL NOT NULL,
    aciklama TEXT,
    tarih TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS destek_mesajlari (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    gonderen_rol TEXT NOT NULL,
    gonderen_ad TEXT,
    mesaj TEXT NOT NULL,
    okundu BOOLEAN DEFAULT false,
    dosya_url TEXT,
    dosya_adi TEXT,
    dosya_tipi TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referans_kodlari (
    id SERIAL PRIMARY KEY,
    kod TEXT UNIQUE NOT NULL,
    sahip_adi TEXT NOT NULL,
    aciklama TEXT,
    indirim_yuzdesi INTEGER DEFAULT 0,
    komisyon_yuzdesi INTEGER DEFAULT 0,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_planlar (
    tur TEXT PRIMARY KEY,
    ad TEXT NOT NULL,
    fiyat REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS randevu_talepleri (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    musteri_adi TEXT NOT NULL,
    telefon TEXT NOT NULL,
    cihaz_model TEXT,
    aciklama TEXT,
    durum TEXT DEFAULT 'yeni',
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS degerlendirmeler (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    repair_no TEXT,
    musteri_adi TEXT NOT NULL,
    puan INTEGER NOT NULL CHECK (puan BETWEEN 1 AND 5),
    yorum TEXT,
    onaylandi BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS takas_teklifleri (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    musteri_adi TEXT NOT NULL,
    telefon TEXT NOT NULL,
    cihaz_model TEXT NOT NULL,
    aciklama TEXT,
    foto_url TEXT,
    durum TEXT DEFAULT 'yeni',
    teklif_tutari REAL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_dogrulama_kodlari (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    kod TEXT NOT NULL,
    dogrulandi BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_duyurular (
    id SERIAL PRIMARY KEY,
    mesaj TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_duyuru_alicilari (
    id SERIAL PRIMARY KEY,
    duyuru_id INTEGER NOT NULL REFERENCES platform_duyurular(id) ON DELETE CASCADE,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    gorundu BOOLEAN DEFAULT false
);

-- Performans için tenant kolonlarına index
CREATE INDEX IF NOT EXISTS idx_customers_dukkan ON customers(dukkan_id);
CREATE INDEX IF NOT EXISTS idx_repairs_dukkan ON repairs(dukkan_id);
CREATE INDEX IF NOT EXISTS idx_parts_dukkan ON parts(dukkan_id);
CREATE INDEX IF NOT EXISTS idx_debts_dukkan ON debts(dukkan_id);
CREATE INDEX IF NOT EXISTS idx_kasa_dukkan ON kasa_hareketleri(dukkan_id);
CREATE INDEX IF NOT EXISTS idx_kullanicilar_dukkan ON kullanicilar(dukkan_id);
CREATE INDEX IF NOT EXISTS idx_ikincel_dukkan ON ikinci_el(dukkan_id);
CREATE INDEX IF NOT EXISTS idx_sifir_dukkan ON sifir_cihazlar(dukkan_id);
