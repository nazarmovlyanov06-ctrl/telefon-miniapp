from fastapi import APIRouter, Depends, Query
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user

router = APIRouter(prefix="/arama", tags=["arama"])


@router.get("/")
async def evrensel_arama(
    q: str = Query(..., min_length=1),
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    like = f"%{q}%"
    sonuclar = []

    # Tamirler
    cur = await db.execute(
        """SELECT r.id, r.repair_no, r.device_model, r.fault_desc, r.status,
                  c.name as musteri_adi, c.phone as telefon
           FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.repair_no LIKE ? OR r.device_model LIKE ? OR r.imei LIKE ?
              OR r.fault_desc LIKE ? OR c.name LIKE ? OR c.phone LIKE ?
           ORDER BY r.created_at DESC LIMIT 8""",
        (like, like, like, like, like, like),
    )
    for r in await cur.fetchall():
        r = dict(r)
        sonuclar.append({
            "tur": "tamir",
            "ikon": "🔧",
            "baslik": f"#{r['repair_no']} — {r['device_model']}",
            "alt": f"{r['musteri_adi'] or '—'} · {r['fault_desc'] or '—'} · {r['status']}",
            "link": f"/repairs/{r['id']}",
            "id": r["id"],
        })

    # Müşteriler
    cur = await db.execute(
        """SELECT id, name, phone FROM customers
           WHERE name LIKE ? OR phone LIKE ?
           ORDER BY created_at DESC LIMIT 6""",
        (like, like),
    )
    for r in await cur.fetchall():
        r = dict(r)
        sonuclar.append({
            "tur": "musteri",
            "ikon": "👤",
            "baslik": r["name"],
            "alt": r["phone"] or "Telefon yok",
            "link": f"/customers/{r['id']}",
            "id": r["id"],
        })

    # Parçalar
    cur = await db.execute(
        """SELECT id, name, category, quantity, sale_price FROM parts
           WHERE name LIKE ? OR category LIKE ?
           ORDER BY name LIMIT 5""",
        (like, like),
    )
    for r in await cur.fetchall():
        r = dict(r)
        sonuclar.append({
            "tur": "parca",
            "ikon": "🔩",
            "baslik": r["name"],
            "alt": f"{r['category'] or 'Stok'} · {r['quantity']} adet · {r['sale_price']:.0f}₺",
            "link": "/parts",
            "id": r["id"],
        })

    # 2. El Cihazlar
    cur = await db.execute(
        """SELECT id, model, imei, durum, alis_fiyati, satis_fiyati, musteri_adi
           FROM ikinci_el
           WHERE model LIKE ? OR imei LIKE ? OR kimden LIKE ? OR musteri_adi LIKE ?
           ORDER BY created_at DESC LIMIT 5""",
        (like, like, like, like),
    )
    for r in await cur.fetchall():
        r = dict(r)
        fiyat = r["satis_fiyati"] or r["alis_fiyati"] or 0
        sonuclar.append({
            "tur": "ikinciel",
            "ikon": "📱",
            "baslik": r["model"],
            "alt": f"{r['durum']} · {fiyat:.0f}₺{' · ' + r['musteri_adi'] if r['musteri_adi'] else ''}",
            "link": "/ikinciel",
            "id": r["id"],
        })

    # Borçlar
    cur = await db.execute(
        """SELECT d.id, c.name as musteri_adi, d.total_amount, d.paid_amount, d.description
           FROM debts d LEFT JOIN customers c ON d.customer_id = c.id
           WHERE c.name LIKE ? OR d.description LIKE ?
             AND d.total_amount > d.paid_amount
           ORDER BY d.created_at DESC LIMIT 4""",
        (like, like),
    )
    for r in await cur.fetchall():
        r = dict(r)
        kalan = (r["total_amount"] or 0) - (r["paid_amount"] or 0)
        if kalan > 0:
            sonuclar.append({
                "tur": "borc",
                "ikon": "💳",
                "baslik": r["musteri_adi"] or "Borç",
                "alt": f"Kalan: {kalan:.0f}₺ · {r['description'] or ''}",
                "link": "/debts",
                "id": r["id"],
            })

    # Aksesuar
    cur = await db.execute(
        """SELECT id, ad, kategori, stok, satis_fiyati FROM aksesuarlar
           WHERE ad LIKE ? OR kategori LIKE ?
           ORDER BY ad LIMIT 4""",
        (like, like),
    )
    for r in await cur.fetchall():
        r = dict(r)
        sonuclar.append({
            "tur": "aksesuar",
            "ikon": "🎧",
            "baslik": r["ad"],
            "alt": f"{r['kategori'] or 'Aksesuar'} · {r['stok']} stok · {r['satis_fiyati']:.0f}₺",
            "link": "/aksesuar",
            "id": r["id"],
        })

    return sonuclar[:25]
