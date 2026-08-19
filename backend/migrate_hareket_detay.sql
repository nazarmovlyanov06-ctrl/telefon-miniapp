-- Stok hareketi geçmişinde "kimden, ne kadara, ne zaman" detayını doğru
-- göstermek için — parts.toptanci_id/purchase_price zamanla değişebildiği
-- için her hareketin KENDİ anındaki fiyat/toptancı bilgisi ayrı saklanıyor.
ALTER TABLE stok_hareketleri ADD COLUMN IF NOT EXISTS toptanci_id INTEGER REFERENCES toptancilar(id);
ALTER TABLE stok_hareketleri ADD COLUMN IF NOT EXISTS birim_fiyat REAL;
