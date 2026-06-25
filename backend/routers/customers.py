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


@router.get("/{customer_id}/gecmis")
async def customer_gecmis(
    customer_id: int,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT name, phone FROM customers WHERE id = ?", (customer_id,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Musteri bulunamadi")
    name = row["name"]
    phone = row["phone"] or ""

    events = []

    # Tamirler
    cur = await db.execute(
        "SELECT * FROM repairs WHERE customer_id = ? ORDER BY created_at DESC", (customer_id,)
    )
    for r in await cur.fetchall():
        r = dict(r)
        events.append({
            "tur": "tamir", "ikon": "🔧",
            "baslik": r["device_model"],
            "alt": r.get("fault_desc") or "",
            "tutar": r.get("final_price") or r.get("estimated_price"),
            "tarih": r.get("created_at"),
            "tamirde_at": r.get("tamirde_at"),
            "completed_at": r.get("completed_at"),
            "delivered_at": r.get("delivered_at"),
            "repair_id": r["id"],
            "repair_no": r.get("repair_no"),
            "durum": r.get("status"),
        })

    # Borçlar
    cur = await db.execute(
        "SELECT * FROM debts WHERE customer_id = ? ORDER BY created_at DESC", (customer_id,)
    )
    for d in await cur.fetchall():
        d = dict(d)
        events.append({
            "tur": "borc", "ikon": "💰",
            "baslik": d.get("description") or d.get("notes") or "Borç",
            "alt": f"Toplam: {d.get('total_amount') or d.get('amount') or 0}₺",
            "tutar": d.get("total_amount") or d.get("amount"),
            "tarih": d.get("created_at"),
        })

    # 2.El — bize sattı (kimden)
    cur = await db.execute(
        "SELECT * FROM ikinci_el WHERE LOWER(kimden) = LOWER(?)"
        + (" OR (kimden_telefon IS NOT NULL AND kimden_telefon != '' AND kimden_telefon = ?)" if phone else ""),
        (name, phone) if phone else (name,)
    )
    for c in await cur.fetchall():
        c = dict(c)
        events.append({
            "tur": "2el_alim", "ikon": "📲",
            "baslik": c["model"],
            "alt": f"Bize sattı · IMEI: {c.get('imei') or '—'}",
            "tutar": c.get("alis_fiyati"),
            "tarih": c.get("alis_tarihi") or c.get("created_at"),
        })

    # 2.El — bizden aldı (musteri_adi)
    cur = await db.execute(
        "SELECT * FROM ikinci_el WHERE LOWER(musteri_adi) = LOWER(?)"
        + (" OR (musteri_telefon IS NOT NULL AND musteri_telefon != '' AND musteri_telefon = ?)" if phone else ""),
        (name, phone) if phone else (name,)
    )
    for c in await cur.fetchall():
        c = dict(c)
        events.append({
            "tur": "2el_satim", "ikon": "📱",
            "baslik": c["model"],
            "alt": f"Satın aldı · IMEI: {c.get('imei') or '—'}",
            "tutar": c.get("satis_fiyati"),
            "tarih": c.get("satis_tarihi") or c.get("created_at"),
        })

    # Sıfır — bize sattı
    cur = await db.execute(
        "SELECT * FROM sifir_cihazlar WHERE LOWER(kimden) = LOWER(?)"
        + (" OR (kimden_telefon IS NOT NULL AND kimden_telefon != '' AND kimden_telefon = ?)" if phone else ""),
        (name, phone) if phone else (name,)
    )
    for c in await cur.fetchall():
        c = dict(c)
        events.append({
            "tur": "sifir_alim", "ikon": "📦",
            "baslik": c["model"],
            "alt": f"Sıfır cihaz · Bize sattı",
            "tutar": c.get("alis_fiyati"),
            "tarih": c.get("alis_tarihi") or c.get("created_at"),
        })

    # Sıfır — bizden aldı
    cur = await db.execute(
        "SELECT * FROM sifir_cihazlar WHERE LOWER(musteri_adi) = LOWER(?)"
        + (" OR (musteri_telefon IS NOT NULL AND musteri_telefon != '' AND musteri_telefon = ?)" if phone else ""),
        (name, phone) if phone else (name,)
    )
    for c in await cur.fetchall():
        c = dict(c)
        events.append({
            "tur": "sifir_satim", "ikon": "📦",
            "baslik": c["model"],
            "alt": f"Sıfır cihaz · Satın aldı",
            "tutar": c.get("satis_fiyati"),
            "tarih": c.get("satis_tarihi") or c.get("created_at"),
        })

    events.sort(key=lambda x: x.get("tarih") or "", reverse=True)
    return events


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
