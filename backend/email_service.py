import logging
import smtplib
from email.mime.text import MIMEText

from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

log = logging.getLogger("email_service")


def email_yapilandirildi() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


def _gonder(alici: str, konu: str, govde: str) -> bool:
    """SMTP ayarlanmadıysa sessizce False döner — çağıran taraf bunu
    'e-posta özelliği aktif değil' olarak yorumlamalı, hata fırlatmamalı."""
    if not email_yapilandirildi():
        log.info(f"SMTP ayarlanmadı, e-posta gönderilemedi: {alici} / {konu}")
        return False
    try:
        msg = MIMEText(govde)
        msg["Subject"] = konu
        msg["From"] = SMTP_FROM
        msg["To"] = alici
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        return True
    except Exception:
        log.warning(f"E-posta gönderilemedi: {alici} / {konu}", exc_info=True)
        return False


def dogrulama_kodu_gonder(alici: str, kod: str) -> bool:
    return _gonder(
        alici,
        "Telefon Servis — Doğrulama Kodu",
        f"Telefon Servis kayıt doğrulama kodunuz: {kod}\n\nBu kod 10 dakika geçerlidir.",
    )


def sifre_sifirlama_kodu_gonder(alici: str, kod: str) -> bool:
    return _gonder(
        alici,
        "Telefon Servis — Şifre Sıfırlama Kodu",
        f"Şifre sıfırlama kodunuz: {kod}\n\nBu kod 10 dakika geçerlidir.\n"
        "Bu talebi siz yapmadıysanız bu e-postayı yok sayın, şifreniz değişmez.",
    )
