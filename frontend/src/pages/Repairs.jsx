import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  parca_bekleniyor: "Parça Bekliyor", hazir: "Hazır", teslim: "Teslim",
};

export default function Repairs() {
  const [repairs, setRepairs] = useState([]);
  const [tab, setTab] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
        <input
          className="search-input"
          placeholder="🔍 Müşteri, model, tamir no..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="tabs">
        {TABS.map((t) => (
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
        repairs.map((r) => (
          <div key={r.id} className="list-item" onClick={() => navigate(`/repairs/${r.id}`)}>
            <div className="list-item-body">
              <div className="list-item-title">{r.customer_name || "—"} · {r.device_model}</div>
              <div className="list-item-sub">#{r.repair_no} · {r.fault_desc}</div>
            </div>
            <span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status]}</span>
          </div>
        ))
      )}
    </div>
  );
}
