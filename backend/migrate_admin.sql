-- Faz 3 (Super Admin) için ek tablolar/kolonlar. IF NOT EXISTS ile idempotent.

-- Son giriş takibi (VarmiStok'taki "son giriş" sütunu için)
ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS son_giris_at TIMESTAMP;

-- Platform (süper admin) işlem geçmişi — dükkan silinse bile ad'ı hayatta kalsın diye denormalize
CREATE TABLE IF NOT EXISTS platform_audit_log (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER REFERENCES dukkanlar(id) ON DELETE SET NULL,
    dukkan_ad TEXT,
    aksiyon TEXT NOT NULL,
    detay TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- Platformun kendi giderleri (Mali Durum sekmesi)
CREATE TABLE IF NOT EXISTS platform_giderler (
    id SERIAL PRIMARY KEY,
    tur TEXT NOT NULL,           -- reklam / gelistirme / sunucu / diger
    tutar REAL NOT NULL,
    aciklama TEXT,
    tarih TEXT NOT NULL,         -- "YYYY-MM-DD"
    created_at TIMESTAMP DEFAULT now()
);

-- Destek mesajlaşması (dükkan <-> platform)
CREATE TABLE IF NOT EXISTS destek_mesajlari (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    gonderen_rol TEXT NOT NULL,  -- dukkan / platform
    gonderen_ad TEXT,
    mesaj TEXT NOT NULL,
    okundu BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now()
);

-- Platform duyuruları (toplu bildirim)
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
