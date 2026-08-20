CREATE TABLE IF NOT EXISTS aksesuar_kategorileri (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    ad TEXT NOT NULL,
    UNIQUE(dukkan_id, ad)
);

CREATE TABLE IF NOT EXISTS aksesuar_stok_hareketleri (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    aksesuar_id INTEGER NOT NULL REFERENCES aksesuarlar(id) ON DELETE CASCADE,
    tur TEXT NOT NULL,
    miktar INTEGER NOT NULL,
    referans_tip TEXT,
    referans_id INTEGER,
    aciklama TEXT,
    created_by INTEGER REFERENCES kullanicilar(id),
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aksesuar_hareket_urun ON aksesuar_stok_hareketleri(aksesuar_id, created_at DESC);
