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

DURUM_LABELS = {
    "bekliyor": "⏳ Bekliyor",
    "parca_bekleniyor": "📦 Parça Bekleniyor",
    "tamirde": "🔧 Tamirde",
    "hazir": "✅ Hazır",
    "teslim": "🏠 Teslim Edildi",
}

ODEME_LABELS = {
    "nakit": "💵 Nakit",
    "kart": "💳 Kart",
    "senet": "📄 Senet",
    "taksit": "📅 Taksit",
    "borc": "📝 Borç",
}
