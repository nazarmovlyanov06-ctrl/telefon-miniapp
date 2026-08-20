import asyncpg
from fastapi import APIRouter, Depends
from database import get_db
from auth import get_current_user, get_dukkan_id
from datetime import date

router = APIRouter(prefix="/bildirimler", tags=["bildirimler"])


async def bildirim_ekle(db, dukkan_id, tur, baslik, mesaj=None, ilgili_tip=None, ilgili_id=None):
    """Randevu/takas/müşteri mesajı gibi ANLIK olaylarda çağrılır — ilgili
    endpoint kendi INSERT'inden hemen sonra bunu çağırır, böylece bildirim
    zil rozetinde bir sonraki poll'da (~25sn) görünür."""
    await db.execute(
        """INSERT INTO bildirimler (dukkan_id, tur, baslik, mesaj, ilgili_tip, ilgili_id)
           VALUES ($1, $2, $3, $4, $5, $6)""",
        dukkan_id, tur, baslik, mesaj, ilgili_tip, ilgili_id,
    )


async def _gunluk_hatirlatmalari_olustur(db, dukkan_id):
    # Bu, her poll'da (sayım/liste uçları) çağrılır ama dükkan başına günde
    # SADECE BİR KEZ gerçek üretim yapar — aksi halde her poll'da aynı
    # hatırlatmalar tekrar tekrar eklenirdi. "son_hatirlatma_tarihi" bugüne
    # eşitse hiçbir şey yapmadan çıkar.
    bugun = date.today()
    dukkan = await db.fetchrow("SELECT son_hatirlatma_tarihi FROM dukkanlar WHERE id=$1", dukkan_id)
    if dukkan and dukkan["son_hatirlatma_tarihi"] == bugun:
        return

    async with db.transaction():
        # Çift kontrol: aynı anda iki istek gelirse ikisi de üretim yapmasın.
        satir = await db.fetchrow(
            "SELECT son_hatirlatma_tarihi FROM dukkanlar WHERE id=$1 FOR UPDATE", dukkan_id
        )
        if satir and satir["son_hatirlatma_tarihi"] == bugun:
            return

        # Vadesi gelmiş/geçmiş açık alacaklar — taksitli olanlar da aynı
        # due_date alanını kullandığı için "taksit günü geldi" burada kapsanır.
        vadesi_gelenler = await db.fetch(
            """SELECT d.id, d.total_amount, d.paid_amount, d.payment_type,
                      COALESCE(c.name, d.alacakli_adi, 'Bilinmiyor') as ad
               FROM debts d LEFT JOIN customers c ON d.customer_id = c.id
               WHERE d.dukkan_id=$1 AND COALESCE(d.borc_turu,'alacak')='alacak'
                     AND d.total_amount > d.paid_amount
                     AND d.due_date IS NOT NULL AND d.due_date <= $2""",
            dukkan_id, bugun.isoformat(),
        )
        for r in vadesi_gelenler:
            kalan = r["total_amount"] - r["paid_amount"]
            taksit_not = " (taksit)" if r["payment_type"] == "taksit" else ""
            await bildirim_ekle(
                db, dukkan_id, "alacak_vadesi",
                f"{r['ad']} — vade geldi{taksit_not}",
                f"Kalan ₺{kalan:,.0f} tahsil edilmedi".replace(",", "."),
                "debt", r["id"],
            )

        # Hazır olup teslim edilmemiş tamirler.
        hazir_bekleyenler = await db.fetch(
            """SELECT r.id, r.repair_no, r.device_model, c.name as ad
               FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id
               WHERE r.dukkan_id=$1 AND r.status='hazir' AND r.delivered_at IS NULL""",
            dukkan_id,
        )
        for r in hazir_bekleyenler:
            await bildirim_ekle(
                db, dukkan_id, "tamir_teslim_bekliyor",
                f"{r['ad'] or 'Müşteri'} — cihaz hazır, teslim edilmedi",
                f"#{r['repair_no']} · {r['device_model']}",
                "repair", r["id"],
            )

        await db.execute("UPDATE dukkanlar SET son_hatirlatma_tarihi=$1 WHERE id=$2", bugun, dukkan_id)
        # Tablo şişmesin diye 30 günden eski okunmuş bildirimler temizlenir.
        await db.execute(
            "DELETE FROM bildirimler WHERE dukkan_id=$1 AND okundu_mu=true AND created_at < now() - interval '30 days'",
            dukkan_id,
        )


@router.get("/sayim")
async def bildirim_sayisi(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    # Hafif uç — sık aralıklarla (zil rozeti için) çağrılır, tam listeyi çekmez.
    await _gunluk_hatirlatmalari_olustur(db, dukkan_id)
    n = await db.fetchval(
        "SELECT COUNT(*) FROM bildirimler WHERE dukkan_id=$1 AND okundu_mu=false", dukkan_id
    )
    return {"okunmamis": n}


@router.get("/")
async def list_bildirimler(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await _gunluk_hatirlatmalari_olustur(db, dukkan_id)
    rows = await db.fetch(
        "SELECT * FROM bildirimler WHERE dukkan_id=$1 ORDER BY created_at DESC LIMIT 100",
        dukkan_id,
    )
    okunmamis = sum(1 for r in rows if not r["okundu_mu"])
    return {"okunmamis": okunmamis, "liste": [dict(r) for r in rows]}


@router.post("/okundu")
async def hepsini_okundu_isaretle(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE bildirimler SET okundu_mu=true WHERE dukkan_id=$1 AND okundu_mu=false", dukkan_id
    )
    return {"ok": True}
