ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_metin_x_pct REAL DEFAULT 50;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_metin_y_pct REAL DEFAULT 42;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_metin_genislik_mm REAL DEFAULT 34;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_metin_yukseklik_mm REAL DEFAULT 13;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_barkot_x_pct REAL DEFAULT 50;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_barkot_y_pct REAL DEFAULT 80;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_barkot_genislik_mm REAL DEFAULT 34;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_barkot_yukseklik_mm REAL DEFAULT 10;
