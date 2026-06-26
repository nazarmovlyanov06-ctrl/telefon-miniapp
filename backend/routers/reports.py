from fastapi import APIRouter, Depends, Query
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
import datetime

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard")
async def dashboard(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    today = datetime.date.today().isoformat()
    month_start = datetime.date.today().replace(day=1).isoformat()
    iki_gun_once = (datetime.date.today() - datetime.timedelta(days=2)).isoformat()
    yedi_gun_sonra = (datetime.date.today() + datetime.timedelta(days=7)).isoformat()

    async def scalar(sql, params=()):
        cur = await db.execute(sql, params)
        row = await cur.fetchone()
        return row[0] if row else 0

    # Tamir durum sayıları (aktif olanlar)
    cur = await db.execute(
        "SELECT status, COUNT(*) as c FROM repairs WHERE status != 'teslim' GROUP BY status"
    )
    tamir_durumlar = {r["status"]: r["c"] for r in await cur.fetchall()}

    # Bugünkü kasa
    cur = await db.execute(
        "SELECT tur, COALESCE(SUM(tutar),0) as t FROM kasa_hareketleri WHERE tarih=? GROUP BY tur",
        (today,),
    )
    kasa = {r["tur"]: r["t"] for r in await cur.fetchall()}

    # Uyarılar — stok
    cur = await db.execute(
        """SELECT name, quantity, min_quantity FROM parts
           WHERE quantity <= COALESCE(min_quantity, 0) OR quantity = 0
           ORDER BY quantity ASC LIMIT 5"""
    )
    stok_uyari = [dict(r) for r in await cur.fetchall()]

    # Uyarılar — garanti
    cur = await db.execute(
        """SELECT musteri_adi, cihaz, bitis_tarihi FROM garantiler
           WHERE aktif=1 AND bitis_tarihi >= ? AND bitis_tarihi <= ?
           ORDER BY bitis_tarihi ASC LIMIT 5""",
        (today, yedi_gun_sonra),
    )
    garanti_uyari = [dict(r) for r in await cur.fetchall()]

    # Uyarılar — gecikmiş borçlar
    cur = await db.execute(
        """SELECT c.name as musteri_adi, d.total_amount - d.paid_amount as kalan, d.due_date
           FROM debts d LEFT JOIN customers c ON d.customer_id = c.id
           WHERE d.due_date < ? AND d.total_amount > d.paid_amount
           ORDER BY d.due_date ASC LIMIT 5""",
        (today,),
    )
    borc_uyari = [dict(r) for r in await cur.fetchall()]

    # Bugün aranacaklar (hazır 2+ gün)
    cur = await db.execute(
        """SELECT r.id, r.repair_no, c.name as musteri_adi, c.phone as telefon,
                  r.device_model, r.completed_at
           FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.status='hazir' AND (r.completed_at <= ? OR r.completed_at IS NULL)
           ORDER BY r.completed_at ASC LIMIT 10""",
        (iki_gun_once,),
    )
    aranacaklar = [dict(r) for r in await cur.fetchall()]

    # Son 5 tamir (canlı feed)
    cur = await db.execute(
        """SELECT r.id, r.repair_no, c.name as musteri_adi, r.device_model,
                  r.fault_desc, r.status, r.created_at, r.final_price
           FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
           ORDER BY r.created_at DESC LIMIT 5""",
    )
    son_tamirler = [dict(r) for r in await cur.fetchall()]

    # Bu ay
    bu_ay_gelir = await scalar(
        "SELECT COALESCE(SUM(final_price),0) FROM repairs WHERE status='teslim' AND delivered_at >= ?",
        (month_start,),
    )
    bu_ay_tamir = await scalar(
        "SELECT COUNT(*) FROM repairs WHERE created_at >= ?", (month_start,)
    )

    return {
        "tamir_durumlar": tamir_durumlar,
        "kasa_bugun": {
            "gelir": kasa.get("gelir", 0),
            "gider": kasa.get("gider", 0),
            "net": kasa.get("gelir", 0) - kasa.get("gider", 0),
        },
        "bu_ay": {
            "gelir": bu_ay_gelir,
            "tamir": bu_ay_tamir,
        },
        "uyarilar": {
            "stok": stok_uyari,
            "garanti": garanti_uyari,
            "borc": borc_uyari,
        },
        "aranacaklar": aranacaklar,
        "son_tamirler": son_tamirler,
        # Legacy compat
        "bugun": {
            "tamir_sayisi": await scalar("SELECT COUNT(*) FROM repairs WHERE DATE(created_at)=?", (today,)),
            "teslim_sayisi": await scalar("SELECT COUNT(*) FROM repairs WHERE DATE(delivered_at)=?", (today,)),
            "gelir": kasa.get("gelir", 0),
        },
        "bekleyen": {
            "tamir": sum(tamir_durumlar.get(s, 0) for s in ["bekliyor", "tamirde", "parca_bekleniyor"]),
            "borc": await scalar("SELECT COUNT(*) FROM debts WHERE total_amount > paid_amount"),
        },
        "stok_uyari": len(stok_uyari),
    }


@router.get("/repairs-by-status")
async def repairs_by_status(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute("SELECT status, COUNT(*) as count FROM repairs GROUP BY status")
    rows = await cur.fetchall()
    return {r["status"]: r["count"] for r in rows}


@router.get("/genel")
async def genel_stats(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    today = datetime.date.today()

    son7gun = []
    for i in range(6, -1, -1):
        gun = (today - datetime.timedelta(days=i)).isoformat()
        cur = await db.execute(
            "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE tarih=? AND tur='gelir'", (gun,)
        )
        gelir = (await cur.fetchone())[0]
        cur = await db.execute(
            "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE tarih=? AND tur='gider'", (gun,)
        )
        gider = (await cur.fetchone())[0]
        son7gun.append({"gun": gun, "gelir": gelir, "gider": gider})

    son6ay = []
    for i in range(5, -1, -1):
        ay = today.month - i
        yil = today.year
        while ay <= 0:
            ay += 12
            yil -= 1
        ay_basi = f"{yil}-{ay:02d}-01"
        ay_sonu = f"{yil+1}-01-01" if ay == 12 else f"{yil}-{ay+1:02d}-01"
        cur = await db.execute(
            "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE tarih>=? AND tarih<? AND tur='gelir'",
            (ay_basi, ay_sonu),
        )
        gelir = (await cur.fetchone())[0]
        cur = await db.execute(
            "SELECT COALESCE(SUM(tutar),0) FROM kasa_hareketleri WHERE tarih>=? AND tarih<? AND tur='gider'",
            (ay_basi, ay_sonu),
        )
        gider = (await cur.fetchone())[0]
        son6ay.append({"ay": f"{yil}-{ay:02d}", "gelir": gelir, "gider": gider})

    cur = await db.execute(
        """SELECT fault_desc, COUNT(*) as c FROM repairs
           WHERE fault_desc IS NOT NULL AND fault_desc != ''
           GROUP BY LOWER(TRIM(fault_desc)) ORDER BY c DESC LIMIT 8"""
    )
    ariza_top = [dict(r) for r in await cur.fetchall()]

    cur = await db.execute(
        """SELECT c.name, COALESCE(SUM(r.final_price),0) as toplam
           FROM customers c JOIN repairs r ON r.customer_id = c.id
           WHERE r.status='teslim' AND r.final_price > 0
           GROUP BY c.id ORDER BY toplam DESC LIMIT 6"""
    )
    musteri_top = [dict(r) for r in await cur.fetchall()]

    cur = await db.execute("SELECT status, COUNT(*) as c FROM repairs GROUP BY status")
    tamir_durum = {r["status"]: r["c"] for r in await cur.fetchall()}

    async def scalar(sql, params=()):
        cur = await db.execute(sql, params)
        row = await cur.fetchone()
        return row[0] if row else 0

    return {
        "son7gun": son7gun,
        "son6ay": son6ay,
        "ariza_top": ariza_top,
        "musteri_top": musteri_top,
        "tamir_durum": tamir_durum,
        "sayilar": {
            "musteri": await scalar("SELECT COUNT(*) FROM customers"),
            "tamir_toplam": await scalar("SELECT COUNT(*) FROM repairs"),
            "ikinciel_stok": await scalar("SELECT COUNT(*) FROM ikinci_el WHERE durum='stokta'"),
            "sifir_stok": await scalar("SELECT COUNT(*) FROM sifir_cihazlar WHERE durum='stokta'"),
            "parca_cesit": await scalar("SELECT COUNT(*) FROM parts"),
            "aksesuar_cesit": await scalar("SELECT COUNT(*) FROM aksesuarlar"),
        },
    }


@router.get("/monthly")
async def monthly_report(
    year: int = Query(None),
    month: int = Query(None),
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    now = datetime.date.today()
    year = year or now.year
    month = month or now.month
    start = f"{year}-{month:02d}-01"
    end = f"{year + 1}-01-01" if month == 12 else f"{year}-{month + 1:02d}-01"

    cur = await db.execute(
        """SELECT DATE(created_at) as day, COUNT(*) as count,
                  COALESCE(SUM(final_price),0) as gelir
           FROM repairs WHERE created_at >= ? AND created_at < ?
           GROUP BY DATE(created_at) ORDER BY day""",
        (start, end),
    )
    return [dict(r) for r in await cur.fetchall()]
