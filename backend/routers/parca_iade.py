import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import get_current_user, get_dukkan_id
from datetime import date

router = APIRouter(prefix="/parca-iade", tags=["parca-iade"])


@router.get("/")
async def list_iade(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT p.*, t.ad as toptanci_adi
           FROM parca_iadeler p
           LEFT JOIN toptancilar t ON p.toptanci_id = t.id
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
            """INSERT INTO parca_iadeler (dukkan_id, toptanci_id, part_id, parca, miktar, sebep, durum, beklenen_tutar)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id""",
            dukkan_id, body.get("toptanci_id"), part_id, body["parca"], miktar,
            body.get("sebep"), body.get("durum", "bekliyor"), beklenen_tutar,
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


@router.put("/{iade_id}/durum")
async def update_durum(
    iade_id: int,
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    yeni_durum = body["durum"]

    iade_row = await db.fetchrow("SELECT * FROM parca_iadeler WHERE id = $1 AND dukkan_id = $2", iade_id, dukkan_id)
    if not iade_row:
        raise HTTPException(404, "İade bulunamadı")
    iade = dict(iade_row)

    async with db.transaction():
        await db.execute(
            "UPDATE parca_iadeler SET durum = $1 WHERE id = $2 AND dukkan_id = $3",
            yeni_durum, iade_id, dukkan_id,
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

    return {"ok": True}
