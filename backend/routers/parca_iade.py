import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import get_current_user, get_dukkan_id
from odeme_yardimci import kaydet_odeme
from datetime import date

router = APIRouter(prefix="/parca-iade", tags=["parca-iade"])

# Önceden bu liste hiç zorlanmıyordu — demo seed verisi "kabul"/"red" gibi
# gerçek akışta hiç var olmayan durum değerleri yazmıştı. Bu değerler
# frontend'in bildiği hiçbir duruma denk gelmediği için o kayıtların üzerinde
# HİÇ buton çıkmıyordu, sonsuza dek "bekleyen" sayılıp ilerletilemiyordu.
GECERLI_DURUMLAR = {"bekliyor", "gönderildi", "para_iade_alindi", "reddedildi", "parca_degisimi"}


@router.get("/")
async def list_iade(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT p.*, t.ad as toptanci_adi, u1.ad as olusturan_adi, u2.ad as son_degistiren_adi
           FROM parca_iadeler p
           LEFT JOIN toptancilar t ON p.toptanci_id = t.id
           LEFT JOIN kullanicilar u1 ON p.created_by = u1.id
           LEFT JOIN kullanicilar u2 ON p.son_durum_degistiren_id = u2.id
           WHERE p.dukkan_id = $1
           ORDER BY p.created_at DESC""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/")
async def add_iade(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    miktar = int(body.get("miktar", 1))
    part_id = body.get("part_id")

    async with db.transaction():
        if part_id:
            part = await db.fetchrow(
                "SELECT quantity, name FROM parts WHERE id = $1 AND dukkan_id = $2", part_id, dukkan_id
            )
            if not part:
                raise HTTPException(404, "Parça bulunamadı")
            if part["quantity"] < miktar:
                raise HTTPException(400, f"Stok yetersiz ({part['quantity']} adet mevcut)")
            await db.execute(
                "UPDATE parts SET quantity = quantity - $1 WHERE id = $2 AND dukkan_id = $3",
                miktar, part_id, dukkan_id,
            )
            await db.execute(
                """INSERT INTO stok_hareketleri (dukkan_id, part_id, hareket, miktar, sebep, aciklama, tarih, created_by)
                   VALUES ($1, $2, 'cikis', $3, 'iade', $4, $5, $6)""",
                dukkan_id, part_id, miktar, body.get("sebep") or "Toptancıya iade",
                date.today().isoformat(), user["id"],
            )

        beklenen_tutar = float(body.get("beklenen_tutar") or 0)

        row = await db.fetchrow(
            """INSERT INTO parca_iadeler (dukkan_id, toptanci_id, part_id, parca, miktar, sebep, durum, beklenen_tutar, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, 'bekliyor', $7, $8) RETURNING id""",
            dukkan_id, body.get("toptanci_id"), part_id, body["parca"], miktar,
            body.get("sebep"), beklenen_tutar, user["id"],
        )
        iade_id = row["id"]

        if beklenen_tutar > 0:
            toptanci_id = body.get("toptanci_id")
            toptanci_adi = None
            if toptanci_id:
                tr = await db.fetchrow("SELECT ad FROM toptancilar WHERE id=$1 AND dukkan_id=$2", toptanci_id, dukkan_id)
                toptanci_adi = tr["ad"] if tr else None
            alacakli = toptanci_adi or body.get("parca", "Toptancı")
            await db.execute(
                """INSERT INTO debts (dukkan_id, alacakli_adi, borc_turu, source_type, source_id,
                   amount, total_amount, payment_type, notes, created_by)
                   VALUES ($1, $2, 'alacak', 'parca_iade', $3, $4, $5, 'borc', $6, $7)""",
                dukkan_id, alacakli, iade_id, beklenen_tutar, beklenen_tutar,
                f"Parça iade: {body['parca']} x{miktar}", user["id"],
            )

    return {"id": iade_id}


@router.put("/{iade_id}")
async def edit_iade(
    iade_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    iade = await db.fetchrow("SELECT * FROM parca_iadeler WHERE id=$1 AND dukkan_id=$2", iade_id, dukkan_id)
    if not iade:
        raise HTTPException(404, "İade bulunamadı")
    if iade["durum"] != "bekliyor":
        raise HTTPException(400, "Toptancıya gönderilmiş/sonuçlanmış bir iade düzenlenemez")

    yeni_tutar = float(body.get("beklenen_tutar") or 0)
    async with db.transaction():
        await db.execute(
            """UPDATE parca_iadeler SET toptanci_id=$1, parca=$2, miktar=$3, sebep=$4, beklenen_tutar=$5
               WHERE id=$6 AND dukkan_id=$7""",
            body.get("toptanci_id"), body.get("parca", iade["parca"]), int(body.get("miktar") or iade["miktar"]),
            body.get("sebep"), yeni_tutar, iade_id, dukkan_id,
        )
        # Beklenen tutar değiştiyse, henüz ödenmemiş bağlı borcu da güncelle.
        await db.execute(
            """UPDATE debts SET amount=$1, total_amount=$1
               WHERE dukkan_id=$2 AND source_type='parca_iade' AND source_id=$3 AND paid_amount=0""",
            yeni_tutar, dukkan_id, iade_id,
        )
        if yeni_tutar <= 0:
            await db.execute(
                "DELETE FROM debts WHERE dukkan_id=$1 AND source_type='parca_iade' AND source_id=$2 AND paid_amount=0",
                dukkan_id, iade_id,
            )
        elif yeni_tutar > 0:
            var_mi = await db.fetchval(
                "SELECT id FROM debts WHERE dukkan_id=$1 AND source_type='parca_iade' AND source_id=$2",
                dukkan_id, iade_id,
            )
            if not var_mi:
                await db.execute(
                    """INSERT INTO debts (dukkan_id, alacakli_adi, borc_turu, source_type, source_id,
                       amount, total_amount, payment_type, notes, created_by)
                       VALUES ($1, $2, 'alacak', 'parca_iade', $3, $4, $4, 'borc', $5, $6)""",
                    dukkan_id, body.get("parca", iade["parca"]), iade_id, yeni_tutar,
                    f"Parça iade: {body.get('parca', iade['parca'])}", user["id"],
                )
    return {"ok": True}


@router.delete("/{iade_id}")
async def delete_iade(
    iade_id: int,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] != "patron":
        raise HTTPException(403, "Sadece patron silebilir")
    iade = await db.fetchrow("SELECT * FROM parca_iadeler WHERE id=$1 AND dukkan_id=$2", iade_id, dukkan_id)
    if not iade:
        raise HTTPException(404, "İade bulunamadı")
    if iade["durum"] == "para_iade_alindi":
        raise HTTPException(400, "Para iadesi tamamlanmış bir kayıt silinemez")

    async with db.transaction():
        if iade["part_id"]:
            # Yanlış girilen kayıt siliniyor — stoktan düşülen miktar geri eklenir,
            # yoksa stok kalıcı olarak eksik görünmeye devam ederdi.
            await db.execute(
                "UPDATE parts SET quantity = quantity + $1 WHERE id = $2 AND dukkan_id = $3",
                iade["miktar"], iade["part_id"], dukkan_id,
            )
            await db.execute(
                """INSERT INTO stok_hareketleri (dukkan_id, part_id, hareket, miktar, sebep, aciklama, tarih, created_by)
                   VALUES ($1, $2, 'giris', $3, 'iade_iptal', $4, $5, $6)""",
                dukkan_id, iade["part_id"], iade["miktar"], "Hatalı iade kaydı silindi",
                date.today().isoformat(), user["id"],
            )
        await db.execute(
            "DELETE FROM debts WHERE dukkan_id=$1 AND source_type='parca_iade' AND source_id=$2 AND paid_amount=0",
            dukkan_id, iade_id,
        )
        await db.execute("DELETE FROM parca_iadeler WHERE id=$1 AND dukkan_id=$2", iade_id, dukkan_id)
    return {"ok": True}


@router.put("/{iade_id}/durum")
async def update_durum(
    iade_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    yeni_durum = body["durum"]
    if yeni_durum not in GECERLI_DURUMLAR:
        raise HTTPException(400, f"Geçersiz durum: {yeni_durum}")

    iade_row = await db.fetchrow("SELECT * FROM parca_iadeler WHERE id = $1 AND dukkan_id = $2", iade_id, dukkan_id)
    if not iade_row:
        raise HTTPException(404, "İade bulunamadı")
    iade = dict(iade_row)

    async with db.transaction():
        await db.execute(
            """UPDATE parca_iadeler SET durum = $1, son_durum_degistiren_id = $2, son_durum_degisiklik_at = now()
               WHERE id = $3 AND dukkan_id = $4""",
            yeni_durum, user["id"], iade_id, dukkan_id,
        )

        if yeni_durum == "para_iade_alindi":
            tutar = float(body.get("alinan_tutar") or iade.get("beklenen_tutar") or 0)
            if tutar > 0:
                parca_adi = iade.get("parca", "Parça")
                odeme_yontemi = body.get("odeme_yontemi") or "nakit"
                await db.execute(
                    """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak)
                       VALUES ($1, $2, 'giris', $3, $4, $5, 'parca_iade')""",
                    dukkan_id, date.today().isoformat(), odeme_yontemi, tutar, f"Parça iade parası: {parca_adi}",
                )
                # add_iade sırasında beklenen_tutar>0 ise burada 'alacak' olarak bir
                # borç açılmıştı — para gelince o borç hiç kapatılmıyordu, bu yüzden
                # Alacaklarımız kalıcı olarak şişiyordu VE biri aynı borcu Borçlar
                # sayfasından ayrıca "tahsil edilmiş" işaretlerse para iki kez kasaya
                # yazılabiliyordu. source_id ile açılan borcu burada tam ödenmiş sayıyoruz.
                await db.execute(
                    "UPDATE debts SET paid_amount = total_amount WHERE dukkan_id=$1 AND source_type='parca_iade' AND source_id=$2",
                    dukkan_id, iade_id,
                )
        elif yeni_durum == "reddedildi":
            # Toptancı iadeyi kabul etmedi — bu para hiç gelmeyecek, açılmış
            # 'alacak' borcunu (henüz tahsil edilmemişse) siliyoruz. Önceden bu
            # durum hiç yoktu, reddedilen iadeler "bekliyor" gibi asılı kalıyordu.
            await db.execute(
                "DELETE FROM debts WHERE dukkan_id=$1 AND source_type='parca_iade' AND source_id=$2 AND paid_amount=0",
                dukkan_id, iade_id,
            )
        elif yeni_durum == "parca_degisimi":
            # Toptancı nakit iade yerine aynı/başka bir parça gönderdi — para
            # gelmeyecek, orijinal 'alacak' borcu parça ile kapanmış sayılır.
            await db.execute(
                "DELETE FROM debts WHERE dukkan_id=$1 AND source_type='parca_iade' AND source_id=$2 AND paid_amount=0",
                dukkan_id, iade_id,
            )
            alinan_part_id = body.get("alinan_part_id")
            alinan_miktar = int(body.get("alinan_miktar") or iade["miktar"])
            if alinan_part_id:
                p = await db.fetchrow("SELECT name FROM parts WHERE id=$1 AND dukkan_id=$2", alinan_part_id, dukkan_id)
                if p:
                    await db.execute(
                        "UPDATE parts SET quantity = quantity + $1 WHERE id=$2 AND dukkan_id=$3",
                        alinan_miktar, alinan_part_id, dukkan_id,
                    )
                    await db.execute(
                        """INSERT INTO stok_hareketleri (dukkan_id, part_id, hareket, miktar, sebep, aciklama, tarih, created_by)
                           VALUES ($1, $2, 'giris', $3, 'degisim', $4, $5, $6)""",
                        dukkan_id, alinan_part_id, alinan_miktar,
                        f"Parça değişimi karşılığı — orijinal: {iade.get('parca')}",
                        date.today().isoformat(), user["id"],
                    )
            # Fiyat farkı varsa (değişim parçası daha pahalı/ucuz) o fark
            # ayrıca ödenir/tahsil edilir — nakit/kart/borç karışık olabilir.
            fark = float(body.get("fark_tutari") or 0)
            fark_yonu = body.get("fark_yonu")
            if fark > 0 and fark_yonu in ("biz_oderiz", "toptanci_oder"):
                toptanci_adi = None
                if iade.get("toptanci_id"):
                    tr = await db.fetchrow("SELECT ad FROM toptancilar WHERE id=$1 AND dukkan_id=$2", iade["toptanci_id"], dukkan_id)
                    toptanci_adi = tr["ad"] if tr else None
                aciklama = f"Parça değişim farkı: {iade.get('parca')}"
                if fark_yonu == "biz_oderiz":
                    await kaydet_odeme(
                        db, dukkan_id, body.get("odemeler"), fark, "gider", "parca_degisim_farki", aciklama, user["id"],
                        alacakli_adi=toptanci_adi, taksit_sayi=body.get("taksit_sayi") or 1,
                    )
                else:
                    await kaydet_odeme(
                        db, dukkan_id, body.get("odemeler"), fark, "gelir", "parca_degisim_farki", aciklama, user["id"],
                        alacakli_adi=toptanci_adi or iade.get("parca"), taksit_sayi=body.get("taksit_sayi") or 1,
                    )

    return {"ok": True}
