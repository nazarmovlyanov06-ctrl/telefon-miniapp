ALTER TABLE ikinci_el ADD COLUMN IF NOT EXISTS garanti_bitis_tarihi TEXT;
ALTER TABLE ikinci_el DROP COLUMN IF EXISTS garanti_var;
ALTER TABLE ikinci_el DROP COLUMN IF EXISTS garanti_aciklama;
