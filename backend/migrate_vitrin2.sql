-- Ürün görselleri (vitrinde gerçek fotoğraf gösterebilmek için)
ALTER TABLE ikinci_el      ADD COLUMN IF NOT EXISTS gorsel_url TEXT;
ALTER TABLE sifir_cihazlar ADD COLUMN IF NOT EXISTS gorsel_url TEXT;
ALTER TABLE aksesuarlar    ADD COLUMN IF NOT EXISTS gorsel_url TEXT;

-- Dükkân galerisi (dükkân içi, ekip, yapılmış iş örnekleri)
CREATE TABLE IF NOT EXISTS dukkan_galeri (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    foto_url TEXT NOT NULL,
    baslik TEXT,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_galeri_dukkan ON dukkan_galeri(dukkan_id);

-- Müşteri portalı üyeliği: portal_kayit_at doluysa müşteri kendisi kaydolmuş.
-- dukkan_gordu varsayılanı TRUE — mevcut müşteriler "yeni üye" bildirimi
-- olarak görünmesin, sadece bundan sonra kaydolanlar bildirim üretsin.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_kayit_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS dukkan_gordu BOOLEAN DEFAULT true;
