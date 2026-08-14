import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://telefon:Tlf_2026_Srvs_x9K@127.0.0.1:8011/telefon_db",
)

JWT_SECRET = os.getenv("JWT_SECRET", "")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET env var zorunlu")

JWT_ALGO = "HS256"
JWT_ACCESS_MIN = 60 * 12       # 12 saat
JWT_REFRESH_DAYS = 30

IMEI_API_KEY = os.getenv("IMEI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Super admin ilk kurulum icin (opsiyonel, ilk acilista kullanilabilir)
SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "")
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "")

ROLE_SUPER_ADMIN = "super_admin"
ROLE_PATRON = "patron"
ROLE_SATIS = "satis"
ROLE_TEKNISYEN = "teknisyen"
ROLE_CIRAK = "cirak"

# SMTP (e-posta doğrulama) — ayarlanmazsa özellik sessizce devre dışı kalır.
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
