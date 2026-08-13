import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from auth import get_current_user, require_patron, get_dukkan_id, hash_sifre

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/")
async def list_users(
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT id, email, ad, rol, durum, aktif, created_at FROM kullanicilar
           WHERE dukkan_id = $1 ORDER BY durum DESC, rol, ad""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/davet")
async def calisan_ekle(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    """Patron yeni calisan hesabi acar (e-posta + gecici sifre)."""
    email = body.get("email", "").strip().lower()
    ad = body.get("ad", "").strip()
    sifre = body.get("sifre", "")
    rol = body.get("rol", "cirak")
    if not email or not ad or len(sifre) < 6:
        raise HTTPException(400, "E-posta, ad ve en az 6 karakter sifre gerekli")
    if rol not in ("patron", "satis", "teknisyen", "cirak"):
        raise HTTPException(400, "Gecersiz rol")

    var_mi = await db.fetchrow("SELECT id FROM kullanicilar WHERE email = $1", email)
    if var_mi:
        raise HTTPException(400, "Bu e-posta zaten kayitli")

    await db.execute(
        """INSERT INTO kullanicilar (dukkan_id, email, sifre_hash, ad, rol, durum)
           VALUES ($1, $2, $3, $4, $5, 'aktif')""",
        dukkan_id, email, hash_sifre(sifre), ad, rol,
    )
    return {"ok": True}


@router.delete("/{user_id}")
async def calisan_sil(
    user_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "DELETE FROM kullanicilar WHERE id = $1 AND dukkan_id = $2 AND rol != 'patron'",
        user_id, dukkan_id,
    )
    return {"ok": True}


@router.put("/{user_id}/role")
async def change_role(
    user_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    new_role = body.get("role")
    if new_role not in ("patron", "satis", "teknisyen", "cirak"):
        raise HTTPException(400, "Gecersiz rol")
    await db.execute(
        "UPDATE kullanicilar SET rol = $1 WHERE id = $2 AND dukkan_id = $3",
        new_role, user_id, dukkan_id,
    )
    return {"ok": True}


@router.put("/{user_id}/aktiflik")
async def aktiflik_degistir(
    user_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    _patron: dict = Depends(require_patron),
    db: asyncpg.Connection = Depends(get_db),
):
    aktif = bool(body.get("aktif", True))
    await db.execute(
        "UPDATE kullanicilar SET aktif = $1 WHERE id = $2 AND dukkan_id = $3",
        aktif, user_id, dukkan_id,
    )
    return {"ok": True}
