-- Giderler artık karma ödeme (nakit/kart/borç) destekliyor. Silme işleminde
-- kasadaki karşılığı da temizleyebilmek için geriye bağlantı kolonları.
ALTER TABLE kasa_hareketleri ADD COLUMN IF NOT EXISTS gider_id INTEGER REFERENCES giderler(id);
ALTER TABLE debts ADD COLUMN IF NOT EXISTS gider_id INTEGER REFERENCES giderler(id);
