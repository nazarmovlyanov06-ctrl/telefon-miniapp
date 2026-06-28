from fastapi import APIRouter, Depends
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date

router = APIRouter(prefix="/maas", tags=["maas"])


@router.get("/calisanlar")
async def list_calisanlar(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT * FROM calisanlar WHERE aktif = 1 ORDER BY ad ASC")
    return [dict(r) for r in await cur.fetchall()]


@router.post("/calisanlar")
async def add_calisan(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "INSERT INTO calisanlar (ad, telefon, aylik_maas, aktif) VALUES (?, ?, ?, 1)",
        (body["ad"], body.get("telefon"), float(body["aylik_maas"])),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.post("/avans")
async def add_avans(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    tarih = body.get("tarih", date.today().isoformat())
    cur = await db.execute(
        "INSERT INTO avanslar (calisan_id, tutar, tarih, notlar) VALUES (?, ?, ?, ?)",
        (body["calisan_id"], float(body["tutar"]), tarih, body.get("notlar")),
    )
    await db.execute(
        """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
           VALUES (?, 'cikis', 'nakit', ?, ?, 'avans')""",
        (tarih, float(body["tutar"]), "Avans odemesi"),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.get("/avanslar/{calisan_id}")
async def calisan_avanslar(
    calisan_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT * FROM avanslar WHERE calisan_id=? ORDER BY tarih DESC LIMIT 50",
        (calisan_id,),
    )
    return [dict(r) for r in await cur.fetchall()]


@router.get("/ozet/{yil}/{ay}")
async def ozet(
    yil: int,
    ay: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT * FROM calisanlar WHERE aktif = 1 ORDER BY ad ASC")
    calisanlar = [dict(r) for r in await cur.fetchall()]

    ay_basi = date(yil, ay, 1).isoformat()
    son_gun = date(yil + (ay == 12), (ay % 12) + 1, 1).isoformat()

    sonuc = []
    toplam_maas = toplam_avans = 0.0
    for c in calisanlar:
        cur = await db.execute(
            "SELECT COALESCE(SUM(tutar), 0) as a FROM avanslar WHERE calisan_id = ? AND tarih >= ? AND tarih < ?",
            (c["id"], ay_basi, son_gun),
        )
        avans = dict(await cur.fetchone())["a"]
        cur = await db.execute(
            "SELECT odendi FROM maas_odemeleri WHERE calisan_id = ? AND yil = ? AND ay = ?",
            (c["id"], yil, ay),
        )
        mrow = await cur.fetchone()
        odendi = bool(dict(mrow)["odendi"]) if mrow else False
        kalan = c["aylik_maas"] - avans
        toplam_maas += c["aylik_maas"]
        toplam_avans += avans
        sonuc.append({
            "calisan_id": c["id"], "ad": c["ad"],
            "aylik_maas": c["aylik_maas"], "alinan_avans": avans,
            "kalan": kalan, "odendi": odendi,
        })
    return {
        "yil": yil, "ay": ay,
        "toplam_maas": toplam_maas, "toplam_avans": toplam_avans,
        "calisanlar": sonuc,
    }
