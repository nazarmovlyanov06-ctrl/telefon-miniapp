import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db
from auth import get_current_user, get_dukkan_id
from datetime import date

router = APIRouter(prefix="/parts", tags=["parts"])


@router.get("/")
async def list_parts(
    q: str = Query(None),
    low_stock: bool = Query(False),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    where = ["p.dukkan_id = $1"]
    params = [dukkan_id]
    if q:
        params += [f"%{q}%", f"%{q}%"]
        where.append(f"(p.name ILIKE ${len(params)-1} OR p.device_model ILIKE ${len(params)})")
    if low_stock:
        where.append("p.quantity <= p.min_quantity")
    where_sql = "WHERE " + " AND ".join(where)
    rows = await db.fetch(
        f"""SELECT p.*, t.ad AS toptanci_adi FROM parts p
            LEFT JOIN toptancilar t ON t.id = p.toptanci_id
            {where_sql}
            ORDER BY p.created_at DESC LIMIT 100""",
        *params,
    )
    return [dict(r) for r in rows]


@router.post("/")
async def create_part(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """INSERT INTO parts (dukkan_id, name, device_model, part_type, quantity, min_quantity,
           purchase_price, sale_price, toptanci_id, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id""",
        dukkan_id,
        body["name"],
        body.get("device_model"),
        body.get("part_type"),
        body.get("quantity", 0),
        body.get("min_quantity", 2),
        body.get("purchase_price"),
        body.get("sale_price"),
        body.get("toptanci_id"),
        user["id"],
    )
    await _toptanci_alis_kaydet(
        db, dukkan_id, body.get("toptanci_id"), body["name"],
        body.get("quantity", 0), body.get("purchase_price"),
    )
    await db.execute(
        """INSERT INTO stok_hareketleri
           (dukkan_id, part_id, hareket, miktar, sebep, tarih, created_by, toptanci_id, birim_fiyat)
           VALUES ($1, $2, 'giris', $3, 'yeni_parca', $4, $5, $6, $7)""",
        dukkan_id, row["id"], body.get("quantity", 0), date.today().isoformat(), user["id"],
        body.get("toptanci_id"), body.get("purchase_price"),
    )
    return {"id": row["id"]}


async def _toptanci_alis_kaydet(db, dukkan_id, toptanci_id, urun, miktar, birim_fiyat):
    """Bir toptancı seçilip fiyat girildiyse bu alımı toptancının kendi alış
    geçmişine de yazar — yoksa Toptancılar sayfasında o toptancıya tıklayınca
    hiçbir şey görünmüyordu (parça stoğuna bağlanan alım, toptancı_alislar
    tablosuna hiç yazılmıyordu)."""
    if not toptanci_id or not birim_fiyat:
        return
    miktar = max(int(miktar or 1), 1)
    fiyat = float(birim_fiyat)
    await db.execute(
        """INSERT INTO toptanci_alislar (dukkan_id, toptanci_id, urun, miktar, birim_fiyat, toplam, tarih)
           VALUES ($1, $2, $3, $4, $5, $6, $7)""",
        dukkan_id, toptanci_id, urun, miktar, fiyat, fiyat * miktar, date.today().isoformat(),
    )


@router.put("/{part_id}")
async def update_part(
    part_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        """UPDATE parts SET name=$1, device_model=$2, part_type=$3, quantity=$4,
           min_quantity=$5, purchase_price=$6, sale_price=$7
           WHERE id=$8 AND dukkan_id=$9""",
        body["name"],
        body.get("device_model"),
        body.get("part_type"),
        body.get("quantity", 0),
        body.get("min_quantity", 2),
        body.get("purchase_price"),
        body.get("sale_price"),
        part_id,
        dukkan_id,
    )
    return {"ok": True}


@router.delete("/{part_id}")
async def delete_part(
    part_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    # stok_hareketleri.part_id -> parts(id) CASCADE değil; hareket geçmişi olan
    # bir parça (artık her yeni parçada en az bir "yeni_parca" kaydı oluyor)
    # önce bu satırlar silinmeden FK ihlaliyle 500 dönüyordu.
    await db.execute("DELETE FROM stok_hareketleri WHERE part_id = $1 AND dukkan_id = $2", part_id, dukkan_id)
    await db.execute("DELETE FROM repair_parts WHERE part_id = $1 AND dukkan_id = $2", part_id, dukkan_id)
    await db.execute("DELETE FROM parts WHERE id = $1 AND dukkan_id = $2", part_id, dukkan_id)
    return {"ok": True}


@router.post("/{part_id}/stok-ekle")
async def stok_ekle(
    part_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    part = await db.fetchrow(
        "SELECT id, name, quantity FROM parts WHERE id=$1 AND dukkan_id=$2", part_id, dukkan_id
    )
    if not part:
        raise HTTPException(404, "Parça bulunamadı")
    miktar = int(body.get("miktar", 1))
    if miktar < 1:
        raise HTTPException(400, "Geçersiz miktar")
    fiyat = body.get("fiyat")
    toptanci_id = body.get("toptanci_id")
    async with db.transaction():
        if fiyat:
            await db.execute(
                """UPDATE parts SET quantity = quantity + $1, purchase_price = $2,
                   toptanci_id = COALESCE($3, toptanci_id) WHERE id = $4 AND dukkan_id = $5""",
                miktar, float(fiyat), toptanci_id, part_id, dukkan_id,
            )
        else:
            await db.execute(
                """UPDATE parts SET quantity = quantity + $1,
                   toptanci_id = COALESCE($2, toptanci_id) WHERE id = $3 AND dukkan_id = $4""",
                miktar, toptanci_id, part_id, dukkan_id,
            )
        await db.execute(
            """INSERT INTO stok_hareketleri
               (dukkan_id, part_id, hareket, miktar, sebep, aciklama, tarih, created_by, toptanci_id, birim_fiyat)
               VALUES ($1, $2, 'giris', $3, 'stok_girisi', $4, $5, $6, $7, $8)""",
            dukkan_id, part_id, miktar, body.get("aciklama"), date.today().isoformat(), user["id"],
            toptanci_id, float(fiyat) if fiyat else None,
        )
        await _toptanci_alis_kaydet(db, dukkan_id, toptanci_id, part["name"], miktar, fiyat)
    return {"ok": True}


@router.post("/{part_id}/kullan")
async def kullan_part(
    part_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    part = await db.fetchrow(
        "SELECT id, name, quantity FROM parts WHERE id=$1 AND dukkan_id=$2", part_id, dukkan_id
    )
    if not part:
        raise HTTPException(404, "Parça bulunamadı")
    miktar = int(body.get("miktar", 1))
    if part["quantity"] < miktar:
        raise HTTPException(400, f"Yetersiz stok (mevcut: {part['quantity']})")
    async with db.transaction():
        await db.execute(
            "UPDATE parts SET quantity = quantity - $1 WHERE id = $2 AND dukkan_id = $3",
            miktar, part_id, dukkan_id,
        )
        await db.execute(
            """INSERT INTO stok_hareketleri (dukkan_id, part_id, hareket, miktar, sebep, aciklama, tarih, created_by)
               VALUES ($1, $2, 'cikis', $3, $4, $5, $6, $7)""",
            dukkan_id, part_id, miktar, body.get("sebep", "diger"), body.get("aciklama"),
            date.today().isoformat(), user["id"],
        )
    return {"ok": True, "kalan": part["quantity"] - miktar}


@router.get("/hareketler/tumu")
async def tum_hareketler(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Stok & Siparişler > Geçmiş sekmesi — daha önce sadece sipariş
    listesinden 'Aldım' ile tamamlananları gösteriyordu; yeni parça
    eklendiğinde veya doğrudan stok girildiğinde hiç görünmüyordu.
    Artık parts tablosundaki TÜM giriş hareketlerini (yeni parça / stok
    girişi / siparişten alındı) tek listede gösteriyor."""
    rows = await db.fetch(
        """SELECT h.id, h.part_id, h.miktar, h.sebep, h.aciklama, h.tarih, h.created_at,
                  h.birim_fiyat, h.birim_fiyat * h.miktar as toplam,
                  p.name as part_name, p.device_model, u.ad as yapan_adi,
                  t.ad as toptanci_adi
           FROM stok_hareketleri h
           JOIN parts p ON p.id = h.part_id
           LEFT JOIN kullanicilar u ON u.id = h.created_by
           LEFT JOIN toptancilar t ON t.id = h.toptanci_id
           WHERE h.dukkan_id=$1 AND h.hareket='giris'
           ORDER BY h.created_at DESC LIMIT 100""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.get("/{part_id}/hareketler")
async def part_hareketler(
    part_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT h.*, u.ad as yapan_adi, t.ad as toptanci_adi
           FROM stok_hareketleri h
           LEFT JOIN kullanicilar u ON u.id = h.created_by
           LEFT JOIN toptancilar t ON t.id = h.toptanci_id
           WHERE h.part_id=$1 AND h.dukkan_id=$2 ORDER BY h.created_at DESC LIMIT 20""",
        part_id, dukkan_id,
    )
    return [dict(r) for r in rows]


# Parca siparisleri
@router.get("/orders/")
async def list_orders(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT po.*, u.ad as ordered_by_name
           FROM part_orders po
           LEFT JOIN kullanicilar u ON po.ordered_by = u.id
           WHERE po.dukkan_id = $1
           ORDER BY po.ordered_at DESC LIMIT 50""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/orders/")
async def create_order(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    async with db.transaction():
        row = await db.fetchrow(
            """INSERT INTO part_orders
               (dukkan_id, supplier_id, part_name, device_model, quantity, estimated_price,
                repair_id, ordered_by, notes)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id""",
            dukkan_id,
            body.get("supplier_id"),
            body["part_name"],
            body.get("device_model"),
            body.get("quantity", 1),
            body.get("estimated_price"),
            body.get("repair_id"),
            user["id"],
            body.get("notes"),
        )
        await db.execute(
            """INSERT INTO alisveris_listesi
               (dukkan_id, part_name, device_model, quantity, estimated_price, added_by, status)
               VALUES ($1, $2, $3, $4, $5, $6, 'bekliyor')""",
            dukkan_id,
            body["part_name"],
            body.get("device_model"),
            body.get("quantity", 1),
            body.get("estimated_price"),
            user["id"],
        )
    return {"id": row["id"]}


@router.put("/orders/{order_id}/arrive")
async def mark_arrived(
    order_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE part_orders SET status='geldi', arrived_at=now() WHERE id=$1 AND dukkan_id=$2",
        order_id, dukkan_id,
    )
    return {"ok": True}
