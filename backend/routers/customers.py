import secrets
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db
from auth import get_current_user, get_dukkan_id, hash_sifre

router = APIRouter(prefix="/customers", tags=["customers"])

# sifre_hash ASLA istemciye gitmemeli (müşteri portalı şifresinin bcrypt
# hash'i) — bu yüzden SELECT * yerine açık kolon listesi kullanılıyor.
# portal_uye: müşteri kendi portal hesabını oluşturmuş mu.
_MUSTERI_KOLONLARI = """id, dukkan_id, name, phone, notes, visit_count,
       portal_kayit_at, dukkan_gordu, created_at,
       (sifre_hash IS NOT NULL) AS portal_uye"""

# Kara listeyle eşleşme customer_id üzerinden (varsa) veya telefonun sadece
# rakamlarının birebir aynı olmasıyla (format farkına dayanıklı) yapılır —
# ham ILIKE substring eşleşmesi "0555..." ile "555..." gibi yazımları
# kaçırıyordu.
_KARA_LISTE_ALT_SORGU = """EXISTS(
    SELECT 1 FROM kara_liste k WHERE k.dukkan_id = customers.dukkan_id
    AND (k.customer_id = customers.id
         OR (k.telefon IS NOT NULL AND customers.phone IS NOT NULL
             AND regexp_replace(k.telefon, '\\D', '', 'g') = regexp_replace(customers.phone, '\\D', '', 'g')
             AND regexp_replace(k.telefon, '\\D', '', 'g') != ''))
) AS is_blacklisted"""


