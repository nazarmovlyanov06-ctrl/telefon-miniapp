import asyncpg
from fastapi import APIRouter, Depends, Query
from database import get_db
from auth import get_current_user, get_dukkan_id
import datetime

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard")
async def dashboard(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    today_date = datetime.date.today()
    today = today_date.isoformat()
    month_start_date = today_date.replace(day=1)
    month_start = month_start_date.isoformat()
    iki_gun_once = today_date - datetime.timedelta(days=2)
    yedi_gun_sonra = (today_date + datetime.timedelta(days=7)).isoformat()

    async def scalar(sql, *params):
        return await db.fetchval(sql, *params) or 0

    rows = await db.fetch(
        "SELECT status, COUNT(*) as c FROM repairs WHERE dukkan_id=$1 AND status != 'teslim' GROUP BY status",
        dukkan_id,
    )
    tamir_durumlar = {r["status"]: r["c"] for r in rows}

    rows = await db.fetch(
        "SELECT tur, COALESCE(SUM(tutar),0) as t FROM kasa_hareketleri WHERE dukkan_id=$1 AND tarih=$2 GROUP BY tur",
        dukkan_id, today,
    )
    kasa = {r["tur"]: float(r["t"]) for r in rows}

    stok_uyari = [dict(r) for r in await db.fetch(
        """SELECT name, quantity, min_quantity FROM parts
           WHERE dukkan_id=$1 AND (quantity <= COALESCE(min_quantity, 0) OR quantity = 0)
           ORDER BY quantity ASC LIMIT 5""",
        dukkan_id,
    )]

    garanti_uyari = [dict(r) for r in await db.fetch(
        """SELECT musteri_adi, cihaz, bitis_tarihi FROM garantiler
           WHERE dukkan_id=$1 AND aktif=true AND bitis_tarihi >= $2 AND bitis_tarihi <= $3
           ORDER BY bitis_tarihi ASC LIMIT 5""",
        dukkan_id, today, yedi_gun_sonra,
    )]

    borc_uyari = [dict(r) for r in await db.fetch(
        """SELECT COALESCE(c.name, d.alacakli_adi) as musteri_adi,
                  d.total_amount - d.paid_amount as kalan, d.due_date
           FROM debts d LEFT JOIN customers c ON d.customer_id = c.id
           WHERE d.dukkan_id=$1 AND d.due_date < $2 AND d.total_amount > d.paid_amount
           ORDER BY d.due_date ASC LIMIT 5""",
        dukkan_id, today,
    )]

    aranacaklar = [dict(r) for r in await db.fetch(
        """SELECT r.id, r.repair_no, c.name as musteri_adi, c.phone as telefon,
                  r.device_model, r.completed_at
           FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.dukkan_id=$1 AND r.status='hazir' AND (r.completed_at <= $2 OR r.completed_at IS NULL)
           ORDER BY r.completed_at ASC LIMIT 10""",
        dukkan_id, iki_gun_once,
    )]

    son_tamirler = [dict(r) for r in await db.fetch(
        """SELECT r.id, r.repair_no, c.name as musteri_adi, r.device_model,
                  r.fault_desc, r.status, r.created_at, r.final_price
           FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.dukkan_id=$1
           ORDER BY r.created_at DESC LIMIT 5""",
        dukkan_id,
    )]

    bu_ay_gelir = await scalar(
        "SELECT COALESCE(SUM(final_price),0) FROM repairs WHERE dukkan_id=$1 AND status='teslim' AND delivered_at >= $2",
        dukkan_id, month_start_date,
    )
    bu_ay_tamir = await scalar(
        "SELECT COUNT(*) FROM repairs WHERE dukkan_id=$1 AND created_at >= $2", dukkan_id, month_start_date
    )

    return {
        "tamir_durumlar": tamir_durumlar,
        "kasa_bugun": {
            "gelir": kasa.get("gelir", 0),
            "gider": kasa.get("gider", 0),
            "net": kasa.get("gelir", 0) - kasa.get("gider", 0),
        },
        "bu_ay": {"gelir": bu_ay_gelir, "tamir": bu_ay_tamir},
        "uyarilar": {"stok": stok_uyari, "garanti": garanti_uyari, "borc": borc_uyari},
        "aranacaklar": aranacaklar,
        "son_tamirler": son_tamirler,
        "bugun": {
            "tamir_sayisi": await scalar(
                "SELECT COUNT(*) FROM repairs WHERE dukkan_id=$1 AND DATE(created_at)=$2", dukkan_id, today_date
            ),
            "teslim_sayisi": await scalar(
                "SELECT COUNT(*) FROM repairs WHERE dukkan_id=$1 AND DATE(delivered_at)=$2", dukkan_id, today_date
            ),
            "gelir": kasa.get("gelir", 0),
        },
        "bekleyen": {
            "tamir": sum(tamir_durumlar.get(s, 0) for s in ["bekliyor", "tamirde", "parca_bekleniyor"]),
            "borc": await scalar(
                "SELECT COUNT(*) FROM debts WHERE dukkan_id=$1 AND total_amount > paid_amount", dukkan_id
            ),
        },
        "stok_uyari": len(stok_uyari),
    }


@router.get("/repairs-by-status")
async def repairs_by_status(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT status, COUNT(*) as count FROM repairs WHERE dukkan_id=$1 GROUP BY status", dukkan_id
    )
    return {r["status"]: r["count"] for r in rows}


@router.get("/genel")
async def genel_stats(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    today = datetime.date.today()

    son7gun = []
    for i in range(6, -1, -1):
        gun = (today - datetime.timedelta(days=i)).isoformat()
        gelir = await db.fetchval(
            "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tarih=$2 AND tur IN ('gelir','giris')",
            dukkan_id, gun,
        )
        gider = await db.fetchval(
            "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tarih=$2 AND tur='gider'",
            dukkan_id, gun,
        )
        son7gun.append({"gun": gun, "gelir": float(gelir), "gider": float(gider)})

    son6ay = []
    for i in range(5, -1, -1):
        ay = today.month - i
        yil = today.year
        while ay <= 0:
            ay += 12
            yil -= 1
        ay_basi = f"{yil}-{ay:02d}-01"
        ay_sonu = f"{yil+1}-01-01" if ay == 12 else f"{yil}-{ay+1:02d}-01"
        gelir = await db.fetchval(
            "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tarih>=$2 AND tarih<$3 AND tur IN ('gelir','giris')",
            dukkan_id, ay_basi, ay_sonu,
        )
        gider = await db.fetchval(
            "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE dukkan_id=$1 AND tarih>=$2 AND tarih<$3 AND tur='gider'",
            dukkan_id, ay_basi, ay_sonu,
        )
        son6ay.append({"ay": f"{yil}-{ay:02d}", "gelir": float(gelir), "gider": float(gider)})

    ariza_top = [dict(r) for r in await db.fetch(
        """SELECT fault_desc, COUNT(*) as c FROM repairs
           WHERE dukkan_id=$1 AND fault_desc IS NOT NULL AND fault_desc != ''
           GROUP BY LOWER(TRIM(fault_desc)), fault_desc ORDER BY c DESC LIMIT 8""",
        dukkan_id,
    )]

    musteri_top = [dict(r) for r in await db.fetch(
        """SELECT c.name, COALESCE(SUM(r.final_price),0) as toplam
           FROM customers c JOIN repairs r ON r.customer_id = c.id
           WHERE c.dukkan_id=$1 AND r.status='teslim' AND r.final_price > 0
           GROUP BY c.id ORDER BY toplam DESC LIMIT 6""",
        dukkan_id,
    )]

    rows = await db.fetch("SELECT status, COUNT(*) as c FROM repairs WHERE dukkan_id=$1 GROUP BY status", dukkan_id)
    tamir_durum = {r["status"]: r["c"] for r in rows}

    async def scalar(sql, *params):
        return await db.fetchval(sql, *params) or 0

    return {
        "son7gun": son7gun,
        "son6ay": son6ay,
        "ariza_top": ariza_top,
        "musteri_top": musteri_top,
        "tamir_durum": tamir_durum,
        "sayilar": {
            "musteri": await scalar("SELECT COUNT(*) FROM customers WHERE dukkan_id=$1", dukkan_id),
            "tamir_toplam": await scalar("SELECT COUNT(*) FROM repairs WHERE dukkan_id=$1", dukkan_id),
            "ikinciel_stok": await scalar(
                "SELECT COUNT(*) FROM ikinci_el WHERE dukkan_id=$1 AND durum='stokta'", dukkan_id
            ),
            "sifir_stok": await scalar(
                "SELECT COUNT(*) FROM sifir_cihazlar WHERE dukkan_id=$1 AND durum='stokta'", dukkan_id
            ),
            "parca_cesit": await scalar("SELECT COUNT(*) FROM parts WHERE dukkan_id=$1", dukkan_id),
            "aksesuar_cesit": await scalar("SELECT COUNT(*) FROM aksesuarlar WHERE dukkan_id=$1", dukkan_id),
        },
    }


@router.get("/monthly")
async def monthly_report(
    year: int = Query(None),
    month: int = Query(None),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    now = datetime.date.today()
    year = year or now.year
    month = month or now.month
    start = datetime.date(year, month, 1)
    end = datetime.date(year + 1, 1, 1) if month == 12 else datetime.date(year, month + 1, 1)

    rows = await db.fetch(
        """SELECT DATE(created_at) as day, COUNT(*) as count,
                  COALESCE(SUM(final_price),0) as gelir
           FROM repairs WHERE dukkan_id=$1 AND created_at >= $2 AND created_at < $3
           GROUP BY DATE(created_at) ORDER BY day""",
        dukkan_id, start, end,
    )
    return [dict(r) for r in rows]


@router.get("/feed")
async def aktivite_feed(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    today = datetime.date.today()
    rows = await db.fetch(
        """SELECT r.id, r.repair_no, r.device_model, r.status,
                  c.name as musteri_adi,
                  u.ad as guncelleyen,
                  r.updated_at
           FROM repairs r
           LEFT JOIN customers c ON r.customer_id = c.id
           LEFT JOIN kullanicilar u ON u.id = r.son_guncelleyen_id
           WHERE r.dukkan_id = $1 AND r.son_guncelleyen_id IS NOT NULL
             AND DATE(r.updated_at) = $2
           ORDER BY r.updated_at DESC LIMIT 30""",
        dukkan_id, today,
    )
    return [dict(r) for r in rows]
