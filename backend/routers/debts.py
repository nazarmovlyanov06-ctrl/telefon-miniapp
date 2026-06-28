from fastapi import APIRouter, Depends, HTTPException, Query
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from typing import Optional

router = APIRouter(prefix="/debts", tags=["debts"])


@router.get("/")
async def list_debts(
    tur: Optional[str] = Query(None),
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    tur_filter = ""
    params = []
    if tur:
        tur_filter = "AND COALESCE(d.borc_turu,'alacak') = ?"
        params.append(tur)
    cur = await db.execute(
        f"""SELECT d.*,
                  COALESCE(c.name, d.alacakli_adi, 'Bilinmiyor') as customer_name,
                  c.phone as customer_phone,
                  (d.total_amount - d.paid_amount) as remaining
           FROM debts d
           LEFT JOIN customers c ON d.customer_id = c.id
           WHERE d.total_amount > d.paid_amount {tur_filter}
           ORDER BY d.due_date ASC NULLS LAST, d.created_at DESC
           LIMIT 100""",
        params,
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/")
async def create_debt(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user = await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    borc_turu = body.get("borc_turu", "alacak")
    customer_id = body.get("customer_id")
    alacakli_adi = body.get("alacakli_adi")

    if borc_turu == "alacak" and not customer_id:
        raise HTTPException(400, "Alacak için müşteri seçilmelidir")
    if borc_turu == "dukkan_borcu" and not alacakli_adi:
        raise HTTPException(400, "Dükkan borcu için alacaklı adı zorunlu")

    cur = await db.execute(
        """INSERT INTO debts
           (customer_id, alacakli_adi, borc_turu, source_type,
            total_amount, payment_type, installment_count, due_date, notes, created_by)
           VALUES (?, ?, ?, 'manuel', ?, ?, ?, ?, ?, ?)""",
        (
            customer_id,
            alacakli_adi,
            borc_turu,
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


@router.get("/{debt_id}/odemeler")
async def debt_odemeler(
    debt_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT * FROM debt_payments WHERE debt_id=? ORDER BY paid_at DESC",
        (debt_id,)
    )
    return [dict(r) for r in await cur.fetchall()]


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
