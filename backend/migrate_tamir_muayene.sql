-- "Kontrol Listesi" mantıksızdı (tamire başlamadan "eski parça müşteriye
-- verildi" isteniyordu) — yerine cihazın GELİŞ durumunu kaydeden bir
-- teslim alma muayenesi: gelen aksesuarlar + çalışan/çalışmayan
-- fonksiyonlar + cihaz açılmıyorsa test edilemez notu.

ALTER TABLE repairs ADD COLUMN IF NOT EXISTS intake_kapali BOOLEAN DEFAULT false;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS intake_notu TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS intake_fonksiyonlar JSONB;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS intake_aksesuarlar JSONB;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS intake_onaylandi BOOLEAN DEFAULT false;
