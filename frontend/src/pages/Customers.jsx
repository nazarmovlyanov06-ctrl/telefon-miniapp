import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Users, Search, CircleX, Star, User, Ban, Plus } from "lucide-react";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.customers(q).then(setCustomers).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.createCustomer(form);
      setShowForm(false);
      setForm({ name: "", phone: "", notes: "" });
      api.customers(q).then(setCustomers);
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 12 }}>
        <div className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 9 }}>
          <Users size={19} strokeWidth={2} /> Müşteriler
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? "İptal" : <><Plus size={14} strokeWidth={2.4} /> Yeni Müşteri</>}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 12 }}>
          <form onSubmit={submit}>
            {err && (
              <div style={{ color: "var(--red)", fontSize: 13, padding: "8px 0", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <CircleX size={14} strokeWidth={2} /> {err}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Ad Soyad *</label>
              <input className="form-input" required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Müşteri adı" />
            </div>
            <div className="form-group">
              <label className="form-label">Telefon</label>
              <input className="form-input" value={form.phone} inputMode="tel"
                onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0555 123 45 67" />
            </div>
            <div className="form-group">
              <label className="form-label">Not</label>
              <input className="form-input" value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Opsiyonel" />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}

      <div className="search-bar">
        <div className="inset search-input" style={{ borderRadius: 13, display: "flex", alignItems: "center", gap: 9, flex: 1 }}>
          <Search size={16} stroke="var(--hint)" strokeWidth={2} />
          <input
            style={{ background: "none", border: "none", outline: "none", color: "var(--text)", font: "inherit", fontSize: 15, flex: 1 }}
            placeholder="Ad veya telefon ara..."
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : customers.length === 0 ? (
        <div className="empty">
          <div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}>
            <Users size={40} stroke="var(--dim)" strokeWidth={1.5} />
          </div>
          {q ? "Müşteri bulunamadı" : "Henüz müşteri eklenmedi"}
        </div>
      ) : (
        customers.map((c) => (
          <div key={c.id} className="list-item" onClick={() => navigate(`/customers/${c.id}`)}>
            <div style={{ position: "relative", zIndex: 1, display: "flex" }}>
              {c.is_vip
                ? <Star size={22} stroke="var(--gold)" fill="var(--gold)" strokeWidth={1.5} />
                : <User size={22} stroke="var(--hint)" strokeWidth={1.7} />}
            </div>
            <div className="list-item-body">
              <div className="list-item-title">{c.name}</div>
              <div className="list-item-sub">{c.phone || "Telefon yok"} · {c.visit_count} ziyaret</div>
            </div>
            {c.is_blacklisted ? (
              <span className="badge" style={{ background: "rgba(248,113,113,0.15)", color: "var(--red)", position: "relative", zIndex: 1, display: "flex" }}>
                <Ban size={13} strokeWidth={2} />
              </span>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
