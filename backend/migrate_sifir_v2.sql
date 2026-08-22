CREATE TABLE IF NOT EXISTS sifir_cihaz_masraflar (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    cihaz_id INTEGER REFERENCES sifir_cihazlar(id) ON DELETE CASCADE,
    aciklama TEXT NOT NULL,
    tutar REAL NOT NULL,
    tarih TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sifir_masraflar_cihaz ON sifir_cihaz_masraflar(cihaz_id);

CREATE TABLE IF NOT EXISTS sifir_cihaz_fotograflari (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    cihaz_id INTEGER REFERENCES sifir_cihazlar(id) ON DELETE CASCADE,
    foto TEXT NOT NULL,
    aciklama TEXT,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sifir_fotograflari_cihaz ON sifir_cihaz_fotograflari(cihaz_id);
