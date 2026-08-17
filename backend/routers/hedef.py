import asyncpg
from fastapi import APIRouter, Depends
from database import get_db
from auth import get_current_user, get_dukkan_id
from datetime import date

router = APIRouter(prefix="/hedef", tags=["hedef"])


@router.get("/bu-ay")
async def bu_ay(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    bugun = date.today()
    yil, ay = bugun.year, bugun.month
    ay_basi = bugun.replace(day=1).isoformat()

    row = await db.fetchrow(
        "SELECT hedef_tutar FROM aylik_hedefler WHERE dukkan_id = $1 AND yil = $2 AND ay = $3",
        dukkan_id, yil, ay,
    )
    hedef = row["hedef_tutar"] if row else 0.0

    # kasa_hareketleri.tur için kod tabanında iki değer birden kullanılıyor:
    # tamir/2.el/sıfır satışları 'gelir', aksesuar/parça alımı 'giris' yazıyor.
    # Sadece 'giris' sayılırsa gelirin büyük kısmı (tamir + cihaz satışı)
    # hedefe hiç yansımıyordu. kasa.py de ikisini birden sayıyor.
    gerceklesen = await db.fetchval(
        """SELECT COALESCE(SUM(tutar), 0) FROM kasa_hareketleri
           WHERE dukkan_id = $1 AND tur IN ('giris', 'gelir') AND tarih >= $2""",
        dukkan_id, ay_basi,
    )

    yuzde = (gerceklesen / hedef * 100) if hedef > 0 else 0
    return {
        "yil": yil, "ay": ay,
        "hedef_tutar": hedef,
        "gerceklesen": gerceklesen,
        "yuzde": round(yuzde, 1),
        "kalan": max(hedef - gerceklesen, 0),
    }


@router.post("/")
async def set_hedef(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    bugun = date.today()
    yil = int(body.get("yil", bugun.year))
    ay = int(body.get("ay", bugun.month))
    await db.execute(
        """INSERT INTO aylik_hedefler (dukkan_id, yil, ay, hedef_tutar) VALUES ($1, $2, $3, $4)
           ON CONFLICT (dukkan_id, yil, ay) DO UPDATE SET hedef_tutar = EXCLUDED.hedef_tutar""",
        dukkan_id, yil, ay, float(body["hedef_tutar"]),
    )
    return {"ok": True}
