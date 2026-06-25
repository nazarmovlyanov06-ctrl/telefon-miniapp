import hmac
import hashlib
import json
import time
import os
from urllib.parse import parse_qsl
from fastapi import HTTPException, Header
from config import TELEGRAM_TOKEN

DEV_MODE = os.getenv("DEV_MODE", "false").lower() == "true"
DEV_TELEGRAM_ID = int(os.getenv("DEV_TELEGRAM_ID", "0"))


def validate_init_data(init_data: str) -> dict:
    """Telegram WebApp initData dogrular, user dict dondurur."""
    if DEV_MODE or init_data == "mock_dev_mode":
        return {"id": DEV_TELEGRAM_ID, "first_name": "Dev"}
    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=False))
        check_hash = parsed.pop("hash", None)
        if not check_hash:
            raise HTTPException(status_code=401, detail="Hash eksik")

        auth_date = int(parsed.get("auth_date", 0))
        if time.time() - auth_date > 86400:
            raise HTTPException(status_code=401, detail="Token suresi dolmus")

        data_check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(parsed.items())
        )
        secret_key = hmac.new(
            b"WebAppData", TELEGRAM_TOKEN.encode(), hashlib.sha256
        ).digest()
        computed = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(computed, check_hash):
            raise HTTPException(status_code=401, detail="Gecersiz token")

        user_data = json.loads(parsed.get("user", "{}"))
        return user_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth hatasi: {e}")


async def get_current_user(
    x_init_data: str = Header(..., alias="X-Init-Data"),
):
    """FastAPI dependency — her endpoint'te kullanilir."""
    return validate_init_data(x_init_data)
