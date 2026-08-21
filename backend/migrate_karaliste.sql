ALTER TABLE kara_liste ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE kara_liste ADD COLUMN IF NOT EXISTS kategori TEXT;
ALTER TABLE kara_liste ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES kullanicilar(id);
ALTER TABLE kara_liste ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_kara_liste_customer ON kara_liste(dukkan_id, customer_id);
