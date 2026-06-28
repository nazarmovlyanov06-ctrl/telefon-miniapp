import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";

const STATUS_LABEL = {
  bekliyor: "⏳ Bekliyor", tamirde: "🔧 Tamirde",
  parca_bekleniyor: "📦 Parça", hazir: "✅ Hazır", teslim: "🏠 Teslim",
};

const TUR_LABEL = {
  tamir: { icon: "🔧", label: "Tamir", color: "#3b82f6" },
  borc: { icon: "💰", label: "Borç", color: "#ef4444" },
  "2el_alim": { icon: "📲", label: "2.El Sattı", color: "#8b5cf6" },
  "2el_satim": { icon: "📱", label: "2.El Aldı", color: "#10b981" },
  sifir_alim: { icon: "📦", label: "Sıfır Sattı", color: "#8b5cf6" },
  sifir_satim: { icon: "📦", label: "Sıfır Aldı", color: "#10b981" },
};

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR");
}

function fmtDateTime(d) {
  if (!d) return null;
  const dt = new Date(d);
  return dt.toLocaleDateString("tr-TR") + " " + dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [debts, setDebts] = useState([]);
  const [gecmis, setGecmis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("ziyaretler");

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const [c, r, d, g] = await Promise.all([
        api.customer(id),
        api.customerRepairs(id),
        api.debts(),
        api.customerGecmis(id),
      ]);
      setCustomer(c);
      setRepairs(r);
      setGecmis(g);
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

  const totalDebt = debts.reduce((s, d) => s + ((d.total_amount || d.amount || 0) - (d.paid_amount || d.paid || 0)), 0);
  const totalRepairs = repairs.reduce((s, r) => s + (r.final_price || r.estimated_price || 0), 0);
  const ziyaretSayisi = gecmis.length;

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
          {customer.phone && (
            <div style={{ fontSize: 14, marginBottom: 4 }}>
              📞 <a href={`tel:${customer.phone}`} style={{ color: "var(--accent)" }}>{customer.phone}</a>
            </div>
          )}
          {customer.notes && <div style={{ fontSize: 13, color: "var(--hint)" }}>📝 {customer.notes}</div>}
          <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 4 }}>
            🗓️ Kayıt: {fmt(customer.created_at)}
          </div>
        </div>
      )}

      {/* Özet */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
        {[
          { val: ziyaretSayisi, label: "Ziyaret", color: "var(--accent)" },
          { val: repairs.length, label: "Tamir", color: "var(--text)" },
          { val: `${totalRepairs.toLocaleString("tr-TR")}₺`, label: "Harcama", color: "var(--text)" },
          { val: `${Math.abs(totalDebt).toLocaleString("tr-TR")}₺`, label: totalDebt > 0 ? "Borç" : "Bakiye", color: totalDebt > 0 ? "var(--danger)" : "var(--success)" },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: "center", margin: 0, padding: "10px 4px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sekmeler */}
      <div className="tabs" style={{ marginBottom: 10 }}>
        <button className={`tab ${tab === "ziyaretler" ? "active" : ""}`} onClick={() => setTab("ziyaretler")}>
          📅 Ziyaretler ({ziyaretSayisi})
        </button>
        <button className={`tab ${tab === "tamirler" ? "active" : ""}`} onClick={() => setTab("tamirler")}>
          🔧 Tamirler ({repairs.length})
        </button>
        <button className={`tab ${tab === "borclar" ? "active" : ""}`} onClick={() => setTab("borclar")}>
          💰 Borçlar ({debts.length})
        </button>
        <button className={`tab ${tab === "notlar" ? "active" : ""}`} onClick={() => setTab("notlar")}>
          📝 Notlar
        </button>
      </div>

      {/* Ziyaretler - tüm geçmiş */}
      {tab === "ziyaretler" && (
        gecmis.length === 0 ? (
          <div className="empty"><div className="empty-icon">📅</div>Henüz kayıt yok</div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* Dikey çizgi */}
            <div style={{
              position: "absolute", left: 15, top: 0, bottom: 0,
              width: 2, background: "var(--border)",
            }} />
            {gecmis.map((ev, i) => {
              const t = TUR_LABEL[ev.tur] || { icon: "•", label: ev.tur, color: "var(--hint)" };
              return (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, position: "relative" }}>
                  {/* İkon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: t.color + "20", border: `2px solid ${t.color}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, flexShrink: 0, zIndex: 1,
                  }}>{t.icon}</div>

                  {/* İçerik */}
                  <div
                    className="card"
                    style={{ flex: 1, margin: 0, padding: "10px 12px", cursor: ev.repair_id ? "pointer" : "default" }}
                    onClick={() => ev.repair_id && navigate(`/repairs/${ev.repair_id}`)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: t.color,
                          background: t.color + "15", padding: "1px 6px", borderRadius: 4, marginRight: 6,
                        }}>{t.label}</span>
                        {ev.durum && (
                          <span style={{ fontSize: 11, color: "var(--hint)" }}>
                            {STATUS_LABEL[ev.durum] || ev.durum}
                          </span>
                        )}
                      </div>
                      {ev.tutar && (
                        <span style={{ fontWeight: 700, fontSize: 14 }}>
                          {Number(ev.tutar).toLocaleString("tr-TR")}₺
                        </span>
                      )}
                    </div>

                    <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>
                      {ev.repair_no ? `#${ev.repair_no} · ` : ""}{ev.baslik}
                    </div>
                    {ev.alt && <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 2 }}>{ev.alt}</div>}

                    {/* Tamir için alt tarihler */}
                    {ev.tur === "tamir" && (
                      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <DateChip icon="📝" label="Kayıt" val={ev.tarih} />
                        <DateChip icon="🔧" label="Tamirde" val={ev.tamirde_at} />
                        <DateChip icon="✅" label="Hazır" val={ev.completed_at} />
                        <DateChip icon="🏠" label="Teslim" val={ev.delivered_at} />
                      </div>
                    )}

                    {ev.tur !== "tamir" && (
                      <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 4 }}>
                        🗓️ {fmtDateTime(ev.tarih) || fmt(ev.tarih)}
                      </div>
                    )}

                    {ev.repair_id && (
                      <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4 }}>
                        Detaya git →
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Tamirler */}
      {tab === "tamirler" && (
        repairs.length === 0 ? (
          <div className="empty"><div className="empty-icon">🔧</div>Tamir kaydı yok</div>
        ) : repairs.map(r => (
          <div key={r.id} className="list-item" onClick={() => navigate(`/repairs/${r.id}`)}>
            <div className="list-item-body">
              <div className="list-item-title">#{r.repair_no} · {r.device_model}</div>
              <div className="list-item-sub">{r.fault_desc || "—"}
                {r.final_price ? ` · ₺${r.final_price}` : r.estimated_price ? ` · ~₺${r.estimated_price}` : ""}
              </div>
              <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span>📝 {fmt(r.created_at)}</span>
                {r.tamirde_at && <span>🔧 {fmt(r.tamirde_at)}</span>}
                {r.completed_at && <span>✅ {fmt(r.completed_at)}</span>}
                {r.delivered_at && <span>🏠 {fmt(r.delivered_at)}</span>}
              </div>
            </div>
            <span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span>
          </div>
        ))
      )}

      {/* Notlar */}
      {tab === "notlar" && (
        <div className="card">
          {customer.notes ? (
            <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{customer.notes}</div>
          ) : (
            <div style={{ color: "var(--hint)", textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
              Not yok
            </div>
          )}
          {!edit && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}
              onClick={() => { setEdit(true); setTab("ziyaretler"); }}>
              ✏️ Not Düzenle
            </button>
          )}
        </div>
      )}

      {/* Borçlar */}
      {tab === "borclar" && (
        debts.length === 0 ? (
          <div className="empty"><div className="empty-icon">💰</div>Borç kaydı yok</div>
        ) : debts.map(d => {
          const kalan = (d.total_amount || d.amount || 0) - (d.paid_amount || d.paid || 0);
          return (
            <div key={d.id} className="card">
              <div className="card-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{d.description || d.notes || "Borç"}</div>
                  {d.due_date && <div style={{ fontSize: 12, color: "var(--hint)" }}>📅 Vade: {d.due_date}</div>}
                  <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>
                    🗓️ {fmt(d.created_at)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: kalan > 0 ? "var(--danger)" : "var(--success)" }}>
                    ₺{kalan.toLocaleString("tr-TR")}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--hint)" }}>
                    / ₺{(d.total_amount || d.amount || 0).toLocaleString("tr-TR")}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function DateChip({ icon, label, val }) {
  if (!val) return (
    <span style={{
      fontSize: 10, padding: "2px 6px", borderRadius: 4,
      background: "var(--bg2)", color: "var(--hint)", opacity: 0.5,
    }}>{icon} {label}: —</span>
  );
  return (
    <span style={{
      fontSize: 10, padding: "2px 6px", borderRadius: 4,
      background: "var(--accent)15", color: "var(--accent)", fontWeight: 600,
    }}>
      {icon} {label}: {new Date(val).toLocaleDateString("tr-TR")}
    </span>
  );
}
