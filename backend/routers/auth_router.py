import re
import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from database import get_db
from auth import hash_sifre, dogrula_sifre, olustur_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def slug_uret(ad: str) -> str:
    s = ad.strip().lower()
    s = s.replace("ı", "i").replace("ğ", "g").replace("ü", "u").replace("ş", "s").replace("ö", "o").replace("ç", "c")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "dukkan"


class KayitBody(BaseModel):
    dukkan_adi: str
    ad: str
    email: EmailStr
    sifre: str
    telefon: str | None = None


class GirisBody(BaseModel):
    email: EmailStr
    sifre: str


@router.post("/kayit")
async def kayit_ol(body: KayitBody, db: asyncpg.Connection = Depends(get_db)):
    if len(body.sifre) < 6:
        raise HTTPException(400, "Sifre en az 6 karakter olmali")

    var_mi = await db.fetchrow("SELECT id FROM kullanicilar WHERE email = $1", body.email)
    if var_mi:
        raise HTTPException(400, "Bu e-posta zaten kayitli")

    slug_base = slug_uret(body.dukkan_adi)
    slug = slug_base
    i = 1
    while await db.fetchrow("SELECT id FROM dukkanlar WHERE slug = $1", slug):
        i += 1
        slug = f"{slug_base}-{i}"

    async with db.transaction():
        dukkan = await db.fetchrow(
            "INSERT INTO dukkanlar (ad, slug, telefon, abonelik_durumu) VALUES ($1, $2, $3, 'deneme') RETURNING id",
            body.dukkan_adi, slug, body.telefon,
        )
        kullanici = await db.fetchrow(
            """INSERT INTO kullanicilar (dukkan_id, email, sifre_hash, ad, rol, durum)
               VALUES ($1, $2, $3, $4, 'patron', 'aktif') RETURNING id, dukkan_id, rol""",
            dukkan["id"], body.email, hash_sifre(body.sifre), body.ad,
        )

    token = olustur_token(kullanici["id"], kullanici["dukkan_id"], kullanici["rol"])
    return {"token": token, "dukkan_slug": slug, "rol": "patron"}


@router.post("/giris")
async def giris_yap(body: GirisBody, db: asyncpg.Connection = Depends(get_db)):
    row = await db.fetchrow(
        "SELECT id, dukkan_id, sifre_hash, rol, durum, aktif FROM kullanicilar WHERE email = $1",
        body.email,
    )
    if not row or not dogrula_sifre(body.sifre, row["sifre_hash"]):
        raise HTTPException(401, "E-posta veya sifre hatali")
    if not row["aktif"]:
        raise HTTPException(403, "Hesabiniz pasif, patronla iletisime gecin")
    if row["durum"] == "bekliyor":
        raise HTTPException(403, "Hesabiniz onay bekliyor")

    await db.execute("UPDATE kullanicilar SET son_giris_at = now() WHERE id = $1", row["id"])

    token = olustur_token(row["id"], row["dukkan_id"], row["rol"])

    dukkan_slug = None
    if row["dukkan_id"]:
        d = await db.fetchrow("SELECT slug FROM dukkanlar WHERE id = $1", row["dukkan_id"])
        dukkan_slug = d["slug"] if d else None

    return {"token": token, "dukkan_slug": dukkan_slug, "rol": row["rol"]}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user
