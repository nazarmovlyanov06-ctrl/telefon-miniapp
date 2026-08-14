-- Faz 3 tamamlama: kalıcı silme, referans kodları, plan bazlı fiyatlandırma,
-- destek dosya eki. IF NOT EXISTS ile idempotent.

ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS silme_talep_tarihi TIMESTAMP;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'deneme';
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS referans_kod TEXT;

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
    tur TEXT PRIMARY KEY,       -- deneme / baslangic / pro / premium
    ad TEXT NOT NULL,
    fiyat REAL NOT NULL DEFAULT 0
);
INSERT INTO platform_planlar (tur, ad, fiyat) VALUES
    ('deneme', 'Deneme', 0),
    ('baslangic', 'Başlangıç', 750),
    ('pro', 'Pro', 1250),
    ('premium', 'Premium', 2000)
ON CONFLICT (tur) DO NOTHING;

ALTER TABLE destek_mesajlari ADD COLUMN IF NOT EXISTS dosya_url TEXT;
ALTER TABLE destek_mesajlari ADD COLUMN IF NOT EXISTS dosya_adi TEXT;
ALTER TABLE destek_mesajlari ADD COLUMN IF NOT EXISTS dosya_tipi TEXT;
