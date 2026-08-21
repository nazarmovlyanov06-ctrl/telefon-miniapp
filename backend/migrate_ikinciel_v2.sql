CREATE TABLE IF NOT EXISTS ikinci_el_fotograflari (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    cihaz_id INTEGER REFERENCES ikinci_el(id) ON DELETE CASCADE,
    foto TEXT NOT NULL,
    aciklama TEXT,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ikinci_el_fotograflari_cihaz ON ikinci_el_fotograflari(cihaz_id);
