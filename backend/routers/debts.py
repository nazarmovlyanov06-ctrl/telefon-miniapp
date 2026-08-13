import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db
from auth import get_current_user, get_dukkan_id
from typing import Optional

router = APIRouter(prefix="/debts", tags=["debts"])


@router.get("/")
async def list_debts(
    tur: Optional[str] = Query(None),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    params = [dukkan_id]
    tur_filter = ""
    if tur:
        params.append(tur)
        tur_filter = f"AND COALESCE(d.borc_turu,'alacak') = ${len(params)}"
    rows = await db.fetch(
        f"""SELECT d.*,
                  COALESCE(c.name, d.alacakli_adi, 'Bilinmiyor') as customer_name,
                  c.phone as customer_phone,
                  (d.total_amount - d.paid_amount) as remaining
           FROM debts d
           LEFT JOIN customers c ON d.customer_id = c.id
           WHERE d.dukkan_id = $1 AND d.total_amount > d.paid_amount {tur_filter}
           ORDER BY d.due_date ASC NULLS LAST, d.created_at DESC
           LIMIT 100""",
        *params,
    )
    return [dict(r) for r in rows]


@router.get("/gecmis")
async def gecmis_debts(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT d.*,
                  COALESCE(c.name, d.alacakli_adi, 'Bilinmiyor') as customer_name,
                  c.phone as customer_phone,
                  (d.total_amount - d.paid_amount) as remaining
           FROM debts d
           LEFT JOIN customers c ON d.customer_id = c.id
           WHERE d.dukkan_id = $1 AND d.paid_amount >= d.total_amount AND d.total_amount > 0
           ORDER BY d.created_at DESC LIMIT 100""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/")
async def create_debt(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    borc_turu = body.get("borc_turu", "alacak")
    customer_id = body.get("customer_id")
    alacakli_adi = body.get("alacakli_adi")

    if borc_turu == "alacak" and not customer_id:
        raise HTTPException(400, "Alacak için müşteri seçilmelidir")
    if borc_turu == "dukkan_borcu" and not alacakli_adi:
        raise HTTPException(400, "Dükkan borcu için alacaklı adı zorunlu")

    row = await db.fetchrow(
        """INSERT INTO debts
           (dukkan_id, customer_id, alacakli_adi, borc_turu, source_type,
            amount, total_amount, payment_type, installment_count, due_date, notes, created_by)
           VALUES ($1, $2, $3, $4, 'manuel', $5, $6, $7, $8, $9, $10, $11)
           RETURNING id""",
        dukkan_id,
        customer_id,
        alacakli_adi,
        borc_turu,
        body["total_amount"],
        body["total_amount"],
        body.get("payment_type", "borc"),
        body.get("installment_count", 1),
        body.get("due_date"),
        body.get("notes"),
        user["id"],
    )
    return {"id": row["id"]}


@router.get("/{debt_id}/odemeler")
async def debt_odemeler(
    debt_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM debt_payments WHERE debt_id=$1 AND dukkan_id=$2 ORDER BY paid_at DESC",
        debt_id, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/{debt_id}/pay")
async def pay_debt(
    debt_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    amount = body.get("amount", 0)

    debt = await db.fetchrow(
        "SELECT * FROM debts WHERE id = $1 AND dukkan_id = $2", debt_id, dukkan_id
    )
    if not debt:
        raise HTTPException(404, "Borc bulunamadi")

    new_paid = debt["paid_amount"] + amount
    async with db.transaction():
        await db.execute(
            "UPDATE debts SET paid_amount = $1 WHERE id = $2 AND dukkan_id = $3",
            new_paid, debt_id, dukkan_id,
        )
        await db.execute(
            """INSERT INTO debt_payments (dukkan_id, debt_id, amount, payment_type, notes, created_by)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            dukkan_id, debt_id, amount, body.get("payment_type", "nakit"), body.get("notes"), user["id"],
        )
    return {"ok": True, "new_paid": new_paid}
