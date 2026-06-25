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

    # Mevcut max id
    cur = await db.execute("SELECT COALESCE(MAX(id), 0) as m FROM repairs")
    row = await cur.fetchone()
    repair_no = make_repair_no(row["m"])

    # Musteri yok ise oluştur
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

    completed_at = None
    delivered_at = None
    if body.get("status") == "hazir":
        completed_at = datetime.datetime.now().isoformat()
    if body.get("status") == "teslim":
        delivered_at = datetime.datetime.now().isoformat()

    cur2 = await db.execute("SELECT repair_no, device_model FROM repairs WHERE id=?", (repair_id,))
    rrow = await cur2.fetchone()
    repair_no = dict(rrow)["repair_no"] if rrow else ""

    await db.execute(
        """UPDATE repairs SET
           device_model=?, fault_desc=?, status=?, estimated_price=?,
           final_price=?, payment_type=?, paid_amount=?,
           warranty_days=?, assigned_to=?, notes=?,
           completed_at=COALESCE(?, completed_at),
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
            completed_at,
            delivered_at,
            repair_id,
        ),
    )

    # Teslim edildiginde kasaya yaz
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
