import asyncpg
from fastapi import APIRouter, Depends
from database import get_db
from auth import get_current_user, get_dukkan_id
from datetime import date

router = APIRouter(prefix="/maas", tags=["maas"])


@router.get("/calisanlar")
async def list_calisanlar(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM calisanlar WHERE dukkan_id = $1 AND aktif = true ORDER BY ad ASC",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/calisanlar")
async def add_calisan(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "INSERT INTO calisanlar (dukkan_id, ad, telefon, aylik_maas, aktif) VALUES ($1, $2, $3, $4, true) RETURNING id",
        dukkan_id, body["ad"], body.get("telefon"), float(body["aylik_maas"]),
    )
    return {"id": row["id"]}


@router.post("/avans")
async def add_avans(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    tarih = body.get("tarih", date.today().isoformat())
    async with db.transaction():
        row = await db.fetchrow(
            "INSERT INTO avanslar (dukkan_id, calisan_id, tutar, tarih, notlar) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            dukkan_id, body["calisan_id"], float(body["tutar"]), tarih, body.get("notlar"),
        )
        await db.execute(
            """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
               VALUES ($1, $2, 'cikis', 'nakit', $3, $4, 'avans')""",
            dukkan_id, tarih, float(body["tutar"]), "Avans odemesi",
        )
    return {"id": row["id"]}


@router.get("/avanslar/{calisan_id}")
async def calisan_avanslar(
    calisan_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM avanslar WHERE calisan_id=$1 AND dukkan_id=$2 ORDER BY tarih DESC LIMIT 50",
        calisan_id, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/ode/{calisan_id}")
async def maas_ode(
    calisan_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    yil = int(body.get("yil", date.today().year))
    ay = int(body.get("ay", date.today().month))
    tarih = body.get("tarih", date.today().isoformat())
    tutar = float(body.get("tutar", 0))

    calisan_row = await db.fetchrow(
        "SELECT * FROM calisanlar WHERE id = $1 AND dukkan_id = $2", calisan_id, dukkan_id
    )
    calisan = dict(calisan_row)

    async with db.transaction():
        row = await db.fetchrow(
            "SELECT id FROM maas_odemeleri WHERE calisan_id=$1 AND yil=$2 AND ay=$3 AND dukkan_id=$4",
            calisan_id, yil, ay, dukkan_id,
        )
        if row:
            await db.execute(
                "UPDATE maas_odemeleri SET odendi=true, odeme_tarihi=$1, maas=$2 WHERE id=$3 AND dukkan_id=$4",
                tarih, tutar, row["id"], dukkan_id,
            )
        else:
            await db.execute(
                """INSERT INTO maas_odemeleri (dukkan_id, calisan_id, yil, ay, maas, odendi, odeme_tarihi)
                   VALUES ($1, $2, $3, $4, $5, true, $6)""",
                dukkan_id, calisan_id, yil, ay, tutar, tarih,
            )
        await db.execute(
            """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
               VALUES ($1, $2, 'cikis', 'nakit', $3, $4, 'maas')""",
            dukkan_id, tarih, tutar, f"Maaş: {calisan['ad']}",
        )
    return {"ok": True}


@router.get("/ozet/{yil}/{ay}")
async def ozet(
    yil: int,
    ay: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM calisanlar WHERE dukkan_id = $1 AND aktif = true ORDER BY ad ASC",
        dukkan_id,
    )
    calisanlar = [dict(r) for r in rows]

    ay_basi = date(yil, ay, 1).isoformat()
    son_gun = date(yil + (ay == 12), (ay % 12) + 1, 1).isoformat()

    sonuc = []
    toplam_maas = toplam_avans = 0.0
    for c in calisanlar:
        arow = await db.fetchrow(
            "SELECT COALESCE(SUM(tutar), 0) as a FROM avanslar WHERE calisan_id = $1 AND dukkan_id = $2 AND tarih >= $3 AND tarih < $4",
            c["id"], dukkan_id, ay_basi, son_gun,
        )
        avans = dict(arow)["a"]
        mrow = await db.fetchrow(
            "SELECT odendi, odeme_tarihi FROM maas_odemeleri WHERE calisan_id = $1 AND yil = $2 AND ay = $3 AND dukkan_id = $4",
            c["id"], yil, ay, dukkan_id,
        )
        odendi = bool(dict(mrow)["odendi"]) if mrow else False
        odeme_tarihi = dict(mrow)["odeme_tarihi"] if mrow else None
        kalan = c["aylik_maas"] - avans
        toplam_maas += c["aylik_maas"]
        toplam_avans += avans
        sonuc.append({
            "calisan_id": c["id"], "ad": c["ad"],
            "aylik_maas": c["aylik_maas"], "alinan_avans": avans,
            "kalan": kalan, "odendi": odendi, "odeme_tarihi": odeme_tarihi,
        })
    return {
        "yil": yil, "ay": ay,
        "toplam_maas": toplam_maas, "toplam_avans": toplam_avans,
        "calisanlar": sonuc,
    }
