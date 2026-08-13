import time
import bcrypt
import jwt
from fastapi import HTTPException, Header, Depends
import asyncpg

from config import JWT_SECRET, JWT_ALGO, JWT_ACCESS_MIN, ROLE_SUPER_ADMIN
from database import get_db


def hash_sifre(sifre: str) -> str:
    return bcrypt.hashpw(sifre.encode(), bcrypt.gensalt()).decode()


def dogrula_sifre(sifre: str, hash_: str) -> bool:
    try:
        return bcrypt.checkpw(sifre.encode(), hash_.encode())
    except Exception:
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
        "SELECT id, dukkan_id, email, ad, rol, durum, aktif FROM kullanicilar WHERE id = $1",
        int(payload["sub"]),
    )
    if not row:
        raise HTTPException(status_code=401, detail="Kullanici bulunamadi")
    if not row["aktif"]:
        raise HTTPException(status_code=403, detail="Hesap pasif")
    if row["durum"] == "bekliyor":
        raise HTTPException(status_code=403, detail="Hesabiniz onay bekliyor")

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
