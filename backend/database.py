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

    # First user ever = auto patron (single-tenant app)
    cur2 = await db.execute("SELECT COUNT(*) FROM users")
    total = (await cur2.fetchone())[0]
    is_first = total == 0
    role = "patron" if is_first else "cirak"
    durum = "aktif" if is_first else "bekliyor"
    await db.execute(
        "INSERT INTO users (telegram_id, name, role, durum) VALUES (?, ?, ?, ?)",
        (tg_id, name, role, durum),
    )
    await db.commit()
    cur = await db.execute(
        "SELECT * FROM users WHERE telegram_id = ?", (tg_id,)
    )
    return dict(await cur.fetchone())
