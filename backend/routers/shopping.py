import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import get_current_user, get_dukkan_id
from datetime import date

router = APIRouter(prefix="/shopping", tags=["shopping"])


@router.get("/")
async def list_shopping(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    pending = await db.fetch(
        """SELECT al.*, u.ad as ekleyen
           FROM alisveris_listesi al
           LEFT JOIN kullanicilar u ON u.id = al.added_by
           WHERE al.dukkan_id = $1 AND al.status = 'bekliyor'
           ORDER BY al.priority DESC, al.added_at ASC""",
        dukkan_id,
    )
    done = await db.fetch(
        """SELECT al.*, u.ad as alan
           FROM alisveris_listesi al
           LEFT JOIN kullanicilar u ON u.id = al.bought_by
           WHERE al.dukkan_id = $1 AND al.status = 'alindi'
           ORDER BY al.bought_at DESC LIMIT 20""",
        dukkan_id,
    )
    return {"bekliyor": [dict(r) for r in pending], "alindi": [dict(r) for r in done]}


@router.post("/")
async def add_item(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """INSERT INTO alisveris_listesi
           (dukkan_id, part_name, device_model, quantity, supplier_hint, estimated_price,
            priority, added_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id""",
        dukkan_id,
        body["part_name"],
        body.get("device_model"),
        body.get("quantity", 1),
        body.get("supplier_hint"),
        body.get("estimated_price"),
        body.get("priority", 0),
        user["id"],
    )
    return {"id": row["id"]}


@router.put("/{item_id}/bought")
async def mark_bought(
    item_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    item_row = await db.fetchrow(
        "SELECT * FROM alisveris_listesi WHERE id=$1 AND dukkan_id=$2", item_id, dukkan_id
    )
    item = dict(item_row) if item_row else {}

    await db.execute(
        """UPDATE alisveris_listesi SET
           status='alindi', bought_by=$1, bought_from=$2, bought_price=$3,
           bought_at=now()
           WHERE id=$4 AND dukkan_id=$5""",
        user["id"], body.get("bought_from"), body.get("bought_price"), item_id, dukkan_id,
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
                p_row = await db.fetchrow(
                    "SELECT name FROM parts WHERE id=$1 AND dukkan_id=$2", part_id_log, dukkan_id
                )
                await db.execute(
                    "UPDATE parts SET quantity = quantity + $1 WHERE id = $2 AND dukkan_id = $3",
                    miktar, part_id_log, dukkan_id,
                )
                stok_mesaj = f"guncellendi:{p_row['name'] if p_row else part_id_log}"
            else:
                existing = await db.fetchrow(
                    "SELECT id, name FROM parts WHERE dukkan_id=$1 AND LOWER(name) LIKE $2 LIMIT 1",
                    dukkan_id, f"%{parca_adi.lower()}%",
                )
                if existing:
                    part_id_log = existing["id"]
                    await db.execute(
                        "UPDATE parts SET quantity = quantity + $1 WHERE id = $2 AND dukkan_id = $3",
                        miktar, existing["id"], dukkan_id,
                    )
                    stok_mesaj = f"guncellendi:{existing['name']}"
                else:
                    ins = await db.fetchrow(
                        """INSERT INTO parts (dukkan_id, name, device_model, part_type, quantity,
                           min_quantity, purchase_price, sale_price, created_by)
                           VALUES ($1, $2, $3, $4, $5, 2, $6, 0, $7) RETURNING id""",
                        dukkan_id, parca_adi, item.get("device_model"),
                        body.get("part_type") or item.get("part_type"),
                        miktar, float(body.get("bought_price") or 0), user["id"],
                    )
                    part_id_log = ins["id"]
                    stok_mesaj = f"yeni:{parca_adi}"

            if part_id_log:
                await db.execute(
                    """INSERT INTO stok_hareketleri (dukkan_id, part_id, hareket, miktar, sebep, aciklama, tarih, created_by)
                       VALUES ($1, $2, 'giris', $3, 'satin_alma', $4, $5, $6)""",
                    dukkan_id, part_id_log, miktar, body.get("bought_from"),
                    date.today().isoformat(), user["id"],
                )
        except Exception as e:
            stok_mesaj = f"hata:{str(e)}"

    if body.get("bought_from") and item:
        try:
            topt = await db.fetchrow(
                "SELECT id FROM toptancilar WHERE dukkan_id=$1 AND ad = $2", dukkan_id, body["bought_from"]
            )
            if topt:
                miktar2 = int(body.get("stok_miktar") or item.get("quantity") or 1)
                fiyat2 = float(body.get("bought_price") or 0)
                birim = fiyat2 / miktar2 if miktar2 > 0 else fiyat2
                await db.execute(
                    """INSERT INTO toptanci_alislar (dukkan_id, toptanci_id, urun, miktar, birim_fiyat, toplam, tarih)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                    dukkan_id, topt["id"], item.get("part_name", "Parça"),
                    miktar2, birim, fiyat2, date.today().isoformat(),
                )
        except Exception:
            pass

    return {"ok": True, "stok_mesaj": stok_mesaj}


@router.delete("/{item_id}")
async def delete_item(
    item_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    await db.execute("DELETE FROM alisveris_listesi WHERE id = $1 AND dukkan_id = $2", item_id, dukkan_id)
    return {"ok": True}
