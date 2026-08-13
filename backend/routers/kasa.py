import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db
from auth import get_current_user, get_dukkan_id
from datetime import date, timedelta

router = APIRouter(prefix="/kasa", tags=["kasa"])


async def _gun_ozet(db: asyncpg.Connection, dukkan_id: int, tarih: str) -> dict:
    rows = await db.fetch(
        "SELECT * FROM kasa_hareketleri WHERE dukkan_id = $1 AND tarih = $2 ORDER BY id DESC",
        dukkan_id, tarih,
    )
    rows = [dict(r) for r in rows]
    giris = cikis = nakit = kart = 0.0
    for r in rows:
        if r["tur"] == "giris":
            giris += r["tutar"]
        else:
            cikis += r["tutar"]
        if r["odeme_yontemi"] == "kart":
            kart += r["tutar"] if r["tur"] == "giris" else -r["tutar"]
        else:
            nakit += r["tutar"] if r["tur"] == "giris" else -r["tutar"]
    return {
        "tarih": tarih,
        "toplam_giris": giris,
        "toplam_cikis": cikis,
        "net": giris - cikis,
        "nakit": nakit,
        "kart": kart,
        "hareketler": rows,
    }


@router.get("/bugun")
async def bugun(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    return await _gun_ozet(db, dukkan_id, date.today().isoformat())


@router.get("/tarih/{tarih}")
async def belirli_gun(
    tarih: str,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    return await _gun_ozet(db, dukkan_id, tarih)


@router.post("/gider")
async def manuel_hareket(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id""",
        dukkan_id,
        body.get("tarih", date.today().isoformat()),
        body.get("tur", "cikis"),
        body.get("odeme_yontemi", "nakit"),
        float(body["tutar"]),
        body.get("aciklama"),
        body.get("kaynak", "manuel"),
    )
    return {"id": row["id"]}


@router.get("/ozet")
async def kasa_ozet(
    periyot: str = Query("bugun"),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    today = date.today()

    if periyot == "hafta":
        baslangic = (today - timedelta(days=today.weekday())).isoformat()
    elif periyot == "ay":
        baslangic = today.replace(day=1).isoformat()
    else:
        baslangic = today.isoformat()
    bitis = today.isoformat()

    async def scalar(sql, *params):
        return float(await db.fetchval(sql, *params) or 0)

    gelir = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tur IN ('giris','gelir') AND tarih>=$2 AND tarih<=$3",
        dukkan_id, baslangic, bitis)
    gelir_nakit = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tur IN ('giris','gelir') AND odeme_yontemi='nakit' AND tarih>=$2 AND tarih<=$3",
        dukkan_id, baslangic, bitis)
    gelir_kart = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tur IN ('giris','gelir') AND odeme_yontemi='kart' AND tarih>=$2 AND tarih<=$3",
        dukkan_id, baslangic, bitis)

    gider = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tur IN ('cikis','gider') AND tarih>=$2 AND tarih<=$3",
        dukkan_id, baslangic, bitis)
    gider_nakit = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tur IN ('cikis','gider') AND odeme_yontemi='nakit' AND tarih>=$2 AND tarih<=$3",
        dukkan_id, baslangic, bitis)
    gider_kart = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tur IN ('cikis','gider') AND odeme_yontemi='kart' AND tarih>=$2 AND tarih<=$3",
        dukkan_id, baslangic, bitis)

    rows = await db.fetch(
        """SELECT COALESCE(kaynak,'diger') as k, COALESCE(SUM(tutar),0) as t
           FROM kasa_hareketleri WHERE dukkan_id=$1 AND tur IN ('giris','gelir') AND tarih>=$2 AND tarih<=$3
           GROUP BY k ORDER BY t DESC""",
        dukkan_id, baslangic, bitis)
    raw = {r['k']: float(r['t']) for r in rows}

    KAYNAK_LABEL = {
        'tamir': 'Tamir gelirleri',
        '2el_satis': '2. El satış',
        'sifir_satis': 'Sıfır cihaz',
        'aksesuar': 'Aksesuar satış',
        'parca_iade': 'Parça iade',
    }
    gelir_kaynaklar = []
    for k, label in KAYNAK_LABEL.items():
        t = raw.pop(k, 0)
        if t > 0:
            gelir_kaynaklar.append({"kaynak": k, "label": label, "tutar": t})
    diger = sum(raw.values())
    if diger > 0:
        gelir_kaynaklar.append({"kaynak": "diger", "label": "Diğer", "tutar": diger})

    alacak_toplam = await scalar(
        "SELECT COALESCE(SUM(total_amount-paid_amount),0) FROM debts WHERE dukkan_id=$1 AND COALESCE(borc_turu,'alacak')='alacak' AND total_amount>paid_amount",
        dukkan_id)
    alacak_sayi = int(await scalar(
        "SELECT COUNT(*) FROM debts WHERE dukkan_id=$1 AND COALESCE(borc_turu,'alacak')='alacak' AND total_amount>paid_amount",
        dukkan_id))
    dukkan_borcu = await scalar(
        "SELECT COALESCE(SUM(total_amount-paid_amount),0) FROM debts WHERE dukkan_id=$1 AND borc_turu='dukkan_borcu' AND total_amount>paid_amount",
        dukkan_id)
    dukkan_sayi = int(await scalar(
        "SELECT COUNT(*) FROM debts WHERE dukkan_id=$1 AND borc_turu='dukkan_borcu' AND total_amount>paid_amount",
        dukkan_id))

    rows = await db.fetch(
        "SELECT * FROM kasa_hareketleri WHERE dukkan_id=$1 AND tarih>=$2 AND tarih<=$3 ORDER BY id DESC LIMIT 30",
        dukkan_id, baslangic, bitis)
    hareketler = [dict(r) for r in rows]

    return {
        "periyot": periyot,
        "baslangic": baslangic,
        "bitis": bitis,
        "gelir": gelir,
        "gelir_nakit": gelir_nakit,
        "gelir_kart": gelir_kart,
        "gider": gider,
        "gider_nakit": gider_nakit,
        "gider_kart": gider_kart,
        "net": gelir - gider,
        "gelir_kaynaklar": gelir_kaynaklar,
        "alacak_toplam": alacak_toplam,
        "alacak_sayi": alacak_sayi,
        "dukkan_borcu": dukkan_borcu,
        "dukkan_sayi": dukkan_sayi,
        "mali_durum": (gelir - gider) + alacak_toplam - dukkan_borcu,
        "hareketler": hareketler,
    }


@router.post("/duzelt")
async def manuel_duzelt(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron")
    await db.execute(
        """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
           VALUES ($1, $2, $3, $4, $5, $6, $7)""",
        dukkan_id,
        body.get("tarih", date.today().isoformat()),
        body.get("tur", "cikis"),
        body.get("odeme_yontemi", "nakit"),
        float(body["tutar"]),
        body.get("aciklama", "Manuel düzeltme"),
        "duzeltme",
    )
    return {"ok": True}
