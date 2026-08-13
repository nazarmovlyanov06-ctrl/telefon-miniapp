import asyncpg
from config import DATABASE_URL

_pool: asyncpg.Pool | None = None


async def init_pool():
    global _pool
    _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool henuz baslatilmadi")
    return _pool


async def get_db():
    """FastAPI dependency — havuzdan bir baglanti odunc alir."""
    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn
