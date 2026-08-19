from datetime import date

# Bilinen gelir kaynakları — kasa.py/reports.py'deki KAYNAK_LABEL ile aynı
# anahtarlar. debts.source_type bunlardan biriyse borç tahsil edildiğinde
# kasa gelir dökümünde doğru kaynağa sayılır (bkz. debts.py _ALACAK_KAYNAK).
BILINEN_GELIR_KAYNAK = {"tamir", "2el_satis", "sifir_satis", "aksesuar", "parca_iade"}


async def kaydet_odeme(
    db, dukkan_id, odemeler, toplam, yon, kaynak, aciklama, user_id,
    customer_id=None, alacakli_adi=None, taksit_sayi=1, tarih=None, gider_id=None,
):
    """Bir satış/alımın tutarını istenilen sayıda ödeme satırına (nakit/kart,
    karışık) ve varsa kalan borca böler. "Bir kısmı nakit, bir kısmı kart,
    kalanı borç" gibi karma ödemelerin TEK noktadan işlendiği yer burası —
    tamir/2.el/sıfır/aksesuar satışları ile parça alımlarının hepsi bunu
    kullanır, aralarında davranış farkı olmasın diye.

    odemeler: [{"yontem": "nakit"|"kart", "tutar": sayı}, ...] — sadece
        GERÇEKTEN o an alınan/ödenen kısımlar (borç satırı buraya girmez).
    yon: "gelir" (satış — müşteriden alınır, kalan 'alacak' olur) veya
        "gider" (alım — toptancıya ödenir, kalan 'dükkan borcu' olur).
    toplam - sum(odemeler.tutar) > 0 ise kalan otomatik borç olarak yazılır.
    """
    toplam = float(toplam or 0)
    if toplam <= 0:
        return
    tarih = tarih or date.today().isoformat()
    kasa_tur = "gelir" if yon == "gelir" else "cikis"
    alinan_toplam = 0.0
    for o in (odemeler or []):
        tutar = float(o.get("tutar") or 0)
        if tutar <= 0:
            continue
        yontem = o.get("yontem") or "nakit"
        alinan_toplam += tutar
        await db.execute(
            """INSERT INTO kasa_hareketleri (dukkan_id, tarih, tur, odeme_yontemi, tutar, aciklama, kaynak, gider_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
            dukkan_id, tarih, kasa_tur, yontem, tutar, aciklama, kaynak, gider_id,
        )
    kalan = round(toplam - alinan_toplam, 2)
    if kalan <= 0.009:
        return
    taksit_sayi = max(int(taksit_sayi or 1), 1)
    if yon == "gelir":
        if not customer_id:
            return  # müşterisiz satışta kalan tutar takip edilemez, borç yazılamaz
        await db.execute(
            """INSERT INTO debts
               (dukkan_id, customer_id, borc_turu, source_type, amount, total_amount,
                payment_type, installment_count, notes, created_by, gider_id)
               VALUES ($1, $2, 'alacak', $3, $4, $4, $5, $6, $7, $8, $9)""",
            dukkan_id, customer_id, kaynak if kaynak in BILINEN_GELIR_KAYNAK else "manuel",
            kalan, "taksit" if taksit_sayi > 1 else "borc", taksit_sayi, aciklama, user_id, gider_id,
        )
    else:
        await db.execute(
            """INSERT INTO debts
               (dukkan_id, alacakli_adi, borc_turu, source_type, amount, total_amount,
                payment_type, installment_count, notes, created_by, gider_id)
               VALUES ($1, $2, 'dukkan_borcu', $3, $4, $4, $5, $6, $7, $8, $9)""",
            dukkan_id, alacakli_adi or "Alacaklı", kaynak,
            kalan, "taksit" if taksit_sayi > 1 else "borc", taksit_sayi, aciklama, user_id, gider_id,
        )
