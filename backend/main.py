from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import aiosqlite
import os
from config import FRONTEND_URL, DB_PATH
from routers import users, customers, repairs, parts, shopping, imei, debts, reports
from routers import (
    toptanci, ikinciel, garanti, kasa, gider, loaner,
    aksesuar, hedef, maas, karalist, parca_iade, ai_chat, sifir_cihaz,
    arama, sablonlar, geri_bildirim,
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'cirak',
    active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS repairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repair_no TEXT UNIQUE,
    customer_id INTEGER REFERENCES customers(id),
    device_model TEXT NOT NULL,
    imei TEXT,
    problem TEXT,
    diagnosis TEXT,
    status TEXT DEFAULT 'bekliyor',
    price REAL DEFAULT 0,
    advance_payment REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'nakit',
    assigned_to INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 0,
    cost_price REAL DEFAULT 0,
    sale_price REAL DEFAULT 0,
    supplier TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS part_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id INTEGER REFERENCES parts(id),
    quantity INTEGER NOT NULL,
    unit_cost REAL DEFAULT 0,
    supplier TEXT,
    status TEXT DEFAULT 'siparis_verildi',
    notes TEXT,
    ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    arrived_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS repair_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repair_id INTEGER REFERENCES repairs(id),
    part_id INTEGER REFERENCES parts(id),
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS shopping_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    priority TEXT DEFAULT 'normal',
    bought INTEGER DEFAULT 0,
    bought_price REAL,
    bought_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS alisveris_listesi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_name TEXT NOT NULL,
    device_model TEXT,
    quantity INTEGER DEFAULT 1,
    supplier_hint TEXT,
    estimated_price REAL,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'bekliyor',
    added_by INTEGER REFERENCES users(id),
    bought_from TEXT,
    bought_by INTEGER REFERENCES users(id),
    bought_price REAL,
    bought_at TIMESTAMP,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS imei_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    imei TEXT NOT NULL,
    device_model TEXT,
    customer_id INTEGER REFERENCES customers(id),
    repair_id INTEGER REFERENCES repairs(id),
    action TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id),
    amount REAL NOT NULL,
    paid REAL DEFAULT 0,
    description TEXT,
    due_date TEXT,
    status TEXT DEFAULT 'bekliyor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS debt_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debt_id INTEGER REFERENCES debts(id),
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'nakit',
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS toptancilar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL,
    telefon TEXT,
    sehir TEXT,
    notlar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS toptanci_alislar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    toptanci_id INTEGER REFERENCES toptancilar(id),
    urun TEXT NOT NULL,
    miktar INTEGER DEFAULT 1,
    birim_fiyat REAL NOT NULL,
    toplam REAL NOT NULL,
    tarih TEXT NOT NULL,
    notlar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ikinci_el (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    imei TEXT,
    kimden TEXT,
    alis_fiyati REAL NOT NULL,
    notlar TEXT,
    durum TEXT DEFAULT 'stokta',
    satis_fiyati REAL,
    satis_kanali TEXT,
    satis_tarihi TEXT,
    musteri_adi TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ikinci_el_masraflar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cihaz_id INTEGER REFERENCES ikinci_el(id),
    aciklama TEXT NOT NULL,
    tutar REAL NOT NULL,
    tarih TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS garantiler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    musteri_adi TEXT NOT NULL,
    telefon TEXT,
    tamir_id INTEGER REFERENCES repairs(id),
    cihaz TEXT NOT NULL,
    tamir_aciklama TEXT NOT NULL,
    baslangic_tarihi TEXT NOT NULL,
    sure_gun INTEGER NOT NULL,
    bitis_tarihi TEXT NOT NULL,
    aktif INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS kasa_hareketleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tarih TEXT NOT NULL,
    tur TEXT NOT NULL,
    odeme_yontemi TEXT DEFAULT 'nakit',
    tutar REAL NOT NULL,
    aciklama TEXT,
    kaynak TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS giderler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kategori TEXT NOT NULL,
    tutar REAL NOT NULL,
    aciklama TEXT,
    tarih TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS loaner_cihazlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    musteri_adi TEXT NOT NULL,
    cihaz TEXT NOT NULL,
    teslim_tarihi TEXT NOT NULL,
    iade_tarihi TEXT,
    notlar TEXT,
    hasar_notu TEXT,
    hasar_tutar REAL,
    aktif INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS loaner_fotograflari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loaner_id INTEGER REFERENCES loaner_cihazlar(id),
    foto TEXT NOT NULL,
    aciklama TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS aksesuarlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL,
    stok INTEGER DEFAULT 0,
    alis_fiyati REAL NOT NULL,
    satis_fiyati REAL NOT NULL,
    kategori TEXT DEFAULT 'Diğer'
);
CREATE TABLE IF NOT EXISTS aksesuar_satislar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aksesuar_id INTEGER REFERENCES aksesuarlar(id),
    miktar INTEGER NOT NULL,
    toplam REAL NOT NULL,
    musteri_adi TEXT,
    tarih TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS aylik_hedefler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    yil INTEGER NOT NULL,
    ay INTEGER NOT NULL,
    hedef_tutar REAL NOT NULL,
    UNIQUE(yil, ay)
);
CREATE TABLE IF NOT EXISTS calisanlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL,
    telefon TEXT,
    aylik_maas REAL NOT NULL,
    aktif INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS maas_odemeleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calisan_id INTEGER REFERENCES calisanlar(id),
    yil INTEGER NOT NULL,
    ay INTEGER NOT NULL,
    maas REAL NOT NULL,
    odendi INTEGER DEFAULT 0,
    odeme_tarihi TEXT
);
CREATE TABLE IF NOT EXISTS avanslar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calisan_id INTEGER REFERENCES calisanlar(id),
    tutar REAL NOT NULL,
    tarih TEXT NOT NULL,
    notlar TEXT
);
CREATE TABLE IF NOT EXISTS kara_liste (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT,
    telefon TEXT,
    imei TEXT,
    sebep TEXT NOT NULL,
    notlar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sifir_cihazlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    imei TEXT,
    renk TEXT,
    depolama TEXT,
    kimden TEXT,
    kaynak TEXT DEFAULT 'dukkan',
    alis_fiyati REAL NOT NULL,
    alis_tarihi TEXT,
    durum TEXT DEFAULT 'stokta',
    satis_fiyati REAL,
    satis_tarihi TEXT,
    satis_kanali TEXT,
    musteri_adi TEXT,
    musteri_telefon TEXT,
    odeme_yontemi TEXT DEFAULT 'nakit',
    notlar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS parca_iadeler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    toptanci_id INTEGER REFERENCES toptancilar(id),
    parca TEXT NOT NULL,
    miktar INTEGER DEFAULT 1,
    sebep TEXT,
    durum TEXT DEFAULT 'bekliyor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS stok_hareketleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id INTEGER REFERENCES parts(id),
    hareket TEXT NOT NULL,
    miktar INTEGER NOT NULL,
    sebep TEXT,
    aciklama TEXT,
    tarih TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tamir_sablonlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL,
    cihaz_model TEXT,
    ariza TEXT,
    tahmini_ucret REAL,
    notlar TEXT,
    kullanim_sayisi INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tamir_fotograflari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repair_id INTEGER REFERENCES repairs(id) ON DELETE CASCADE,
    foto TEXT NOT NULL,
    aciklama TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS calisan_geri_bildirim (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gonderen_id INTEGER REFERENCES users(id),
    hedef_id INTEGER NOT NULL REFERENCES users(id),
    tur TEXT NOT NULL,
    mesaj TEXT NOT NULL,
    goruldu INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os, logging
    log = logging.getLogger("startup")
    log.info(f"DB_PATH={DB_PATH}")
    db_abs = os.path.abspath(DB_PATH)
    parent = os.path.dirname(db_abs)
    if parent:
        os.makedirs(parent, exist_ok=True)
    async with aiosqlite.connect(db_abs) as db:
        stmts = [s.strip() for s in SCHEMA.split(";") if s.strip()]
        ok = fail = 0
        for s in stmts:
            try:
                await db.execute(s)
                ok += 1
            except Exception as e:
                log.error(f"Schema hatasi: {e} | SQL: {s[:80]}")
                fail += 1
        for m in [
            "ALTER TABLE ikinci_el ADD COLUMN musteri_adi TEXT",
            "ALTER TABLE aksesuarlar ADD COLUMN kategori TEXT DEFAULT 'Diğer'",
            "ALTER TABLE parts ADD COLUMN device_model TEXT",
            "ALTER TABLE parts ADD COLUMN part_type TEXT",
            "ALTER TABLE parts ADD COLUMN purchase_price REAL DEFAULT 0",
            "ALTER TABLE parts ADD COLUMN created_by INTEGER",
            "ALTER TABLE loaner_cihazlar ADD COLUMN hasar_notu TEXT",
            "ALTER TABLE loaner_cihazlar ADD COLUMN hasar_tutar REAL DEFAULT 0",
            "ALTER TABLE ikinci_el ADD COLUMN kaynak TEXT DEFAULT 'dukkan'",
            "ALTER TABLE repairs ADD COLUMN fault_desc TEXT",
            "ALTER TABLE repairs ADD COLUMN estimated_price REAL DEFAULT 0",
            "ALTER TABLE repairs ADD COLUMN final_price REAL DEFAULT 0",
            "ALTER TABLE repairs ADD COLUMN paid_amount REAL DEFAULT 0",
            "ALTER TABLE repairs ADD COLUMN warranty_days INTEGER DEFAULT 0",
            "ALTER TABLE repairs ADD COLUMN completed_at TEXT",
            "ALTER TABLE repairs ADD COLUMN delivered_at TEXT",
            "ALTER TABLE repairs ADD COLUMN created_by INTEGER",
            "ALTER TABLE debts ADD COLUMN total_amount REAL DEFAULT 0",
            "ALTER TABLE debts ADD COLUMN paid_amount REAL DEFAULT 0",
            "ALTER TABLE debts ADD COLUMN payment_type TEXT DEFAULT 'borc'",
            "ALTER TABLE debts ADD COLUMN installment_count INTEGER DEFAULT 1",
            "ALTER TABLE debts ADD COLUMN notes TEXT",
            "ALTER TABLE debts ADD COLUMN source_type TEXT DEFAULT 'manuel'",
            "ALTER TABLE debts ADD COLUMN created_by INTEGER",
            "ALTER TABLE debt_payments ADD COLUMN payment_type TEXT DEFAULT 'nakit'",
            "ALTER TABLE debt_payments ADD COLUMN notes TEXT",
            "ALTER TABLE debt_payments ADD COLUMN created_by INTEGER",
            "UPDATE debts SET total_amount = COALESCE(amount, 0) WHERE total_amount = 0 AND amount > 0",
            "UPDATE debts SET paid_amount = COALESCE(paid, 0) WHERE paid_amount = 0 AND paid > 0",
            "ALTER TABLE parca_iadeler ADD COLUMN part_id INTEGER REFERENCES parts(id)",
            "ALTER TABLE ikinci_el ADD COLUMN musteri_telefon TEXT",
            "ALTER TABLE ikinci_el ADD COLUMN kimden_telefon TEXT",
            "ALTER TABLE sifir_cihazlar ADD COLUMN kimden_telefon TEXT",
            "ALTER TABLE repairs ADD COLUMN tamirde_at TEXT",
            "ALTER TABLE ikinci_el ADD COLUMN renk TEXT",
            "ALTER TABLE ikinci_el ADD COLUMN depolama TEXT",
            "ALTER TABLE ikinci_el ADD COLUMN ram TEXT",
            "ALTER TABLE ikinci_el ADD COLUMN ozellikler TEXT",
            "ALTER TABLE repairs ADD COLUMN on_odeme INTEGER DEFAULT 0",
            "ALTER TABLE repairs ADD COLUMN musteri_onayi INTEGER DEFAULT 0",
            "ALTER TABLE repairs ADD COLUMN eski_parca INTEGER DEFAULT 0",
            "ALTER TABLE repairs ADD COLUMN veri_yedegi INTEGER DEFAULT 0",
            "ALTER TABLE repairs ADD COLUMN screen_lock_type TEXT",
            "ALTER TABLE repairs ADD COLUMN screen_lock_value TEXT",
            "ALTER TABLE stok_hareketleri ADD COLUMN created_by INTEGER",
            "ALTER TABLE debts ADD COLUMN borc_turu TEXT DEFAULT 'alacak'",
            "ALTER TABLE debts ADD COLUMN alacakli_adi TEXT",
            "ALTER TABLE parca_iadeler ADD COLUMN beklenen_tutar REAL DEFAULT 0",
            "ALTER TABLE users ADD COLUMN durum TEXT DEFAULT 'aktif'",
            "ALTER TABLE repairs ADD COLUMN son_guncelleyen_id INTEGER REFERENCES users(id)",
            "ALTER TABLE customers ADD COLUMN is_vip INTEGER DEFAULT 0",
            "ALTER TABLE customers ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE ikinci_el ADD COLUMN alis_tarihi TEXT",
            "ALTER TABLE sifir_cihazlar ADD COLUMN satis_tarihi TEXT",
            "ALTER TABLE sifir_cihazlar ADD COLUMN satis_kanali TEXT DEFAULT 'Dükkan'",
            "ALTER TABLE aksesuar_satislar ADD COLUMN musteri_adi TEXT",
            "ALTER TABLE aksesuar_satislar ADD COLUMN odeme_yontemi TEXT DEFAULT 'nakit'",
            "ALTER TABLE repairs ADD COLUMN updated_at TIMESTAMP",
            "ALTER TABLE debts ADD COLUMN source_id INTEGER",
            "ALTER TABLE avanslar ADD COLUMN aciklama TEXT",
            "ALTER TABLE customers ADD COLUMN visit_count INTEGER DEFAULT 0",
            "ALTER TABLE repairs ADD COLUMN payment_type TEXT",
            "ALTER TABLE part_orders ADD COLUMN supplier_id INTEGER",
            "ALTER TABLE part_orders ADD COLUMN part_name TEXT",
            "ALTER TABLE part_orders ADD COLUMN device_model TEXT",
            "ALTER TABLE part_orders ADD COLUMN estimated_price REAL",
            "ALTER TABLE part_orders ADD COLUMN repair_id INTEGER",
            "ALTER TABLE part_orders ADD COLUMN ordered_by INTEGER",
            "ALTER TABLE maas_odemeleri ADD COLUMN odeme_tarihi TEXT",
        ]:
            try:
                await db.execute(m)
            except Exception:
                pass
        await db.commit()
        cur = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tablolar = [r[0] for r in await cur.fetchall()]
        log.info(f"DB hazir — {len(tablolar)} tablo | schema ok={ok} fail={fail}")
        log.info(f"Tablolar: {sorted(tablolar)}")
    yield


app = FastAPI(title="Telefon Servis API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Init-Data", "Accept", "Authorization"],
    max_age=3600,
)

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


@app.get("/health")
async def health():
    return {"status": "ok"}


# Serve React SPA — must be after all API routes
_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_dist, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        return FileResponse(os.path.join(_dist, "index.html"))


@app.get("/health/db")
async def health_db():
    """Hangi tablolar var kontrol eder."""
    import aiosqlite as _aio
    beklenen = [
        "users", "customers", "repairs", "parts", "part_orders", "repair_parts",
        "shopping_list", "imei_history", "debts", "debt_payments",
        "toptancilar", "toptanci_alislar", "ikinci_el", "ikinci_el_masraflar",
        "garantiler", "kasa_hareketleri", "giderler", "loaner_cihazlar",
        "aksesuarlar", "aksesuar_satislar", "aylik_hedefler",
        "calisanlar", "maas_odemeleri", "avanslar", "kara_liste", "parca_iadeler",
    ]
    async with _aio.connect(DB_PATH) as db:
        cur = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        mevcut = {r[0] for r in await cur.fetchall()}
    eksik = [t for t in beklenen if t not in mevcut]
    return {"db_path": DB_PATH, "mevcut_tablo": sorted(mevcut), "eksik_tablo": eksik, "ok": len(eksik) == 0}


@app.post("/health/init-tables")
async def force_init_tables():
    """Tablolari zorla olustur — tani icin."""
    import aiosqlite as _aio, logging
    log = logging.getLogger("init")
    results = []
    async with _aio.connect(DB_PATH) as db:
        stmts = [s.strip() for s in SCHEMA.split(";") if s.strip()]
        for s in stmts:
            try:
                await db.execute(s)
                tname = s.split("EXISTS")[-1].strip().split("(")[0].strip()
                results.append({"tablo": tname, "ok": True})
            except Exception as e:
                results.append({"sql": s[:60], "hata": str(e)})
        await db.commit()
    return {"sonuc": results}
