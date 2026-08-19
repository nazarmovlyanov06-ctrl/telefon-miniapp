-- Tamir durum akışı: kontrol listesi kalıcılığı + iptal/teslim ek bilgi +
-- müşteri bildirimleri. Canlıdaki veritabanına elle uygulanır (psql).

ALTER TABLE repairs ADD COLUMN IF NOT EXISTS on_odeme INTEGER DEFAULT 0;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS musteri_onayi INTEGER DEFAULT 0;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS eski_parca INTEGER DEFAULT 0;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS veri_yedegi INTEGER DEFAULT 0;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS durum_detay JSONB;

CREATE TABLE IF NOT EXISTS musteri_bildirimleri (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    repair_id INTEGER REFERENCES repairs(id) ON DELETE CASCADE,
    baslik TEXT NOT NULL,
    mesaj TEXT,
    okundu BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_musteri_bildirimleri_customer ON musteri_bildirimleri(customer_id, created_at DESC);
