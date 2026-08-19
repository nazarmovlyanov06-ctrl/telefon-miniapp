-- Gider kategorileri artık dükkan bazlı ortak liste (önceden cihaza özel
-- localStorage'daydı, çalışanlar arasında paylaşılmıyordu).
CREATE TABLE IF NOT EXISTS gider_kategorileri (
    id SERIAL PRIMARY KEY,
    dukkan_id INTEGER NOT NULL REFERENCES dukkanlar(id) ON DELETE CASCADE,
    ad TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE (dukkan_id, ad)
);
