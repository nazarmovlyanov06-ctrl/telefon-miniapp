import random
import re
from datetime import datetime, timedelta

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from database import get_db
from auth import hash_sifre, dogrula_sifre, olustur_token, get_current_user
from email_service import email_yapilandirildi, dogrulama_kodu_gonder

router = APIRouter(prefix="/auth", tags=["auth"])

_KOD_GECERLILIK_DK = 10


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
    referans_kod: str | None = None


class KodGonderBody(BaseModel):
    email: EmailStr


class KodDogrulaBody(BaseModel):
    email: EmailStr
    kod: str


class GirisBody(BaseModel):
    email: EmailStr
    sifre: str


@router.get("/email-dogrulama-durumu")
async def email_dogrulama_durumu():
    return {"aktif": email_yapilandirildi()}


@router.post("/kod-gonder")
async def kod_gonder(body: KodGonderBody, db: asyncpg.Connection = Depends(get_db)):
    if not email_yapilandirildi():
        raise HTTPException(400, "E-posta doğrulama şu an aktif değil")
    var_mi = await db.fetchrow("SELECT id FROM kullanicilar WHERE email = $1", body.email)
    if var_mi:
        raise HTTPException(400, "Bu e-posta zaten kayitli")
    kod = f"{random.randint(0, 999999):06d}"
    await db.execute("INSERT INTO email_dogrulama_kodlari (email, kod) VALUES ($1, $2)", body.email, kod)
    gonderildi = dogrulama_kodu_gonder(body.email, kod)
    if not gonderildi:
        raise HTTPException(500, "Doğrulama e-postası gönderilemedi, lütfen tekrar deneyin")
    return {"ok": True}


@router.post("/kod-dogrula")
async def kod_dogrula(body: KodDogrulaBody, db: asyncpg.Connection = Depends(get_db)):
    sinir = datetime.utcnow() - timedelta(minutes=_KOD_GECERLILIK_DK)
    row = await db.fetchrow(
        """SELECT id FROM email_dogrulama_kodlari
           WHERE email = $1 AND kod = $2 AND created_at >= $3
           ORDER BY id DESC LIMIT 1""",
        body.email, body.kod, sinir,
    )
    if not row:
        raise HTTPException(400, "Kod geçersiz veya süresi dolmuş")
    await db.execute("UPDATE email_dogrulama_kodlari SET dogrulandi = true WHERE id = $1", row["id"])
    return {"ok": True}


@router.post("/kayit")
async def kayit_ol(body: KayitBody, db: asyncpg.Connection = Depends(get_db)):
    if len(body.sifre) < 6:
        raise HTTPException(400, "Sifre en az 6 karakter olmali")

    var_mi = await db.fetchrow("SELECT id FROM kullanicilar WHERE email = $1", body.email)
    if var_mi:
        raise HTTPException(400, "Bu e-posta zaten kayitli")

    if email_yapilandirildi():
        sinir = datetime.utcnow() - timedelta(minutes=_KOD_GECERLILIK_DK)
        dogrulandi = await db.fetchval(
            """SELECT 1 FROM email_dogrulama_kodlari
               WHERE email = $1 AND dogrulandi = true AND created_at >= $2
               ORDER BY id DESC LIMIT 1""",
            body.email, sinir,
        )
        if not dogrulandi:
            raise HTTPException(400, "E-posta doğrulanmadı — önce doğrulama kodunu isteyip girin")

    slug_base = slug_uret(body.dukkan_adi)
    slug = slug_base
    i = 1
    while await db.fetchrow("SELECT id FROM dukkanlar WHERE slug = $1", slug):
        i += 1
        slug = f"{slug_base}-{i}"

    referans_kod = None
    if body.referans_kod:
        gecerli = await db.fetchval(
            "SELECT kod FROM referans_kodlari WHERE kod = $1 AND aktif = true", body.referans_kod.strip()
        )
        referans_kod = gecerli  # geçersizse sessizce yok sayılır, kayıt engellenmez

    async with db.transaction():
        dukkan = await db.fetchrow(
            "INSERT INTO dukkanlar (ad, slug, telefon, abonelik_durumu, referans_kod) VALUES ($1, $2, $3, 'deneme', $4) RETURNING id",
            body.dukkan_adi, slug, body.telefon, referans_kod,
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
