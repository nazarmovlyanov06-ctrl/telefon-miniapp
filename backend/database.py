import aiosqlite
from config import DB_PATH


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
        return dict(row)
    await db.execute(
        "INSERT INTO users (telegram_id, name, role) VALUES (?, ?, 'cirak')",
        (tg_id, name),
    )
    await db.commit()
    cur = await db.execute(
        "SELECT * FROM users WHERE telegram_id = ?", (tg_id,)
    )
    return dict(await cur.fetchone())
