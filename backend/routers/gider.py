import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db
from auth import get_current_user, get_dukkan_id
from odeme_yardimci import kaydet_odeme
from datetime import date, timedelta

router = APIRouter(prefix="/giderler", tags=["gider"])


def _patron_kontrol(user):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron")


@router.get("/")
async def list_giderler(
    periyot: str = Query("ay"),
    baslangic_q: str = Query(None, alias="baslangic"),
    bitis_q: str = Query(None, alias="bitis"),
    q: str = Query(None),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    # Kasa'daki periyot seçiciyle aynı desen — önceden hep "bu ay"a sabitliydi,
    # eski/farklı dönem giderlerine bakma imkanı hiç yoktu.
    bugun = date.today()
    if periyot == "ozel" and baslangic_q and bitis_q:
        baslangic, bitis = baslangic_q, bitis_q
    elif periyot == "bugun":
        baslangic = bitis = bugun.isoformat()
    elif periyot == "hafta":
        baslangic = (bugun - timedelta(days=bugun.weekday())).isoformat()
        bitis = bugun.isoformat()
    else:  # "ay" (varsayılan)
        baslangic = bugun.replace(day=1).isoformat()
        bitis = bugun.isoformat()

    where = ["dukkan_id = $1", "tarih >= $2", "tarih <= $3"]
    params = [dukkan_id, baslangic, bitis]
    if q:
        params.append(f"%{q}%")
        where.append(f"(kategori ILIKE ${len(params)} OR aciklama ILIKE ${len(params)})")
    where_sql = " AND ".join(where)

    rows = await db.fetch(
        f"SELECT * FROM giderler WHERE {where_sql} ORDER BY tarih DESC, id DESC",
        *params,
    )
    rows = [dict(r) for r in rows]
    toplam = sum(r["tutar"] for r in rows)
    return {"toplam": toplam, "giderler": rows, "baslangic": baslangic, "bitis": bitis}


@router.get("/kategoriler")
async def list_kategoriler(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT ad FROM gider_kategorileri WHERE dukkan_id=$1 ORDER BY ad", dukkan_id
    )
    return {"kategoriler": [r["ad"] for r in rows]}


@router.post("/kategoriler")
async def add_kategori(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    ad = (body.get("ad") or "").strip()
    if not ad:
        raise HTTPException(400, "Kategori adı boş olamaz")
    await db.execute(
        "INSERT INTO gider_kategorileri (dukkan_id, ad) VALUES ($1, $2) ON CONFLICT (dukkan_id, ad) DO NOTHING",
        dukkan_id, ad,
    )
    return {"ok": True}


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
