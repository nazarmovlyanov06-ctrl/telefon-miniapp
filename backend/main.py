from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import FRONTEND_URL
from routers import users, customers, repairs, parts, shopping, imei, debts, reports

app = FastAPI(title="Telefon Servis API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "https://web.telegram.org", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(customers.router)
app.include_router(repairs.router)
app.include_router(parts.router)
app.include_router(shopping.router)
app.include_router(imei.router)
app.include_router(debts.router)
app.include_router(reports.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
