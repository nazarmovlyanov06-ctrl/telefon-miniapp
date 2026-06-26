"""
Demo verisi doldurucu — boş bir veritabanına gerçekçi örnek veri ekler.
Kullanım: python seed_demo.py
"""
import sqlite3
import datetime
import random
import os

DB_PATH = os.getenv("DB_PATH", "servis.db")

MUSTERILER = [
    ("Ahmet Yılmaz", "0532 111 2233"),
    ("Fatma Kaya", "0545 222 3344"),
    ("Mehmet Demir", "0555 333 4455"),
    ("Ayşe Çelik", "0541 444 5566"),
    ("Mustafa Şahin", "0551 555 6677"),
    ("Zeynep Arslan", "0536 666 7788"),
    ("İbrahim Koç", "0542 777 8899"),
    ("Hatice Güneş", "0553 888 9900"),
    ("Ali Polat", "0534 999 0011"),
    ("Emine Yıldız", "0548 000 1122"),
]

CIHAZLAR = [
    ("iPhone 14 Pro", "356789012345670"),
    ("Samsung Galaxy S23", "357891023456781"),
    ("iPhone 13", "358012034567892"),
    ("Xiaomi 13T", "359123045678903"),
    ("iPhone 12", "350234056789014"),
    ("Samsung A54", "351345067890125"),
    ("iPhone 15", "352456078901236"),
    ("Huawei P60", "353567089012347"),
    ("Oppo Find X6", "354678090123458"),
    ("iPhone SE 2022", "355789001234569"),
]

ARIZALAR = [
    "Ekran kırık", "Batarya şişmiş", "Şarj olmuyor",
    "Hoparlör çalışmıyor", "Ön kamera bozuk", "Su hasarı",
    "Touch ID çalışmıyor", "Wifi sorunu", "Ses çıkmıyor",
    "Açılmıyor", "Kasa hasarı", "Face ID bozuk",
]

PARCALAR = [
    ("iPhone 14 Pro Ekran", "Ekran", 15, 5, 850, 1400),
    ("Samsung S23 Ekran", "Ekran", 8, 3, 650, 1100),
    ("iPhone 13 Batarya", "Batarya", 20, 5, 180, 350),
    ("iPhone 14 Batarya", "Batarya", 18, 5, 220, 420),
    ("Samsung A54 Ekran", "Ekran", 12, 4, 380, 680),
    ("Şarj Soketi (Type-C)", "Konnektör", 25, 8, 45, 120),
    ("Lightning Şarj Soketi", "Konnektör", 22, 8, 65, 150),
    ("iPhone 12 Ekran", "Ekran", 10, 3, 480, 850),
    ("Hoparlör (Universal)", "Hoparlör", 30, 10, 35, 90),
    ("iPhone 13 Pro Kamera", "Kamera", 6, 2, 420, 750),
    ("Arka Cam (iPhone 14)", "Kasa", 14, 5, 95, 220),
    ("Batarya (Samsung A54)", "Batarya", 16, 5, 140, 280),
]

AKSESUARLAR = [
    ("iPhone 14 Pro Kılıf", "Kılıf", 45, 35, 120),
    ("Samsung S23 Kılıf", "Kılıf", 38, 28, 100),
    ("iPhone Tempered Glass", "Ekran Koruyucu", 60, 20, 80),
    ("Samsung Tempered Glass", "Ekran Koruyucu", 55, 18, 70),
    ("20W Şarj Adaptörü", "Şarj", 30, 60, 180),
    ("Lightning Kablo 1m", "Kablo", 40, 25, 90),
    ("Type-C Kablo 1m", "Kablo", 50, 22, 80),
    ("AirPods Kılıf", "Kılıf", 20, 45, 130),
    ("MagSafe Kablosuz Şarj", "Şarj", 12, 150, 320),
    ("Bluetooth Kulaklık Kılıfı", "Aksesuar", 25, 30, 85),
]

def gun_once(n):
    return (datetime.date.today() - datetime.timedelta(days=n)).isoformat()

def rand_gun(min_g, max_g):
    return gun_once(random.randint(min_g, max_g))

