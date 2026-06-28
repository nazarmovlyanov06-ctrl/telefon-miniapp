import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")
DB_PATH = os.getenv("DB_PATH", "../telefon_bot/telefon_bot.db")
IMEI_API_KEY = os.getenv("IMEI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

DAVET_KODU = os.getenv("DAVET_KODU", "")

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
