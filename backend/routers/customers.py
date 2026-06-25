from fastapi import APIRouter, Depends, HTTPException, Query
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("/")
async def list_customers(
    q: str = Query(None),
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if q:
        cur = await db.execute(
            """SELECT * FROM customers
               WHERE name LIKE ? OR phone LIKE ?
               ORDER BY visit_count DESC LIMIT 50""",
            (f"%{q}%", f"%{q}%"),
        )
    else:
        cur = await db.execute(
            "SELECT * FROM customers ORDER BY visit_count DESC, created_at DESC LIMIT 100"
        )
    return [dict(r) for r in await cur.fetchall()]


@router.get("/{customer_id}")
async def get_customer(
    customer_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Musteri bulunamadi")
    return dict(row)


@router.post("/")
async def create_customer(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "INSERT INTO customers (name, phone, notes) VALUES (?, ?, ?)",
        (body["name"], body.get("phone"), body.get("notes")),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.put("/{customer_id}")
async def update_customer(
    customer_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    await db.execute(
        """UPDATE customers SET name=?, phone=?, notes=?, is_vip=?
           WHERE id=?""",
        (body["name"], body.get("phone"), body.get("notes"), int(body.get("is_vip", 0)), customer_id),
    )
    await db.commit()
    return {"ok": True}


@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    if user["role"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    await db.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    await db.commit()
    return {"ok": True}


@router.get("/{customer_id}/ikinciel")
async def customer_ikinciel(
    customer_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT name FROM customers WHERE id = ?", (customer_id,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Musteri bulunamadi")
    name = dict(row)["name"]
    # Kimden = aldığımız cihaz (bize sattı), musteri_adi = sattığımız (müşteri satın aldı)
    cur = await db.execute(
        """SELECT *, 'alim' as yon FROM ikinci_el WHERE LOWER(kimden) = LOWER(?)
           UNION ALL
           SELECT *, 'satim' as yon FROM ikinci_el WHERE LOWER(musteri_adi) = LOWER(?)
           ORDER BY created_at DESC""",
        (name, name)
    )
    return [dict(r) for r in await cur.fetchall()]


@router.get("/{customer_id}/repairs")
async def customer_repairs(
    customer_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT r.*, u.name as assigned_name
           FROM repairs r
           LEFT JOIN users u ON r.assigned_to = u.id
           WHERE r.customer_id = ?
           ORDER BY r.created_at DESC""",
        (customer_id,),
    )
    return [dict(r) for r in await cur.fetchall()]
