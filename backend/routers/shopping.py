from fastapi import APIRouter, Depends
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
import datetime
from datetime import date

router = APIRouter(prefix="/shopping", tags=["shopping"])


@router.get("/")
async def list_shopping(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT al.*, u.name as ekleyen
           FROM alisveris_listesi al
           LEFT JOIN users u ON u.id = al.added_by
           WHERE al.status = 'bekliyor'
           ORDER BY al.priority DESC, al.added_at ASC"""
    )
    pending = [dict(r) for r in await cur.fetchall()]

    cur = await db.execute(
        """SELECT al.*, u.name as alan
           FROM alisveris_listesi al
           LEFT JOIN users u ON u.id = al.bought_by
           WHERE al.status = 'alindi'
           ORDER BY al.bought_at DESC LIMIT 20"""
    )
    done = [dict(r) for r in await cur.fetchall()]
    return {"bekliyor": pending, "alindi": done}


@router.post("/")
async def add_item(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """INSERT INTO alisveris_listesi
           (part_name, device_model, quantity, supplier_hint, estimated_price,
            priority, added_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            body["part_name"],
            body.get("device_model"),
            body.get("quantity", 1),
            body.get("supplier_hint"),
            body.get("estimated_price"),
            body.get("priority", 0),
            user["id"],
        ),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.put("/{item_id}/bought")
async def mark_bought(
    item_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT * FROM alisveris_listesi WHERE id=?", (item_id,))
    item = await cur.fetchone()
    item = dict(item) if item else {}

    await db.execute(
        """UPDATE alisveris_listesi SET
           status='alindi', bought_by=?, bought_from=?, bought_price=?,
           bought_at=CURRENT_TIMESTAMP
           WHERE id=?""",
        (user["id"], body.get("bought_from"), body.get("bought_price"), item_id),
    )

    stok_mesaj = None
    part_id_log = None
    if body.get("stok_ekle") and item:
        miktar = int(body.get("stok_miktar") or item.get("quantity") or 1)
        parca_adi = item.get("part_name", "")
        try:
            explicit_id = body.get("existing_part_id")
            if explicit_id:
                part_id_log = int(explicit_id)
                cur_p = await db.execute("SELECT name FROM parts WHERE id=?", (part_id_log,))
                p_row = await cur_p.fetchone()
                await db.execute("UPDATE parts SET quantity = quantity + ? WHERE id = ?",
                                 (miktar, part_id_log))
                stok_mesaj = f"guncellendi:{p_row['name'] if p_row else part_id_log}"
            else:
                src = await db.execute(
                    "SELECT id, name FROM parts WHERE LOWER(name) LIKE ? LIMIT 1",
                    (f"%{parca_adi.lower()}%",)
                )
                existing = await src.fetchone()
                if existing:
                    part_id_log = existing["id"]
                    await db.execute("UPDATE parts SET quantity = quantity + ? WHERE id = ?",
                                     (miktar, existing["id"]))
                    stok_mesaj = f"guncellendi:{existing['name']}"
                else:
                    ins = await db.execute(
                        """INSERT INTO parts (name, device_model, part_type, quantity, min_quantity,
                           purchase_price, sale_price, created_by) VALUES (?, ?, ?, ?, 2, ?, 0, ?)""",
                        (parca_adi, item.get("device_model"),
                         body.get("part_type") or item.get("part_type"),
                         miktar, float(body.get("bought_price") or 0), user["id"])
                    )
                    part_id_log = ins.lastrowid
                    stok_mesaj = f"yeni:{parca_adi}"

            if part_id_log:
                await db.execute(
                    """INSERT INTO stok_hareketleri (part_id, hareket, miktar, sebep, aciklama, tarih, created_by)
                       VALUES (?, 'giris', ?, 'satin_alma', ?, ?, ?)""",
                    (part_id_log, miktar, body.get("bought_from"), date.today().isoformat(), user["id"])
                )
        except Exception as e:
            stok_mesaj = f"hata:{str(e)}"

    # Toptancı alış geçmişine ekle
    if body.get("bought_from") and item:
        try:
            src = await db.execute("SELECT id FROM toptancilar WHERE ad = ?", (body["bought_from"],))
            topt = await src.fetchone()
            if topt:
                miktar2 = int(body.get("stok_miktar") or item.get("quantity") or 1)
                fiyat2 = float(body.get("bought_price") or 0)
                birim = fiyat2 / miktar2 if miktar2 > 0 else fiyat2
                await db.execute(
                    """INSERT INTO toptanci_alislar (toptanci_id, urun, miktar, birim_fiyat, toplam, tarih)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (topt["id"], item.get("part_name", "Parça"),
                     miktar2, birim, fiyat2, date.today().isoformat())
                )
        except Exception:
            pass

    await db.commit()
    return {"ok": True, "stok_mesaj": stok_mesaj}


@router.delete("/{item_id}")
async def delete_item(
    item_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if user["role"] != "patron":
        from fastapi import HTTPException
        raise HTTPException(403, "Sadece patron silebilir")
    await db.execute("DELETE FROM alisveris_listesi WHERE id = ?", (item_id,))
    await db.commit()
    return {"ok": True}
