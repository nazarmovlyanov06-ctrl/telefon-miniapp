from fastapi import APIRouter, Depends, HTTPException, Query
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user

router = APIRouter(prefix="/parts", tags=["parts"])


@router.get("/")
async def list_parts(
    q: str = Query(None),
    low_stock: bool = Query(False),
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    where = []
    params = []
    if q:
        where.append("(name LIKE ? OR device_model LIKE ?)")
        params += [f"%{q}%", f"%{q}%"]
    if low_stock:
        where.append("quantity <= min_quantity")
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    cur = await db.execute(
        f"SELECT * FROM parts {where_sql} ORDER BY quantity ASC, name ASC LIMIT 100",
        params,
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/")
async def create_part(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """INSERT INTO parts (name, device_model, part_type, quantity, min_quantity,
           purchase_price, sale_price, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            body["name"],
            body.get("device_model"),
            body.get("part_type"),
            body.get("quantity", 0),
            body.get("min_quantity", 2),
            body.get("purchase_price"),
            body.get("sale_price"),
            user["id"],
        ),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.put("/{part_id}")
async def update_part(
    part_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute(
        """UPDATE parts SET name=?, device_model=?, part_type=?, quantity=?,
           min_quantity=?, purchase_price=?, sale_price=?
           WHERE id=?""",
        (
            body["name"],
            body.get("device_model"),
            body.get("part_type"),
            body.get("quantity", 0),
            body.get("min_quantity", 2),
            body.get("purchase_price"),
            body.get("sale_price"),
            part_id,
        ),
    )
    await db.commit()
    return {"ok": True}


@router.delete("/{part_id}")
async def delete_part(
    part_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if user["role"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    await db.execute("DELETE FROM parts WHERE id = ?", (part_id,))
    await db.commit()
    return {"ok": True}


# Parça siparisleri
@router.get("/orders/")
async def list_orders(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT po.*, s.name as supplier_name, u.name as ordered_by_name
           FROM part_orders po
           LEFT JOIN suppliers s ON po.supplier_id = s.id
           LEFT JOIN users u ON po.ordered_by = u.id
           ORDER BY po.ordered_at DESC LIMIT 50"""
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/orders/")
async def create_order(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """INSERT INTO part_orders
           (supplier_id, part_name, device_model, quantity, estimated_price,
            repair_id, ordered_by, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            body.get("supplier_id"),
            body["part_name"],
            body.get("device_model"),
            body.get("quantity", 1),
            body.get("estimated_price"),
            body.get("repair_id"),
            user["id"],
            body.get("notes"),
        ),
    )
    # Alışveriş listesine de ekle
    await db.execute(
        """INSERT INTO alisveris_listesi
           (part_name, device_model, quantity, estimated_price, added_by, status)
           VALUES (?, ?, ?, ?, ?, 'bekliyor')""",
        (
            body["part_name"],
            body.get("device_model"),
            body.get("quantity", 1),
            body.get("estimated_price"),
            user["id"],
        ),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.put("/orders/{order_id}/arrive")
async def mark_arrived(
    order_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute(
        "UPDATE part_orders SET status='geldi', arrived_at=CURRENT_TIMESTAMP WHERE id=?",
        (order_id,),
    )
    await db.commit()
    return {"ok": True}
