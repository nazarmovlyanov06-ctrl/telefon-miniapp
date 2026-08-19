ALTER TABLE kasa_hareketleri ADD COLUMN IF NOT EXISTS debt_payment_id INTEGER REFERENCES debt_payments(id);
