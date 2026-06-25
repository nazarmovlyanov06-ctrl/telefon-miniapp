import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.customers(q).then(setCustomers).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="page">
      <div className="page-title">👥 Müşteriler</div>

      <div className="search-bar">
        <input className="search-input" placeholder="🔍 Ad veya telefon ara..."
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : customers.length === 0 ? (
        <div className="empty"><div className="empty-icon">👥</div>Müşteri bulunamadı</div>
      ) : (
        customers.map((c) => (
          <div key={c.id} className="list-item" onClick={() => navigate(`/customers/${c.id}`)}>
            <div style={{ fontSize: 28 }}>{c.is_vip ? "⭐" : "👤"}</div>
            <div className="list-item-body">
              <div className="list-item-title">{c.name}</div>
              <div className="list-item-sub">{c.phone || "Telefon yok"} · {c.visit_count} ziyaret</div>
            </div>
            {c.is_blacklisted ? <span className="badge" style={{ background: "#fee2e2", color: "#991b1b" }}>🚫</span> : null}
          </div>
        ))
      )}
    </div>
  );
}
