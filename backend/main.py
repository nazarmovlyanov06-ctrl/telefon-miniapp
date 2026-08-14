from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import FRONTEND_URL
from database import init_pool, close_pool, get_pool
from routers import auth_router, users, customers, repairs, parts, shopping, imei, debts, reports
from routers import (
    toptanci, ikinciel, garanti, kasa, gider, loaner,
    aksesuar, hedef, maas, karalist, parca_iade, ai_chat, sifir_cihaz,
    arama, sablonlar, geri_bildirim, admin, destek,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
        )
        tablolar = [r["tablename"] for r in rows]
        log.info(f"PostgreSQL bagli — {len(tablolar)} tablo: {tablolar}")
    yield
    await close_pool()


app = FastAPI(title="Telefon Servis API", version="2.0.0", lifespan=lifespan)

# Belirli originlere sinirlandirildi — production'da acik CORS risklidir.
_allowed_origins = [FRONTEND_URL, "https://telefon.varmistok.com"]
if os.getenv("DEV_MODE", "false").lower() == "true":
    _allowed_origins += ["http://localhost:5173", "http://localhost:3000", "http://localhost:5183"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
    max_age=3600,
)

app.include_router(auth_router.router)
app.include_router(users.router)
app.include_router(customers.router)
app.include_router(repairs.router)
app.include_router(parts.router)
app.include_router(shopping.router)
app.include_router(imei.router)
app.include_router(debts.router)
app.include_router(reports.router)
app.include_router(toptanci.router)
app.include_router(ikinciel.router)
app.include_router(garanti.router)
app.include_router(kasa.router)
app.include_router(gider.router)
app.include_router(loaner.router)
app.include_router(aksesuar.router)
app.include_router(hedef.router)
app.include_router(maas.router)
app.include_router(karalist.router)
app.include_router(parca_iade.router)
app.include_router(ai_chat.router)
app.include_router(sifir_cihaz.router)
app.include_router(arama.router)
app.include_router(sablonlar.router)
app.include_router(geri_bildirim.router)
app.include_router(admin.router)
app.include_router(destek.router)

_uploads_dir = os.path.join(os.path.dirname(__file__), "..", "data", "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/db")
async def health_db():
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
        )
    return {"tablolar": [r["tablename"] for r in rows], "sayi": len(rows)}


# Serve React SPA — must be after all API routes
_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_dist, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        return FileResponse(os.path.join(_dist, "index.html"))
