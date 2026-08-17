"""
Demo dükkânı sunuma hazır hale getirir:
  1) Stoktaki ürünlere satış fiyatı yazar (vitrinde "Sorunuz" yerine fiyat çıksın)
  2) Ürün görsellerini Wikipedia makale görselleriyle (gerçek ürün fotoğrafı)
     değiştirir — Commons arama sonuçları ekran görüntüsü/alakasız çıkabiliyordu.

Tekrar tekrar çalıştırılabilir. Kullanım: python demo_duzelt.py
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
UA = "TelefonServisDemo/1.0 (https://telefon.varmistok.com)"
BEKLEME = 1.2

# Modeller için Wikipedia makale adayları (sırayla denenir)
MODEL_SAYFA = {
    "iPhone 11": ["IPhone 11"], "iPhone 12": ["IPhone 12"], "iPhone 13": ["IPhone 13"],
    "iPhone 14": ["IPhone 14"], "iPhone 15": ["IPhone 15"], "iPhone 15 Pro": ["IPhone 15 Pro"],
    "Samsung Galaxy S22": ["Samsung Galaxy S22"], "Samsung Galaxy S23": ["Samsung Galaxy S23"],
    "Samsung Galaxy A54": ["Samsung Galaxy A54"],
    "Xiaomi Redmi Note 12": ["Redmi Note 12", "Redmi Note 12 series"],
    "Xiaomi 13T": ["Xiaomi 13T", "Xiaomi 13"],
    "Huawei P60": ["Huawei P60", "Huawei P series"],
    "Oppo A78": ["Oppo A series", "Oppo"],
    "Realme C55": ["Realme C series", "Realme"],
}

KATEGORI_SAYFA = {
    "Şarj Aleti": ["Battery charger", "AC adapter"],
    "Kablo": ["USB-C", "USB"],
    "Kılıf": ["Mobile phone accessories", "Smartphone"],
    "Kırılmaz Cam": ["Screen protector"],
    "Kulaklık": ["Headphones", "Earphone"],
    "Powerbank": ["Power bank", "Battery charger"],
}

GALERI_SAYFA = {
    "Dükkânımız": ["Mobile phone shop", "Retail"],
    "Tamir Masamız": ["Soldering", "Soldering iron"],
    "Teşhir Reyonu": ["Display case", "Retail"],
    "Ekibimiz": ["Technician", "Electronics technician"],
}


def _wiki_gorsel(baslik: str):
    """Wikipedia makalesinin ana görselinin URL'sini döndürür."""
    try:
        api = ("https://en.wikipedia.org/w/api.php?action=query&titles=" +
               urllib.parse.quote(baslik) +
               "&prop=pageimages&pithumbsize=900&format=json&redirects=1")
        req = urllib.request.Request(api, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            d = json.load(r)
        for p in (d.get("query", {}).get("pages") or {}).values():
            src = (p.get("thumbnail") or {}).get("source")
            if src:
                return src
    except Exception as e:
        print(f"   wiki hata ({baslik}): {e}")
    return None


def indir(adaylar, subdir: str, dukkan_id: int):
    """Aday makale başlıklarını sırayla dener, ilk bulduğu görseli indirir."""
    for baslik in adaylar:
        url = _wiki_gorsel(baslik)
        time.sleep(BEKLEME)
        if not url:
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                icerik = r.read()
            if len(icerik) < 2500:
                continue
            u = url.lower().split("?")[0]
            uzanti = "png" if u.endswith(".png") else "svg" if u.endswith(".svg") else "jpg"
            klasor = os.path.join(UPLOAD_ROOT, subdir, str(dukkan_id))
            os.makedirs(klasor, exist_ok=True)
            ad = f"{uuid.uuid4().hex}.{uzanti}"
            with open(os.path.join(klasor, ad), "wb") as f:
                f.write(icerik)
            print(f"   -> {baslik}")
            return f"/uploads/{subdir}/{dukkan_id}/{ad}"
        except Exception as e:
            print(f"   indirme hata ({baslik}): {e}")
        time.sleep(BEKLEME)
    return None


async def main():
    db = await asyncpg.connect(DATABASE_URL)
    dukkan_id = await db.fetchval("SELECT id FROM dukkanlar WHERE slug = $1", SLUG)
    if not dukkan_id:
        print("Demo dukkan yok.")
        return
    print(f"Demo dukkan id={dukkan_id}\n--- 1) Fiyatlar ---")

    # Stoktaki cihazlarda satış fiyatı boşsa maliyetin üzerine gerçekçi kâr koy
    n1 = await db.execute(
        """UPDATE ikinci_el SET satis_fiyati = ROUND((alis_fiyati * 1.22)/50)*50
           WHERE dukkan_id = $1 AND durum = 'stokta' AND satis_fiyati IS NULL""", dukkan_id)
    n2 = await db.execute(
        """UPDATE sifir_cihazlar SET satis_fiyati = ROUND((alis_fiyati * 1.18)/50)*50
           WHERE dukkan_id = $1 AND durum = 'stokta' AND satis_fiyati IS NULL""", dukkan_id)
    print(f"ikinci_el: {n1}, sifir_cihazlar: {n2}")

    print("\n--- 2) Gorseller ---")
    sayac = 0
    for tablo, subdir in [("ikinci_el", "ikincel"), ("sifir_cihazlar", "sifir")]:
        for r in await db.fetch(f"SELECT id, model FROM {tablo} WHERE dukkan_id = $1", dukkan_id):
            adaylar = MODEL_SAYFA.get(r["model"], [r["model"]])
            print(f"{tablo}: {r['model']}")
            url = indir(adaylar, subdir, dukkan_id)
            if url:
                await db.execute(f"UPDATE {tablo} SET gorsel_url = $1 WHERE id = $2", url, r["id"])
                sayac += 1

    kategori_url = {}
    for r in await db.fetch("SELECT id, kategori FROM aksesuarlar WHERE dukkan_id = $1", dukkan_id):
        kat = r["kategori"] or "Diğer"
        if kat not in kategori_url:
            print(f"aksesuar: {kat}")
            kategori_url[kat] = indir(KATEGORI_SAYFA.get(kat, [kat]), "aksesuar", dukkan_id)
        if kategori_url[kat]:
            await db.execute("UPDATE aksesuarlar SET gorsel_url = $1 WHERE id = $2", kategori_url[kat], r["id"])
            sayac += 1

    for r in await db.fetch("SELECT id, baslik FROM dukkan_galeri WHERE dukkan_id = $1", dukkan_id):
        print(f"galeri: {r['baslik']}")
        url = indir(GALERI_SAYFA.get(r["baslik"], [r["baslik"]]), "galeri", dukkan_id)
        if url:
            await db.execute("UPDATE dukkan_galeri SET foto_url = $1 WHERE id = $2", url, r["id"])
            sayac += 1

    fiyatsiz = await db.fetchval(
        """SELECT (SELECT COUNT(*) FROM ikinci_el WHERE dukkan_id=$1 AND durum='stokta' AND satis_fiyati IS NULL)
                + (SELECT COUNT(*) FROM sifir_cihazlar WHERE dukkan_id=$1 AND durum='stokta' AND satis_fiyati IS NULL)""",
        dukkan_id)
    await db.close()
    print(f"\nGuncellenen gorsel: {sayac} · Fiyatsiz stok kalan: {fiyatsiz}")


if __name__ == "__main__":
    asyncio.run(main())
