import asyncpg
from fastapi import APIRouter, Depends, Query
from database import get_db
from auth import get_current_user, get_dukkan_id

router = APIRouter(prefix="/arama", tags=["arama"])


@router.get("/")
async def evrensel_arama(
    q: str = Query(..., min_length=1),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    like = f"%{q}%"
    sonuclar = []

    try:
        rows = await db.fetch(
            """SELECT r.id, r.repair_no, r.device_model, r.fault_desc, r.status,
                      c.name as musteri_adi, c.phone as telefon
               FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
               WHERE r.dukkan_id = $1 AND
                     (r.repair_no ILIKE $2 OR r.device_model ILIKE $2 OR r.imei ILIKE $2
                      OR r.fault_desc ILIKE $2 OR c.name ILIKE $2 OR c.phone ILIKE $2)
               ORDER BY r.created_at DESC LIMIT 8""",
            dukkan_id, like,
        )
        for r in rows:
            r = dict(r)
            sonuclar.append({
                "tur": "tamir", "ikon": "🔧",
                "baslik": f"#{r['repair_no']} — {r['device_model']}",
                "alt": f"{r['musteri_adi'] or '—'} · {r['fault_desc'] or '—'} · {r['status']}",
                "link": f"/repairs/{r['id']}", "id": r["id"],
            })
    except Exception:
        pass

    try:
        rows = await db.fetch(
            """SELECT id, name, phone FROM customers
               WHERE dukkan_id = $1 AND (name ILIKE $2 OR phone ILIKE $2)
               ORDER BY id DESC LIMIT 6""",
            dukkan_id, like,
        )
        for r in rows:
            r = dict(r)
            sonuclar.append({
                "tur": "musteri", "ikon": "👤",
                "baslik": r["name"], "alt": r["phone"] or "Telefon yok",
                "link": f"/customers/{r['id']}", "id": r["id"],
            })
    except Exception:
        pass

    try:
        rows = await db.fetch(
            """SELECT id, name, category, quantity, sale_price FROM parts
               WHERE dukkan_id = $1 AND (name ILIKE $2 OR category ILIKE $2)
               ORDER BY name LIMIT 5""",
            dukkan_id, like,
        )
        for r in rows:
            r = dict(r)
            fiyat = r["sale_price"] or 0
            sonuclar.append({
                "tur": "parca", "ikon": "🔩",
                "baslik": r["name"],
                "alt": f"{r['category'] or 'Stok'} · {r['quantity']} adet · {fiyat:.0f}₺",
                "link": "/parts", "id": r["id"],
            })
    except Exception:
        pass

    try:
        rows = await db.fetch(
            """SELECT id, model, imei, durum, alis_fiyati, satis_fiyati, musteri_adi
               FROM ikinci_el
               WHERE dukkan_id = $1 AND (model ILIKE $2 OR imei ILIKE $2 OR kimden ILIKE $2 OR musteri_adi ILIKE $2)
               ORDER BY created_at DESC LIMIT 5""",
            dukkan_id, like,
        )
        for r in rows:
            r = dict(r)
            fiyat = r["satis_fiyati"] or r["alis_fiyati"] or 0
            sonuclar.append({
                "tur": "ikinciel", "ikon": "📱",
                "baslik": r["model"],
                "alt": f"{r['durum']} · {fiyat:.0f}₺{' · ' + r['musteri_adi'] if r['musteri_adi'] else ''}",
                "link": "/ikinciel", "id": r["id"],
            })
    except Exception:
        pass

    try:
        rows = await db.fetch(
            """SELECT d.id, COALESCE(c.name, d.alacakli_adi) as musteri_adi,
                      d.total_amount, d.paid_amount, d.notes
               FROM debts d LEFT JOIN customers c ON d.customer_id = c.id
               WHERE d.dukkan_id = $1 AND (c.name ILIKE $2 OR d.alacakli_adi ILIKE $2 OR d.notes ILIKE $2)
               ORDER BY d.created_at DESC LIMIT 4""",
            dukkan_id, like,
        )
        for r in rows:
            r = dict(r)
            kalan = (r["total_amount"] or 0) - (r["paid_amount"] or 0)
            if kalan <= 0:
                continue
            sonuclar.append({
                "tur": "borc", "ikon": "💳",
                "baslik": r["musteri_adi"] or "Borç",
                "alt": f"Kalan: {kalan:.0f}₺ · {r['notes'] or ''}",
                "link": "/debts", "id": r["id"],
            })
    except Exception:
        pass

    try:
        rows = await db.fetch(
            """SELECT id, ad, kategori, stok, satis_fiyati FROM aksesuarlar
               WHERE dukkan_id = $1 AND (ad ILIKE $2 OR kategori ILIKE $2)
               ORDER BY ad LIMIT 4""",
            dukkan_id, like,
        )
        for r in rows:
            r = dict(r)
            sonuclar.append({
                "tur": "aksesuar", "ikon": "🎧",
                "baslik": r["ad"],
                "alt": f"{r['kategori'] or 'Aksesuar'} · {r['stok']} stok · {r['satis_fiyati']:.0f}₺",
                "link": "/aksesuar", "id": r["id"],
            })
    except Exception:
        pass

    return sonuclar[:25]
