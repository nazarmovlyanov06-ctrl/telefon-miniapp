import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";

const STATUS_LABEL = {
  bekliyor: "⏳ Bekliyor", tamirde: "🔧 Tamirde",
  parca_bekleniyor: "📦 Parça", hazir: "✅ Hazır", teslim: "🏠 Teslim",
};

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [debts, setDebts] = useState([]);
  const [ikinciel, setIkinciel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("tamirler");

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const [c, r, d, ie] = await Promise.all([
        api.customer(id),
        api.customerRepairs(id),
        api.debts(),
        api.customerIkinciEl(id),
      ]);
      setCustomer(c);
      setRepairs(r);
      setIkinciel(ie);
      setForm({ name: c.name, phone: c.phone || "", notes: c.notes || "" });
      setDebts(d.filter(db => db.customer_id === parseInt(id)));
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function save(e) {
    e.preventDefault(); setErr("");
    try {
      await api.updateCustomer(id, form);
      setCustomer(c => ({ ...c, ...form }));
      setEdit(false);
    } catch (e) { setErr(e.message); }
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (!customer) return <div className="empty">Müşteri bulunamadı</div>;

  const totalDebt = debts.reduce((s, d) => s + (d.remaining || 0), 0);
  const totalRepairs = repairs.reduce((s, r) => s + (r.final_price || r.estimated_price || 0), 0);

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>👤 {customer.name}</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setEdit(!edit)}>
          {edit ? "İptal" : "✏️ Düzenle"}
        </button>
      </div>

      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>❌ {err}</div>}

      {edit ? (
        <div className="card">
          <form onSubmit={save}>
            <div className="form-group">
              <label className="form-label">Ad Soyad *</label>
              <input className="form-input" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Telefon</label>
              <input className="form-input" value={form.phone} inputMode="tel"
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Not</label>
              <input className="form-input" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(false)}>İptal</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 12 }}>
          {customer.phone && <div style={{ fontSize: 14, marginBottom: 4 }}>📞 {customer.phone}</div>}
          {customer.notes && <div style={{ fontSize: 13, color: "var(--hint)" }}>📝 {customer.notes}</div>}
        </div>
      )}

      {/* Özet */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div className="card" style={{ textAlign: "center", margin: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{repairs.length}</div>
          <div style={{ fontSize: 11, color: "var(--hint)" }}>Tamir</div>
        </div>
        <div className="card" style={{ textAlign: "center", margin: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{totalRepairs.toLocaleString("tr-TR")}₺</div>
          <div style={{ fontSize: 11, color: "var(--hint)" }}>Toplam</div>
        </div>
        <div className="card" style={{ textAlign: "center", margin: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: totalDebt > 0 ? "var(--danger)" : "var(--text)" }}>
            {totalDebt.toLocaleString("tr-TR")}₺
          </div>
          <div style={{ fontSize: 11, color: "var(--hint)" }}>Borç</div>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="tabs" style={{ marginBottom: 10 }}>
        <button className={`tab ${tab === "tamirler" ? "active" : ""}`} onClick={() => setTab("tamirler")}>
          🔧 Tamirler ({repairs.length})
        </button>
        <button className={`tab ${tab === "borclar" ? "active" : ""}`} onClick={() => setTab("borclar")}>
          💰 Borçlar ({debts.length})
        </button>
        <button className={`tab ${tab === "ikinciel" ? "active" : ""}`} onClick={() => setTab("ikinciel")}>
          📱 2. El ({ikinciel.length})
        </button>
      </div>

      {tab === "tamirler" && (
        repairs.length === 0 ? (
          <div className="empty"><div className="empty-icon">🔧</div>Tamir kaydı yok</div>
        ) : repairs.map(r => (
          <div key={r.id} className="list-item" onClick={() => navigate(`/repairs/${r.id}`)}>
            <div className="list-item-body">
              <div className="list-item-title">#{r.repair_no} · {r.device_model}</div>
              <div className="list-item-sub">
                {r.fault_desc || "—"}
                {r.final_price ? ` · ₺${r.final_price}` : r.estimated_price ? ` · ~₺${r.estimated_price}` : ""}
              </div>
              <div style={{ fontSize: 11, color: "var(--hint)" }}>
                {new Date(r.created_at).toLocaleDateString("tr-TR")}
              </div>
            </div>
            <span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span>
          </div>
        ))
      )}

      {tab === "borclar" && (
        debts.length === 0 ? (
          <div className="empty"><div className="empty-icon">💰</div>Borç kaydı yok</div>
        ) : debts.map(d => (
          <div key={d.id} className="card">
            <div className="card-row">
              <div>
                <div style={{ fontWeight: 600 }}>{d.description || d.notes || "Borç"}</div>
                {d.due_date && <div style={{ fontSize: 12, color: "var(--hint)" }}>Vade: {d.due_date}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: "var(--danger)" }}>₺{(d.remaining || 0).toLocaleString("tr-TR")}</div>
                <div style={{ fontSize: 11, color: "var(--hint)" }}>/{(d.total_amount || 0).toLocaleString("tr-TR")}</div>
              </div>
            </div>
          </div>
        ))
      )}

      {tab === "ikinciel" && (
        ikinciel.length === 0 ? (
          <div className="empty"><div className="empty-icon">📱</div>2. El kaydı yok</div>
        ) : ikinciel.map(c => (
          <div key={c.id + c.yon} className="card">
            <div className="card-row">
              <div>
                <div style={{ fontWeight: 600 }}>📱 {c.model}</div>
                {c.imei && <div style={{ fontSize: 12, color: "var(--hint)" }}>IMEI: {c.imei}</div>}
                <div style={{ fontSize: 12, color: c.yon === "alim" ? "var(--success)" : "var(--hint)" }}>
                  {c.yon === "alim" ? "⬇️ Bizden sattı" : "⬆️ Satın aldı"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {c.yon === "alim" && (
                  <div style={{ fontWeight: 700 }}>₺{(c.alis_fiyati || 0).toLocaleString("tr-TR")}</div>
                )}
                {c.yon === "satim" && c.satis_fiyati && (
                  <div style={{ fontWeight: 700, color: "var(--success)" }}>₺{c.satis_fiyati.toLocaleString("tr-TR")}</div>
                )}
                <div style={{ fontSize: 11, color: "var(--hint)" }}>
                  {c.yon === "alim" ? c.alis_tarihi : c.satis_tarihi || "—"}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
