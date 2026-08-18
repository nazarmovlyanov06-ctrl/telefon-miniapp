import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db
from auth import get_current_user, get_dukkan_id
from photo_storage import save_photo, delete_photo
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
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    where = ["r.dukkan_id = $1"]
    params = [dukkan_id]
    if status == "aktif":
        # Ana Sayfa'daki "Aktif Tamir" önizlemesi için — teslim edilmemiş
        # ve iptal edilmemiş tüm durumları (bekliyor/tamirde/parça bekleniyor/hazır) kapsar.
        where.append("r.status NOT IN ('teslim', 'iptal')")
    elif status:
        params.append(status)
        where.append(f"r.status = ${len(params)}")
    if q:
        params.append(f"%{q}%")
        idx = len(params)
        where.append(
            f"(c.name ILIKE ${idx} OR r.device_model ILIKE ${idx} OR r.repair_no ILIKE ${idx} OR r.imei ILIKE ${idx})"
        )

    where_sql = "WHERE " + " AND ".join(where)
    params.append(limit)
    rows = await db.fetch(
        f"""SELECT r.*, c.name as customer_name, c.phone as customer_phone,
                   u.ad as assigned_name
            FROM repairs r
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN kullanicilar u ON r.assigned_to = u.id
            {where_sql}
            ORDER BY r.created_at DESC
            LIMIT ${len(params)}""",
        *params,
    )
    return [dict(r) for r in rows]


@router.get("/modeller")
async def get_modeller(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT device_model, COUNT(*) as c FROM repairs
           WHERE dukkan_id = $1 AND device_model IS NOT NULL AND device_model != ''
           GROUP BY LOWER(TRIM(device_model)) ORDER BY c DESC LIMIT 30""",
        dukkan_id,
    )
    return [r["device_model"] for r in rows]


@router.get("/ariza-onceriler")
async def get_ariza_onceriler(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT fault_desc, COUNT(*) as c FROM repairs
           WHERE dukkan_id = $1 AND fault_desc IS NOT NULL AND fault_desc != ''
           GROUP BY LOWER(TRIM(fault_desc)) ORDER BY c DESC LIMIT 20""",
        dukkan_id,
    )
    return [r["fault_desc"] for r in rows]


@router.get("/{repair_id}")
async def get_repair(
    repair_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """SELECT r.*, c.name as customer_name, c.phone as customer_phone,
                  u.ad as son_guncelleyen_adi
           FROM repairs r
           LEFT JOIN customers c ON r.customer_id = c.id
           LEFT JOIN kullanicilar u ON u.id = r.son_guncelleyen_id
           WHERE r.id = $1 AND r.dukkan_id = $2""",
        repair_id, dukkan_id,
    )
    if not row:
        raise HTTPException(404, "Tamir bulunamadi")
    return dict(row)


@router.post("/")
async def create_repair(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT COALESCE(MAX(id), 0) as m FROM repairs WHERE dukkan_id = $1", dukkan_id
    )
    repair_no = make_repair_no(row["m"])

    customer_id = body.get("customer_id")
    if not customer_id and body.get("customer_name"):
        # Önce aynı isimli müşteri var mı bak
        phone = body.get("customer_phone") or ""
        if phone:
            existing = await db.fetchrow(
                "SELECT id FROM customers WHERE dukkan_id = $1 AND phone = $2", dukkan_id, phone
            )
        else:
            existing = await db.fetchrow(
                "SELECT id FROM customers WHERE dukkan_id = $1 AND name = $2",
                dukkan_id, body["customer_name"],
            )
        if existing:
            customer_id = existing["id"]
        else:
            new_cust = await db.fetchrow(
                "INSERT INTO customers (dukkan_id, name, phone) VALUES ($1, $2, $3) RETURNING id",
                dukkan_id, body["customer_name"], body.get("customer_phone"),
            )
            customer_id = new_cust["id"]

    # Müşteri ziyaret sayısını güncelle
    if customer_id:
        await db.execute(
            "UPDATE customers SET visit_count = COALESCE(visit_count, 0) + 1 WHERE id = $1 AND dukkan_id = $2",
            customer_id, dukkan_id,
        )

    new_repair = await db.fetchrow(
        """INSERT INTO repairs
           (dukkan_id, repair_no, customer_id, device_model, imei, fault_desc,
            estimated_price, status, assigned_to, notes, created_by,
            screen_lock_type, screen_lock_value)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'bekliyor', $8, $9, $10, $11, $12)
           RETURNING id""",
        dukkan_id,
        repair_no,
        customer_id,
        body["device_model"],
        body.get("imei"),
        body["fault_desc"],
        body.get("estimated_price"),
        body.get("assigned_to"),
        body.get("notes"),
        user["id"],
        body.get("screen_lock_type"),
        body.get("screen_lock_value"),
    )
    return {"id": new_repair["id"], "repair_no": repair_no}


