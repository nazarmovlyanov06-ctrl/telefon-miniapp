import logging
import smtplib
from email.mime.text import MIMEText

from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

log = logging.getLogger("email_service")


def email_yapilandirildi() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


def dogrulama_kodu_gonder(alici: str, kod: str) -> bool:
    """SMTP ayarlanmadıysa sessizce False döner — çağıran taraf bunu
    'e-posta doğrulama aktif değil' olarak yorumlamalı, hata fırlatmamalı."""
    if not email_yapilandirildi():
        log.info(f"SMTP ayarlanmadı, doğrulama kodu gönderilemedi: {alici}")
        return False
    try:
        msg = MIMEText(f"Telefon Servis kayıt doğrulama kodunuz: {kod}\n\nBu kod 10 dakika geçerlidir.")
        msg["Subject"] = "Telefon Servis — Doğrulama Kodu"
        msg["From"] = SMTP_FROM
        msg["To"] = alici
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        return True
    except Exception:
        log.warning(f"Doğrulama e-postası gönderilemedi: {alici}", exc_info=True)
        return False
