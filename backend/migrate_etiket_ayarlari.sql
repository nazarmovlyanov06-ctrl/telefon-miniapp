ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_genislik_mm REAL DEFAULT 40;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_yukseklik_mm REAL DEFAULT 30;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_logo_goster BOOLEAN DEFAULT false;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_kategori_goster BOOLEAN DEFAULT true;
