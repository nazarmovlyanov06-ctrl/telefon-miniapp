SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('repairs','customers','debts','part_orders','ikinci_el','sifir_cihazlar','parca_iadeler','stok_hareketleri','parts')
ORDER BY table_name, ordinal_position;
