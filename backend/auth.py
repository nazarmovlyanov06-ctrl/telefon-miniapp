import json
import time
import os
from urllib.parse import parse_qsl
from fastapi import HTTPException, Header

DEV_MODE = os.getenv("DEV_MODE", "false").lower() == "true"
DEV_TELEGRAM_ID = int(os.getenv("DEV_TELEGRAM_ID", "0"))


def validate_init_data(init_data: str) -> dict:
    """Telegram WebApp initData'dan user bilgisini cikarir."""
    if DEV_MODE or init_data == "mock_dev_mode":
        return {"id": DEV_TELEGRAM_ID, "first_name": "Dev"}
    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=False))

        auth_date = int(parsed.get("auth_date", 0))
        if time.time() - auth_date > 86400:
            raise HTTPException(status_code=401, detail="Token suresi dolmus")

        user_data = json.loads(parsed.get("user", "{}"))
        if not user_data.get("id"):
            raise HTTPException(status_code=401, detail="Kullanici bulunamadi")
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
