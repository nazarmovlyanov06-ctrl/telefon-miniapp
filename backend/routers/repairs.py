import json
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db
from auth import get_current_user, get_dukkan_id
from photo_storage import save_photo, delete_photo
from odeme_yardimci import kaydet_odeme
import datetime

router = APIRouter(prefix="/repairs", tags=["repairs"])

# Durum akışı: hangi durumdan hangilerine doğrudan geçilebilir. "bekliyor"dan
# doğrudan "hazir"/"teslim"e atlanamaz — önce "tamirde"den geçmesi gerekir.
# "iptal" (teslim hariç) her aktif durumdan erişilebilir; "teslim"/"iptal"
# son durumlardır, oradan başka bir yere geçilemez.
DURUM_SIRASI = {
    "bekliyor": {"tamirde", "iptal"},
    "tamirde": {"parca_bekleniyor", "hazir", "iptal"},
    "parca_bekleniyor": {"tamirde", "hazir", "iptal"},
    "hazir": {"teslim", "tamirde", "iptal"},
    "teslim": set(),
    "iptal": set(),
}
DURUM_LABEL_TR = {
    "bekliyor": "Bekliyor", "tamirde": "Tamirde", "parca_bekleniyor": "Parça Bekleniyor",
    "hazir": "Hazır", "teslim": "Teslim Edildi", "iptal": "İptal",
}

def make_repair_no(last_id: int) -> str:
    today = datetime.date.today().strftime("%y%m%d")
    return f"T{today}{last_id + 1:04d}"


async def _bildirim_ekle(db, dukkan_id, customer_id, repair_id, baslik, mesaj):
    if not customer_id or not mesaj:
        return
    await db.execute(
        "INSERT INTO musteri_bildirimleri (dukkan_id, customer_id, repair_id, baslik, mesaj) VALUES ($1,$2,$3,$4,$5)",
        dukkan_id, customer_id, repair_id, baslik, mesaj,
    )


def _durum_gecisi_dogrula(eski_durum: str, yeni_durum: str):
    if yeni_durum == eski_durum:
        return
    if yeni_durum not in DURUM_SIRASI.get(eski_durum, set()):
        raise HTTPException(
            400,
            f"'{DURUM_LABEL_TR.get(eski_durum, eski_durum)}' durumundan "
            f"'{DURUM_LABEL_TR.get(yeni_durum, yeni_durum)}' durumuna doğrudan geçilemez",
        )


