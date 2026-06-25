import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Debts() {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [musteriler, setMusteriler] = useState([]);
  const [oneriler, setOneriler] = useState([]);
  const [showOneriler, setShowOneriler] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [odemeler, setOdemeler] = useState({});
  const [form, setForm] = useState({
    customer_id: null, customer_name_display: "",
    total_amount: "", payment_type: "borc", installment_count: "1",
    due_date: "", notes: ""
  });
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    load();
    api.customers("").then(setMusteriler).catch(() => {});
  }, []);

  const load = () => api.debts().then(setDebts).finally(() => setLoading(false));

  function handleMusteriChange(val) {
    setForm(f => ({ ...f, customer_name_display: val, customer_id: null }));
    if (val.length >= 2) {
      const q = val.toLowerCase();
      const found = musteriler.filter(m =>
        m.name.toLowerCase().includes(q) || (m.phone || "").includes(q)
      ).slice(0, 5);
      setOneriler(found); setShowOneriler(found.length > 0);
    } else { setShowOneriler(false); }
  }

  async function submitYeniBorc(e) {
    e.preventDefault(); setErr("");
    if (!form.customer_id) { setErr("Müşteri seçilmelidir"); return; }
    try {
      await api.createDebt({
        customer_id: form.customer_id,
        total_amount: parseFloat(form.total_amount),
        payment_type: form.payment_type,
        installment_count: parseInt(form.installment_count),
        due_date: form.due_date || null,
        notes: form.notes,
      });
      setShowForm(false);
      setForm({ customer_id: null, customer_name_display: "", total_amount: "", payment_type: "borc", installment_count: "1", due_date: "", notes: "" });
      setShowOneriler(false);
      load();
    } catch (e) { setErr(e.message); }
  }

  async function pay(debt) {
    const amount = prompt(`${debt.customer_name} - Ödeme miktarı (₺)?`);
    if (!amount) return;
    await api.payDebt(debt.id, { amount: parseFloat(amount) });
    load();
    if (expandedId === debt.id) loadOdemeler(debt.id);
  }

  async function loadOdemeler(id) {
    const data = await api.debtOdemeler(id);
    setOdemeler(o => ({ ...o, [id]: data }));
  }

  function toggleExpand(id) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!odemeler[id]) loadOdemeler(id);
  }

  const total = debts.reduce((s, d) => s + (d.remaining || 0), 0);

  const PAYMENT_TYPES = [
    { value: "borc", label: "💳 Normal Borç" },
    { value: "taksit", label: "📅 Taksit" },
    { value: "senet", label: "📄 Senet" },
  ];

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/more")}>← Geri</button>
        <div className="page-title" style={{ margin: 0, flex: 1 }}>💰 Borçlar</div>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(!showForm); setErr(""); }}>+ Yeni</button>
      </div>

      {!loading && debts.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-row">
            <span style={{ color: "var(--hint)" }}>Toplam Alacak</span>
            <span style={{ fontWeight: 800, fontSize: 20, color: "var(--danger)" }}>
              ₺{total.toLocaleString("tr-TR")}
            </span>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Yeni Borç Kaydı</div>
          <form onSubmit={submitYeniBorc}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>❌ {err}</div>}
            <div className="form-group" style={{ position: "relative" }}>
              <label className="form-label">Müşteri *</label>
              <input className="form-input" required
                value={form.customer_name_display}
                onChange={e => handleMusteriChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowOneriler(false), 150)}
                placeholder="Müşteri adı yaz..." autoComplete="off" />
              {showOneriler && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden" }}>
                  {oneriler.map(m => (
                    <div key={m.id}
                      onMouseDown={() => { setForm(f => ({ ...f, customer_id: m.id, customer_name_display: m.name })); setShowOneriler(false); }}
                      style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14,
                        borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                      <span>👤 {m.name}</span>
                      {m.phone && <span style={{ fontSize: 12, color: "var(--hint)" }}>{m.phone}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Borç Türü</label>
              <select className="form-select" value={form.payment_type}
                onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))}>
                {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Tutar (₺) *</label>
                <input className="form-input" type="number" required min="1"
                  value={form.total_amount}
                  onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
              </div>
              {form.payment_type === "taksit" && (
                <div className="form-group">
                  <label className="form-label">Taksit Sayısı</label>
                  <input className="form-input" type="number" min="2"
                    value={form.installment_count}
                    onChange={e => setForm(f => ({ ...f, installment_count: e.target.value }))} />
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Vade Tarihi</label>
              <input className="form-input" type="date" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Not</label>
              <input className="form-input" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : debts.length === 0 ? (
        <div className="empty"><div className="empty-icon">💰</div>Açık borç yok</div>
      ) : (
        debts.map((d) => (
          <div key={d.id} className="card" style={{ marginBottom: 8 }}>
            <div className="card-row" onClick={() => toggleExpand(d.id)} style={{ cursor: "pointer" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{d.customer_name}</div>
                <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 2 }}>
                  {d.customer_phone || ""}
                  {d.payment_type === "taksit" ? " · Taksit" : d.payment_type === "senet" ? " · Senet" : ""}
                  {d.due_date ? ` · Vade: ${new Date(d.due_date).toLocaleDateString("tr-TR")}` : ""}
                </div>
                {d.notes && <div style={{ fontSize: 12, color: "var(--hint)" }}>{d.notes}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: "var(--danger)", fontSize: 17 }}>
                  ₺{(d.remaining || 0).toLocaleString("tr-TR")}
                </div>
                <div style={{ fontSize: 12, color: "var(--hint)" }}>
                  /{(d.total_amount || 0).toLocaleString("tr-TR")}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => pay(d)}>💵 Ödeme Al</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleExpand(d.id)}>
                {expandedId === d.id ? "▲ Gizle" : "▼ Geçmiş"}
              </button>
            </div>
            {expandedId === d.id && (
              <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Ödeme Geçmişi</div>
                {!(odemeler[d.id]?.length) ? (
                  <div style={{ fontSize: 12, color: "var(--hint)" }}>Ödeme kaydı yok</div>
                ) : odemeler[d.id].map(o => (
                  <div key={o.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--hint)" }}>{o.paid_at ? new Date(o.paid_at).toLocaleDateString("tr-TR") : "—"} {o.payment_type === "kart" ? "💳" : "💵"}</span>
                    <span style={{ fontWeight: 600, color: "var(--success)" }}>+₺{(o.amount || 0).toLocaleString("tr-TR")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
