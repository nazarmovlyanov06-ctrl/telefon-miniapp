"""
Tüm kullanıcı verilerini sıfırlar — teslim öncesi temizlik.
Şablonlar (arıza_sablonlari) KORUNUR, diğer her şey silinir.
Çalıştır: python reset_data.py
"""
import sqlite3, sys, os
sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv
load_dotenv()

DB_PATH = os.getenv("DB_PATH", "../telefon_bot/telefon_bot.db")

print(f"DB: {DB_PATH}")
if not os.path.exists(DB_PATH):
    print("HATA: DB dosyası bulunamadı!")
    sys.exit(1)

onay = input("\n⚠️  TÜM VERİLER SİLİNECEK. Devam? (evet yaz): ")
if onay.strip().lower() != "evet":
    print("İptal edildi.")
    sys.exit(0)

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# SILINECEK tablolar (kullanıcı verisi)
SIL = [
    # İlişkili tablolar önce
    "repair_parts",
    "debt_payments",
    "debts",
    "part_orders",
    "repairs",
    "customers",
    "parts",
    "shopping_list",
    "alisveris_listesi",
    "imei_history",
    "toptanci_alislar",
    "toptancilar",
    "parca_iadeler",
    "ikinci_el_masraflar",
    "ikinci_el",
    "garantiler",
    "kasa_hareketleri",
    "giderler",
    "loaner_fotograflari",
    "loaner_cihazlar",
    "aksesuar_satislar",
    "aksesuarlar",
    "aylik_hedefler",
    "avanslar",
    "maas_odemeleri",
    "calisanlar",
    "kara_liste",
    "geri_bildirimler",
    "activity_log",
    "users",
    # sıfır_cihaz varsa
    "sifir_cihazlar",
]

c.execute("PRAGMA foreign_keys = OFF")

toplam = 0
for tablo in SIL:
    try:
        c.execute(f"SELECT COUNT(*) FROM {tablo}")
        sayi = c.fetchone()[0]
        c.execute(f"DELETE FROM {tablo}")
        c.execute(f"DELETE FROM sqlite_sequence WHERE name='{tablo}'")
        print(f"  ✓ {tablo}: {sayi} kayıt silindi")
        toplam += sayi
    except Exception as e:
        print(f"  - {tablo}: atlandı ({e})")

c.execute("PRAGMA foreign_keys = ON")
conn.commit()

# Şablonlar korunuyor mu kontrol
try:
    c.execute("SELECT COUNT(*) FROM ariza_sablonlari")
    sab = c.fetchone()[0]
    print(f"\n✅ ariza_sablonlari KORUNDU ({sab} şablon)")
except:
    pass

conn.execute("VACUUM")
conn.commit()
conn.close()

print(f"\n🎉 Temizlik tamamlandı — toplam {toplam} kayıt silindi.")
print("Uygulama teslime hazır!")
