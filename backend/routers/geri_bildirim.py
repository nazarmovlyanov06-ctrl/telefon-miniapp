import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import get_current_user, get_dukkan_id

router = APIRouter(prefix="/geri-bildirim", tags=["geri-bildirim"])


@router.get("/calisanlar")
async def calisanlar_listesi(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT id, ad, rol FROM kullanicilar WHERE dukkan_id = $1 ORDER BY ad", dukkan_id
    )
    return [dict(r) for r in rows]


@router.get("/bildirim")
async def bildirim_sayisi(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    count = await db.fetchval(
        "SELECT COUNT(*) FROM calisan_geri_bildirim WHERE dukkan_id=$1 AND hedef_id=$2 AND goruldu=false",
        dukkan_id, user["id"],
    )
    return {"bekleyen": int(count)}


@router.get("/")
async def list_bildirimler(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    if user["rol"] == "patron":
        rows = await db.fetch(
            """SELECT cb.*,
                      ug.ad as gonderen_adi,
                      uh.ad as hedef_adi
               FROM calisan_geri_bildirim cb
               LEFT JOIN kullanicilar ug ON cb.gonderen_id = ug.id
               LEFT JOIN kullanicilar uh ON cb.hedef_id = uh.id
               WHERE cb.dukkan_id = $1
               ORDER BY cb.created_at DESC LIMIT 200""",
            dukkan_id,
        )
    else:
        rows = await db.fetch(
            """SELECT cb.id, cb.tur, cb.mesaj, cb.goruldu, cb.created_at,
                      NULL as gonderen_adi,
                      uh.ad as hedef_adi
               FROM calisan_geri_bildirim cb
               LEFT JOIN kullanicilar uh ON cb.hedef_id = uh.id
               WHERE cb.dukkan_id = $1
               ORDER BY cb.created_at DESC LIMIT 200""",
            dukkan_id,
        )
    return [dict(r) for r in rows]


@router.get("/skor")
async def skor(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT u.id, u.ad,
                  SUM(CASE WHEN cb.tur='sikayet' THEN 1 ELSE 0 END) as sikayet_sayisi,
                  SUM(CASE WHEN cb.tur='ovgu'    THEN 1 ELSE 0 END) as ovgu_sayisi
           FROM kullanicilar u
           LEFT JOIN calisan_geri_bildirim cb ON u.id = cb.hedef_id AND cb.dukkan_id = $1
           WHERE u.dukkan_id = $1
           GROUP BY u.id
           ORDER BY ovgu_sayisi DESC, sikayet_sayisi ASC""",
        dukkan_id,
    )
    return [dict(r) for r in rows]


@router.post("/")
async def create_bildirim(
    body: dict,
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    hedef_id = body["hedef_id"]
    if hedef_id == user["id"]:
        raise HTTPException(400, "Kendinize bildirim gönderemezsiniz")
    row = await db.fetchrow(
        """INSERT INTO calisan_geri_bildirim (dukkan_id, gonderen_id, hedef_id, tur, mesaj)
           VALUES ($1, $2, $3, $4, $5) RETURNING id""",
        dukkan_id, user["id"], hedef_id, body["tur"], body["mesaj"],
    )
    return {"id": row["id"]}


@router.post("/goruldu")
async def mark_goruldu(
    dukkan_id: int = Depends(get_dukkan_id),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE calisan_geri_bildirim SET goruldu=true WHERE dukkan_id=$1 AND hedef_id=$2",
        dukkan_id, user["id"],
    )
    return {"ok": True}
