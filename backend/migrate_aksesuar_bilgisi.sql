-- 2.el/sıfır cihaz eklerken hangi aksesuarların geldiğini kaydetmek için
-- (kutu, şarj aleti, kılıf, kulaklık) — müşteri geçmişinde gösterilir.
ALTER TABLE ikinci_el ADD COLUMN IF NOT EXISTS aksesuarlar JSONB;
ALTER TABLE sifir_cihazlar ADD COLUMN IF NOT EXISTS aksesuarlar JSONB;
