import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

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
      <div className="page-title">👋 Merhaba, {user?.name?.split(" ")[0] || "Hoş geldin"}</div>

      <div className="section-title">Bugün</div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{bugun.tamir_sayisi}</div>
          <div className="stat-label">Yeni Tamir</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{bugun.teslim_sayisi}</div>
          <div className="stat-label">Teslim Edilen</div>
        </div>
      </div>
      <div className="card">
        <div className="card-row">
          <span style={{ color: "var(--hint)" }}>Bugünkü Gelir</span>
          <span style={{ fontWeight: 700, fontSize: 18 }}>
            ₺{bugun.gelir.toLocaleString("tr-TR", { minimumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <div className="section-title">Bu Ay</div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{bu_ay.tamir_sayisi}</div>
          <div className="stat-label">Tamir</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{bu_ay.yeni_musteri}</div>
          <div className="stat-label">Yeni Müşteri</div>
        </div>
      </div>
      <div className="card">
        <div className="card-row">
          <span style={{ color: "var(--hint)" }}>Aylık Gelir</span>
          <span style={{ fontWeight: 700, fontSize: 18 }}>
            ₺{bu_ay.gelir.toLocaleString("tr-TR", { minimumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <div className="section-title">Bekleyenler</div>
      <div className="card">
        {[
          { label: "🔧 Aktif Tamir", value: bekleyen.tamir, path: "/repairs" },
          { label: "📦 Sipariş", value: bekleyen.siparis, path: "/parts?tab=orders" },
          { label: "💰 Borçlu", value: bekleyen.borc, path: "/debts" },
          { label: "🛒 Alışveriş", value: bekleyen.alisveris, path: "/shopping" },
        ].map((item, i) => (
          <div key={i}>
            <div
              className="card-row"
              style={{ padding: "10px 0", cursor: "pointer" }}
              onClick={() => navigate(item.path)}
            >
              <span>{item.label}</span>
              <span style={{
                fontWeight: 700,
                color: item.value > 0 ? "var(--accent)" : "var(--hint)"
              }}>
                {item.value}
              </span>
            </div>
            {i < 3 && <div className="divider" />}
          </div>
        ))}
      </div>

      {stok_uyari > 0 && (
        <div
          className="card"
          style={{ background: "#fff7ed", cursor: "pointer" }}
          onClick={() => navigate("/parts?low=1")}
        >
          <div className="card-row">
            <span>⚠️ Azalan Stok</span>
            <span style={{ fontWeight: 700, color: "var(--warn)" }}>{stok_uyari} ürün</span>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => navigate("/repairs/new")}>
          ➕ Yeni Tamir Kaydı
        </button>
      </div>
    </div>
  );
}
