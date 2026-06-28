from fastapi import APIRouter, Depends, HTTPException
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from datetime import date

router = APIRouter(prefix="/parca-iade", tags=["parca-iade"])


@router.get("/")
async def list_iade(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT p.*, t.ad as toptanci_adi
           FROM parca_iadeler p
           LEFT JOIN toptancilar t ON p.toptanci_id = t.id
           ORDER BY p.created_at DESC"""
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/")
async def add_iade(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    miktar = int(body.get("miktar", 1))
    part_id = body.get("part_id")

    # Stoktan düş
    if part_id:
        cur_p = await db.execute("SELECT quantity, name FROM parts WHERE id = ?", (part_id,))
        part = await cur_p.fetchone()
        if not part:
            raise HTTPException(404, "Parça bulunamadı")
        part = dict(part)
        if part["quantity"] < miktar:
            raise HTTPException(400, f"Stok yetersiz ({part['quantity']} adet mevcut)")
        await db.execute("UPDATE parts SET quantity = quantity - ? WHERE id = ?", (miktar, part_id))
        await db.execute(
            """INSERT INTO stok_hareketleri (part_id, hareket, miktar, sebep, aciklama, tarih)
               VALUES (?, 'cikis', ?, 'iade', ?, ?)""",
            (part_id, miktar, body.get("sebep") or "Toptancıya iade", date.today().isoformat())
        )

    beklenen_tutar = float(body.get("beklenen_tutar") or 0)

    cur = await db.execute(
        """INSERT INTO parca_iadeler (toptanci_id, part_id, parca, miktar, sebep, durum, beklenen_tutar)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (body.get("toptanci_id"), part_id, body["parca"], miktar,
         body.get("sebep"), body.get("durum", "bekliyor"), beklenen_tutar),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.put("/{iade_id}/durum")
async def update_durum(
    iade_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    yeni_durum = body["durum"]

    cur = await db.execute("SELECT * FROM parca_iadeler WHERE id = ?", (iade_id,))
    iade = await cur.fetchone()
    if not iade:
        raise HTTPException(404, "İade bulunamadı")
    iade = dict(iade)

    await db.execute(
        "UPDATE parca_iadeler SET durum = ? WHERE id = ?",
        (yeni_durum, iade_id),
    )

    # Para alındı → kasaya giris ekle
    if yeni_durum == "para_iade_alindi":
        tutar = float(body.get("alinan_tutar") or iade.get("beklenen_tutar") or 0)
        if tutar > 0:
            parca_adi = iade.get("parca", "Parça")
            await db.execute(
                """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
                   VALUES (?, 'giris', 'nakit', ?, ?, 'parca_iade')""",
                (date.today().isoformat(), tutar, f"Parça iade parası: {parca_adi}")
            )

    await db.commit()
    return {"ok": True}
