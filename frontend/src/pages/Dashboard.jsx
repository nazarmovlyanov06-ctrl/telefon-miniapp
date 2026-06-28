import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const QUICK = [
  { icon: "📱", label: "2. El",     path: "/ikinciel",    bg: "#8b5cf6", shadow: "#8b5cf620" },
  { icon: "📦", label: "Sıfır",    path: "/sifir-cihaz", bg: "#3b82f6", shadow: "#3b82f620" },
  { icon: "🛡️", label: "Garanti",  path: "/garanti",     bg: "#10b981", shadow: "#10b98120" },
  { icon: "📋", label: "Siparişler",path: "/parts",       bg: "#f59e0b", shadow: "#f59e0b20" },
  { icon: "🎧", label: "Aksesuar", path: "/aksesuar",    bg: "#ec4899", shadow: "#ec489920" },
  { icon: "💳", label: "Borçlar",  path: "/debts",       bg: "#ef4444", shadow: "#ef444420" },
  { icon: "📊", label: "Rapor",    path: "/stats",       bg: "#06b6d4", shadow: "#06b6d420" },
  { icon: "✨", label: "Yardımcı", path: "/ai",          bg: "#0ea5e9", shadow: "#0ea5e920" },
];

const DURUM_RENK = {
  bekliyor: "#f59e0b",
  tamirde: "#3b82f6",
  parca_bekleniyor: "#8b5cf6",
  hazir: "#10b981",
};

const DURUM_LABEL = {
  bekliyor: "⏳ Bekliyor",
  tamirde: "🔧 Tamirde",
  parca_bekleniyor: "📦 Parça",
  hazir: "✅ Hazır",
};

function fmt(n) {
  if (!n) return "0";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return Math.round(n).toString();
}

function gun_fark(tarih) {
  if (!tarih) return null;
  const gun = Math.floor((Date.now() - new Date(tarih).getTime()) / 86400000);
  if (gun === 0) return "Bugün";
  if (gun === 1) return "Dün";
  return `${gun} gün önce`;
}

