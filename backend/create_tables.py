"""Yeni tablolari manuel olusturur — Railway ve lokal DB icin."""
import sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')

DB = r"C:\claude\telefon_bot\telefon_bot.db"

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS toptancilar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ad TEXT NOT NULL, telefon TEXT, sehir TEXT, notlar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS toptanci_alislar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        toptanci_id INTEGER REFERENCES toptancilar(id),
        urun TEXT NOT NULL, miktar INTEGER DEFAULT 1,
        birim_fiyat REAL NOT NULL, toplam REAL NOT NULL,
        tarih TEXT NOT NULL, notlar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS ikinci_el (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model TEXT NOT NULL, imei TEXT, kimden TEXT,
        alis_fiyati REAL NOT NULL, notlar TEXT,
        durum TEXT DEFAULT 'stokta',
        satis_fiyati REAL, satis_kanali TEXT, satis_tarihi TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS ikinci_el_masraflar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cihaz_id INTEGER REFERENCES ikinci_el(id),
        aciklama TEXT NOT NULL, tutar REAL NOT NULL, tarih TEXT NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS garantiler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        musteri_adi TEXT NOT NULL, telefon TEXT,
        tamir_id INTEGER, cihaz TEXT NOT NULL,
        tamir_aciklama TEXT NOT NULL, baslangic_tarihi TEXT NOT NULL,
        sure_gun INTEGER NOT NULL, bitis_tarihi TEXT NOT NULL,
        aktif INTEGER DEFAULT 1)""",
    """CREATE TABLE IF NOT EXISTS kasa_hareketleri (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tarih TEXT NOT NULL, tur TEXT NOT NULL,
        odeme_yontemi TEXT DEFAULT 'nakit',
        tutar REAL NOT NULL, aciklama TEXT, kaynak TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS giderler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kategori TEXT NOT NULL, tutar REAL NOT NULL,
        aciklama TEXT, tarih TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS loaner_cihazlar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        musteri_adi TEXT NOT NULL, cihaz TEXT NOT NULL,
        teslim_tarihi TEXT NOT NULL, iade_tarihi TEXT,
        notlar TEXT, aktif INTEGER DEFAULT 1)""",
    """CREATE TABLE IF NOT EXISTS aksesuarlar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ad TEXT NOT NULL, stok INTEGER DEFAULT 0,
        alis_fiyati REAL NOT NULL, satis_fiyati REAL NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS aksesuar_satislar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aksesuar_id INTEGER REFERENCES aksesuarlar(id),
        miktar INTEGER NOT NULL, toplam REAL NOT NULL,
        musteri_adi TEXT, tarih TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS aylik_hedefler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        yil INTEGER NOT NULL, ay INTEGER NOT NULL,
        hedef_tutar REAL NOT NULL, UNIQUE(yil, ay))""",
    """CREATE TABLE IF NOT EXISTS calisanlar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ad TEXT NOT NULL, telefon TEXT,
        aylik_maas REAL NOT NULL, aktif INTEGER DEFAULT 1)""",
    """CREATE TABLE IF NOT EXISTS maas_odemeleri (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        calisan_id INTEGER REFERENCES calisanlar(id),
        yil INTEGER NOT NULL, ay INTEGER NOT NULL,
        maas REAL NOT NULL, odendi INTEGER DEFAULT 0, odeme_tarihi TEXT)""",
    """CREATE TABLE IF NOT EXISTS avanslar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        calisan_id INTEGER REFERENCES calisanlar(id),
        tutar REAL NOT NULL, tarih TEXT NOT NULL, notlar TEXT)""",
    """CREATE TABLE IF NOT EXISTS kara_liste (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ad TEXT, telefon TEXT, imei TEXT,
        sebep TEXT NOT NULL, notlar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS parca_iadeler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        toptanci_id INTEGER REFERENCES toptancilar(id),
        parca TEXT NOT NULL, miktar INTEGER DEFAULT 1,
        sebep TEXT, durum TEXT DEFAULT 'bekliyor',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""",
]

conn = sqlite3.connect(DB)
for sql in SCHEMA:
    tablo = sql.split("EXISTS")[-1].strip().split("(")[0].strip().split()[0]
    try:
        conn.execute(sql)
        print(f"OK: {tablo}")
    except Exception as e:
        print(f"HATA {tablo}: {e}")

conn.commit()

# Kontrol
tables = sorted([r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()])
print(f"\nToplam tablo sayisi: {len(tables)}")
conn.close()
