import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db
from auth import get_current_user, get_dukkan_id
from typing import Optional
from datetime import date
from odeme_yardimci import BILINEN_GELIR_KAYNAK

# alacak tipi borçlarda source_type artık doğrudan kasa 'kaynak' değeriyle
# aynı isimle yazılıyor (bkz. odeme_yardimci.kaydet_odeme) — satışın kısmen
# ödenmiş kısmı satış anında zaten kasaya yazılıyor, kalan tutar burada
# 'alacak' olarak bekliyor; ileride tahsil edilince aynı gelir kaynağına
# sayılmalı ki kasa dökümü satış anında seçilen kaynaktan sapmasın.
# "manuel" oluşturulan alacaklar tanınmayan kaynak olduğu için "Diğer"e düşer.

router = APIRouter(prefix="/debts", tags=["debts"])

# "Eski borçlar" / "yüksek borçlar" gibi sorulara cevap verilemiyordu — liste
# hep tek bir sırada (vadeye göre) geliyordu, tutar/tarih aralığına göre daraltma
# da yoktu. Whitelist'ten seçilir, doğrudan f-string'e kullanıcı girdisi girmez.
_SIRALAMA_AKTIF = {
    "vade": "d.due_date ASC NULLS LAST, d.created_at DESC",
    "eski": "d.created_at ASC",
    "yeni": "d.created_at DESC",
    "tutar_yuksek": "d.total_amount DESC",
    "tutar_dusuk": "d.total_amount ASC",
}
_SIRALAMA_GECMIS = {
    "eski": "d.created_at ASC",
    "yeni": "d.created_at DESC",
    "tutar_yuksek": "d.total_amount DESC",
    "tutar_dusuk": "d.total_amount ASC",
}


def _patron_kontrol(user):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron")


def _tutar_tarih_filtresi(where, params, min_tutar, max_tutar, tarih_baslangic, tarih_bitis):
    if min_tutar is not None:
        params.append(min_tutar)
        where.append(f"d.total_amount >= ${len(params)}")
    if max_tutar is not None:
        params.append(max_tutar)
        where.append(f"d.total_amount <= ${len(params)}")
    if tarih_baslangic is not None:
        params.append(tarih_baslangic)
        where.append(f"d.created_at >= ${len(params)}")
    if tarih_bitis is not None:
        params.append(tarih_bitis)
        where.append(f"d.created_at < ${len(params)} + interval '1 day'")


