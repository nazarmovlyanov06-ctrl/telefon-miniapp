import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const QUICK = [
  { icon: "🏦", label: "Kasa",    path: "/kasa",     color: "#dcfce7" },
  { icon: "📱", label: "2. El",   path: "/ikinciel", color: "#f0fdf4" },
  { icon: "🛡️", label: "Garanti", path: "/garanti",  color: "#eff6ff" },
  { icon: "🏭", label: "Toptancı",path: "/toptanci", color: "#f0f9ff" },
  { icon: "🛒", label: "Alışveriş", path: "/parts",   color: "#fdf4ff" },
  { icon: "🎧", label: "Aksesuar",path: "/aksesuar", color: "#fff7ed" },
];

export default function Dashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.dashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (!data) return null;

  const { bugun, bu_ay, bekleyen, stok_uyari } = data;

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--hint)" }}>Hoş geldin 👋</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{user?.name?.split(" ")[0] || "Mağaza"}</div>
      </div>

      {/* Bugün özet */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div className="card" style={{ margin: 0, textAlign: "center", padding: "12px 8px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>{bugun.tamir_sayisi}</div>
          <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>Yeni Tamir</div>
        </div>
        <div className="card" style={{ margin: 0, textAlign: "center", padding: "12px 8px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--success)" }}>{bugun.teslim_sayisi}</div>
          <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>Teslim</div>
        </div>
        <div className="card" style={{ margin: 0, textAlign: "center", padding: "12px 8px" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
            {bugun.gelir > 999 ? (bugun.gelir / 1000).toFixed(1) + "K" : bugun.gelir}
          </div>
          <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>₺ Gelir</div>
        </div>
      </div>

      {/* Bu ay gelir */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-row">
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>₺{bu_ay.gelir.toLocaleString("tr-TR")}</div>
            <div style={{ fontSize: 12, color: "var(--hint)" }}>Bu ay toplam gelir</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 600 }}>{bu_ay.tamir_sayisi} tamir</div>
            <div style={{ fontSize: 12, color: "var(--hint)" }}>{bu_ay.yeni_musteri} yeni müşteri</div>
          </div>
        </div>
      </div>

      {/* Hızlı Erişim */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--hint)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Hızlı Erişim
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 14, scrollbarWidth: "none" }}>
        {QUICK.map(q => (
          <div
            key={q.path}
            onClick={() => navigate(q.path)}
            style={{
              flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 5, cursor: "pointer", width: 64,
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14, background: q.color,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
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
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--hint)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Bekleyenler
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        {[
          { label: "🔧 Aktif Tamir", value: bekleyen.tamir, path: "/repairs" },
          { label: "📦 Sipariş", value: bekleyen.siparis, path: "/parts?tab=orders" },
          { label: "💰 Borçlu", value: bekleyen.borc, path: "/debts" },
        ].map((item, i) => (
          <div key={i}>
            <div className="card-row" style={{ padding: "10px 0", cursor: "pointer" }} onClick={() => navigate(item.path)}>
              <span>{item.label}</span>
              <span style={{ fontWeight: 700, color: item.value > 0 ? "var(--accent)" : "var(--hint)" }}>
                {item.value}
              </span>
            </div>
            {i < 2 && <div className="divider" />}
          </div>
        ))}
      </div>

      {stok_uyari > 0 && (
        <div className="card" style={{ background: "#fff7ed", cursor: "pointer", marginBottom: 14 }} onClick={() => navigate("/parts?low=1")}>
          <div className="card-row">
            <span>⚠️ Azalan Stok</span>
            <span style={{ fontWeight: 700, color: "var(--warn)" }}>{stok_uyari} ürün</span>
          </div>
        </div>
      )}

      <button className="btn btn-primary" onClick={() => navigate("/repairs/new")}>
        ➕ Yeni Tamir Kaydı
      </button>
    </div>
  );
}
