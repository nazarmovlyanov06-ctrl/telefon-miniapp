from fastapi import APIRouter, Depends, HTTPException, Query
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
import datetime

router = APIRouter(prefix="/repairs", tags=["repairs"])


def make_repair_no(last_id: int) -> str:
    today = datetime.date.today().strftime("%y%m%d")
    return f"T{today}{last_id + 1:04d}"


@router.get("/")
async def list_repairs(
    status: str = Query(None),
    q: str = Query(None),
    limit: int = Query(50),
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    where = []
    params = []
    if status:
        where.append("r.status = ?")
        params.append(status)
    if q:
        where.append("(c.name LIKE ? OR r.device_model LIKE ? OR r.repair_no LIKE ? OR r.imei LIKE ?)")
        params += [f"%{q}%"] * 4

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    cur = await db.execute(
        f"""SELECT r.*, c.name as customer_name, c.phone as customer_phone,
                   u.name as assigned_name
            FROM repairs r
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN users u ON r.assigned_to = u.id
            {where_sql}
            ORDER BY r.created_at DESC
            LIMIT ?""",
        params + [limit],
    )
    return [dict(r) for r in await cur.fetchall()]


@router.get("/{repair_id}")
async def get_repair(
    repair_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT r.*, c.name as customer_name, c.phone as customer_phone
           FROM repairs r
           LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.id = ?""",
        (repair_id,),
    )
    row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Tamir bulunamadi")
    return dict(row)


@router.post("/")
async def create_repair(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))

    cur = await db.execute("SELECT COALESCE(MAX(id), 0) as m FROM repairs")
    row = await cur.fetchone()
    repair_no = make_repair_no(row["m"])

    customer_id = body.get("customer_id")
    if not customer_id and body.get("customer_name"):
        cur = await db.execute(
            "INSERT INTO customers (name, phone) VALUES (?, ?)",
            (body["customer_name"], body.get("customer_phone")),
        )
        customer_id = cur.lastrowid
        await db.commit()

    cur = await db.execute(
        """INSERT INTO repairs
           (repair_no, customer_id, device_model, imei, fault_desc,
            estimated_price, status, assigned_to, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 'bekliyor', ?, ?, ?)""",
        (
            repair_no,
            customer_id,
            body["device_model"],
            body.get("imei"),
            body["fault_desc"],
            body.get("estimated_price"),
            body.get("assigned_to"),
            body.get("notes"),
            user["id"],
        ),
    )
    await db.commit()
    return {"id": cur.lastrowid, "repair_no": repair_no}


@router.put("/{repair_id}")
async def update_repair(
    repair_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))

    now = datetime.datetime.now().isoformat()
    tamirde_at = now if body.get("status") == "tamirde" else None
    completed_at = now if body.get("status") == "hazir" else None
    delivered_at = now if body.get("status") == "teslim" else None

    cur2 = await db.execute("SELECT repair_no, device_model FROM repairs WHERE id=?", (repair_id,))
    rrow = await cur2.fetchone()
    repair_no = dict(rrow)["repair_no"] if rrow else ""

    await db.execute(
        """UPDATE repairs SET
           device_model=?, fault_desc=?, status=?, estimated_price=?,
           final_price=?, payment_type=?, paid_amount=?,
           warranty_days=?, assigned_to=?, notes=?,
           tamirde_at=COALESCE(tamirde_at, ?),
           completed_at=COALESCE(completed_at, ?),
           delivered_at=COALESCE(?, delivered_at)
           WHERE id=?""",
        (
            body.get("device_model"),
            body.get("fault_desc"),
            body.get("status"),
            body.get("estimated_price"),
            body.get("final_price"),
            body.get("payment_type"),
            body.get("paid_amount", 0),
            body.get("warranty_days", 0),
            body.get("assigned_to"),
            body.get("notes"),
            tamirde_at,
            completed_at,
            delivered_at,
            repair_id,
        ),
    )

    if body.get("status") == "teslim" and body.get("kasa_yazilsin"):
        final = float(body.get("final_price") or 0)
        if final > 0:
            cihaz = body.get("device_model", "")
            await db.execute(
                """INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
                   VALUES (?, 'gelir', ?, ?, ?, 'tamir')""",
                (datetime.date.today().isoformat(),
                 body.get("payment_type", "nakit"),
                 final,
                 f"Tamir #{repair_no} {cihaz}".strip()),
            )

    await db.commit()
    return {"ok": True}


@router.get("/modeller")
async def get_modeller(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT device_model, COUNT(*) as c FROM repairs
           WHERE device_model IS NOT NULL AND device_model != ''
           GROUP BY LOWER(TRIM(device_model)) ORDER BY c DESC LIMIT 30"""
    )
    return [r["device_model"] for r in await cur.fetchall()]


@router.get("/ariza-onceriler")
async def get_ariza_onceriler(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT fault_desc, COUNT(*) as c FROM repairs
           WHERE fault_desc IS NOT NULL AND fault_desc != ''
           GROUP BY LOWER(TRIM(fault_desc)) ORDER BY c DESC LIMIT 20"""
    )
    return [r["fault_desc"] for r in await cur.fetchall()]


@router.delete("/{repair_id}")
async def delete_repair(
    repair_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if user["role"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    await db.execute("DELETE FROM repairs WHERE id = ?", (repair_id,))
    await db.commit()
    return {"ok": True}


# ── KULLANILAN PARÇALAR ─────────────────────────────────────────────────

@router.get("/{repair_id}/parcalar")
async def get_repair_parcalar(
    repair_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT rp.id, rp.part_id, rp.quantity, rp.unit_price,
                  p.name, p.category
           FROM repair_parts rp
           JOIN parts p ON rp.part_id = p.id
           WHERE rp.repair_id = ?
           ORDER BY rp.id""",
        (repair_id,),
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/{repair_id}/parcalar")
async def add_repair_parca(
    repair_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    part_id = body.get("part_id")
    adet = int(body.get("quantity", 1))
    if not part_id or adet < 1:
        raise HTTPException(400, "Geçersiz parça veya adet")

    cur = await db.execute("SELECT quantity, sale_price, name FROM parts WHERE id=?", (part_id,))
    part = await cur.fetchone()
    if not part:
        raise HTTPException(404, "Parça bulunamadı")
    if part["quantity"] < adet:
        raise HTTPException(400, f"Stok yetersiz (mevcut: {part['quantity']})")

    birim_fiyat = float(body.get("unit_price") or part["sale_price"] or 0)
    await db.execute(
        "INSERT INTO repair_parts (repair_id, part_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
        (repair_id, part_id, adet, birim_fiyat),
    )
    await db.execute("UPDATE parts SET quantity = quantity - ? WHERE id=?", (adet, part_id))
    await db.commit()
    return {"ok": True}


@router.delete("/{repair_id}/parcalar/{rp_id}")
async def remove_repair_parca(
    repair_id: int,
    rp_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT part_id, quantity FROM repair_parts WHERE id=? AND repair_id=?",
        (rp_id, repair_id),
    )
    row = await cur.fetchone()
    if not row:
        raise HTTPException(404)
    await db.execute("UPDATE parts SET quantity = quantity + ? WHERE id=?", (row["quantity"], row["part_id"]))
    await db.execute("DELETE FROM repair_parts WHERE id=?", (rp_id,))
    await db.commit()
    return {"ok": True}


# ── TAMİR FOTOĞRAFLARI ─────────────────────────────────────────────────

@router.get("/{repair_id}/fotolar")
async def get_repair_fotolar(
    repair_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT id, aciklama, created_at FROM tamir_fotograflari WHERE repair_id=? ORDER BY created_at",
        (repair_id,),
    )
    rows = [dict(r) for r in await cur.fetchall()]
    # Load foto data separately to avoid huge row in listing
    result = []
    for r in rows:
        cur2 = await db.execute("SELECT foto FROM tamir_fotograflari WHERE id=?", (r["id"],))
        frow = await cur2.fetchone()
        result.append({**r, "foto": frow["foto"] if frow else ""})
    return result


@router.post("/{repair_id}/fotolar")
async def add_repair_foto(
    repair_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    foto = body.get("foto", "")
    if not foto:
        raise HTTPException(400, "Fotoğraf verisi gerekli")
    await db.execute(
        "INSERT INTO tamir_fotograflari (repair_id, foto, aciklama) VALUES (?, ?, ?)",
        (repair_id, foto, body.get("aciklama")),
    )
    await db.commit()
    return {"ok": True}


@router.delete("/{repair_id}/fotolar/{foto_id}")
async def delete_repair_foto(
    repair_id: int,
    foto_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute(
        "DELETE FROM tamir_fotograflari WHERE id=? AND repair_id=?",
        (foto_id, repair_id),
    )
    await db.commit()
    return {"ok": True}