export default function Dashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.dashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 40 }}>🔧</div>
      <div style={{ color: "var(--hint)", fontSize: 14 }}>Yükleniyor...</div>
    </div>
  );

  const bugun = data?.bugun || {};
  const bu_ay = data?.bu_ay || {};
  const bekleyen = data?.bekleyen || {};
  const stok_uyari = data?.stok_uyari || 0;
  const durumlar = data?.tamir_durumlar || {};
  const uyarilar = data?.uyarilar || {};
  const aranacaklar = data?.aranacaklar || [];
  const kasa = data?.kasa_bugun || {};

  const isim = user?.name?.split(" ")[0] || "";
  const saat = new Date().getHours();
  const selam = saat < 12 ? "☀️ Günaydın" : saat < 18 ? "👋 Merhaba" : "🌙 İyi akşamlar";

  return (
    <div className="page" style={{ paddingBottom: 90 }}>

      {/* Arama barı */}
      <div
        onClick={() => navigate("/search")}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "var(--card)", borderRadius: 14,
          padding: "12px 16px", marginBottom: 16, cursor: "pointer",
          border: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: 18 }}>🔍</span>
        <span style={{ color: "var(--hint)", fontSize: 14, flex: 1 }}>
          Müşteri, tamir no, model, IMEI ara...
        </span>
      </div>

      {/* Selam + isim */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--hint)" }}>{selam}{isim ? `, ${isim}` : ""}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Bugün</div>
      </div>

      {/* Tamir durum sayıları */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
        {["bekliyor", "tamirde", "parca_bekleniyor", "hazir"].map(k => (
          <div key={k} onClick={() => navigate(`/repairs?status=${k}`)}
            style={{
              background: "var(--card)", borderRadius: 12, padding: "10px 6px",
              textAlign: "center", cursor: "pointer",
              borderBottom: `3px solid ${DURUM_RENK[k]}`,
            }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: DURUM_RENK[k] }}>
              {durumlar[k] || 0}
            </div>
            <div style={{ fontSize: 9, color: "var(--hint)", marginTop: 2 }}>{DURUM_LABEL[k]}</div>
          </div>
        ))}
      </div>

      {/* Bugün kasa */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div className="card" style={{ margin: 0, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, color: "var(--hint)", marginBottom: 2 }}>💰 Bugün Gelir</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#10b981" }}>{fmt(kasa.gelir)}₺</div>
        </div>
        <div className="card" style={{ margin: 0, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, color: "var(--hint)", marginBottom: 2 }}>📉 Bugün Gider</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#ef4444" }}>{fmt(kasa.gider)}₺</div>
        </div>
      </div>

      {/* Bu ay */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-row">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>
              {(bu_ay.gelir || 0).toLocaleString("tr-TR")}₺
            </div>
            <div style={{ fontSize: 12, color: "var(--hint)" }}>Bu ay kazanç</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 600 }}>{bu_ay.tamir || 0} tamir</div>
            <div style={{ fontSize: 12, color: "var(--hint)" }}>{bugun.tamir_sayisi || 0} bugün açıldı</div>
          </div>
        </div>
      </div>

      {/* Uyarılar */}
      {((uyarilar.stok?.length || 0) + (uyarilar.garanti?.length || 0) + (uyarilar.borc?.length || 0)) > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {(uyarilar.stok || []).map((u, i) => (
            <div key={"s"+i} onClick={() => navigate("/parts")}
              style={{ background: "rgba(245,158,11,0.12)", borderRadius: 10, padding: "8px 12px", cursor: "pointer", borderLeft: "3px solid #f59e0b" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b" }}>📦 {u.name} — stok kritik ({u.quantity} kaldı)</div>
            </div>
          ))}
          {(uyarilar.borc || []).map((u, i) => (
            <div key={"b"+i} onClick={() => navigate("/debts")}
              style={{ background: "rgba(239,68,68,0.12)", borderRadius: 10, padding: "8px 12px", cursor: "pointer", borderLeft: "3px solid #ef4444" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>💳 {u.musteri_adi} — {(u.kalan || 0).toLocaleString("tr-TR")}₺ gecikmiş borç</div>
            </div>
          ))}
          {(uyarilar.garanti || []).map((u, i) => (
            <div key={"g"+i} onClick={() => navigate("/garanti")}
              style={{ background: "rgba(59,130,246,0.12)", borderRadius: 10, padding: "8px 12px", cursor: "pointer", borderLeft: "3px solid #3b82f6" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#3b82f6" }}>🛡️ {u.musteri_adi} — {u.cihaz} garanti bitiyor ({u.bitis_tarihi})</div>
            </div>
          ))}
        </div>
      )}

      {/* Aranacaklar */}
      {aranacaklar.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#10b981", marginBottom: 8 }}>📞 Aranacaklar ({aranacaklar.length})</div>
          {aranacaklar.slice(0, 3).map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
              <div style={{ flex: 1, fontSize: 13, cursor: "pointer" }} onClick={() => navigate(`/repairs/${a.id}`)}>
                <span style={{ fontWeight: 600 }}>{a.musteri_adi || "—"}</span> — {a.device_model}
              </div>
              {a.telefon && (
                <a href={`tel:${a.telefon}`} onClick={e => e.stopPropagation()}
                  style={{ width: 30, height: 30, borderRadius: "50%", background: "#25D366", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 14, flexShrink: 0 }}>
                  ☎️
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hızlı Erişim */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--hint)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Hızlı Erişim
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        {QUICK.map(q => (
          <div key={q.path} onClick={() => navigate(q.path)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: q.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
              boxShadow: `0 4px 12px ${q.shadow}`,
            }}>
              {q.icon}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", textAlign: "center", lineHeight: 1.2 }}>
              {q.label}
            </span>
          </div>
        ))}
      </div>

      {/* Bekleyenler */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--hint)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Bekleyenler
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        {[
          { label: "🔧 Aktif Tamir", value: bekleyen.tamir, path: "/repairs" },
          { label: "💰 Açık Borç", value: bekleyen.borc, path: "/debts" },
        ].map((item, i) => (
          <div key={i}>
            <div className="card-row" style={{ padding: "10px 0", cursor: "pointer" }}
              onClick={() => navigate(item.path)}>
              <span>{item.label}</span>
              <span style={{ fontWeight: 700, color: item.value > 0 ? "var(--accent)" : "var(--hint)" }}>
                {item.value || 0}
              </span>
            </div>
            {i < 1 && <div className="divider" />}
          </div>
        ))}
      </div>

      {stok_uyari > 0 && (
        <div style={{ background: "rgba(245,158,11,0.12)", borderRadius: 10, padding: "10px 14px", cursor: "pointer", marginBottom: 14, borderLeft: "3px solid #f59e0b" }}
          onClick={() => navigate("/parts?low_stock=true")}>
          <div className="card-row">
            <span style={{ color: "#f59e0b", fontWeight: 600 }}>⚠️ Azalan Stok</span>
            <span style={{ fontWeight: 700, color: "#f59e0b" }}>{stok_uyari} ürün →</span>
          </div>
        </div>
      )}

      <button className="btn btn-primary" onClick={() => navigate("/repairs/new")}>
        ➕ Yeni Tamir Kaydı
      </button>
    </div>
  );
}
