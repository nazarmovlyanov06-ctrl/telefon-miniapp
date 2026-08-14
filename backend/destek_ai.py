import logging
import httpx
from config import GEMINI_API_KEY

log = logging.getLogger("destek_ai")

_MODELS = ["gemini-flash-lite-latest", "gemini-3-flash-preview", "gemini-3.1-flash-lite"]

_SISTEM = """Sen "Telefon Servis" adlı telefon tamirci dükkanları için SaaS uygulamasının
destek asistanısın. Türkçe, kısa ve net cevap ver. Uygulama şu modülleri içerir: tamir
takibi, müşteri kaydı, stok/parça yönetimi, kasa, 2.el ve sıfır cihaz alım-satımı, garanti
takibi, yedek telefon, kara liste, personel/maaş, IMEI sorgulama, borç takibi.
Eğer soru bu uygulamanın kullanımıyla ilgili basit bir soruysa kısaca cevapla. Emin
olmadığın, hesap/ödeme/teknik hata gibi özel konularda "Bu konuda ekibimiz size yakında
dönüş yapacak" de ve yanıtı kısa tut. Asla uydurma fiyat/özellik bilgisi verme."""


async def ai_yanit_uret(soru: str) -> str | None:
    """Basit destek sorularına en iyi çaba ile otomatik yanıt üretir.
    Başarısız olursa (anahtar yok, API hatası) None döner — çağıran taraf bunu
    sessizce yok sayıp insana bırakmalı."""
    if not GEMINI_API_KEY or not soru.strip():
        return None
    payload = {
        "contents": [{"role": "user", "parts": [{"text": _SISTEM + "\n\nSoru: " + soru}]}],
        "generationConfig": {"maxOutputTokens": 300, "temperature": 0.3},
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            for model in _MODELS:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}",
                    json=payload,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()
                if resp.status_code == 429:
                    continue
    except Exception:
        log.warning("Destek AI otomatik yanıt başarısız", exc_info=True)
    return None
