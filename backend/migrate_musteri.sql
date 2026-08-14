ALTER TABLE customers ADD COLUMN IF NOT EXISTS sifre_hash TEXT;

ALTER TABLE ikinci_el ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE sifir_cihazlar ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE aksesuar_satislar ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE aksesuar_satislar ADD COLUMN IF NOT EXISTS musteri_telefon TEXT;

CREATE INDEX IF NOT EXISTS idx_ikinci_el_customer ON ikinci_el(customer_id);
CREATE INDEX IF NOT EXISTS idx_sifir_cihaz_customer ON sifir_cihazlar(customer_id);
CREATE INDEX IF NOT EXISTS idx_aksesuar_satis_customer ON aksesuar_satislar(customer_id);
