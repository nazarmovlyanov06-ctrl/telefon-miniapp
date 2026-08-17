-- Aynı kod tablosu hem kayıt doğrulama hem şifre sıfırlama için kullanılıyor;
-- 'amac' ikisini ayırır (kayıt kodu şifre sıfırlamada kabul edilmesin diye).
ALTER TABLE email_dogrulama_kodlari ADD COLUMN IF NOT EXISTS amac TEXT DEFAULT 'kayit';

CREATE INDEX IF NOT EXISTS idx_email_kod_amac ON email_dogrulama_kodlari(email, amac);
