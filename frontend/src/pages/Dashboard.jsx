import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const DURUM_RENK = {
  bekliyor: "#f59e0b",
  tamirde: "#3b82f6",
  parca_bekleniyor: "#8b5cf6",
  hazir: "#10b981",
  teslim: "#6b7280",
};

const DURUM_LABEL = {
  bekliyor: "⏳ Bekliyor",
  tamirde: "🔧 Tamirde",
  parca_bekleniyor: "📦 Parça",
  hazir: "✅ Hazır",
  teslim: "🏠 Teslim",
};

function fmt(n) {
  return (n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

function gun_fark(tarih) {
  if (!tarih) return null;
  const ms = Date.now() - new Date(tarih).getTime();
  const gun = Math.floor(ms / 86400000);
  if (gun === 0) return "Bugün";
  if (gun === 1) return "Dün";
  return `${gun} gün önce`;
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 40 }}>🔧</div>
      <div style={{ color: "var(--hint)", fontSize: 14 }}>Yükleniyor...</div>
    </div>
  );

  const durumlar = data?.tamir_durumlar || {};
  const kasa = data?.kasa_bugun || {};
  const uyarilar = data?.uyarilar || {};
  const aranacaklar = data?.aranacaklar || [];
  const son_tamirler = data?.son_tamirler || [];
  const uyari_sayisi = (uyarilar.stok?.length || 0) + (uyarilar.garanti?.length || 0) + (uyarilar.borc?.length || 0);

  const isim = user?.name?.split(" ")[0] || "";
  const saat = new Date().getHours();
  const selam = saat < 12 ? "☀️ Günaydın" : saat < 18 ? "👋 Merhaba" : "🌙 İyi akşamlar";

  return (
    <div className="page" style={{ paddingBottom: 90 }}>
      {/* Başlık + Arama */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "var(--hint)" }}>{selam}{isim ? `, ${isim}` : ""}</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Bugün ne oluyor?</div>
        </div>
        <button
          className="btn btn-ghost"
          style={{ width: 44, height: 44, borderRadius: "50%", padding: 0, fontSize: 20, flexShrink: 0 }}
          onClick={() => navigate("/search")}
        >
          🔍
        </button>
      </div>

      {/* Tamir Durum Sayıları */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
        {["bekliyor", "tamirde", "parca_bekleniyor", "hazir"].map(k => (
          <div
            key={k}
            onClick={() => navigate(`/repairs?status=${k}`)}
            style={{
              background: "var(--card)", borderRadius: 12, padding: "10px 8px",
              textAlign: "center", cursor: "pointer",
              borderBottom: `3px solid ${DURUM_RENK[k]}`,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 22, color: DURUM_RENK[k] }}>
              {durumlar[k] || 0}
            </div>
            <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 2 }}>{DURUM_LABEL[k]}</div>
          </div>
        ))}
      </div>

      {/* Kasa Özeti */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div className="card" style={{ padding: "12px 14px", margin: 0 }}>
          <div style={{ fontSize: 11, color: "var(--hint)", marginBottom: 4 }}>💰 Bugün Gelir</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#10b981" }}>{fmt(kasa.gelir)}₺</div>
        </div>
        <div className="card" style={{ padding: "12px 14px", margin: 0 }}>
          <div style={{ fontSize: 11, color: "var(--hint)", marginBottom: 4 }}>📉 Bugün Gider</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#ef4444" }}>{fmt(kasa.gider)}₺</div>
        </div>
      </div>

      {/* Bu Ay */}
      {data?.bu_ay && (
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--hint)" }}>Bu Ay Kazanç</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>{fmt(data.bu_ay.gelir)}₺</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--hint)" }}>Bu Ay Tamir</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{data.bu_ay.tamir} adet</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/stats")}>Rapor →</button>
        </div>
      )}

      {/* Uyarılar */}
      {uyari_sayisi > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 14 }}>⚠️ Uyarılar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(uyarilar.stok || []).map((u, i) => (
              <div key={"s" + i} className="card" style={{ padding: "10px 14px", borderLeft: "3px solid #f59e0b", cursor: "pointer" }}
                onClick={() => navigate("/parts")}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>📦 {u.name}</div>
                <div style={{ fontSize: 12, color: "#f59e0b" }}>Stok kritik: {u.quantity} adet kaldı</div>
              </div>
            ))}
            {(uyarilar.garanti || []).map((u, i) => (
              <div key={"g" + i} className="card" style={{ padding: "10px 14px", borderLeft: "3px solid #3b82f6", cursor: "pointer" }}
                onClick={() => navigate("/garanti")}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>🛡️ {u.cihaz} — {u.musteri_adi}</div>
                <div style={{ fontSize: 12, color: "#3b82f6" }}>Garanti bitiyor: {u.bitis_tarihi}</div>
              </div>
            ))}
            {(uyarilar.borc || []).map((u, i) => (
              <div key={"b" + i} className="card" style={{ padding: "10px 14px", borderLeft: "3px solid #ef4444", cursor: "pointer" }}
                onClick={() => navigate("/debts")}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>💳 {u.musteri_adi}</div>
                <div style={{ fontSize: 12, color: "#ef4444" }}>Gecikmiş borç: {fmt(u.kalan)}₺ (vade: {u.due_date})</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Bugün Aranacaklar */}
      {aranacaklar.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 14 }}>📞 Aranacaklar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {aranacaklar.map((a, i) => (
              <div key={i} className="card"
                style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                onClick={() => navigate(`/repairs/${a.id}`)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.musteri_adi || "—"} — {a.device_model}</div>
                  <div style={{ fontSize: 12, color: "#10b981" }}>✅ {gun_fark(a.completed_at)} hazır, alınmadı</div>
                </div>
                {a.telefon && (
                  <a href={`tel:${a.telefon}`} onClick={e => e.stopPropagation()}
                    style={{
                      width: 36, height: 36, borderRadius: "50%", background: "#25D366",
                      color: "#fff", display: "flex", alignItems: "center",
                      justifyContent: "center", textDecoration: "none", fontSize: 16, flexShrink: 0,
                    }}>☎️</a>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Son Tamirler */}
      {son_tamirler.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, marginBottom: 6 }}>
            <div className="section-title" style={{ margin: 0 }}>Son Tamirler</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/repairs")}>Tümü →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {son_tamirler.map(t => (
              <div key={t.id} className="card"
                style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                onClick={() => navigate(`/repairs/${t.id}`)}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: DURUM_RENK[t.status] || "var(--hint)",
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.musteri_adi || "—"} — {t.device_model}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--hint)" }}>
                    {t.fault_desc || "—"} · {gun_fark(t.created_at)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: DURUM_RENK[t.status], fontWeight: 700, flexShrink: 0 }}>
                  {DURUM_LABEL[t.status] || t.status}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
