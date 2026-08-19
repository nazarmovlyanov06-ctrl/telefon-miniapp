-- Stok kaydına hangi toptancıdan alındığını bağlamak için.
ALTER TABLE parts ADD COLUMN IF NOT EXISTS toptanci_id INTEGER REFERENCES toptancilar(id);
