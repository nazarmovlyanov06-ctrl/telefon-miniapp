-- Müşteri <-> dükkan yazışması. Platform destek sohbetinden (destek_mesajlari) ayrı:
-- o dükkan<->süper admin, bu müşteri<->dükkan.
CREATE TABLE IF NOT EXISTS musteri_mesajlari (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    gonderen TEXT NOT NULL,          -- 'musteri' | 'dukkan'
    mesaj TEXT NOT NULL,
    okundu BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_musteri_mesaj_dukkan ON musteri_mesajlari(dukkan_id);
CREATE INDEX IF NOT EXISTS idx_musteri_mesaj_customer ON musteri_mesajlari(customer_id);
