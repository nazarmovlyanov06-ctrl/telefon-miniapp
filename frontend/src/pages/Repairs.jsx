import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../api";

const TABS = [
  { key: "", label: "Tümü" },
  { key: "bekliyor", label: "⏳ Bekliyor" },
  { key: "tamirde", label: "🔧 Tamirde" },
  { key: "parca_bekleniyor", label: "📦 Parça" },
  { key: "hazir", label: "✅ Hazır" },
  { key: "teslim", label: "🏠 Teslim" },
];

const STATUS_LABEL = {
  bekliyor: "Bekliyor", tamirde: "Tamirde",
  parca_bekleniyor: "Parça", hazir: "Hazır", teslim: "Teslim",
};

const STATUS_RENK = {
  bekliyor: "#f59e0b", tamirde: "#3b82f6",
  parca_bekleniyor: "#8b5cf6", hazir: "#10b981", teslim: "#6b7280",
};

function servisSuresi(created_at, status) {
  if (!created_at || status === "teslim") return null;
  const gun = Math.floor((Date.now() - new Date(created_at).getTime()) / 86400000);
  return gun;
}

function ServisGun({ gun, status }) {
  if (gun === null || status === "teslim") return null;
  let renk = "#10b981";
  if (gun >= 3) renk = "#f59e0b";
  if (gun >= 7) renk = "#ef4444";
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color: renk,
      background: renk + "18", padding: "2px 6px", borderRadius: 6,
    }}>
      {gun === 0 ? "Bugün" : `${gun}g`}
    </span>
  );
}

export default function Repairs() {
  const [repairs, setRepairs] = useState([]);
  const [tab, setTab] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const s = params.get("status");
    if (s) setTab(s);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (tab) params.status = tab;
    if (q) params.q = q;
    api.repairs(params).then(setRepairs).finally(() => setLoading(false));
  }, [tab, q]);

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div className="page-title" style={{ margin: 0 }}>🔧 Tamirler</div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate("/repairs/new")}>+ Yeni</button>
      </div>

      <div className="search-bar">
        <input className="search-input" placeholder="🔍 Müşteri, model, tamir no..."
          value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : repairs.length === 0 ? (
        <div className="empty"><div className="empty-icon">🔧</div>Tamir bulunamadı</div>
      ) : (
        repairs.map(r => {
          const gun = servisSuresi(r.created_at, r.status);
          return (
            <div key={r.id} className="list-item" onClick={() => navigate(`/repairs/${r.id}`)}>
              <div style={{
                width: 4, borderRadius: 4, alignSelf: "stretch", flexShrink: 0,
                background: STATUS_RENK[r.status] || "var(--bg2)",
                marginRight: 4,
              }} />
              <div className="list-item-body">
                <div className="list-item-title">
                  {r.customer_name || "—"} · {r.device_model}
                </div>
                <div className="list-item-sub">
                  #{r.repair_no} · {r.fault_desc || "—"}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                <ServisGun gun={gun} status={r.status} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
