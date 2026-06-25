import sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')

DB = r"C:\claude\telefon_bot\telefon_bot.db"

YENI = [
    "toptancilar", "toptanci_alislar", "ikinci_el", "ikinci_el_masraflar",
    "garantiler", "kasa_hareketleri", "giderler", "loaner_cihazlar",
    "aksesuarlar", "aksesuar_satislar", "aylik_hedefler",
    "calisanlar", "maas_odemeleri", "avanslar", "kara_liste", "parca_iadeler",
]

conn = sqlite3.connect(DB)
tables = sorted([r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()])
print("Mevcut:", tables)
print()
eksik = [t for t in YENI if t not in tables]
mevcut_yeni = [t for t in YENI if t in tables]
print("Yeni tablolar OK:", mevcut_yeni)
print("EKSiK:", eksik)
conn.close()
