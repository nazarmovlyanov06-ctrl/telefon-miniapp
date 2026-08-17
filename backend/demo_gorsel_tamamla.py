"""
Demo dükkânda SVG'ye düşmüş (yani gerçek fotoğraf indirilememiş) görselleri
Wikimedia Commons'tan gerçek fotoğraflarla değiştirir.

seed_demo_full.py hızlı ardışık istek yaptığı için Wikimedia 429 (rate limit)
dönüyordu; burada istekler arasına bekleme konuyor ve tekrar tekrar
çalıştırılabiliyor (sadece hâlâ .svg olanları dener).

Kullanım (container içinde): python demo_gorsel_tamamla.py
"""
import asyncio
import json
import os
import time
import urllib.parse
import urllib.request
import uuid

import asyncpg

from config import DATABASE_URL

SLUG = "yildiz-teknik"
UPLOAD_ROOT = os.path.join(os.path.dirname(__file__), "..", "data", "uploads")
UA = "TelefonServisDemo/1.0 (https://telefon.varmistok.com; demo icerik doldurma)"
BEKLEME = 2.5  # saniye — Wikimedia rate limit'ine takılmamak için

AKSESUAR_SORGU = {
    "Şarj Aleti": "USB power adapter",
    "Kablo": "USB cable",
    "Kılıf": "mobile phone case",
    "Kırılmaz Cam": "screen protector",
    "Kulaklık": "earbuds",
    "Powerbank": "power bank",
}
GALERI_SORGU = {
    "Dükkânımız": "mobile phone shop",
    "Tamir Masamız": "soldering station electronics",
    "Teşhir Reyonu": "mobile phone store display",
    "Ekibimiz": "phone repair technician",
}


def indir(sorgu: str, subdir: str, dukkan_id: int, deneme=3):
    """Commons'ta ara, ilk uygun fotoğrafı indir. Başarısızsa None."""
    for d in range(deneme):
        try:
            api = ("https://commons.wikimedia.org/w/api.php?action=query&generator=search"
                   "&gsrsearch=" + urllib.parse.quote(sorgu) +
                   "&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime"
                   "&iiurlwidth=800&format=json")
            req = urllib.request.Request(api, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=25) as r:
                data = json.load(r)
            sayfalar = (data.get("query") or {}).get("pages") or {}
            # arama sırasını koru
            sirali = sorted(sayfalar.values(), key=lambda p: p.get("index", 99))
            for p in sirali:
                ii = (p.get("imageinfo") or [{}])[0]
                if ii.get("mime") not in ("image/jpeg", "image/png"):
                    continue
                url = ii.get("thumburl")
                if not url:
                    continue
                time.sleep(BEKLEME)
                req2 = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req2, timeout=30) as r2:
                    icerik = r2.read()
                if len(icerik) < 4000:
                    continue
                uzanti = "png" if url.lower().endswith(".png") else "jpg"
                klasor = os.path.join(UPLOAD_ROOT, subdir, str(dukkan_id))
                os.makedirs(klasor, exist_ok=True)
                ad = f"{uuid.uuid4().hex}.{uzanti}"
                with open(os.path.join(klasor, ad), "wb") as f:
                    f.write(icerik)
                return f"/uploads/{subdir}/{dukkan_id}/{ad}"
            return None
        except Exception as e:
            print(f"   deneme {d+1} basarisiz ({sorgu}): {e}")
            time.sleep(BEKLEME * (d + 2))
    return None


async def main():
    db = await asyncpg.connect(DATABASE_URL)
    dukkan_id = await db.fetchval("SELECT id FROM dukkanlar WHERE slug = $1", SLUG)
    if not dukkan_id:
        print("Demo dukkan bulunamadi.")
        return
    print(f"Demo dukkan id={dukkan_id}\n")
    sayac = {"ok": 0, "atlandi": 0}

    async def guncelle(tablo, kayit_id, url):
        await db.execute(f"UPDATE {tablo} SET gorsel_url = $1 WHERE id = $2", url, kayit_id)

    # 2.El + Sıfır cihazlar — model adına göre gerçek fotoğraf
    for tablo, subdir in [("ikinci_el", "ikincel"), ("sifir_cihazlar", "sifir")]:
        rows = await db.fetch(
            f"SELECT id, model FROM {tablo} WHERE dukkan_id = $1 AND (gorsel_url IS NULL OR gorsel_url LIKE '%.svg')",
            dukkan_id)
        for r in rows:
            print(f"{tablo}: {r['model']}")
            time.sleep(BEKLEME)
            url = indir(f"{r['model']}", subdir, dukkan_id)
            if url:
                await guncelle(tablo, r["id"], url)
                sayac["ok"] += 1
                print("   -> tamam")
            else:
                sayac["atlandi"] += 1

    # Aksesuarlar — kategori bazlı (aynı kategori için tek indirme yeter)
    kategori_url = {}
    rows = await db.fetch(
        "SELECT id, ad, kategori FROM aksesuarlar WHERE dukkan_id = $1 AND (gorsel_url IS NULL OR gorsel_url LIKE '%.svg')",
        dukkan_id)
    for r in rows:
        kat = r["kategori"] or "Diğer"
        if kat not in kategori_url:
            print(f"aksesuar kategorisi: {kat}")
            time.sleep(BEKLEME)
            kategori_url[kat] = indir(AKSESUAR_SORGU.get(kat, kat), "aksesuar", dukkan_id)
        if kategori_url[kat]:
            await guncelle("aksesuarlar", r["id"], kategori_url[kat])
            sayac["ok"] += 1
        else:
            sayac["atlandi"] += 1

    # Galeri
    rows = await db.fetch(
        "SELECT id, baslik FROM dukkan_galeri WHERE dukkan_id = $1 AND foto_url LIKE '%.svg'", dukkan_id)
    for r in rows:
        print(f"galeri: {r['baslik']}")
        time.sleep(BEKLEME)
        url = indir(GALERI_SORGU.get(r["baslik"], r["baslik"]), "galeri", dukkan_id)
        if url:
            await db.execute("UPDATE dukkan_galeri SET foto_url = $1 WHERE id = $2", url, r["id"])
            sayac["ok"] += 1
        else:
            sayac["atlandi"] += 1

    kalan = {}
    for tablo in ["ikinci_el", "sifir_cihazlar", "aksesuarlar"]:
        kalan[tablo] = await db.fetchval(
            f"SELECT COUNT(*) FROM {tablo} WHERE dukkan_id=$1 AND (gorsel_url IS NULL OR gorsel_url LIKE '%.svg')",
            dukkan_id)
    kalan["galeri"] = await db.fetchval(
        "SELECT COUNT(*) FROM dukkan_galeri WHERE dukkan_id=$1 AND foto_url LIKE '%.svg'", dukkan_id)

    await db.close()
    print(f"\nGercek fotograf: {sayac['ok']}, alinamadi: {sayac['atlandi']}")
    print(f"Hala SVG kalan: {kalan}")


if __name__ == "__main__":
    asyncio.run(main())
