from fastapi import APIRouter, Depends, HTTPException
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from config import IMEI_API_KEY
import httpx

router = APIRouter(prefix="/imei", tags=["imei"])


def luhn_check(imei: str) -> bool:
    """IMEI Luhn algoritma dogrulamasi."""
    if not imei.isdigit() or len(imei) != 15:
        return False
    total = 0
    for i, d in enumerate(imei):
        n = int(d)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


@router.get("/{imei}")
async def query_imei(
    imei: str,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))

    imei = imei.strip().replace(" ", "").replace("-", "")

    if not luhn_check(imei):
        raise HTTPException(400, "Gecersiz IMEI numarasi (15 rakam olmali)")

    # Kendi kayitlarimizdan bak
    cur = await db.execute(
        """SELECT r.repair_no, r.device_model, r.status, r.created_at,
                  c.name as customer_name
           FROM repairs r
           LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.imei = ?
           ORDER BY r.created_at DESC""",
        (imei,),
    )
    local_records = [dict(r) for r in await cur.fetchall()]

    cur = await db.execute(
        "SELECT * FROM second_hand WHERE imei = ? ORDER BY created_at DESC",
        (imei,),
    )
    second_hand = [dict(r) for r in await cur.fetchall()]

    # Dis API sorgusu (imeicheck.io)
    api_result = None
    if IMEI_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://api.imeicheck.net/v1/checks",
                    headers={"Authorization": f"Bearer {IMEI_API_KEY}"},
                    json={"imei": imei, "serviceId": 12},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    api_result = data.get("properties", {})
        except Exception:
            pass

    # IMEI gecmisine kaydet
    await db.execute(
        "INSERT INTO imei_history (imei, action_type) VALUES (?, 'sorgulama')",
        (imei,),
    )
    await db.commit()

    return {
        "imei": imei,
        "valid": True,
        "local_repairs": local_records,
        "second_hand": second_hand,
        "api_info": api_result,
        "tac": imei[:8],
    }