@router.put("/{repair_id}")
async def update_repair(
    repair_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    now = datetime.datetime.now()
    tamirde_at = now if body.get("status") == "tamirde" else None
    completed_at = now if body.get("status") == "hazir" else None
    delivered_at = now if body.get("status") == "teslim" else None

    rrow = await db.fetchrow(
        "SELECT repair_no, device_model FROM repairs WHERE id = $1 AND dukkan_id = $2",
        repair_id, dukkan_id,
    )
    repair_no = dict(rrow)["repair_no"] if rrow else ""

    await db.execute(
        """UPDATE repairs SET
           device_model=$1, fault_desc=$2, status=$3, estimated_price=$4,
           final_price=$5, payment_type=$6, paid_amount=$7,
           warranty_days=$8, assigned_to=$9, notes=$10,
           screen_lock_type=COALESCE($11, screen_lock_type),
           screen_lock_value=COALESCE($12, screen_lock_value),
           tamirde_at=COALESCE(tamirde_at, $13),
           completed_at=COALESCE(completed_at, $14),
           delivered_at=COALESCE($15, delivered_at),
           son_guncelleyen_id=$16,
           updated_at=now()
           WHERE id=$17 AND dukkan_id=$18""",
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
        body.get("screen_lock_type"),
        body.get("screen_lock_value"),
        tamirde_at,
        completed_at,
        delivered_at,
        user["id"],
        repair_id,
        dukkan_id,
    )

    if body.get("status") == "teslim" and body.get("kasa_yazilsin"):
        final = float(body.get("final_price") or 0)
        if final > 0:
            cihaz = body.get("device_model", "")
            await db.execute(
                """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
                   VALUES ($1, $2, 'gelir', $3, $4, $5, 'tamir')""",
                dukkan_id,
                datetime.date.today().isoformat(),
                body.get("payment_type", "nakit"),
                final,
                f"Tamir #{repair_no} {cihaz}".strip(),
            )

    return {"ok": True}


@router.delete("/{repair_id}")
async def delete_repair(
    repair_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    await db.execute("DELETE FROM repairs WHERE id = $1 AND dukkan_id = $2", repair_id, dukkan_id)
    return {"ok": True}


# ── KULLANILAN PARÇALAR ─────────────────────────────────────────────────

@router.get("/{repair_id}/parcalar")
async def get_repair_parcalar(
    repair_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT rp.id, rp.part_id, rp.quantity, rp.unit_price,
                  p.name, p.category
           FROM repair_parts rp
           JOIN parts p ON rp.part_id = p.id
           WHERE rp.repair_id = $1 AND rp.dukkan_id = $2
           ORDER BY rp.id""",
        repair_id, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/{repair_id}/parcalar")
async def add_repair_parca(
    repair_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    part_id = body.get("part_id")
    adet = int(body.get("quantity", 1))
    if not part_id or adet < 1:
        raise HTTPException(400, "Geçersiz parça veya adet")

    part = await db.fetchrow(
        "SELECT quantity, sale_price, name FROM parts WHERE id = $1 AND dukkan_id = $2",
        part_id, dukkan_id,
    )
    if not part:
        raise HTTPException(404, "Parça bulunamadı")
    stok = part["quantity"] or 0
    if stok < adet:
        raise HTTPException(400, f"Stok yetersiz (mevcut: {stok})")

    birim_fiyat = float(body.get("unit_price") or part["sale_price"] or 0)
    await db.execute(
        "INSERT INTO repair_parts (dukkan_id, repair_id, part_id, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)",
        dukkan_id, repair_id, part_id, adet, birim_fiyat,
    )
    await db.execute(
        "UPDATE parts SET quantity = quantity - $1 WHERE id = $2 AND dukkan_id = $3",
        adet, part_id, dukkan_id,
    )
    return {"ok": True}


@router.delete("/{repair_id}/parcalar/{rp_id}")
async def remove_repair_parca(
    repair_id: int,
    rp_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT part_id, quantity FROM repair_parts WHERE id = $1 AND repair_id = $2 AND dukkan_id = $3",
        rp_id, repair_id, dukkan_id,
    )
    if not row:
        raise HTTPException(404)
    await db.execute(
        "UPDATE parts SET quantity = quantity + $1 WHERE id = $2 AND dukkan_id = $3",
        row["quantity"], row["part_id"], dukkan_id,
    )
    await db.execute("DELETE FROM repair_parts WHERE id = $1 AND dukkan_id = $2", rp_id, dukkan_id)
    return {"ok": True}


# ── TAMİR FOTOĞRAFLARI ─────────────────────────────────────────────────

@router.get("/{repair_id}/fotolar")
async def get_repair_fotolar(
    repair_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT id, foto, aciklama, created_at FROM tamir_fotograflari WHERE repair_id = $1 AND dukkan_id = $2 ORDER BY created_at",
        repair_id, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/{repair_id}/fotolar")
async def add_repair_foto(
    repair_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    foto = body.get("foto", "")
    if not foto:
        raise HTTPException(400, "Fotoğraf verisi gerekli")
    try:
        foto_path = save_photo(foto, "repairs", repair_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute(
        "INSERT INTO tamir_fotograflari (dukkan_id, repair_id, foto, aciklama) VALUES ($1, $2, $3, $4)",
        dukkan_id, repair_id, foto_path, body.get("aciklama"),
    )
    return {"ok": True}


@router.delete("/{repair_id}/fotolar/{foto_id}")
async def delete_repair_foto(
    repair_id: int,
    foto_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT foto FROM tamir_fotograflari WHERE id = $1 AND repair_id = $2 AND dukkan_id = $3",
        foto_id, repair_id, dukkan_id,
    )
    await db.execute(
        "DELETE FROM tamir_fotograflari WHERE id = $1 AND repair_id = $2 AND dukkan_id = $3",
        foto_id, repair_id, dukkan_id,
    )
    if row:
        delete_photo(row["foto"])
    return {"ok": True}
