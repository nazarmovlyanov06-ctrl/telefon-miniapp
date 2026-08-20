CREATE TABLE IF NOT EXISTS bildirimler (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    tur TEXT NOT NULL,
    baslik TEXT NOT NULL,
    mesaj TEXT,
    ilgili_tip TEXT,
    ilgili_id INTEGER,
    okundu_mu BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bildirimler_dukkan ON bildirimler(dukkan_id, created_at DESC);
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS son_hatirlatma_tarihi DATE;
