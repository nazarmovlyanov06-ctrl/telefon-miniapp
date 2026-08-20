ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_cerceve_goster BOOLEAN DEFAULT true;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_ayirici_cizgi_goster BOOLEAN DEFAULT false;
ALTER TABLE dukkanlar ADD COLUMN IF NOT EXISTS etiket_logo_boyut INTEGER DEFAULT 22;
