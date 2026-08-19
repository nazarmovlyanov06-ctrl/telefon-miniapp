import logging
import time
import bcrypt
import jwt
from fastapi import HTTPException, Header, Depends
import asyncpg

from config import JWT_SECRET, JWT_ALGO, JWT_ACCESS_MIN, ROLE_SUPER_ADMIN
from database import get_db

log = logging.getLogger("auth")


def hash_sifre(sifre: str) -> str:
    return bcrypt.hashpw(sifre.encode(), bcrypt.gensalt()).decode()


def dogrula_sifre(sifre: str, hash_: str) -> bool:
    try:
        return bcrypt.checkpw(sifre.encode(), hash_.encode())
    except Exception:
        # checkpw yanlış şifrede exception atmaz, sadece False döner — buraya
        # düşmek bozuk/beklenmeyen formatlı bir hash olduğu anlamına gelir.
        log.warning("Şifre doğrulama hatası — hash formatı bozuk olabilir", exc_info=True)
        return False


def olustur_token(kullanici_id: int, dukkan_id: int | None, rol: str) -> str:
    payload = {
        "sub": str(kullanici_id),
        "dukkan_id": dukkan_id,
        "rol": rol,
        "exp": int(time.time()) + JWT_ACCESS_MIN * 60,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def coz_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum suresi doldu, tekrar giris yapin")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Gecersiz oturum")


async def get_current_user(
    authorization: str = Header(..., alias="Authorization"),
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    """FastAPI dependency — Bearer token dogrular, kullaniciyi + dukkan_id'yi dondurur."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token eksik")
    token = authorization[7:]
    payload = coz_token(token)

    row = await db.fetchrow(
        """SELECT k.id, k.dukkan_id, k.email, k.ad, k.rol, k.durum, k.aktif,
                  d.ad AS dukkan_adi
           FROM kullanicilar k
           LEFT JOIN dukkanlar d ON d.id = k.dukkan_id
           WHERE k.id = $1""",
        int(payload["sub"]),
    )
    if not row:
        raise HTTPException(status_code=401, detail="Kullanici bulunamadi")
    if not row["aktif"]:
        raise HTTPException(status_code=403, detail="Hesap pasif")
    if row["durum"] == "bekliyor":
        raise HTTPException(status_code=403, detail="Hesabiniz onay bekliyor")

    if row["dukkan_id"] is not None and row["rol"] != ROLE_SUPER_ADMIN:
        durum = await db.fetchval("SELECT abonelik_durumu FROM dukkanlar WHERE id = $1", row["dukkan_id"])
        if durum == "askida":
            raise HTTPException(status_code=403, detail="Dükkânınız askıya alınmış, lütfen destek ile iletişime geçin")
        if durum == "iptal":
            raise HTTPException(status_code=403, detail="Aboneliğiniz iptal edilmiş, lütfen destek ile iletişime geçin")

    return dict(row)


async def require_patron(user: dict = Depends(get_current_user)) -> dict:
    if user["rol"] not in ("patron", ROLE_SUPER_ADMIN):
        raise HTTPException(status_code=403, detail="Bu islem icin patron yetkisi gerekli")
    return user


async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["rol"] != ROLE_SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Bu islem icin super admin yetkisi gerekli")
    return user


def get_dukkan_id(user: dict = Depends(get_current_user)) -> int:
    """Cogu router bunu kullanir — sorguyu otomatik dukkana kilitler."""
    if user["dukkan_id"] is None:
        raise HTTPException(status_code=400, detail="Bu hesap bir dukkana bagli degil")
    return user["dukkan_id"]


def olustur_musteri_token(customer_id: int, dukkan_id: int) -> str:
    """Personel token'ından ayrı — 'tip' claim'i ile kullanicilar tablosuyla
    çakışmaz, get_current_musteri sadece bunu kabul eder."""
    payload = {
        "sub": str(customer_id),
        "dukkan_id": dukkan_id,
        "tip": "musteri",
        "exp": int(time.time()) + JWT_ACCESS_MIN * 60,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_musteri(
    authorization: str = Header(..., alias="Authorization"),
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Musteri portali icin ayri dependency — kullanicilar tablosuna hic bakmaz."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token eksik")
    payload = coz_token(authorization[7:])
    if payload.get("tip") != "musteri":
        raise HTTPException(status_code=401, detail="Gecersiz musteri oturumu")

    row = await db.fetchrow(
        "SELECT id, dukkan_id, name, phone FROM customers WHERE id = $1",
        int(payload["sub"]),
    )
    if not row or row["dukkan_id"] != payload["dukkan_id"]:
        raise HTTPException(status_code=401, detail="Musteri bulunamadi")
    return dict(row)