@router.get("/")
async def list_customers(
    q: str = Query(None),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if q:
        rows = await db.fetch(
            f"""SELECT {_MUSTERI_KOLONLARI}, {_KARA_LISTE_ALT_SORGU} FROM customers
               WHERE dukkan_id = $1 AND (name ILIKE $2 OR phone ILIKE $2)
               ORDER BY created_at DESC LIMIT 50""",
            dukkan_id, f"%{q}%",
        )
    else:
        rows = await db.fetch(
            f"SELECT {_MUSTERI_KOLONLARI}, {_KARA_LISTE_ALT_SORGU} FROM customers WHERE dukkan_id = $1 ORDER BY created_at DESC LIMIT 100",
            dukkan_id,
        )
    return [dict(r) for r in rows]


@router.get("/yeni-uyeler")
async def yeni_uyeler(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Portalden kendisi kaydolmuş, dükkanın henüz görmediği müşteriler."""
    rows = await db.fetch(
        """SELECT id, name, phone, portal_kayit_at FROM customers
           WHERE dukkan_id = $1 AND portal_kayit_at IS NOT NULL AND dukkan_gordu = false
           ORDER BY portal_kayit_at DESC""",
        dukkan_id,
    )
    return {"sayi": len(rows), "musteriler": [dict(r) for r in rows]}


@router.post("/yeni-uyeleri-gordum")
async def yeni_uyeleri_gordum(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE customers SET dukkan_gordu = true WHERE dukkan_id = $1 AND dukkan_gordu = false",
        dukkan_id,
    )
    return {"ok": True}


@router.get("/{customer_id}")
async def get_customer(
    customer_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        f"SELECT {_MUSTERI_KOLONLARI}, {_KARA_LISTE_ALT_SORGU} FROM customers WHERE id = $1 AND dukkan_id = $2",
        customer_id, dukkan_id,
    )
    if not row:
        raise HTTPException(404, "Musteri bulunamadi")
    musteri = dict(row)
    if musteri["is_blacklisted"]:
        kara = await db.fetchrow(
            """SELECT id, sebep, kategori FROM kara_liste
               WHERE dukkan_id=$1 AND (customer_id=$2
                     OR (telefon IS NOT NULL AND $3::text IS NOT NULL
                         AND regexp_replace(telefon, '\\D', '', 'g') = regexp_replace($3, '\\D', '', 'g')
                         AND regexp_replace(telefon, '\\D', '', 'g') != ''))
               ORDER BY created_at DESC LIMIT 1""",
            dukkan_id, customer_id, musteri.get("phone"),
        )
        if kara:
            musteri["kara_liste_id"] = kara["id"]
            musteri["kara_liste_sebep"] = kara["sebep"]
            musteri["kara_liste_kategori"] = kara["kategori"]
    return musteri


@router.post("/")
async def create_customer(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "INSERT INTO customers (dukkan_id, name, phone, notes) VALUES ($1, $2, $3, $4) RETURNING id",
        dukkan_id, body["name"], body.get("phone"), body.get("notes"),
    )
    return {"id": row["id"]}


@router.put("/{customer_id}")
async def update_customer(
    customer_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        """UPDATE customers SET name=$1, phone=$2, notes=$3
           WHERE id=$4 AND dukkan_id=$5""",
        body["name"], body.get("phone"), body.get("notes"), customer_id, dukkan_id,
    )
    return {"ok": True}


@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    await db.execute("DELETE FROM customers WHERE id = $1 AND dukkan_id = $2", customer_id, dukkan_id)
    return {"ok": True}


@router.get("/{customer_id}/ikinciel")
async def customer_ikinciel(
    customer_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT name FROM customers WHERE id = $1 AND dukkan_id = $2", customer_id, dukkan_id
    )
    if not row:
        raise HTTPException(404, "Musteri bulunamadi")
    name = row["name"]
    # Kimden = aldığımız cihaz (bize sattı), musteri_adi = sattığımız (müşteri satın aldı)
    rows = await db.fetch(
        """SELECT *, 'alim' as yon FROM ikinci_el WHERE dukkan_id = $1 AND LOWER(kimden) = LOWER($2)
           UNION ALL
           SELECT *, 'satim' as yon FROM ikinci_el WHERE dukkan_id = $1 AND LOWER(musteri_adi) = LOWER($2)
           ORDER BY created_at DESC""",
        dukkan_id, name,
    )
    return [dict(r) for r in rows]


@router.get("/{customer_id}/gecmis")
async def customer_gecmis(
    customer_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT name, phone FROM customers WHERE id = $1 AND dukkan_id = $2", customer_id, dukkan_id
    )
    if not row:
        raise HTTPException(404, "Musteri bulunamadi")
    name = row["name"]
    phone = row["phone"] or ""

    events = []

    # Tamirler
    rows = await db.fetch(
        "SELECT * FROM repairs WHERE customer_id = $1 AND dukkan_id = $2 ORDER BY created_at DESC",
        customer_id, dukkan_id,
    )
    for r in rows:
        r = dict(r)
        events.append({
            "tur": "tamir", "ikon": "🔧",
            "baslik": r["device_model"],
            "alt": r.get("fault_desc") or "",
            "tutar": r.get("final_price") or r.get("estimated_price"),
            "tarih": r.get("created_at"),
            "tamirde_at": r.get("tamirde_at"),
            "completed_at": r.get("completed_at"),
            "delivered_at": r.get("delivered_at"),
            "repair_id": r["id"],
            "repair_no": r.get("repair_no"),
            "durum": r.get("status"),
        })

    # Borçlar
    rows = await db.fetch(
        "SELECT * FROM debts WHERE customer_id = $1 AND dukkan_id = $2 ORDER BY created_at DESC",
        customer_id, dukkan_id,
    )
    for d in rows:
        d = dict(d)
        events.append({
            "tur": "borc", "ikon": "💰",
            "baslik": d.get("description") or d.get("notes") or "Borç",
            "alt": f"Toplam: {d.get('total_amount') or d.get('amount') or 0}₺",
            "tutar": d.get("total_amount") or d.get("amount"),
            "tarih": d.get("created_at"),
        })

    # 2.El — bize sattı (kimden)
    if phone:
        rows = await db.fetch(
            """SELECT * FROM ikinci_el WHERE dukkan_id = $1 AND (LOWER(kimden) = LOWER($2)
               OR (kimden_telefon IS NOT NULL AND kimden_telefon != '' AND kimden_telefon = $3))""",
            dukkan_id, name, phone,
        )
    else:
        rows = await db.fetch(
            "SELECT * FROM ikinci_el WHERE dukkan_id = $1 AND LOWER(kimden) = LOWER($2)",
            dukkan_id, name,
        )
    for c in rows:
        c = dict(c)
        events.append({
            "tur": "2el_alim", "ikon": "📲",
            "baslik": c["model"],
            "alt": f"Bize sattı · IMEI: {c.get('imei') or '—'}",
            "tutar": c.get("alis_fiyati"),
            "tarih": c.get("alis_tarihi") or c.get("created_at"),
            "detay": {
                "model": c["model"], "imei": c.get("imei"),
                "renk": c.get("renk"), "depolama": c.get("depolama"), "ram": c.get("ram"),
                "durum_aciklama": c.get("ozellikler"), "notlar": c.get("notlar"),
                "kimden": c.get("kimden"), "aksesuarlar": c.get("aksesuarlar"),
            },
        })

    # 2.El — bizden aldı (musteri_adi)
    if phone:
        rows = await db.fetch(
            """SELECT * FROM ikinci_el WHERE dukkan_id = $1 AND (LOWER(musteri_adi) = LOWER($2)
               OR (musteri_telefon IS NOT NULL AND musteri_telefon != '' AND musteri_telefon = $3))""",
            dukkan_id, name, phone,
        )
    else:
        rows = await db.fetch(
            "SELECT * FROM ikinci_el WHERE dukkan_id = $1 AND LOWER(musteri_adi) = LOWER($2)",
            dukkan_id, name,
        )
    for c in rows:
        c = dict(c)
        events.append({
            "tur": "2el_satim", "ikon": "📱",
            "baslik": c["model"],
            "alt": f"Satın aldı · IMEI: {c.get('imei') or '—'}",
            "tutar": c.get("satis_fiyati"),
            "tarih": c.get("satis_tarihi") or c.get("created_at"),
            "detay": {
                "model": c["model"], "imei": c.get("imei"),
                "renk": c.get("renk"), "depolama": c.get("depolama"), "ram": c.get("ram"),
                "durum_aciklama": c.get("ozellikler"), "notlar": c.get("notlar"),
                "satis_kanali": c.get("satis_kanali"), "aksesuarlar": c.get("aksesuarlar"),
            },
        })

    # Sıfır — bize sattı
    if phone:
        rows = await db.fetch(
            """SELECT * FROM sifir_cihazlar WHERE dukkan_id = $1 AND (LOWER(kimden) = LOWER($2)
               OR (kimden_telefon IS NOT NULL AND kimden_telefon != '' AND kimden_telefon = $3))""",
            dukkan_id, name, phone,
        )
    else:
        rows = await db.fetch(
            "SELECT * FROM sifir_cihazlar WHERE dukkan_id = $1 AND LOWER(kimden) = LOWER($2)",
            dukkan_id, name,
        )
    for c in rows:
        c = dict(c)
        events.append({
            "tur": "sifir_alim", "ikon": "📦",
            "baslik": c["model"],
            "alt": f"Sıfır cihaz · Bize sattı",
            "tutar": c.get("alis_fiyati"),
            "tarih": c.get("alis_tarihi") or c.get("created_at"),
            "detay": {
                "model": c["model"], "imei": c.get("imei"),
                "renk": c.get("renk"), "depolama": c.get("depolama"),
                "notlar": c.get("notlar"), "kimden": c.get("kimden"), "aksesuarlar": c.get("aksesuarlar"),
            },
        })

    # Sıfır — bizden aldı
    if phone:
        rows = await db.fetch(
            """SELECT * FROM sifir_cihazlar WHERE dukkan_id = $1 AND (LOWER(musteri_adi) = LOWER($2)
               OR (musteri_telefon IS NOT NULL AND musteri_telefon != '' AND musteri_telefon = $3))""",
            dukkan_id, name, phone,
        )
    else:
        rows = await db.fetch(
            "SELECT * FROM sifir_cihazlar WHERE dukkan_id = $1 AND LOWER(musteri_adi) = LOWER($2)",
            dukkan_id, name,
        )
    for c in rows:
        c = dict(c)
        events.append({
            "tur": "sifir_satim", "ikon": "📦",
            "baslik": c["model"],
            "alt": f"Sıfır cihaz · Satın aldı",
            "tutar": c.get("satis_fiyati"),
            "tarih": c.get("satis_tarihi") or c.get("created_at"),
            "detay": {
                "model": c["model"], "imei": c.get("imei"),
                "renk": c.get("renk"), "depolama": c.get("depolama"),
                "notlar": c.get("notlar"), "satis_kanali": c.get("satis_kanali"), "aksesuarlar": c.get("aksesuarlar"),
            },
        })

    # Aksesuar satışları — customer_id bağlantısı DB'de vardı ama personel
    # tarafındaki bu geçmiş sayfası hiç sorgulamıyordu, müşteri portalında
    # ("Satın Aldıklarım") görünse de personel burada göremiyordu.
    if phone:
        rows = await db.fetch(
            """SELECT s.*, a.ad as urun_adi FROM aksesuar_satislar s
               LEFT JOIN aksesuarlar a ON a.id = s.aksesuar_id
               WHERE s.dukkan_id = $1 AND (s.customer_id = $2 OR LOWER(s.musteri_adi) = LOWER($3)
                     OR (s.musteri_telefon IS NOT NULL AND s.musteri_telefon != '' AND s.musteri_telefon = $4))""",
            dukkan_id, customer_id, name, phone,
        )
    else:
        rows = await db.fetch(
            """SELECT s.*, a.ad as urun_adi FROM aksesuar_satislar s
               LEFT JOIN aksesuarlar a ON a.id = s.aksesuar_id
               WHERE s.dukkan_id = $1 AND (s.customer_id = $2 OR LOWER(s.musteri_adi) = LOWER($3))""",
            dukkan_id, customer_id, name,
        )
    for c in rows:
        c = dict(c)
        events.append({
            "tur": "aksesuar_satis", "ikon": "🎧",
            "baslik": c.get("urun_adi") or "Aksesuar",
            "alt": f"Aksesuar · {c['miktar']} adet",
            "tutar": c.get("toplam"),
            "tarih": c.get("tarih") or c.get("created_at"),
        })

    events.sort(key=lambda x: x.get("tarih") or "", reverse=True)
    return events


@router.get("/{customer_id}/repairs")
async def customer_repairs(
    customer_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT r.*, u.ad as assigned_name,
                  (SELECT STRING_AGG(p.name, ', ') FROM repair_parts rp
                   JOIN parts p ON p.id = rp.part_id WHERE rp.repair_id = r.id) AS kullanilan_parcalar
           FROM repairs r
           LEFT JOIN kullanicilar u ON r.assigned_to = u.id
           WHERE r.customer_id = $1 AND r.dukkan_id = $2
           ORDER BY r.created_at DESC""",
        customer_id, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/{customer_id}/portal-sifre")
async def customer_portal_sifre_belirle(
    customer_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Müşteri portalı hesabı oluşturur (sifre_hash boşsa) veya unutulan
    şifreyi sıfırlar (zaten varsa) — SMS/e-posta doğrulama altyapısı
    olmadığından dükkan tarafı telefon numarasını zaten bildiği/gördüğü için
    kendisi başlatıyor. Üretilen geçici şifre SADECE burada bir kez döner,
    kaydedilmez — personel müşteriye kendisi iletir (WhatsApp vb.)."""
    row = await db.fetchrow(
        "SELECT id, name, phone, sifre_hash FROM customers WHERE id=$1 AND dukkan_id=$2",
        customer_id, dukkan_id,
    )
    if not row:
        raise HTTPException(404, "Müşteri bulunamadı")
    if not row["phone"]:
        raise HTTPException(400, "Portal hesabı için müşterinin telefon numarası kayıtlı olmalı")
    yeni_hesap = row["sifre_hash"] is None
    gecici = secrets.token_urlsafe(9)
    await db.execute("UPDATE customers SET sifre_hash=$1 WHERE id=$2", hash_sifre(gecici), customer_id)
    return {"ok": True, "phone": row["phone"], "gecici_sifre": gecici, "yeni_hesap": yeni_hesap}
