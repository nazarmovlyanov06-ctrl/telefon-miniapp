from fastapi import APIRouter, Depends, HTTPException
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date

router = APIRouter(prefix="/ikinciel", tags=["ikinciel"])


@router.get("/listesi")
async def list_stok(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT c.*,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m
                            WHERE m.cihaz_id = c.id), 0) as toplam_masraf
           FROM ikinci_el c
           WHERE c.durum = 'stokta'
           ORDER BY c.created_at DESC"""
    )
    return [dict(r) for r in await cur.fetchall()]


@router.get("/satilanlar")
async def list_satilanlar(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT c.*,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m
                            WHERE m.cihaz_id = c.id), 0) as toplam_masraf
           FROM ikinci_el c
           WHERE c.durum = 'satildi'
           ORDER BY c.satis_tarihi DESC"""
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/")
async def create_cihaz(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """INSERT INTO ikinci_el (model, imei, kimden, alis_fiyati, notlar, durum)
           VALUES (?, ?, ?, ?, ?, 'stokta')""",
        (body["model"], body.get("imei"), body.get("kimden"),
         float(body["alis_fiyati"]), body.get("notlar")),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.post("/{cihaz_id}/masraf")
async def add_masraf(
    cihaz_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "INSERT INTO ikinci_el_masraflar (cihaz_id, aciklama, tutar, tarih) VALUES (?, ?, ?, ?)",
        (cihaz_id, body["aciklama"], float(body["tutar"]),
         body.get("tarih", date.today().isoformat())),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.post("/{cihaz_id}/sat")
async def sat_cihaz(
    cihaz_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT * FROM ikinci_el WHERE id = ?", (cihaz_id,))
    if not await cur.fetchone():
        raise HTTPException(404, "Cihaz bulunamadi")
    await db.execute(
        """UPDATE ikinci_el SET durum='satildi', satis_fiyati=?, satis_kanali=?,
           satis_tarihi=?, musteri_adi=? WHERE id=?""",
        (float(body["satis_fiyati"]), body.get("satis_kanali", "magaza"),
         body.get("satis_tarihi", date.today().isoformat()),
         body.get("musteri_adi"), cihaz_id),
    )
    await db.commit()
    return {"ok": True}


@router.get("/ozet")
async def ozet(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT c.id, c.model, c.alis_fiyati, c.satis_fiyati, c.durum,
                  COALESCE((SELECT SUM(m.tutar) FROM ikinci_el_masraflar m
                            WHERE m.cihaz_id = c.id), 0) as toplam_masraf
           FROM ikinci_el c"""
    )
    rows = [dict(r) for r in await cur.fetchall()]
    toplam_alis = toplam_masraf = toplam_satis = kar = 0.0
    stokta = satildi = 0
    for r in rows:
        toplam_alis += r["alis_fiyati"] or 0
        toplam_masraf += r["toplam_masraf"] or 0
        if r["durum"] == "satildi":
            satildi += 1
            satis = r["satis_fiyati"] or 0
            toplam_satis += satis
            kar += satis - (r["alis_fiyati"] or 0) - (r["toplam_masraf"] or 0)
        else:
            stokta += 1
    return {
        "stokta_adet": stokta,
        "satilan_adet": satildi,
        "toplam_alis": toplam_alis,
        "toplam_masraf": toplam_masraf,
        "toplam_satis": toplam_satis,
        "net_kar": kar,
    }
