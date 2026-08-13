-- Mevcut Postgres tablolarını schema_pg.sql'deki güncel yapıya taşır.
-- IF NOT EXISTS ile idempotent — tekrar çalıştırmak güvenli.

-- customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0;

-- repairs — eski problem/diagnosis/price/advance_payment/payment_method kalsın (kullanılmıyor ama veri kaybı olmasın),
-- yeni kolonları ekle
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS fault_desc TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS estimated_price REAL DEFAULT 0;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS final_price REAL;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'nakit';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS paid_amount REAL DEFAULT 0;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS warranty_days INTEGER DEFAULT 0;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS screen_lock_type TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS screen_lock_value TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS tamirde_at TIMESTAMP;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES kullanicilar(id);
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS son_guncelleyen_id INTEGER REFERENCES kullanicilar(id);
-- repair_no artık dukkan bazlı UNIQUE olmalı (tekil unique kısıtı varsa kaldır)
ALTER TABLE repairs DROP CONSTRAINT IF EXISTS repairs_repair_no_key;
ALTER TABLE repairs ADD CONSTRAINT repairs_dukkan_repair_no_key UNIQUE (dukkan_id, repair_no);

-- debts
ALTER TABLE debts ADD COLUMN IF NOT EXISTS alacakli_adi TEXT;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manuel';
ALTER TABLE debts ADD COLUMN IF NOT EXISTS source_id INTEGER;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS total_amount REAL;
UPDATE debts SET total_amount = amount WHERE total_amount IS NULL;
ALTER TABLE debts ALTER COLUMN total_amount SET NOT NULL;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS paid_amount REAL DEFAULT 0;
UPDATE debts SET paid_amount = COALESCE(paid, 0) WHERE paid_amount = 0;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS installment_count INTEGER DEFAULT 1;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS notes TEXT;
UPDATE debts SET notes = description WHERE notes IS NULL;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES kullanicilar(id);
ALTER TABLE debts ALTER COLUMN payment_type SET DEFAULT 'borc';

-- debt_payments
ALTER TABLE debt_payments ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'nakit';
UPDATE debt_payments SET payment_type = payment_method WHERE payment_type IS NULL;
ALTER TABLE debt_payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE debt_payments ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES kullanicilar(id);

-- part_orders
ALTER TABLE part_orders ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES toptancilar(id);
ALTER TABLE part_orders ADD COLUMN IF NOT EXISTS part_name TEXT;
ALTER TABLE part_orders ADD COLUMN IF NOT EXISTS device_model TEXT;
ALTER TABLE part_orders ADD COLUMN IF NOT EXISTS repair_id INTEGER REFERENCES repairs(id);
ALTER TABLE part_orders ADD COLUMN IF NOT EXISTS estimated_price REAL;
ALTER TABLE part_orders ADD COLUMN IF NOT EXISTS ordered_by INTEGER REFERENCES kullanicilar(id);
ALTER TABLE part_orders ALTER COLUMN part_id DROP NOT NULL;

-- ikinci_el
ALTER TABLE ikinci_el ADD COLUMN IF NOT EXISTS renk TEXT;
ALTER TABLE ikinci_el ADD COLUMN IF NOT EXISTS depolama TEXT;
ALTER TABLE ikinci_el ADD COLUMN IF NOT EXISTS ram TEXT;
ALTER TABLE ikinci_el ADD COLUMN IF NOT EXISTS ozellikler TEXT;
ALTER TABLE ikinci_el ADD COLUMN IF NOT EXISTS kimden_telefon TEXT;
ALTER TABLE ikinci_el ADD COLUMN IF NOT EXISTS musteri_telefon TEXT;

-- sifir_cihazlar
ALTER TABLE sifir_cihazlar ADD COLUMN IF NOT EXISTS kimden_telefon TEXT;

-- parca_iadeler
ALTER TABLE parca_iadeler ADD COLUMN IF NOT EXISTS part_id INTEGER REFERENCES parts(id);
ALTER TABLE parca_iadeler ADD COLUMN IF NOT EXISTS beklenen_tutar REAL DEFAULT 0;

-- stok_hareketleri
ALTER TABLE stok_hareketleri ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES kullanicilar(id);

-- Doğrulama
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('repairs','customers','debts','part_orders','ikinci_el','sifir_cihazlar','parca_iadeler','stok_hareketleri')
ORDER BY table_name, ordinal_position;
