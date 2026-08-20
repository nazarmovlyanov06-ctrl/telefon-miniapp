import re
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from typing import Optional
from database import get_db
from auth import get_current_user, get_dukkan_id
from photo_storage import save_upload
from odeme_yardimci import kaydet_odeme
from datetime import date

router = APIRouter(prefix="/aksesuarlar", tags=["aksesuar"])

_SIRALAMA = {
    "eski": "s.created_at ASC",
    "yeni": "s.created_at DESC",
    "tutar_yuksek": "s.toplam DESC",
    "tutar_dusuk": "s.toplam ASC",
}


async def _hareket_ekle(db, dukkan_id, aksesuar_id, tur, miktar, user_id, referans_tip=None, referans_id=None, aciklama=None):
    # Önceden stok sadece tek bir sayı olarak tutuluyordu — kim ne zaman kaç
    # adet ekledi/sattı/düzeltti hiç kaydedilmiyordu, geriye dönük denetim
    # mümkün değildi.
    await db.execute(
        """INSERT INTO aksesuar_stok_hareketleri
           (dukkan_id, aksesuar_id, tur, miktar, referans_tip, referans_id, aciklama, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
        dukkan_id, aksesuar_id, tur, miktar, referans_tip, referans_id, aciklama, user_id,
    )


async def _musteri_bul_veya_olustur(db, dukkan_id, musteri_adi, musteri_telefon):
    if not musteri_adi:
        return None
    if musteri_telefon:
        row = await db.fetchrow(
            "SELECT id FROM customers WHERE dukkan_id=$1 AND (name = $2 OR phone = $3)",
            dukkan_id, musteri_adi, musteri_telefon,
        )
    else:
        row = await db.fetchrow(
            "SELECT id FROM customers WHERE dukkan_id=$1 AND name = $2", dukkan_id, musteri_adi
        )
    if row:
        return row["id"]
    ins = await db.fetchrow(
        "INSERT INTO customers (dukkan_id, name, phone) VALUES ($1, $2, $3) RETURNING id",
        dukkan_id, musteri_adi, musteri_telefon or None,
    )
    return ins["id"]


@router.get("/")
async def list_aksesuar(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT a.*, t.ad as toptanci_adi FROM aksesuarlar a
           LEFT JOIN toptancilar t ON t.id = a.toptanci_id
           WHERE a.dukkan_id = $1 ORDER BY a.ad ASC""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.get("/kategoriler")
async def list_kategoriler(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch("SELECT ad FROM aksesuar_kategorileri WHERE dukkan_id=$1 ORDER BY ad", dukkan_id)
    return {"kategoriler": [r["ad"] for r in rows]}


@router.post("/kategoriler")
async def add_kategori(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    ad = (body.get("ad") or "").strip()
    if not ad:
        raise HTTPException(400, "Kategori adı boş olamaz")
    await db.execute(
        "INSERT INTO aksesuar_kategorileri (dukkan_id, ad) VALUES ($1, $2) ON CONFLICT (dukkan_id, ad) DO NOTHING",
        dukkan_id, ad,
    )
    return {"ok": True}


@router.delete("/kategoriler")
async def sil_kategori(
    ad: str = Query(...),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute("DELETE FROM aksesuar_kategorileri WHERE dukkan_id=$1 AND ad=$2", dukkan_id, ad)
    return {"ok": True}


@router.get("/barkot/{kod}")
async def barkot_ara(
    kod: str,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    # "Barkotla Sat" hızlı akışı — önce elle girilmiş/taranmış gerçek
    # barkota bakılır, yoksa etikette bastığımız "AKS000123" biçimindeki
    # kendi otomatik kodumuz olup olmadığına bakılır (id'den türetilir, ayrıca
    # saklanmaz).
    row = await db.fetchrow(
        "SELECT a.*, t.ad as toptanci_adi FROM aksesuarlar a LEFT JOIN toptancilar t ON t.id = a.toptanci_id WHERE a.dukkan_id=$1 AND a.barkot=$2",
        dukkan_id, kod,
    )
    if not row:
        m = re.fullmatch(r"AKS0*(\d+)", kod.strip().upper())
        if m:
            row = await db.fetchrow(
                "SELECT a.*, t.ad as toptanci_adi FROM aksesuarlar a LEFT JOIN toptancilar t ON t.id = a.toptanci_id WHERE a.dukkan_id=$1 AND a.id=$2",
                dukkan_id, int(m.group(1)),
            )
    if not row:
        raise HTTPException(404, "Bu barkoda ait ürün bulunamadı")
    return dict(row)


@router.get("/satislar")
async def satis_gecmisi(
    q: Optional[str] = Query(None),
    tarih_baslangic: Optional[date] = Query(None),
    tarih_bitis: Optional[date] = Query(None),
    sirala: Optional[str] = Query(None),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    # Önceden aksesuar satışlarının geçmişini gösteren hiçbir sayfa yoktu —
    # satış aksesuar_satislar'a düşüyordu ama sadece Kasa'nın genel gelir
    # dökümünde toplam olarak görünüyordu, hangi ürün/müşteriye satıldığı
    # kayboluyordu.
    params = [dukkan_id]
    where = ["s.dukkan_id = $1"]
    if q:
        params.append(f"%{q}%")
        idx = len(params)
        where.append(f"(a.ad ILIKE ${idx} OR s.musteri_adi ILIKE ${idx})")
    if tarih_baslangic is not None:
        params.append(tarih_baslangic)
        where.append(f"s.created_at >= ${len(params)}")
    if tarih_bitis is not None:
        params.append(tarih_bitis)
        where.append(f"s.created_at < ${len(params)} + interval '1 day'")
    where_sql = " AND ".join(where)
    order_sql = _SIRALAMA.get(sirala, _SIRALAMA["yeni"])
    rows = await db.fetch(
        f"""SELECT s.*, a.ad as urun_adi, a.kategori
           FROM aksesuar_satislar s LEFT JOIN aksesuarlar a ON a.id = s.aksesuar_id
           WHERE {where_sql} ORDER BY {order_sql} LIMIT 300""",
        *params,
    )
    toplam = sum(r["toplam"] for r in rows)
    return {"toplam": toplam, "liste": [dict(r) for r in rows]}


@router.get("/{aksesuar_id}/hareketler")
async def stok_hareketleri(
    aksesuar_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT h.*, u.ad as yapan_adi FROM aksesuar_stok_hareketleri h
           LEFT JOIN kullanicilar u ON u.id = h.created_by
           WHERE h.aksesuar_id=$1 AND h.dukkan_id=$2 ORDER BY h.created_at DESC LIMIT 100""",
        aksesuar_id, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/")
async def create_aksesuar(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    stok = int(body.get("stok", 0))
    async with db.transaction():
        row = await db.fetchrow(
            """INSERT INTO aksesuarlar (dukkan_id, ad, stok, alis_fiyati, satis_fiyati, kategori, toptanci_id, min_stok, barkot)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id""",
            dukkan_id, body["ad"], stok, float(body["alis_fiyati"]), float(body["satis_fiyati"]),
            body.get("kategori", "Diğer"), body.get("toptanci_id"), int(body.get("min_stok") or 5),
            (body.get("barkot") or "").strip() or None,
        )
        if stok > 0:
            await _hareket_ekle(db, dukkan_id, row["id"], "giris", stok, user["id"], "ilk_stok")
    return {"id": row["id"]}


@router.put("/{aksesuar_id}")
async def update_aksesuar(
    aksesuar_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    eski = await db.fetchrow("SELECT stok FROM aksesuarlar WHERE id=$1 AND dukkan_id=$2", aksesuar_id, dukkan_id)
    if not eski:
        raise HTTPException(404, "Aksesuar bulunamadı")
    yeni_stok = int(body.get("stok", 0))
    async with db.transaction():
        await db.execute(
            """UPDATE aksesuarlar SET ad=$1, stok=$2, alis_fiyati=$3, satis_fiyati=$4, kategori=$5,
               toptanci_id=$6, min_stok=$7, barkot=$8 WHERE id=$9 AND dukkan_id=$10""",
            body.get("ad"), yeni_stok, float(body.get("alis_fiyati", 0)),
            float(body.get("satis_fiyati", 0)), body.get("kategori", "Diğer"),
            body.get("toptanci_id"), int(body.get("min_stok") or 5),
            (body.get("barkot") or "").strip() or None, aksesuar_id, dukkan_id,
        )
        fark = yeni_stok - eski["stok"]
        if fark != 0:
            await _hareket_ekle(db, dukkan_id, aksesuar_id, "duzeltme", fark, user["id"], "manuel_duzenleme")
    return {"ok": True}


@router.post("/{aksesuar_id}/stok-ekle")
async def stok_ekle(
    aksesuar_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    # Toptancıdan yeni parti geldiğinde hızlı stok girişi — istenirse aynı anda
    # alış fiyatı/toptancı bilgisini de günceller (fiyat değişmiş olabilir).
    aks = await db.fetchrow("SELECT * FROM aksesuarlar WHERE id=$1 AND dukkan_id=$2", aksesuar_id, dukkan_id)
    if not aks:
        raise HTTPException(404, "Aksesuar bulunamadı")
    miktar = int(body.get("miktar", 0))
    if miktar <= 0:
        raise HTTPException(400, "Adet sıfırdan büyük olmalı")
    yeni_alis = body.get("alis_fiyati")
    yeni_toptanci = body.get("toptanci_id")
    async with db.transaction():
        if yeni_alis is not None or yeni_toptanci is not None:
            await db.execute(
                "UPDATE aksesuarlar SET stok = stok + $1, alis_fiyati = COALESCE($2, alis_fiyati), toptanci_id = COALESCE($3, toptanci_id) WHERE id=$4 AND dukkan_id=$5",
                miktar, float(yeni_alis) if yeni_alis is not None else None, yeni_toptanci, aksesuar_id, dukkan_id,
            )
        else:
            await db.execute(
                "UPDATE aksesuarlar SET stok = stok + $1 WHERE id=$2 AND dukkan_id=$3", miktar, aksesuar_id, dukkan_id
            )
        await _hareket_ekle(db, dukkan_id, aksesuar_id, "giris", miktar, user["id"], "toptanci_alim")
    return {"ok": True}


@router.delete("/{aksesuar_id}")
async def delete_aksesuar(
    aksesuar_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    satis_var_mi = await db.fetchval(
        "SELECT 1 FROM aksesuar_satislar WHERE aksesuar_id=$1 AND dukkan_id=$2 LIMIT 1", aksesuar_id, dukkan_id
    )
    if satis_var_mi:
        raise HTTPException(400, "Bu ürünün satış geçmişi var, silinemez")
    await db.execute("DELETE FROM aksesuarlar WHERE id = $1 AND dukkan_id = $2", aksesuar_id, dukkan_id)
    return {"ok": True}


@router.post("/{aksesuar_id}/sat")
async def sat_aksesuar(
    aksesuar_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    aks = await db.fetchrow("SELECT * FROM aksesuarlar WHERE id = $1 AND dukkan_id = $2", aksesuar_id, dukkan_id)
    if not aks:
        raise HTTPException(404, "Aksesuar bulunamadi")
    aks = dict(aks)
    miktar = int(body.get("miktar", 1))
    if miktar <= 0:
        raise HTTPException(400, "Adet sıfırdan büyük olmalı")
    if aks["stok"] < miktar:
        raise HTTPException(400, "Yetersiz stok")
    # Tutar artık her zaman sunucuda hesaplanıyor — önceden istemcinin
    # gönderdiği "toplam" olduğu gibi güveniliyordu, adet ile fiyat çarpımıyla
    # hiç karşılaştırılmıyordu.
    toplam = round(miktar * aks["satis_fiyati"], 2)
    tarih = body.get("tarih", date.today().isoformat())
    musteri_adi = body.get("musteri_adi") or ""
    musteri_telefon = body.get("musteri_telefon") or ""
    async with db.transaction():
        await db.execute(
            "UPDATE aksesuarlar SET stok = stok - $1 WHERE id = $2 AND dukkan_id = $3", miktar, aksesuar_id, dukkan_id
        )
        customer_id = await _musteri_bul_veya_olustur(db, dukkan_id, musteri_adi, musteri_telefon)
        row = await db.fetchrow(
            """INSERT INTO aksesuar_satislar (dukkan_id, aksesuar_id, miktar, toplam, musteri_adi, musteri_telefon, tarih, customer_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id""",
            dukkan_id, aksesuar_id, miktar, toplam, musteri_adi or None, musteri_telefon or None, tarih, customer_id,
        )
        await _hareket_ekle(db, dukkan_id, aksesuar_id, "cikis", -miktar, user["id"], "satis", row["id"])
        await kaydet_odeme(
            db, dukkan_id, body.get("odemeler"), toplam, "gelir", "aksesuar",
            f"Aksesuar: {aks['ad']} x{miktar}", user["id"],
            customer_id=customer_id, taksit_sayi=body.get("taksit_sayi") or 1, tarih=tarih,
        )
    return {"id": row["id"], "toplam": toplam}


@router.post("/toplu-sat")
async def toplu_sat(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    # Barkotla art arda taranan farklı ürünleri TEK müşteriye TEK satış olarak
    # kapatır — önceden her ürün ayrı ayrı satılmak zorundaydı, bu da aynı
    # müşteriye yapılan tek alışverişi kasada/borçta parça parça gösterirdi.
    kalemler = body.get("kalemler") or []
    if not kalemler:
        raise HTTPException(400, "Sepet boş")
    tarih = body.get("tarih", date.today().isoformat())
    musteri_adi = body.get("musteri_adi") or ""
    musteri_telefon = body.get("musteri_telefon") or ""

    async with db.transaction():
        customer_id = await _musteri_bul_veya_olustur(db, dukkan_id, musteri_adi, musteri_telefon)
        toplam_tutar = 0.0
        aciklamalar = []
        for kalem in kalemler:
            aksesuar_id = int(kalem["aksesuar_id"])
            miktar = int(kalem.get("miktar", 1))
            if miktar <= 0:
                raise HTTPException(400, "Adet sıfırdan büyük olmalı")
            aks = await db.fetchrow("SELECT * FROM aksesuarlar WHERE id=$1 AND dukkan_id=$2", aksesuar_id, dukkan_id)
            if not aks:
                raise HTTPException(404, "Sepetteki bir ürün bulunamadı")
            if aks["stok"] < miktar:
                raise HTTPException(400, f"{aks['ad']} için yetersiz stok")
            satir_tutar = round(miktar * aks["satis_fiyati"], 2)
            toplam_tutar += satir_tutar
            await db.execute(
                "UPDATE aksesuarlar SET stok = stok - $1 WHERE id=$2 AND dukkan_id=$3", miktar, aksesuar_id, dukkan_id
            )
            satis_row = await db.fetchrow(
                """INSERT INTO aksesuar_satislar (dukkan_id, aksesuar_id, miktar, toplam, musteri_adi, musteri_telefon, tarih, customer_id)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id""",
                dukkan_id, aksesuar_id, miktar, satir_tutar, musteri_adi or None, musteri_telefon or None, tarih, customer_id,
            )
            await _hareket_ekle(db, dukkan_id, aksesuar_id, "cikis", -miktar, user["id"], "satis", satis_row["id"])
            aciklamalar.append(f"{aks['ad']} x{miktar}")

        toplam_tutar = round(toplam_tutar, 2)
        await kaydet_odeme(
            db, dukkan_id, body.get("odemeler"), toplam_tutar, "gelir", "aksesuar",
            "Aksesuar (toplu): " + ", ".join(aciklamalar), user["id"],
            customer_id=customer_id, taksit_sayi=body.get("taksit_sayi") or 1, tarih=tarih,
        )
    return {"ok": True, "toplam": toplam_tutar, "urun_cesidi": len(kalemler)}


@router.post("/{kayit_id}/gorsel")
async def gorsel_yukle(
    kayit_id: int,
    dosya: UploadFile = File(...),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Vitrinde gosterilecek urun fotografi."""
    var_mi = await db.fetchval(
        "SELECT 1 FROM aksesuarlar WHERE id = $1 AND dukkan_id = $2", kayit_id, dukkan_id
    )
    if not var_mi:
        raise HTTPException(404, "Kayit bulunamadi")
    try:
        url, _, _ = await save_upload(dosya, "aksesuar", dukkan_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute(
        "UPDATE aksesuarlar SET gorsel_url = $1 WHERE id = $2 AND dukkan_id = $3",
        url, kayit_id, dukkan_id,
    )
    return {"url": url}