@router.get("/")
async def list_debts(
    tur: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    min_tutar: Optional[float] = Query(None),
    max_tutar: Optional[float] = Query(None),
    tarih_baslangic: Optional[date] = Query(None),
    tarih_bitis: Optional[date] = Query(None),
    sirala: Optional[str] = Query(None),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    params = [dukkan_id]
    where = ["d.dukkan_id = $1", "d.total_amount > d.paid_amount"]
    if tur:
        params.append(tur)
        where.append(f"COALESCE(d.borc_turu,'alacak') = ${len(params)}")
    if q:
        params.append(f"%{q}%")
        idx = len(params)
        where.append(f"(c.name ILIKE ${idx} OR d.alacakli_adi ILIKE ${idx} OR d.notes ILIKE ${idx})")
    _tutar_tarih_filtresi(where, params, min_tutar, max_tutar, tarih_baslangic, tarih_bitis)
    where_sql = " AND ".join(where)
    order_sql = _SIRALAMA_AKTIF.get(sirala, _SIRALAMA_AKTIF["vade"])
    # Açık (henüz kapanmamış) borç/alacaklar her zaman dikkat gerektirir —
    # Parça İade'deki bekleyen kayıtlar gibi limitsiz listelenir, aksi halde
    # 100'den fazla açık kayıt varsa eskiler sessizce listeden düşerdi.
    rows = await db.fetch(
        f"""SELECT d.*,
                  COALESCE(c.name, d.alacakli_adi, 'Bilinmiyor') as customer_name,
                  c.phone as customer_phone,
                  (d.total_amount - d.paid_amount) as remaining
           FROM debts d
           LEFT JOIN customers c ON d.customer_id = c.id
           WHERE {where_sql}
           ORDER BY {order_sql}""",
        *params,
    )
    return [dict(r) for r in rows]


@router.get("/gecmis")
async def gecmis_debts(
    q: Optional[str] = Query(None),
    min_tutar: Optional[float] = Query(None),
    max_tutar: Optional[float] = Query(None),
    tarih_baslangic: Optional[date] = Query(None),
    tarih_bitis: Optional[date] = Query(None),
    sirala: Optional[str] = Query(None),
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    params = [dukkan_id]
    where = ["d.dukkan_id = $1", "d.paid_amount >= d.total_amount", "d.total_amount > 0"]
    if q:
        params.append(f"%{q}%")
        idx = len(params)
        where.append(f"(c.name ILIKE ${idx} OR d.alacakli_adi ILIKE ${idx} OR d.notes ILIKE ${idx})")
    _tutar_tarih_filtresi(where, params, min_tutar, max_tutar, tarih_baslangic, tarih_bitis)
    where_sql = " AND ".join(where)
    order_sql = _SIRALAMA_GECMIS.get(sirala, _SIRALAMA_GECMIS["yeni"])
    rows = await db.fetch(
        f"""SELECT d.*,
                  COALESCE(c.name, d.alacakli_adi, 'Bilinmiyor') as customer_name,
                  c.phone as customer_phone,
                  (d.total_amount - d.paid_amount) as remaining
           FROM debts d
           LEFT JOIN customers c ON d.customer_id = c.id
           WHERE {where_sql}
           ORDER BY {order_sql} LIMIT 200""",
        *params,
    )
    return [dict(r) for r in rows]


@router.post("/")
async def create_debt(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    borc_turu = body.get("borc_turu", "alacak")
    customer_id = body.get("customer_id")
    alacakli_adi = (body.get("alacakli_adi") or "").strip() or None

    # Alacak kaydı öncesi sadece kayıtlı müşteri seçilebiliyordu — müşteri
    # olmayan birine (borç verilen tanıdık, vb.) alacak açılamıyordu.
    if borc_turu == "alacak" and not customer_id and not alacakli_adi:
        raise HTTPException(400, "Alacak için müşteri veya kişi/kurum adı girilmelidir")
    if borc_turu == "dukkan_borcu" and not alacakli_adi:
        raise HTTPException(400, "Dükkan borcu için alacaklı adı zorunlu")

    row = await db.fetchrow(
        """INSERT INTO debts
           (dukkan_id, customer_id, alacakli_adi, borc_turu, source_type,
            amount, total_amount, payment_type, installment_count, due_date, notes, created_by)
           VALUES ($1, $2, $3, $4, 'manuel', $5, $6, $7, $8, $9, $10, $11)
           RETURNING id""",
        dukkan_id,
        customer_id,
        alacakli_adi,
        borc_turu,
        body["total_amount"],
        body["total_amount"],
        body.get("payment_type", "borc"),
        body.get("installment_count", 1),
        body.get("due_date"),
        body.get("notes"),
        user["id"],
    )
    return {"id": row["id"]}


def _kaynak_kontrol(debt):
    # Parça İade'nin kendi beklenen tutarına bağlı borç, o kaydın edit_iade'si
    # tarafından aktif olarak senkronize ediliyor (bkz. parca_iade.py) — burada
    # bağımsız değiştirilirse bir sonraki iade düzenlemesinde üzerine yazılır.
    if debt["source_type"] == "parca_iade" and debt["source_id"] is not None:
        raise HTTPException(400, "Bu kayıt Parça İade'ye bağlı, oradan düzenleyin/silin")


@router.put("/{debt_id}")
async def edit_debt(
    debt_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    debt = await db.fetchrow("SELECT * FROM debts WHERE id=$1 AND dukkan_id=$2", debt_id, dukkan_id)
    if not debt:
        raise HTTPException(404, "Borç bulunamadı")
    _kaynak_kontrol(debt)

    total_amount = float(body.get("total_amount", debt["total_amount"]))
    if total_amount < debt["paid_amount"] - 0.009:
        raise HTTPException(400, "Yeni tutar, şimdiye kadar ödenen tutardan az olamaz")

    customer_id = body.get("customer_id", debt["customer_id"])
    alacakli_adi = (body["alacakli_adi"] if "alacakli_adi" in body else debt["alacakli_adi"])
    alacakli_adi = (alacakli_adi or "").strip() or None
    if (debt["borc_turu"] or "alacak") == "alacak" and not customer_id and not alacakli_adi:
        raise HTTPException(400, "Alacak için müşteri veya kişi/kurum adı girilmelidir")

    await db.execute(
        """UPDATE debts SET customer_id=$1, alacakli_adi=$2, total_amount=$3, amount=$3,
           payment_type=$4, installment_count=$5, due_date=$6, notes=$7
           WHERE id=$8 AND dukkan_id=$9""",
        customer_id, alacakli_adi, total_amount,
        body.get("payment_type", debt["payment_type"]),
        body.get("installment_count", debt["installment_count"]),
        body.get("due_date", debt["due_date"]),
        body.get("notes", debt["notes"]),
        debt_id, dukkan_id,
    )
    return {"ok": True}


@router.delete("/{debt_id}")
async def delete_debt(
    debt_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    _patron_kontrol(user)
    debt = await db.fetchrow("SELECT * FROM debts WHERE id=$1 AND dukkan_id=$2", debt_id, dukkan_id)
    if not debt:
        raise HTTPException(404, "Borç bulunamadı")
    _kaynak_kontrol(debt)
    if debt["paid_amount"] > 0:
        raise HTTPException(400, "Bu kayda zaten ödeme yapılmış — önce ödemeleri silin")
    await db.execute("DELETE FROM debts WHERE id=$1 AND dukkan_id=$2", debt_id, dukkan_id)
    return {"ok": True}


@router.get("/{debt_id}/odemeler")
async def debt_odemeler(
    debt_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM debt_payments WHERE debt_id=$1 AND dukkan_id=$2 ORDER BY paid_at DESC",
        debt_id, dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/{debt_id}/pay")
async def pay_debt(
    debt_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    amount = float(body.get("amount", 0) or 0)
    if amount <= 0:
        raise HTTPException(400, "Tutar sıfırdan büyük olmalı")

    debt = await db.fetchrow(
        "SELECT * FROM debts WHERE id = $1 AND dukkan_id = $2", debt_id, dukkan_id
    )
    if not debt:
        raise HTTPException(404, "Borc bulunamadi")

    kalan = debt["total_amount"] - debt["paid_amount"]
    # Önceden üst sınır kontrolü yoktu — fazladan bir sıfır girilse kalan
    # tutar eksiye düşer ve bunu geri almanın yolu olmazdı.
    if amount - kalan > 0.009:
        raise HTTPException(400, f"Ödeme, kalan tutardan (₺{kalan:.0f}) fazla olamaz")

    new_paid = debt["paid_amount"] + amount
    odeme_yontemi = body.get("payment_type", "nakit")
    async with db.transaction():
        await db.execute(
            "UPDATE debts SET paid_amount = $1 WHERE id = $2 AND dukkan_id = $3",
            new_paid, debt_id, dukkan_id,
        )
        payment = await db.fetchrow(
            """INSERT INTO debt_payments (dukkan_id, debt_id, amount, payment_type, notes, created_by)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id""",
            dukkan_id, debt_id, amount, odeme_yontemi, body.get("notes"), user["id"],
        )
        # Borç tahsilatı/ödemesi de kasadan gerçek para hareketi — daha önce
        # buraya hiç yazılmıyordu, bu yüzden taksitle satılan bir cihazın
        # kalan ödemesi tahsil edilse bile Kasa'da hiç gelir olarak görünmüyordu.
        borc_turu = debt["borc_turu"] or "alacak"
        if borc_turu == "alacak":
            kaynak = debt["source_type"] if debt["source_type"] in BILINEN_GELIR_KAYNAK else "diger"
            await db.execute(
                """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak, debt_payment_id)
                   VALUES ($1, $2, 'gelir', $3, $4, $5, $6, $7)""",
                dukkan_id, date.today().isoformat(), odeme_yontemi, amount,
                f"Borç tahsilatı: {debt['notes'] or ''}".strip(": "), kaynak, payment["id"],
            )
        else:
            await db.execute(
                """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak, debt_payment_id)
                   VALUES ($1, $2, 'cikis', $3, $4, $5, 'borc_odeme', $6)""",
                dukkan_id, date.today().isoformat(), odeme_yontemi, amount,
                f"Dükkan borcu ödemesi: {debt['alacakli_adi'] or ''}".strip(": "), payment["id"],
            )
    return {"ok": True, "new_paid": new_paid}


@router.delete("/{debt_id}/odemeler/{payment_id}")
async def delete_odeme(
    debt_id: int,
    payment_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    # Yanlış girilen bir ödeme kaydını düzeltmenin yolu yoktu — kalıcı olarak
    # borcu (yanlışlıkla) kapatmış olarak kalırdı. Silme; borcun ödenen
    # tutarını geri alır ve kasaya yazılmış karşılığını da temizler.
    _patron_kontrol(user)
    payment = await db.fetchrow(
        "SELECT * FROM debt_payments WHERE id=$1 AND debt_id=$2 AND dukkan_id=$3", payment_id, debt_id, dukkan_id
    )
    if not payment:
        raise HTTPException(404, "Ödeme bulunamadı")
    async with db.transaction():
        await db.execute(
            "UPDATE debts SET paid_amount = GREATEST(paid_amount - $1, 0) WHERE id=$2 AND dukkan_id=$3",
            payment["amount"], debt_id, dukkan_id,
        )
        await db.execute("DELETE FROM kasa_hareketleri WHERE debt_payment_id=$1 AND dukkan_id=$2", payment_id, dukkan_id)
        await db.execute("DELETE FROM debt_payments WHERE id=$1 AND dukkan_id=$2", payment_id, dukkan_id)
    return {"ok": True}
