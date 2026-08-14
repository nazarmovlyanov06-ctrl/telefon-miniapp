-- Faz 4 (tanıtım sitesi + dükkân portalı) için ek kolonlar/tablo.

ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS vitrin_aktif BOOLEAN DEFAULT true;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS vitrin_aciklama TEXT;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS calisma_saatleri TEXT;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS hizmetler TEXT;

CREATE TABLE IF NOT EXISTS randevu_talepleri (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    musteri_adi TEXT NOT NULL,
    telefon TEXT NOT NULL,
    cihaz_model TEXT,
    aciklama TEXT,
    durum TEXT DEFAULT 'yeni',   -- yeni / goruldu / tamire_donusturuldu / reddedildi
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_randevu_dukkan ON randevu_talepleri(dukkan_id);
