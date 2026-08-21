ALTER TABLE repairs ADD COLUMN IF NOT EXISTS tahmini_teslim_tarihi DATE;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_tamir_genislik_mm REAL DEFAULT 70;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_tamir_yukseklik_mm REAL DEFAULT 50;
