import aiosqlite
from config import DB_PATH, DEV_TELEGRAM_ID


async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()


async def get_or_create_user(db: aiosqlite.Connection, tg_id: int, name: str) -> dict:
    cur = await db.execute(
        "SELECT * FROM users WHERE telegram_id = ?", (tg_id,)
    )
    row = await cur.fetchone()
    if row:
        user = dict(row)
        if DEV_TELEGRAM_ID and tg_id == DEV_TELEGRAM_ID and user.get("role") != "patron":
            await db.execute(
                "UPDATE users SET role='patron', durum='aktif' WHERE telegram_id=?", (tg_id,)
            )
            await db.commit()
            user["role"] = "patron"
            user["durum"] = "aktif"
        return user
    is_patron = DEV_TELEGRAM_ID and tg_id == DEV_TELEGRAM_ID
    role = "patron" if is_patron else "cirak"
    durum = "aktif" if is_patron else "bekliyor"
    await db.execute(
        "INSERT INTO users (telegram_id, name, role, durum) VALUES (?, ?, ?, ?)",
        (tg_id, name, role, durum),
    )
    await db.commit()
    cur = await db.execute(
        "SELECT * FROM users WHERE telegram_id = ?", (tg_id,)
    )
    return dict(await cur.fetchone())
