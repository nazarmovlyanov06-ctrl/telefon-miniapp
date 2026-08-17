import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Users, Search, CircleX, Star, User, Ban, Plus, ChevronUp, ChevronDown, UserPlus, X } from "lucide-react";

function SortTh({ label, col, sort, setSort }) {
  const active = sort.col === col;
  return (
    <th className="sortable" onClick={() => setSort(s => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }))}>
      <span className="th-inner">
        {label}
        {active && (sort.dir === "asc" ? <ChevronUp size={12} strokeWidth={2.4} /> : <ChevronDown size={12} strokeWidth={2.4} />)}
      </span>
    </th>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [err, setErr] = useState("");
  const [sort, setSort] = useState({ col: "name", dir: "asc" });
  const [yeniUyeler, setYeniUyeler] = useState([]);
  const navigate = useNavigate();

  // Portalden kendisi kaydolan müşteriler — dükkan sayfayı açınca bildirimi
  // gösterip "görüldü" işaretliyoruz.
  useEffect(() => {
    api.yeniUyeler()
      .then(r => {
        setYeniUyeler(r.musteriler || []);
        if (r.sayi > 0) api.yeniUyeleriGordum().catch(() => {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.customers(q).then(setCustomers).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const sortedCustomers = useMemo(() => {
    const list = [...customers];
    const { col, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let av = a[col], bv = b[col];
      if (col === "visit_count") { av = av || 0; bv = bv || 0; }
      else { av = (av || "").toString().toLowerCase(); bv = (bv || "").toString().toLowerCase(); }
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return list;
  }, [customers, sort]);

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

      {yeniUyeler.length > 0 && (
        <div className="card" style={{ marginBottom: 12, background: "rgba(74,222,128,0.08)", borderLeft: "3px solid var(--green)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <UserPlus size={17} stroke="var(--green)" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {yeniUyeler.length} yeni müşteri mağaza sayfanızdan kayıt oldu
                </div>
                <div style={{ fontSize: 12.5, color: "var(--hint)", marginTop: 4 }}>
                  {yeniUyeler.map(u => `${u.name}${u.phone ? ` (${u.phone})` : ""}`).join(" · ")}
                </div>
              </div>
            </div>
            <button onClick={() => setYeniUyeler([])}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex", flexShrink: 0 }}>
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

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
        <>
          <div className="mobile-list">
            {customers.map((c) => (
              <div key={c.id} className="list-item" onClick={() => navigate(`/customers/${c.id}`)}>
                <div style={{ position: "relative", zIndex: 1, display: "flex" }}>
                  {c.is_vip
                    ? <Star size={22} stroke="var(--gold)" fill="var(--gold)" strokeWidth={1.5} />
                    : <User size={22} stroke="var(--hint)" strokeWidth={1.7} />}
                </div>
                <div className="list-item-body">
                  <div className="list-item-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {c.name}
                    {c.portal_uye && <UserPlus size={13} stroke="var(--green)" strokeWidth={2} title="Portal üyesi" />}
                  </div>
                  <div className="list-item-sub">{c.phone || "Telefon yok"} · {c.visit_count} ziyaret</div>
                </div>
                {c.is_blacklisted ? (
                  <span className="badge" style={{ background: "rgba(248,113,113,0.15)", color: "var(--red)", position: "relative", zIndex: 1, display: "flex" }}>
                    <Ban size={13} strokeWidth={2} />
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="desktop-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <SortTh label="Ad Soyad" col="name" sort={sort} setSort={setSort} />
                  <SortTh label="Telefon" col="phone" sort={sort} setSort={setSort} />
                  <SortTh label="Ziyaret" col="visit_count" sort={sort} setSort={setSort} />
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {sortedCustomers.map(c => (
                  <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)}>
                    <td style={{ display: "flex" }}>
                      {c.is_vip
                        ? <Star size={16} stroke="var(--gold)" fill="var(--gold)" strokeWidth={1.5} />
                        : <User size={16} stroke="var(--hint)" strokeWidth={1.7} />}
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {c.name}
                        {c.portal_uye && <UserPlus size={13} stroke="var(--green)" strokeWidth={2} title="Portal üyesi" />}
                      </span>
                    </td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.visit_count || 0}</td>
                    <td>
                      {c.is_blacklisted ? (
                        <span className="badge" style={{ background: "rgba(248,113,113,0.15)", color: "var(--red)", display: "inline-flex" }}>
                          <Ban size={13} strokeWidth={2} />
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
