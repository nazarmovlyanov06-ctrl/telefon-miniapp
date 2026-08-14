import base64
import logging
import os
import re
import uuid

log = logging.getLogger("photo_storage")

_UPLOAD_ROOT = os.path.join(os.path.dirname(__file__), "..", "data", "uploads")
_DATA_URI_RE = re.compile(r"^data:image/(?P<ext>[a-zA-Z0-9+.-]+);base64,(?P<data>.+)$", re.DOTALL)


def save_photo(data_uri: str, subdir: str, entity_id: int) -> str:
    """base64 data URI'yi diske yazar, DB'ye kaydedilecek göreli URL yolunu döner.
    DB'de artık büyük base64 blob değil kısa bir path string tutulur."""
    m = _DATA_URI_RE.match(data_uri or "")
    if not m:
        raise ValueError("Geçersiz fotoğraf verisi (data URI bekleniyor)")
    ext = m.group("ext").split("+")[0].lower()
    if ext not in ("jpeg", "jpg", "png", "webp"):
        ext = "jpg"
    raw = base64.b64decode(m.group("data"))

    klasor = os.path.join(_UPLOAD_ROOT, subdir, str(entity_id))
    os.makedirs(klasor, exist_ok=True)
    dosya_adi = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(klasor, dosya_adi), "wb") as f:
        f.write(raw)

    return f"/uploads/{subdir}/{entity_id}/{dosya_adi}"


_IZINLI_UZANTILAR = {
    "jpg": "image", "jpeg": "image", "png": "image", "webp": "image", "gif": "image",
    "pdf": "pdf",
    "mp3": "audio", "wav": "audio", "m4a": "audio", "ogg": "audio", "webm": "audio",
    "mp4": "video", "mov": "video",
}


async def save_upload(upload, subdir: str, entity_id: int) -> tuple[str, str, str]:
    """FastAPI UploadFile'ı diske yazar. (url_path, dosya_adi, dosya_tipi) döner.
    dosya_tipi: image/pdf/audio/video — frontend'de doğru önizlemeyi seçmek için."""
    orijinal_ad = upload.filename or "dosya"
    ext = orijinal_ad.rsplit(".", 1)[-1].lower() if "." in orijinal_ad else ""
    tip = _IZINLI_UZANTILAR.get(ext)
    if not tip:
        raise ValueError(f"Desteklenmeyen dosya türü: .{ext}")

    icerik = await upload.read()
    if len(icerik) > 15 * 1024 * 1024:
        raise ValueError("Dosya çok büyük (max 15MB)")

    klasor = os.path.join(_UPLOAD_ROOT, subdir, str(entity_id))
    os.makedirs(klasor, exist_ok=True)
    dosya_adi = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(klasor, dosya_adi), "wb") as f:
        f.write(icerik)

    return f"/uploads/{subdir}/{entity_id}/{dosya_adi}", orijinal_ad, tip


def delete_photo(url_path: str) -> None:
    """Diskteki dosyayı siler; bulunamazsa/eskiyse (eski base64 kayıtları) sessizce geçer."""
    if not url_path or not url_path.startswith("/uploads/"):
        return
    dosya_yolu = os.path.join(_UPLOAD_ROOT, *url_path[len("/uploads/"):].split("/"))
    try:
        os.remove(dosya_yolu)
    except OSError as e:
        log.warning(f"Fotoğraf dosyası silinemedi: {dosya_yolu} — {e}")