@router.get("/")
async def list_repairs(
    status: str = Query(None),
    q: str = Query(None),
    limit: int = Query(50),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    where = ["r.dukkan_id = $1"]
    params = [dukkan_id]
    if status == "aktif":
        # Ana Sayfa'daki "Aktif Tamir" önizlemesi için — teslim edilmemiş
        # ve iptal edilmemiş tüm durumları (bekliyor/tamirde/parça bekleniyor/hazır) kapsar.
        where.append("r.status NOT IN ('teslim', 'iptal')")
    elif status:
        params.append(status)
        where.append(f"r.status = ${len(params)}")
    if q:
        params.append(f"%{q}%")
        idx = len(params)
        where.append(
            f"(c.name ILIKE ${idx} OR r.device_model ILIKE ${idx} OR r.repair_no ILIKE ${idx} OR r.imei ILIKE ${idx})"
        )

    where_sql = "WHERE " + " AND ".join(where)
    params.append(limit)
    rows = await db.fetch(
        f"""SELECT r.*, c.name as customer_name, c.phone as customer_phone,
                   u.ad as assigned_name
            FROM repairs r
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN kullanicilar u ON r.assigned_to = u.id
            {where_sql}
            ORDER BY r.created_at DESC
            LIMIT ${len(params)}""",
        *params,
    )
    return [dict(r) for r in rows]


@router.get("/modeller")
async def get_modeller(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT device_model, COUNT(*) as c FROM repairs
           WHERE dukkan_id = $1 AND device_model IS NOT NULL AND device_model != ''
           GROUP BY LOWER(TRIM(device_model)) ORDER BY c DESC LIMIT 30""",
        dukkan_id,
    )
    return [r["device_model"] for r in rows]


@router.get("/ariza-onceriler")
async def get_ariza_onceriler(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT MIN(fault_desc) as fault_desc, COUNT(*) as c FROM repairs
           WHERE dukkan_id = $1 AND fault_desc IS NOT NULL AND fault_desc != ''
           GROUP BY LOWER(TRIM(fault_desc)) ORDER BY c DESC LIMIT 20""",
        dukkan_id,
    )
    return [r["fault_desc"] for r in rows]


@router.get("/{repair_id}")
async def get_repair(
    repair_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """SELECT r.*, c.name as customer_name, c.phone as customer_phone,
                  u.ad as son_guncelleyen_adi
           FROM repairs r
           LEFT JOIN customers c ON r.customer_id = c.id
           LEFT JOIN kullanicilar u ON u.id = r.son_guncelleyen_id
           WHERE r.id = $1 AND r.dukkan_id = $2""",
        repair_id, dukkan_id,
    )
    if not row:
        raise HTTPException(404, "Tamir bulunamadi")
    return dict(row)


@router.post("/")
async def create_repair(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT COALESCE(MAX(id), 0) as m FROM repairs WHERE dukkan_id = $1", dukkan_id
    )
    repair_no = make_repair_no(row["m"])

    customer_id = body.get("customer_id")
    if not customer_id and body.get("customer_name"):
        # Önce aynı isimli müşteri var mı bak
        phone = body.get("customer_phone") or ""
        if phone:
            existing = await db.fetchrow(
                "SELECT id FROM customers WHERE dukkan_id = $1 AND phone = $2", dukkan_id, phone
            )
        else:
            existing = await db.fetchrow(
                "SELECT id FROM customers WHERE dukkan_id = $1 AND name = $2",
                dukkan_id, body["customer_name"],
            )
        if existing:
            customer_id = existing["id"]
        else:
            new_cust = await db.fetchrow(
                "INSERT INTO customers (dukkan_id, name, phone) VALUES ($1, $2, $3) RETURNING id",
                dukkan_id, body["customer_name"], body.get("customer_phone"),
            )
            customer_id = new_cust["id"]

    # Müşteri ziyaret sayısını güncelle
    if customer_id:
        await db.execute(
            "UPDATE customers SET visit_count = COALESCE(visit_count, 0) + 1 WHERE id = $1 AND dukkan_id = $2",
            customer_id, dukkan_id,
        )

    new_repair = await db.fetchrow(
        """INSERT INTO repairs
           (dukkan_id, repair_no, customer_id, device_model, imei, fault_desc,
            estimated_price, status, assigned_to, notes, created_by,
            screen_lock_type, screen_lock_value, tahmini_teslim_tarihi)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'bekliyor', $8, $9, $10, $11, $12, $13)
           RETURNING id""",
        dukkan_id,
        repair_no,
        customer_id,
        body["device_model"],
        body.get("imei"),
        body["fault_desc"],
        body.get("estimated_price"),
        body.get("assigned_to"),
        body.get("notes"),
        user["id"],
        body.get("screen_lock_type"),
        body.get("screen_lock_value"),
        body.get("tahmini_teslim_tarihi") or None,
    )
    return {"id": new_repair["id"], "repair_no": repair_no}


@router.put("/{repair_id}")
async def update_repair(
    repair_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    mevcut = await db.fetchrow(
        "SELECT repair_no, device_model, status, customer_id FROM repairs WHERE id = $1 AND dukkan_id = $2",
        repair_id, dukkan_id,
    )
    if not mevcut:
        raise HTTPException(404, "Tamir bulunamadı")
    repair_no = mevcut["repair_no"] or ""
    eski_durum = mevcut["status"]
    yeni_durum = body.get("status") or eski_durum
    durum_degisiyor = yeni_durum != eski_durum
    if durum_degisiyor:
        _durum_gecisi_dogrula(eski_durum, yeni_durum)

    now = datetime.datetime.now()
    tamirde_at = now if yeni_durum == "tamirde" else None
    completed_at = now if yeni_durum == "hazir" else None
    delivered_at = now if yeni_durum == "teslim" else None
    tahmini_teslim_tarihi = body.get("tahmini_teslim_tarihi") or None

    # "Kime teslim edildi" — sadece bu çağrı teslim'e geçiriyorsa kaydedilir,
    # aksi halde mevcut durum_detay korunur (aşağıda COALESCE ile).
    yeni_durum_detay = None
    if durum_degisiyor and yeni_durum == "teslim":
        yeni_durum_detay = json.dumps({
            "teslim_alan_ad": body.get("teslim_alan_ad") or None,
            "teslim_alan_tel": body.get("teslim_alan_tel") or None,
        }, ensure_ascii=False)

    await db.execute(
        """UPDATE repairs SET
           device_model=$1, fault_desc=$2, status=$3, estimated_price=$4,
           final_price=$5, payment_type=$6, paid_amount=$7,
           warranty_days=$8, assigned_to=$9, notes=$10,
           screen_lock_type=COALESCE($11, screen_lock_type),
           screen_lock_value=COALESCE($12, screen_lock_value),
           tamirde_at=COALESCE(tamirde_at, $13),
           completed_at=COALESCE(completed_at, $14),
           delivered_at=COALESCE($15, delivered_at),
           durum_detay=COALESCE($16::jsonb, durum_detay),
           son_guncelleyen_id=$17,
           tahmini_teslim_tarihi=COALESCE($18, tahmini_teslim_tarihi),
           updated_at=now()
           WHERE id=$19 AND dukkan_id=$20""",
        body.get("device_model"),
        body.get("fault_desc"),
        yeni_durum,
        body.get("estimated_price"),
        body.get("final_price"),
        body.get("payment_type"),
        body.get("paid_amount", 0),
        body.get("warranty_days", 0),
        body.get("assigned_to"),
        body.get("notes"),
        body.get("screen_lock_type"),
        body.get("screen_lock_value"),
        tamirde_at,
        completed_at,
        delivered_at,
        yeni_durum_detay,
        user["id"],
        tahmini_teslim_tarihi,
        repair_id,
        dukkan_id,
    )

    if yeni_durum == "teslim":
        final = float(body.get("final_price") or 0)
        if final > 0:
            cihaz = body.get("device_model", "")
            aciklama = f"Tamir #{repair_no} {cihaz}".strip()
            # Karma ödeme: "bir kısmı nakit, bir kısmı kart, kalanı borç"
            # gibi ihtiyaçlar için tek satırlık payment_type yerine ödeme
            # satırları listesi kullanılıyor — kalan otomatik borca gider.
            await kaydet_odeme(
                db, dukkan_id, body.get("odemeler"), final, "gelir", "tamir", aciklama, user["id"],
                customer_id=mevcut["customer_id"], taksit_sayi=body.get("taksit_sayi") or 1,
            )

    if durum_degisiyor and yeni_durum == "teslim":
        kime = body.get("teslim_alan_ad") or "size"
        await _bildirim_ekle(
            db, dukkan_id, mevcut["customer_id"], repair_id,
            "Cihazınız teslim edildi",
            f"#{repair_no} numaralı tamiriniz {kime} teslim edildi.",
        )

    return {"ok": True}


@router.patch("/{repair_id}/intake")
async def update_repair_intake(
    repair_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Cihaz teslim alma muayenesi (gelen aksesuarlar + çalışan/çalışmayan
    fonksiyonlar + cihaz açılmıyorsa 'kapalı' notu + ön ödeme alındı mı) —
    onaylanmadıkça değiştirilebilir (bkz. onayla_repair_intake). Yanlışlıkla
    onaylandıysa patron `kilit-ac` ile tekrar açabilir, bkz. o endpoint."""
    mevcut = await db.fetchrow(
        "SELECT intake_onaylandi FROM repairs WHERE id=$1 AND dukkan_id=$2", repair_id, dukkan_id
    )
    if not mevcut:
        raise HTTPException(404, "Tamir bulunamadı")
    if mevcut["intake_onaylandi"]:
        raise HTTPException(400, "Muayene onaylandı, değiştirmek için önce kilidi açın")

    fonksiyonlar = json.dumps(body["fonksiyonlar"], ensure_ascii=False) if "fonksiyonlar" in body else None
    aksesuarlar = json.dumps(body["aksesuarlar"], ensure_ascii=False) if "aksesuarlar" in body else None
    on_odeme = (1 if body.get("on_odeme") else 0) if "on_odeme" in body else None
    await db.execute(
        """UPDATE repairs SET
           intake_kapali = COALESCE($1, intake_kapali),
           intake_notu = COALESCE($2, intake_notu),
           intake_fonksiyonlar = COALESCE($3::jsonb, intake_fonksiyonlar),
           intake_aksesuarlar = COALESCE($4::jsonb, intake_aksesuarlar),
           on_odeme = COALESCE($5, on_odeme),
           updated_at = now()
           WHERE id=$6 AND dukkan_id=$7""",
        body.get("kapali"), body.get("notu"), fonksiyonlar, aksesuarlar, on_odeme, repair_id, dukkan_id,
    )
    return {"ok": True}


@router.post("/{repair_id}/intake/onayla")
async def onayla_repair_intake(
    repair_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow("SELECT 1 FROM repairs WHERE id=$1 AND dukkan_id=$2", repair_id, dukkan_id)
    if not row:
        raise HTTPException(404, "Tamir bulunamadı")
    await db.execute(
        "UPDATE repairs SET intake_onaylandi = true, updated_at = now() WHERE id=$1 AND dukkan_id=$2",
        repair_id, dukkan_id,
    )
    return {"ok": True}


@router.post("/{repair_id}/intake/kilit-ac")
async def kilit_ac_repair_intake(
    repair_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Yanlışlıkla onaylanan muayeneyi tekrar düzenlenebilir yapar —
    sadece patron açabilir, personel yanlışlıkla kendi onayını iptal edip
    değiştirmesin diye."""
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron muayene kilidini açabilir")
    row = await db.fetchrow("SELECT 1 FROM repairs WHERE id=$1 AND dukkan_id=$2", repair_id, dukkan_id)
    if not row:
        raise HTTPException(404, "Tamir bulunamadı")
    await db.execute(
        "UPDATE repairs SET intake_onaylandi = false, updated_at = now() WHERE id=$1 AND dukkan_id=$2",
        repair_id, dukkan_id,
    )
    return {"ok": True}


@router.patch("/{repair_id}/status")
async def update_repair_status(
    repair_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    # Sadece durumu değiştirir — tam PUT /repairs/{id} tüm alanları (fiyat,
    # arıza vb.) body.get(...) ile üzerine yazdığı için, listeden veya
    # detaydan tek tuşla hızlı durum değişikliğinde diğer alanları
    # boşaltmaması için ayrı ve dar kapsamlı bir endpoint.
    status = body.get("status")
    if not status:
        raise HTTPException(400, "status gerekli")

    mevcut = await db.fetchrow(
        "SELECT status, customer_id, intake_onaylandi FROM repairs WHERE id=$1 AND dukkan_id=$2",
        repair_id, dukkan_id,
    )
    if not mevcut:
        raise HTTPException(404, "Tamir bulunamadı")
    eski_durum = mevcut["status"]
    if status == eski_durum:
        return {"ok": True}

    # "Geri Al" bildirimi (RepairDetail.jsx) yanlışlıkla tıklanan bir durumu
    # birkaç saniye içinde düzeltmek için akış kurallarını atlar — bu normal
    # akıştan farklı, kullanıcının kendi az önceki hatasını düzeltmesi.
    zorla = bool(body.get("zorla"))
    if not zorla:
        _durum_gecisi_dogrula(eski_durum, status)
        if eski_durum == "bekliyor" and status == "tamirde":
            if not mevcut["intake_onaylandi"]:
                raise HTTPException(400, "Tamire almadan önce cihaz muayenesini tamamlayıp onaylayın")

    now = datetime.datetime.now()
    tamirde_at = now if status == "tamirde" else None
    completed_at = now if status == "hazir" else None

    if status == "iptal":
        iade = body.get("iade") or {}
        durum_detay = json.dumps({
            "iade_kalemler": iade.get("kalemler") or {},
            "iade_kime_ad": iade.get("kime_ad") or None,
            "iade_kime_tel": iade.get("kime_tel") or None,
            "aciklama": iade.get("aciklama") or None,
        }, ensure_ascii=False)
        await db.execute(
            """UPDATE repairs SET status=$1, durum_detay=$2::jsonb,
               son_guncelleyen_id=$3, updated_at=now()
               WHERE id=$4 AND dukkan_id=$5""",
            status, durum_detay, user["id"], repair_id, dukkan_id,
        )
        kime = iade.get("kime_ad") or "size"
        mesaj = f"Tamir talebiniz iptal edildi. Cihaz {kime} teslim edildi."
    elif status == "parca_bekleniyor":
        parca = body.get("parca_bilgisi") or {}
        durum_detay = json.dumps({
            "parca_adi": parca.get("ad") or None,
            "tahmini_tarih": parca.get("tahmini_tarih") or None,
            "not": parca.get("not") or None,
        }, ensure_ascii=False) if parca else None
        await db.execute(
            """UPDATE repairs SET status=$1, durum_detay=COALESCE($2::jsonb, durum_detay),
               son_guncelleyen_id=$3, updated_at=now()
               WHERE id=$4 AND dukkan_id=$5""",
            status, durum_detay, user["id"], repair_id, dukkan_id,
        )
        parca_adi = parca.get("ad")
        mesaj = f"Cihazınız için {parca_adi} bekleniyor." if parca_adi else "Cihazınız için parça bekleniyor."
    else:
        await db.execute(
            """UPDATE repairs SET
               status=$1,
               tamirde_at=COALESCE(tamirde_at, $2),
               completed_at=COALESCE(completed_at, $3),
               son_guncelleyen_id=$4,
               updated_at=now()
               WHERE id=$5 AND dukkan_id=$6""",
            status, tamirde_at, completed_at, user["id"], repair_id, dukkan_id,
        )
        mesaj = {
            "tamirde": "Cihazınız tamire alındı, çalışmalara başlandı.",
            "hazir": "Cihazınız hazır! Servisimizden teslim alabilirsiniz.",
        }.get(status)

    if not zorla:
        baslik = f"Durum güncellendi: {DURUM_LABEL_TR.get(status, status)}"
        await _bildirim_ekle(db, dukkan_id, mevcut["customer_id"], repair_id, baslik, mesaj)
    return {"ok": True}


@router.patch("/{repair_id}/parca-bilgisi")
async def update_repair_parca_bilgisi(
    repair_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """'Parça Bekleniyor' durumundayken hangi parçanın beklendiğini
    düzenlemek için — bir durum değişikliği değil, bu yüzden PATCH
    /status'un "aynı duruma geçiş" erken dönüşüne takılmaması için ayrı."""
    mevcut = await db.fetchrow("SELECT status FROM repairs WHERE id=$1 AND dukkan_id=$2", repair_id, dukkan_id)
    if not mevcut:
        raise HTTPException(404, "Tamir bulunamadı")
    if mevcut["status"] != "parca_bekleniyor":
        raise HTTPException(400, "Bu bilgi sadece 'Parça Bekleniyor' durumundayken düzenlenebilir")
    durum_detay = json.dumps({
        "parca_adi": body.get("ad") or None,
        "tahmini_tarih": body.get("tahmini_tarih") or None,
        "not": body.get("not") or None,
    }, ensure_ascii=False)
    await db.execute(
        "UPDATE repairs SET durum_detay=$1::jsonb, updated_at=now() WHERE id=$2 AND dukkan_id=$3",
        durum_detay, repair_id, dukkan_id,
    )
    return {"ok": True}


@router.delete("/{repair_id}")
async def delete_repair(
    repair_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    await db.execute("DELETE FROM repairs WHERE id = $1 AND dukkan_id = $2", repair_id, dukkan_id)
    return {"ok": True}


# ── KULLANILAN PARÇALAR ─────────────────────────────────────────────────

@router.get("/{repair_id}/parcalar")
async def get_repair_parcalar(
    repair_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT rp.id, rp.part_id, rp.quantity, rp.unit_price,
                  p.name, p.category
           FROM repair_parts rp
           JOIN parts p ON rp.part_id = p.id
           WHERE rp.repair_id = $1 AND rp.dukkan_id = $2
           ORDER BY rp.id""",
        repair_id, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/{repair_id}/parcalar")
async def add_repair_parca(
    repair_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    part_id = body.get("part_id")
    adet = int(body.get("quantity", 1))
    if not part_id or adet < 1:
        raise HTTPException(400, "Geçersiz parça veya adet")

    part = await db.fetchrow(
        "SELECT quantity, sale_price, name FROM parts WHERE id = $1 AND dukkan_id = $2",
        part_id, dukkan_id,
    )
    if not part:
        raise HTTPException(404, "Parça bulunamadı")
    stok = part["quantity"] or 0
    if stok < adet:
        raise HTTPException(400, f"Stok yetersiz (mevcut: {stok})")

    birim_fiyat = float(body.get("unit_price") or part["sale_price"] or 0)
    await db.execute(
        "INSERT INTO repair_parts (dukkan_id, repair_id, part_id, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)",
        dukkan_id, repair_id, part_id, adet, birim_fiyat,
    )
    await db.execute(
        "UPDATE parts SET quantity = quantity - $1 WHERE id = $2 AND dukkan_id = $3",
        adet, part_id, dukkan_id,
    )
    return {"ok": True}


@router.delete("/{repair_id}/parcalar/{rp_id}")
async def remove_repair_parca(
    repair_id: int,
    rp_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT part_id, quantity FROM repair_parts WHERE id = $1 AND repair_id = $2 AND dukkan_id = $3",
        rp_id, repair_id, dukkan_id,
    )
    if not row:
        raise HTTPException(404)
    await db.execute(
        "UPDATE parts SET quantity = quantity + $1 WHERE id = $2 AND dukkan_id = $3",
        row["quantity"], row["part_id"], dukkan_id,
    )
    await db.execute("DELETE FROM repair_parts WHERE id = $1 AND dukkan_id = $2", rp_id, dukkan_id)
    return {"ok": True}


# ── TAMİR FOTOĞRAFLARI ─────────────────────────────────────────────────

@router.get("/{repair_id}/fotolar")
async def get_repair_fotolar(
    repair_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT id, foto, aciklama, created_at FROM tamir_fotograflari WHERE repair_id = $1 AND dukkan_id = $2 ORDER BY created_at",
        repair_id, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/{repair_id}/fotolar")
async def add_repair_foto(
    repair_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    foto = body.get("foto", "")
    if not foto:
        raise HTTPException(400, "Fotoğraf verisi gerekli")
    try:
        foto_path = save_photo(foto, "repairs", repair_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.execute(
        "INSERT INTO tamir_fotograflari (dukkan_id, repair_id, foto, aciklama) VALUES ($1, $2, $3, $4)",
        dukkan_id, repair_id, foto_path, body.get("aciklama"),
    )
    return {"ok": True}


@router.delete("/{repair_id}/fotolar/{foto_id}")
async def delete_repair_foto(
    repair_id: int,
    foto_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT foto FROM tamir_fotograflari WHERE id = $1 AND repair_id = $2 AND dukkan_id = $3",
        foto_id, repair_id, dukkan_id,
    )
    await db.execute(
        "DELETE FROM tamir_fotograflari WHERE id = $1 AND repair_id = $2 AND dukkan_id = $3",
        foto_id, repair_id, dukkan_id,
    )
    if row:
        delete_photo(row["foto"])
    return {"ok": True}
