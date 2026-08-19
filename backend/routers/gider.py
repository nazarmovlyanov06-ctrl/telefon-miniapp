import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import get_current_user, get_dukkan_id
from odeme_yardimci import kaydet_odeme
from datetime import date

router = APIRouter(prefix="/giderler", tags=["gider"])


def _patron_kontrol(user):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron")


@router.get("/")
async def list_giderler(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    bugun = date.today()
    ay_basi = bugun.replace(day=1).isoformat()
    rows = await db.fetch(
        "SELECT * FROM giderler WHERE dukkan_id = $1 AND tarih >= $2 ORDER BY tarih DESC, id DESC",
        dukkan_id, ay_basi,
    )
    rows = [dict(r) for r in rows]
    toplam = sum(r["tutar"] for r in rows)
    return {"toplam": toplam, "giderler": rows}


@router.post("/")
async def create_gider(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    tarih = body.get("tarih", date.today().isoformat())
    tutar = float(body["tutar"])
    aciklama = f"{body['kategori']}: {body.get('aciklama', '')}".strip(": ")
    odemeler = [o for o in (body.get("odemeler") or []) if float(o.get("tutar") or 0) > 0]
    alinan = sum(float(o.get("tutar") or 0) for o in odemeler)
    if tutar - alinan > 0.009 and not (body.get("alacakli_adi") or "").strip():
        raise HTTPException(400, "Kalan tutar borç yazılacaksa kime borçlanıldığı girilmeli")
    async with db.transaction():
        row = await db.fetchrow(
            "INSERT INTO giderler (dukkan_id, kategori, tutar, aciklama, tarih) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            dukkan_id, body["kategori"], tutar, body.get("aciklama"), tarih,
        )
        await kaydet_odeme(
            db, dukkan_id, odemeler, tutar, "gider", "gider", aciklama, user["id"],
            alacakli_adi=body.get("alacakli_adi"), taksit_sayi=body.get("taksit_sayi") or 1,
            tarih=tarih, gider_id=row["id"],
        )
    return {"id": row["id"]}


@router.delete("/{gider_id}")
async def delete_gider(
    gider_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    _patron_kontrol(user)
    borc = await db.fetchrow(
        "SELECT id, paid_amount FROM debts WHERE gider_id=$1 AND dukkan_id=$2", gider_id, dukkan_id
    )
    if borc and borc["paid_amount"] > 0:
        raise HTTPException(400, "Bu gidere bağlı borcun bir kısmı zaten ödenmiş — önce Borçlar sayfasından borcu düzenleyin")
    # kasa_hareketleri/debts'e gider_id ile bağlı satırlar da temizlenmeden
    # gider silinirse kasadaki karşılık gelen kayıt kalıcı olarak orada kalır
    # (önceden hiç temizlenmiyordu, Toplam Gider sürekli şişerdi).
    async with db.transaction():
        await db.execute("DELETE FROM kasa_hareketleri WHERE gider_id = $1 AND dukkan_id = $2", gider_id, dukkan_id)
        await db.execute("DELETE FROM debts WHERE gider_id = $1 AND dukkan_id = $2", gider_id, dukkan_id)
        await db.execute("DELETE FROM giderler WHERE id = $1 AND dukkan_id = $2", gider_id, dukkan_id)
    return {"ok": True}
