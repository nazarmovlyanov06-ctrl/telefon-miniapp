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

    async def scalar(sql, params=()):
        cur = await db.execute(sql, params)
        row = await cur.fetchone()
        return row[0] if row else 0

    return {
        "bugun": {
            "tamir_sayisi": await scalar(
                "SELECT COUNT(*) FROM repairs WHERE DATE(created_at) = ?", (today,)
            ),
            "teslim_sayisi": await scalar(
                "SELECT COUNT(*) FROM repairs WHERE DATE(delivered_at) = ?", (today,)
            ),
            "gelir": await scalar(
                "SELECT COALESCE(SUM(final_price),0) FROM repairs WHERE DATE(delivered_at) = ?",
                (today,),
            ),
        },
        "bu_ay": {
            "tamir_sayisi": await scalar(
                "SELECT COUNT(*) FROM repairs WHERE created_at >= ?", (month_start,)
            ),
            "gelir": await scalar(
                "SELECT COALESCE(SUM(final_price),0) FROM repairs WHERE delivered_at >= ? AND status='teslim'",
                (month_start,),
            ),
            "yeni_musteri": await scalar(
                "SELECT COUNT(*) FROM customers WHERE created_at >= ?", (month_start,)
            ),
        },
        "bekleyen": {
            "tamir": await scalar("SELECT COUNT(*) FROM repairs WHERE status IN ('bekliyor','tamirde','parca_bekleniyor')"),
            "siparis": await scalar("SELECT COUNT(*) FROM part_orders WHERE status='bekleniyor'"),
            "borc": await scalar("SELECT COUNT(*) FROM debts WHERE total_amount > paid_amount"),
            "alisveris": await scalar("SELECT COUNT(*) FROM alisveris_listesi WHERE status='bekliyor'"),
        },
        "stok_uyari": await scalar(
            "SELECT COUNT(*) FROM parts WHERE quantity <= min_quantity"
        ),
    }


@router.get("/repairs-by-status")
async def repairs_by_status(
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    cur = await db.execute(
        "SELECT status, COUNT(*) as count FROM repairs GROUP BY status"
    )
    rows = await cur.fetchall()
    return {r["status"]: r["count"] for r in rows}


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
    if month == 12:
        end = f"{year + 1}-01-01"
    else:
        end = f"{year}-{month + 1:02d}-01"

    cur = await db.execute(
        """SELECT DATE(created_at) as day, COUNT(*) as count,
                  COALESCE(SUM(final_price),0) as gelir
           FROM repairs
           WHERE created_at >= ? AND created_at < ?
           GROUP BY DATE(created_at)
           ORDER BY day""",
        (start, end),
    )
    return [dict(r) for r in await cur.fetchall()]
