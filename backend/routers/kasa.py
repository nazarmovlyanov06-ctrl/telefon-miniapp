from fastapi import APIRouter, Depends, Query
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date, timedelta

router = APIRouter(prefix="/kasa", tags=["kasa"])


async def _gun_ozet(db: Connection, tarih: str) -> dict:
    cur = await db.execute(
        "SELECT * FROM kasa_hareketleri WHERE tarih = ? ORDER BY id DESC", (tarih,)
    )
    rows = [dict(r) for r in await cur.fetchall()]
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
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    return await _gun_ozet(db, date.today().isoformat())


@router.get("/tarih/{tarih}")
async def belirli_gun(
    tarih: str,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    return await _gun_ozet(db, tarih)


@router.post("/gider")
async def manuel_hareket(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (body.get("tarih", date.today().isoformat()),
         body.get("tur", "cikis"),
         body.get("odeme_yontemi", "nakit"),
         float(body["tutar"]),
         body.get("aciklama"),
         body.get("kaynak", "manuel")),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.get("/ozet")
async def kasa_ozet(
    periyot: str = Query("bugun"),
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    today = date.today()

    if periyot == "hafta":
        baslangic = (today - timedelta(days=today.weekday())).isoformat()
    elif periyot == "ay":
        baslangic = today.replace(day=1).isoformat()
    else:
        baslangic = today.isoformat()
    bitis = today.isoformat()
    p = (baslangic, bitis)

    async def scalar(sql, params=()):
        c = await db.execute(sql, params)
        r = await c.fetchone()
        return float(r[0] or 0) if r else 0.0

    gelir = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE tur IN ('giris','gelir') AND tarih>=? AND tarih<=?", p)
    gelir_nakit = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE tur IN ('giris','gelir') AND odeme_yontemi='nakit' AND tarih>=? AND tarih<=?", p)
    gelir_kart = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE tur IN ('giris','gelir') AND odeme_yontemi='kart' AND tarih>=? AND tarih<=?", p)

    gider = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE tur IN ('cikis','gider') AND tarih>=? AND tarih<=?", p)
    gider_nakit = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE tur IN ('cikis','gider') AND odeme_yontemi='nakit' AND tarih>=? AND tarih<=?", p)
    gider_kart = await scalar(
        "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE tur IN ('cikis','gider') AND odeme_yontemi='kart' AND tarih>=? AND tarih<=?", p)

    cur = await db.execute(
        "SELECT COALESCE(kaynak,'diger') as k, COALESCE(SUM(tutar),0) as t FROM kasa_hareketleri WHERE tur IN ('giris','gelir') AND tarih>=? AND tarih<=? GROUP BY k ORDER BY t DESC",
        p)
    raw = {r['k']: float(r['t']) for r in await cur.fetchall()}

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
        "SELECT COALESCE(SUM(total_amount-paid_amount),0) FROM debts WHERE COALESCE(borc_turu,'alacak')='alacak' AND total_amount>paid_amount")
    alacak_sayi = int(await scalar(
        "SELECT COUNT(*) FROM debts WHERE COALESCE(borc_turu,'alacak')='alacak' AND total_amount>paid_amount"))
    dukkan_borcu = await scalar(
        "SELECT COALESCE(SUM(total_amount-paid_amount),0) FROM debts WHERE borc_turu='dukkan_borcu' AND total_amount>paid_amount")
    dukkan_sayi = int(await scalar(
        "SELECT COUNT(*) FROM debts WHERE borc_turu='dukkan_borcu' AND total_amount>paid_amount"))

    cur = await db.execute(
        "SELECT * FROM kasa_hareketleri WHERE tarih>=? AND tarih<=? ORDER BY id DESC LIMIT 30", p)
    hareketler = [dict(r) for r in await cur.fetchall()]

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
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    from fastapi import HTTPException
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if user["role"] != "patron":
        raise HTTPException(403, "Sadece patron")
    await db.execute(
        """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (body.get("tarih", date.today().isoformat()),
         body.get("tur", "cikis"),
         body.get("odeme_yontemi", "nakit"),
         float(body["tutar"]),
         body.get("aciklama", "Manuel düzeltme"),
         "duzeltme"),
    )
    await db.commit()
    return {"ok": True}
