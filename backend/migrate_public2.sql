-- Faz 4 kalan modülleri: değerlendirme, takas teklifi, e-posta doğrulama.

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
CREATE INDEX IF NOT EXISTS idx_degerlendirme_dukkan ON degerlendirmeler(dukkan_id);

CREATE TABLE IF NOT EXISTS takas_teklifleri (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    musteri_adi TEXT NOT NULL,
    telefon TEXT NOT NULL,
    cihaz_model TEXT NOT NULL,
    aciklama TEXT,
    foto_url TEXT,
    durum TEXT DEFAULT 'yeni',   -- yeni / teklif_verildi / kabul_edildi / reddedildi
    teklif_tutari REAL,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_takas_dukkan ON takas_teklifleri(dukkan_id);

CREATE TABLE IF NOT EXISTS email_dogrulama_kodlari (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    kod TEXT NOT NULL,
    dogrulandi BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_dogrulama_email ON email_dogrulama_kodlari(email);
