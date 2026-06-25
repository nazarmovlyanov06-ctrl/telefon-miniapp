from fastapi import APIRouter, Depends, HTTPException
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user

router = APIRouter(prefix="/debts", tags=["debts"])


@router.get("/")
async def list_debts(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """SELECT d.*, c.name as customer_name, c.phone as customer_phone,
                  (d.total_amount - d.paid_amount) as remaining
           FROM debts d
           JOIN customers c ON d.customer_id = c.id
           WHERE d.total_amount > d.paid_amount
           ORDER BY d.due_date ASC NULLS LAST, d.created_at DESC
           LIMIT 50"""
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/")
async def create_debt(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        """INSERT INTO debts
           (customer_id, source_type, total_amount, payment_type,
            installment_count, due_date, notes, created_by)
           VALUES (?, 'manuel', ?, ?, ?, ?, ?, ?)""",
        (
            body["customer_id"],
            body["total_amount"],
            body.get("payment_type", "borc"),
            body.get("installment_count", 1),
            body.get("due_date"),
            body.get("notes"),
            user["id"],
        ),
    )
    await db.commit()
    return {"id": cur.lastrowid}


@router.post("/{debt_id}/pay")
async def pay_debt(
    debt_id: int,
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    amount = body.get("amount", 0)

    cur = await db.execute("SELECT * FROM debts WHERE id = ?", (debt_id,))
    debt = await cur.fetchone()
    if not debt:
        raise HTTPException(404, "Borc bulunamadi")

    new_paid = dict(debt)["paid_amount"] + amount
    await db.execute(
        "UPDATE debts SET paid_amount = ? WHERE id = ?",
        (new_paid, debt_id),
    )
    await db.execute(
        """INSERT INTO debt_payments (debt_id, amount, payment_type, notes, created_by)
           VALUES (?, ?, ?, ?, ?)""",
        (debt_id, amount, body.get("payment_type", "nakit"), body.get("notes"), user["id"]),
    )
    await db.commit()
    return {"ok": True, "new_paid": new_paid}
