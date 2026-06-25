from fastapi import APIRouter, Depends
from aiosqlite import Connection
from database import get_db, get_or_create_user
from auth import get_current_user
from config import GEMINI_API_KEY
import httpx, json
from datetime import date

router = APIRouter(prefix="/ai", tags=["ai"])


async def _servis_ozeti(db: Connection) -> str:
    bugun = date.today().isoformat()
    ay_basi = date.today().replace(day=1).isoformat()

    cur = await db.execute(
        "SELECT COUNT(*) as c, status FROM repairs WHERE DATE(created_at)=? GROUP BY status", (bugun,)
    )
    tamirler = {r["status"]: r["c"] for r in await cur.fetchall()}

    cur = await db.execute(
        "SELECT COUNT(*) as c FROM repairs WHERE status NOT IN ('teslim', 'iptal')"
    )
    bekleyen = (await cur.fetchone())["c"]

    cur = await db.execute(
        "SELECT COALESCE(SUM(tutar),0) as t FROM kasa_hareketleri WHERE tur='giris' AND tarih=?", (bugun,)
    )
    bugun_gelir = (await cur.fetchone())["t"]

    cur = await db.execute(
        "SELECT COALESCE(SUM(tutar),0) as t FROM kasa_hareketleri WHERE tur='giris' AND tarih>=?", (ay_basi,)
    )
    ay_gelir = (await cur.fetchone())["t"]

    cur = await db.execute(
        "SELECT COUNT(*) as c FROM loaner_cihazlar WHERE aktif=1"
    )
    loaner_count = (await cur.fetchone())["c"]

    cur = await db.execute(
        "SELECT COUNT(*) as c FROM garantiler WHERE aktif=1 AND bitis_tarihi<?", (bugun,)
    )
    suresi_dolan = (await cur.fetchone())["c"]

    cur = await db.execute(
        "SELECT ad, stok FROM aksesuarlar WHERE stok <= 5 ORDER BY stok ASC LIMIT 5"
    )
    dusuk_stok = [dict(r) for r in await cur.fetchall()]

    ozet = f"""Bugün: {bugun}
Bugün gelen tamir: {tamirler.get('bekliyor', 0)} adet
Bekleyen tamirler (toplam): {bekleyen} adet
Bugün gelir: {bugun_gelir:.0f} ₺
Bu ay toplam gelir: {ay_gelir:.0f} ₺
Dışarıda yedek telefon: {loaner_count} adet
Süresi dolan garanti: {suresi_dolan} adet"""

    if dusuk_stok:
        stok_str = ", ".join(f"{a['ad']} ({a['stok']} adet)" for a in dusuk_stok)
        ozet += f"\nDüşük stok uyarısı: {stok_str}"

    return ozet


@router.post("/sor")
async def sor(
    body: dict,
    tg_user=Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await get_or_create_user(db, tg_user["id"], tg_user.get("first_name", ""))
    soru = (body.get("soru") or "").strip()
    if not soru:
        return {"cevap": "Lütfen bir soru yazın."}

    if not GEMINI_API_KEY:
        return {"cevap": "AI özelliği aktif değil. Railway'de GEMINI_API_KEY ortam değişkenini ayarlayın."}

    servis_ozeti = await _servis_ozeti(db)
    sistem_mesaji = f"""Sen 'Telefoncu Tayfun' servisinin akıllı asistanısın.
Türkçe konuşuyorsun. Kısa ve net cevaplar veriyorsun.
Kullanıcı telefon tamiri, satış ve servis yönetimi hakkında sorular soruyor.

MEVCUT SERVİS DURUMU:
{servis_ozeti}

Bu bilgilere dayanarak yardımcı ol. Eğer bilgi yoksa bunu belirt."""

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}",
                json={
                    "contents": [
                        {"role": "user", "parts": [{"text": sistem_mesaji + "\n\nKullanıcı sorusu: " + soru}]}
                    ],
                    "generationConfig": {"maxOutputTokens": 400, "temperature": 0.7}
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                cevap = data["candidates"][0]["content"]["parts"][0]["text"]
                return {"cevap": cevap}
            else:
                return {"cevap": f"AI hatası: {resp.status_code}"}
    except Exception as e:
        return {"cevap": f"Bağlantı hatası: {str(e)[:100]}"}
