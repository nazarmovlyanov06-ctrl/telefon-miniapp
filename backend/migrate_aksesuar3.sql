ALTER TABLE aksesuarlar ADD COLUMN IF NOT EXISTS barkot TEXT;
CREATE INDEX IF NOT EXISTS idx_aksesuarlar_barkot ON aksesuarlar(dukkan_id, barkot);