def main():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    print("🌱 Demo verisi ekleniyor...")

    # Kullanıcı (patron)
    cur.execute("""
        INSERT OR IGNORE INTO users (tg_id, name, role)
        VALUES (99999999, 'Demo Kullanıcı', 'patron')
    """)

    # Müşteriler
    musteri_ids = []
    for ad, tel in MUSTERILER:
        cur.execute("INSERT OR IGNORE INTO customers (name, phone) VALUES (?, ?)", (ad, tel))
        musteri_ids.append(cur.lastrowid or cur.execute("SELECT id FROM customers WHERE phone=?", (tel,)).fetchone()[0])
    con.commit()
    cur.execute("SELECT id FROM customers")
    musteri_ids = [r[0] for r in cur.fetchall()]

    # Parçalar
    for ad, kat, stok, min_stok, alis, satis in PARCALAR:
        cur.execute("""
            INSERT OR IGNORE INTO parts (name, category, quantity, min_quantity, cost_price, sale_price)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (ad, kat, stok, min_stok, alis, satis))
    con.commit()

    # Aksesuarlar
    for ad, kat, stok, alis, satis in AKSESUARLAR:
        cur.execute("""
            INSERT OR IGNORE INTO aksesuarlar (ad, kategori, stok, alis_fiyati, satis_fiyati)
            VALUES (?, ?, ?, ?, ?)
        """, (ad, kat, stok, alis, satis))
    con.commit()

    # Tamirler
    DURUMLAR = ["bekliyor", "tamirde", "parca_bekleniyor", "hazir", "teslim"]
    DURUM_AGIRLIK = [2, 3, 1, 2, 5]  # teslim daha fazla
    repair_ids = []
    for i in range(25):
        musteri_id = random.choice(musteri_ids)
        cihaz, imei = random.choice(CIHAZLAR)
        ariza = random.choice(ARIZALAR)
        durum = random.choices(DURUMLAR, weights=DURUM_AGIRLIK)[0]
        tahmini = random.choice([350, 500, 750, 950, 1200, 1500, 2000])
        final = int(tahmini * random.uniform(0.9, 1.1)) if durum in ("teslim", "hazir") else None
        odendi = final if durum == "teslim" else 0
        garanti_gun = random.choice([30, 60, 90]) if durum == "teslim" else 0
        gun = rand_gun(0, 60)

        today = datetime.date.today().isoformat()
        repair_no_idx = i + 1
        repair_no = f"T{datetime.date.today().strftime('%y%m%d')}{repair_no_idx:04d}"

        cur.execute("""
            INSERT OR IGNORE INTO repairs
            (repair_no, customer_id, device_model, imei, fault_desc,
             estimated_price, final_price, paid_amount, status, warranty_days,
             payment_type, created_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nakit', ?, 1)
        """, (repair_no, musteri_id, cihaz, imei, ariza,
              tahmini, final, odendi, durum, garanti_gun, gun))
        repair_ids.append(cur.lastrowid)
    con.commit()

    # Kasa hareketleri (son 30 gün)
    for _ in range(40):
        gun = rand_gun(0, 30)
        tur = random.choices(["gelir", "gider"], weights=[3, 1])[0]
        tutar = random.choice([350, 500, 750, 950, 1200, 200, 150, 85]) if tur == "gelir" \
            else random.choice([200, 350, 500, 750, 150])
        aciklamalar_gelir = ["Tamir ücreti", "Aksesuar satışı", "2.el cihaz satış", "Parça satışı"]
        aciklamalar_gider = ["Parça alımı", "Kira", "Elektrik", "Aksesuar alımı", "Kargo"]
        aciklama = random.choice(aciklamalar_gelir if tur == "gelir" else aciklamalar_gider)
        cur.execute("""
            INSERT INTO kasa_hareketleri (tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
            VALUES (?, ?, 'nakit', ?, ?, 'manuel')
        """, (gun, tur, tutar, aciklama))
    con.commit()

    # Garantiler
    for rid in random.sample(repair_ids, min(5, len(repair_ids))):
        cur.execute("SELECT customer_id, device_model, fault_desc FROM repairs WHERE id=?", (rid,))
        row = cur.fetchone()
        if not row: continue
        mid = row[0]
        cur.execute("SELECT name, phone FROM customers WHERE id=?", (mid,))
        m = cur.fetchone()
        if not m: continue
        baslangic = rand_gun(10, 60)
        cur.execute("""
            INSERT OR IGNORE INTO garantiler
            (musteri_adi, telefon, tamir_id, cihaz, tamir_aciklama,
             baslangic_tarihi, sure_gun, aktif)
            VALUES (?, ?, ?, ?, ?, ?, 90, 1)
        """, (m[0], m[1], rid, row[1], row[2], baslangic))
    con.commit()

    # Bir borç
    mid = random.choice(musteri_ids)
    cur.execute("SELECT name FROM customers WHERE id=?", (mid,))
    m = cur.fetchone()
    if m:
        cur.execute("""
            INSERT OR IGNORE INTO debts
            (customer_id, amount, paid, description, due_date, status)
            VALUES (?, 750, 250, 'Tamir taksiti', ?, 'bekliyor')
        """, (mid, gun_once(-15)))
    con.commit()

    # 2. El cihaz
    ikinci_el_data = [
        ("iPhone 12 64GB", "352111234567890", "Orhan Bey", 4500, "stokta", None, None),
        ("Samsung S22", "353222345678901", "Veli Hanım", 5200, "stokta", None, None),
        ("iPhone 11", "354333456789012", "Kazım Bey", 3800, "satıldı", 5500, "Zeynep Hanım"),
    ]
    for model, imei, kimden, alis, durum, satis, alici in ikinci_el_data:
        cur.execute("""
            INSERT OR IGNORE INTO ikinci_el
            (model, imei, kimden, alis_fiyati, durum, satis_fiyati, musteri_adi, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (model, imei, kimden, alis, durum, satis, alici, rand_gun(5, 30)))
    con.commit()

    con.close()
    print("✅ Demo verisi başarıyla eklendi!")
    print(f"   • {len(MUSTERILER)} müşteri")
    print(f"   • 25 tamir kaydı")
    print(f"   • {len(PARCALAR)} parça")
    print(f"   • {len(AKSESUARLAR)} aksesuar")
    print(f"   • 40 kasa hareketi")
    print(f"   • 3 2.el cihaz")
    print(f"   • Garantiler ve borçlar")

if __name__ == "__main__":
    main()
