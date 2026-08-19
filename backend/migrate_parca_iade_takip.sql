-- Parça iade: kim oluşturdu / kim durumu son değiştirdi takibi + yeni
-- "reddedildi" durumu için şema hazırlığı (uygulama tarafında validate ediliyor).
ALTER TABLE parca_iadeler ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES kullanicilar(id);
ALTER TABLE parca_iadeler ADD COLUMN IF NOT EXISTS son_durum_degistiren_id INTEGER REFERENCES kullanicilar(id);
ALTER TABLE parca_iadeler ADD COLUMN IF NOT EXISTS son_durum_degisiklik_at TIMESTAMP;
