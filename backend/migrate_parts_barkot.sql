ALTER TABLE parts ADD COLUMN IF NOT EXISTS barkot TEXT;
CREATE INDEX IF NOT EXISTS idx_parts_barkot ON parts(dukkan_id, barkot);
