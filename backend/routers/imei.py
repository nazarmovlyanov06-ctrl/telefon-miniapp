import logging
import re
import httpx
import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import get_current_user, get_dukkan_id
from config import IMEI_API_KEY

log = logging.getLogger("imei")
router = APIRouter(prefix="/imei", tags=["imei"])


def luhn_check(imei: str) -> bool:
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


@router.get("/btk/{imei}")
async def btk_query(
    imei: str,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    imei = imei.strip().replace(" ", "").replace("-", "")
    if not luhn_check(imei):
        raise HTTPException(400, "Geçersiz IMEI")

    headers = {
        "User-Agent": "Mozilla/5.0 (Android 13; Mobile) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://imei.btk.gov.tr/",
        "Origin": "https://imei.btk.gov.tr",
    }
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            resp = await client.get(
                f"https://imei.btk.gov.tr/api/sorgulama/{imei}",
                headers=headers,
            )
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    return {"kaynak": "btk", "durum": data.get("durum") or data.get("status"), "detay": data}
                except Exception:
                    # BTK API'si JSON dönmeyebilir — HTML scrape yoluna düşülüyor, bu beklenen bir durum.
                    log.debug("BTK direkt API JSON değil, scrape'e düşülüyor", exc_info=True)

            session_resp = await client.get("https://imei.btk.gov.tr/", headers=headers)
            csrf = ""
            m = re.search(r'name=["\']_token["\'] value=["\']([^"\']+)["\']', session_resp.text)
            if m:
                csrf = m.group(1)

            post_resp = await client.post(
                "https://imei.btk.gov.tr/sorgulama",
                data={"imei": imei, "_token": csrf},
                headers={**headers, "Content-Type": "application/x-www-form-urlencoded"},
            )
            text = post_resp.text
            durum = "bilinmiyor"
            renk = "gray"
            if "kayıtlı" in text.lower() and "değil" not in text.lower():
                durum = "kayitli"
                renk = "green"
            elif "çalıntı" in text.lower() or "engelli" in text.lower() or "bloke" in text.lower():
                durum = "calinitli_engelli"
                renk = "red"
            elif "yurt dışı" in text.lower() or "ithal" in text.lower():
                durum = "yurt_disi"
                renk = "orange"
            elif "kayıtsız" in text.lower():
                durum = "kayitsiz"
                renk = "orange"

            if durum != "bilinmiyor":
                return {"kaynak": "btk_scrape", "durum": durum, "renk": renk, "ham": ""}

    except Exception:
        log.warning("BTK IMEI sorgusu başarısız", exc_info=True)

    return {"kaynak": "hata", "durum": "btk_erisim_hatasi", "mesaj": "BTK'ya erişilemedi, lütfen siteyi manuel ziyaret edin"}


@router.get("/{imei}")
async def query_imei(
    imei: str,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    imei = imei.strip().replace(" ", "").replace("-", "")

    if not luhn_check(imei):
        raise HTTPException(400, "Geçersiz IMEI numarası (15 rakam olmalı)")

    local_rows = await db.fetch(
        """SELECT r.repair_no, r.device_model, r.status, r.created_at,
                  c.name as customer_name
           FROM repairs r
           LEFT JOIN customers c ON r.customer_id = c.id
           WHERE r.imei = $1 AND r.dukkan_id = $2
           ORDER BY r.created_at DESC""",
        imei, dukkan_id,
    )
    local_records = [dict(r) for r in local_rows]

    sh_rows = await db.fetch(
        "SELECT model, durum, alis_fiyati, satis_fiyati, created_at FROM ikinci_el WHERE imei = $1 AND dukkan_id = $2 ORDER BY created_at DESC",
        imei, dukkan_id,
    )
    second_hand = [dict(r) for r in sh_rows]

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
                    api_result = resp.json().get("properties", {})
        except Exception:
            log.warning("imeicheck.net API sorgusu başarısız", exc_info=True)

    try:
        await db.execute(
            "INSERT INTO imei_history (dukkan_id, imei, action) VALUES ($1, $2, 'sorgulama')",
            dukkan_id, imei,
        )
    except Exception:
        log.warning("imei_history kaydı yazılamadı", exc_info=True)

    return {
        "imei": imei,
        "valid": True,
        "local_repairs": local_records,
        "second_hand": second_hand,
        "api_info": api_result,
        "tac": imei[:8],
    }
