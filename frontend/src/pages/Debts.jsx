import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  Banknote, Landmark, ClipboardList, CircleX, User, Ban, Phone, Calendar,
  CreditCard, FileText, Wallet, X, Search, Pencil, Trash2,
} from "lucide-react";

export default function Debts({ user }) {
  const [tab, setTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "alacak";
  });
  const [alacaklar, setAlacaklar] = useState([]);
  const [dukkanBorclari, setDukkanBorclari] = useState([]);
  const [gecmis, setGecmis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [musteriler, setMusteriler] = useState([]);
  const [toptancilar, setToptancilar] = useState([]);
  const [oneriler, setOneriler] = useState([]);
  const [showOneriler, setShowOneriler] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [odemeler, setOdemeler] = useState({});
  const [payModal, setPayModal] = useState(null); // { debt, defaultAmount }
  const [payForm, setPayForm] = useState({ amount: "", payment_type: "nakit" });
  const [payErr, setPayErr] = useState("");
  const [arama, setArama] = useState("");
  const [form, setForm] = useState({
    customer_id: null, customer_name_display: "",
    alacakli_adi: "",
    total_amount: "", payment_type: "borc", installment_count: "1",
    due_date: "", notes: ""
  });
  const [err, setErr] = useState("");
  const [karaUyari, setKaraUyari] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.customers("").then(setMusteriler).catch(() => {});
    api.toptanciList().then(setToptancilar).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arama yazarken her tuşta değil, 300ms bekleyip sakinleşince çek.
  const ilkYuklemeRef = useRef(true);
  useEffect(() => {
    if (ilkYuklemeRef.current) { ilkYuklemeRef.current = false; return; }
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arama]);

  async function load() {
    setLoading(true);
    try {
      const [a, d, g] = await Promise.all([
        api.debts("alacak", arama),
        api.debts("dukkan_borcu", arama),
        api.debtsGecmis(arama),
      ]);
      setAlacaklar(a);
      setDukkanBorclari(d);
      setGecmis(g);
    } finally { setLoading(false); }
  }

  function handleAlacakliChange(val) {
    setForm(f => ({ ...f, alacakli_adi: val }));
    if (val.length >= 2) {
      const q = val.toLowerCase();
      const tFound = toptancilar.filter(t => t.ad.toLowerCase().includes(q)).map(t => ({ id: "t_" + t.id, name: t.ad, tip: "Toptancı" }));
      const mFound = musteriler.filter(m => m.name.toLowerCase().includes(q)).map(m => ({ id: "m_" + m.id, name: m.name, tip: "Müşteri" }));
      const combined = [...tFound, ...mFound].slice(0, 6);
      setOneriler(combined);
      setShowOneriler(combined.length > 0);
    } else {
      setShowOneriler(false);
    }
  }

  const activeList = tab === "alacak" ? alacaklar : tab === "dukkan_borcu" ? dukkanBorclari : gecmis;

  function handleMusteriChange(val) {
    setForm(f => ({ ...f, customer_name_display: val, customer_id: null }));
    if (val.length >= 2) {
      const q = val.toLowerCase();
      const found = musteriler.filter(m =>
        m.name.toLowerCase().includes(q) || (m.phone || "").includes(q)
      ).slice(0, 5);
      setOneriler(found.map(m => ({ ...m, tip: "Müşteri" }))); setShowOneriler(found.length > 0);
    } else { setShowOneriler(false); }
  }

  async function submitYeniBorc(e) {
    e.preventDefault(); setErr("");
    const serbestIsim = form.customer_name_display.trim();
    if (tab === "alacak" && !form.customer_id && !serbestIsim) { setErr("Müşteri veya kişi/kurum adı girilmelidir"); return; }
    if (tab === "dukkan_borcu" && !form.alacakli_adi.trim()) { setErr("Alacaklı adı zorunlu"); return; }
    const payload = {
      borc_turu: tab,
      customer_id: tab === "alacak" ? form.customer_id : null,
      // Kayıtlı müşteri seçilmediyse yazılan isim serbest "alacaklı" olarak
      // kaydedilir — önceden alacak sadece kayıtlı müşteriye açılabiliyordu.
      alacakli_adi: tab === "dukkan_borcu" ? form.alacakli_adi : (!form.customer_id ? serbestIsim : null),
      total_amount: parseFloat(form.total_amount),
      payment_type: form.payment_type,
      installment_count: parseInt(form.installment_count),
      due_date: form.due_date || null,
      notes: form.notes,
    };
    try {
      if (editingId) await api.updateDebt(editingId, payload);
      else await api.createDebt(payload);
      setShowForm(false);
      resetForm();
      load();
    } catch (e) { setErr(e.message); }
  }

  function resetForm() {
    setEditingId(null);
    setForm({ customer_id: null, customer_name_display: "", alacakli_adi: "", total_amount: "", payment_type: "borc", installment_count: "1", due_date: "", notes: "" });
    setShowOneriler(false);
  }

  function canManage(d) {
    // Parça İade'nin beklenen tutarına bağlı alacak kendi sayfasından yönetilir.
    return !(d.source_type === "parca_iade" && d.source_id);
  }

  function startEdit(d) {
    setEditingId(d.id);
    setForm({
      customer_id: d.customer_id || null,
      customer_name_display: d.customer_id ? d.customer_name : (d.borc_turu === "alacak" ? (d.alacakli_adi || "") : ""),
      alacakli_adi: d.borc_turu === "dukkan_borcu" ? (d.alacakli_adi || "") : "",
      total_amount: String(d.total_amount ?? ""),
      payment_type: d.payment_type || "borc",
      installment_count: String(d.installment_count || 1),
      due_date: d.due_date || "",
      notes: d.notes || "",
    });
    setErr("");
    setShowOneriler(false);
    setShowForm(true);
  }

  async function silBorc(d) {
    if (!confirm("Bu kaydı silmek istiyorsun?")) return;
    try {
      await api.deleteDebt(d.id);
      load();
    } catch (e) { alert(e.message); }
  }

  function pay(debt) {
    const taksitTutari = debt.payment_type === "taksit" && debt.installment_count > 1
      ? Math.round((debt.total_amount || 0) / (debt.installment_count || 1))
      : "";
    setPayModal(debt);
    setPayForm({ amount: taksitTutari ? String(taksitTutari) : "", payment_type: "nakit" });
    setPayErr("");
  }

  async function submitPay(e) {
    e.preventDefault();
    if (!payModal || !payForm.amount) return;
    setPayErr("");
    try {
      await api.payDebt(payModal.id, { amount: parseFloat(payForm.amount), payment_type: payForm.payment_type });
      const id = payModal.id;
      setPayModal(null);
      load();
      if (expandedId === id) loadOdemeler(id);
    } catch (e) { setPayErr(e.message); }
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

  async function silOdeme(debtId, paymentId) {
    if (!confirm("Bu ödeme kaydını silmek istiyorsun? Borcun ödenen tutarı buna göre geri alınacak.")) return;
    try {
      await api.deleteDebtOdeme(debtId, paymentId);
      loadOdemeler(debtId);
      load();
    } catch (e) { alert(e.message); }
  }

  const totalAlacak = alacaklar.reduce((s, d) => s + (d.remaining || 0), 0);
  const totalBorc = dukkanBorclari.reduce((s, d) => s + (d.remaining || 0), 0);

  const PAYMENT_TYPES = [
    { value: "borc", label: "Normal" },
    { value: "taksit", label: "Taksit" },
    { value: "senet", label: "Senet" },
  ];

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/more")}>← Geri</button>
        <div className="page-title" style={{ margin: 0, flex: 1 }}>
          {tab === "alacak" ? "Alacaklar" : tab === "dukkan_borcu" ? "Dükkan Borçları" : "Geçmiş"}
        </div>
        {tab !== "gecmis" && <button className="btn btn-primary btn-sm" onClick={() => { if (showForm) { setShowForm(false); } else { resetForm(); setShowForm(true); } setErr(""); }}>+ Yeni</button>}
      </div>

      {/* Sekme */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${tab === "alacak" ? "active" : ""}`} onClick={() => { setTab("alacak"); setShowForm(false); setExpandedId(null); resetForm(); }}>
          Alacaklar {alacaklar.length > 0 && `(${alacaklar.length})`}
        </button>
        <button className={`tab ${tab === "dukkan_borcu" ? "active" : ""}`} onClick={() => { setTab("dukkan_borcu"); setShowForm(false); setExpandedId(null); resetForm(); }}>
          Borçlar {dukkanBorclari.length > 0 && `(${dukkanBorclari.length})`}
        </button>
        <button className={`tab ${tab === "gecmis" ? "active" : ""}`} onClick={() => { setTab("gecmis"); setShowForm(false); setExpandedId(null); resetForm(); }}>
          Geçmiş
        </button>
      </div>

      <div className="form-group" style={{ position: "relative", marginBottom: 10 }}>
        <input className="form-input" style={{ paddingLeft: 36 }} value={arama}
          onChange={e => setArama(e.target.value)} placeholder="İsim veya notta ara..." />
        <Search size={15} strokeWidth={2} stroke="var(--hint)"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
      </div>

      {/* Özet kart */}
      {!loading && tab !== "gecmis" && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-row">
            {tab === "alacak" ? (
              <>
                <span style={{ color: "var(--hint)" }}>Toplam Alacak</span>
                <span style={{ fontWeight: 800, fontSize: 20, color: "var(--success)" }}>₺{totalAlacak.toLocaleString("tr-TR")}</span>
              </>
            ) : (
              <>
                <span style={{ color: "var(--hint)" }}>Toplam Borcumuz</span>
                <span style={{ fontWeight: 800, fontSize: 20, color: "var(--danger)" }}>₺{totalBorc.toLocaleString("tr-TR")}</span>
              </>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>
            {editingId
              ? (tab === "alacak" ? "Alacak Kaydını Düzenle" : "Dükkan Borcunu Düzenle")
              : (tab === "alacak" ? "Yeni Alacak Kaydı" : "Yeni Dükkan Borcu")}
          </div>
          <form onSubmit={submitYeniBorc}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}

            {tab === "alacak" ? (
              <div className="form-group" style={{ position: "relative" }}>
                <label className="form-label">Müşteri veya Kişi/Kurum *</label>
                <input className="form-input" required
                  value={form.customer_name_display}
                  onChange={e => handleMusteriChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowOneriler(false), 150)}
                  placeholder="Müşteri adı yaz, ya da kayıtlı değilse serbest yaz..." autoComplete="off" />
                {form.customer_name_display && !form.customer_id && (
                  <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 4 }}>
                    Kayıtlı müşteri seçilmedi — "{form.customer_name_display}" serbest isim olarak kaydedilecek
                  </div>
                )}
                {showOneriler && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
                    background: "var(--card)", border: "1px solid var(--border)",
                    borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden" }}>
                    {oneriler.map(m => (
                      <div key={m.id}
                        onMouseDown={() => {
                          setForm(f => ({ ...f, customer_id: m.id, customer_name_display: m.name }));
                          setShowOneriler(false);
                          setKaraUyari([]);
                          if (m.phone) api.karaListe(m.phone).then(r => setKaraUyari(r || [])).catch(() => {});
                        }}
                        style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14,
                          borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><User size={13} strokeWidth={2} /> {m.name}</span>
                        {m.phone && <span style={{ fontSize: 12, color: "var(--hint)" }}>{m.phone}</span>}
                      </div>
                    ))}
                  </div>
                )}
              {karaUyari.length > 0 && (
                <div style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                  Kara liste: {karaUyari.map(k => k.sebep || k.ad).join(", ")}
                </div>
              )}
              </div>
            ) : (
              <div className="form-group" style={{ position: "relative" }}>
                <label className="form-label">Alacaklı (kime borçluyuz?) *</label>
                <input className="form-input" required
                  value={form.alacakli_adi}
                  onChange={e => handleAlacakliChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowOneriler(false), 150)}
                  placeholder="Toptancı adı, mal sahibi..." autoComplete="off" />
                {showOneriler && tab === "dukkan_borcu" && (
                  <div className="ac-dropdown" style={{ zIndex: 99 }}>
                    {oneriler.map(o => (
                      <div key={o.id} onMouseDown={() => { setForm(f => ({ ...f, alacakli_adi: o.name })); setShowOneriler(false); }}
                        style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                        <span>{o.name}</span>
                        <span style={{ fontSize: 11, color: "var(--hint)" }}>{o.tip}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{tab === "alacak" ? "Borç Türü" : "Ödeme Türü"}</label>
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
              <button type="submit" className="btn btn-primary">{editingId ? "Güncelle" : "Kaydet"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); resetForm(); }}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : activeList.length === 0 ? (
        <div className="empty">
          <div className="empty-icon" style={{display:"flex",justifyContent:"center"}}>{tab === "alacak" ? <Banknote size={40} stroke="var(--dim)" strokeWidth={1.5}/> : tab === "gecmis" ? <ClipboardList size={40} stroke="var(--dim)" strokeWidth={1.5}/> : <Landmark size={40} stroke="var(--dim)" strokeWidth={1.5}/>}</div>
          {arama ? "Aramayla eşleşen kayıt yok" : (tab === "alacak" ? "Açık alacak yok" : tab === "gecmis" ? "Geçmiş kayıt yok" : "Dükkan borcu yok")}
        </div>
      ) : (
        activeList.map((d) => (
          <div key={d.id} className="card" style={{ marginBottom: 8 }}>
            <div className="card-row" onClick={() => toggleExpand(d.id)} style={{ cursor: "pointer" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{d.customer_name}</div>
                <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 2 }}>
                  {d.customer_phone ? d.customer_phone : ""}
                  {d.payment_type === "taksit" ? " · Taksit" : d.payment_type === "senet" ? " · Senet" : ""}
                  {d.due_date ? ` · Vade: ${new Date(d.due_date).toLocaleDateString("tr-TR")}` : ""}
                  {d.borc_turu === "alacak" && d.source_type === "parca_iade" ? " · Parça İade" : ""}
                </div>
                {d.notes && <div style={{ fontSize: 12, color: "var(--hint)" }}>{d.notes}</div>}
                {d.created_at && (
                  <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>
                    {new Date(d.created_at).toLocaleDateString("tr-TR")}
                    {tab === "gecmis" && <span style={{ color: "var(--success)", fontWeight: 600, marginLeft: 6 }}>Ödendi</span>}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: tab === "gecmis" ? "var(--hint)" : tab === "alacak" ? "var(--success)" : "var(--danger)", fontSize: 17 }}>
                  ₺{(d.total_amount || 0).toLocaleString("tr-TR")}
                </div>
                {tab !== "gecmis" && d.payment_type === "taksit" && d.installment_count > 1 ? (() => {
                  const taksitTutari = (d.total_amount || 0) / (d.installment_count || 1);
                  const odenenTaksit = Math.floor((d.paid_amount || 0) / taksitTutari);
                  const kalanTaksit = (d.installment_count || 1) - odenenTaksit;
                  return (
                    <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>
                      <div>{odenenTaksit}/{d.installment_count} taksit ödendi</div>
                      <div style={{ color: kalanTaksit > 0 ? "var(--danger)" : "var(--success)" }}>
                        {kalanTaksit > 0 ? `${kalanTaksit} taksit kaldı` : "Tamamlandı"}
                      </div>
                    </div>
                  );
                })() : tab !== "gecmis" && (
                  <div style={{ fontSize: 12, color: "var(--hint)" }}>
                    kalan: ₺{(d.remaining || 0).toLocaleString("tr-TR")}
                  </div>
                )}
              </div>
            </div>
            {tab !== "gecmis" && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => pay(d)}>
                {tab === "alacak" ? "Ödeme Al" : "Ödedik"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleExpand(d.id)}>
                {expandedId === d.id ? "▲ Gizle" : "▼ Taksit/Geçmiş"}
              </button>
              {canManage(d) && (
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(d)} title="Düzenle" style={{ padding: "4px 8px", display: "flex", marginLeft: "auto" }}>
                  <Pencil size={13} strokeWidth={2} />
                </button>
              )}
              {canManage(d) && user?.rol === "patron" && (d.paid_amount || 0) === 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => silBorc(d)} title="Sil" style={{ padding: "4px 8px", display: "flex", marginLeft: canManage(d) ? 0 : "auto" }}>
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              )}
            </div>
            )}
            {expandedId === d.id && (
              <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                {/* Taksit planı */}
                {d.payment_type === "taksit" && d.installment_count > 1 && (() => {
                  const taksitTutari = (d.total_amount || 0) / (d.installment_count || 1);
                  const odenenTaksit = Math.floor((d.paid_amount || 0) / taksitTutari);
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
                        Taksit Planı
                      </div>
                      {/* Özet */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                        <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px", textAlign: "center" }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>₺{taksitTutari.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</div>
                          <div style={{ fontSize: 10, color: "var(--hint)" }}>Aylık Taksit</div>
                        </div>
                        <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px", textAlign: "center" }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--success)" }}>{odenenTaksit}</div>
                          <div style={{ fontSize: 10, color: "var(--hint)" }}>Ödenen</div>
                        </div>
                        <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px", textAlign: "center" }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: (d.installment_count - odenenTaksit) > 0 ? "var(--danger)" : "var(--success)" }}>
                            {d.installment_count - odenenTaksit}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--hint)" }}>Kalan</div>
                        </div>
                      </div>
                      {/* Taksit satırları */}
                      {Array.from({ length: d.installment_count }, (_, i) => {
                        const paid = i < odenenTaksit;
                        const current = i === odenenTaksit;
                        return (
                          <div key={i} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            fontSize: 13, padding: "6px 8px", borderRadius: 6, marginBottom: 3,
                            background: paid ? "rgba(52,199,89,0.08)" : current ? "rgba(255,149,0,0.1)" : "var(--bg2)",
                          }}>
                            <span style={{ color: paid ? "var(--success)" : current ? "orange" : "var(--hint)" }}>
                              {i + 1}. taksit
                            </span>
                            <span style={{ fontWeight: 600, color: paid ? "var(--success)" : "var(--text)" }}>
                              ₺{taksitTutari.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {/* Ödeme geçmişi */}
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Ödeme Geçmişi</div>
                {!(odemeler[d.id]?.length) ? (
                  <div style={{ fontSize: 12, color: "var(--hint)" }}>Henüz ödeme yok</div>
                ) : odemeler[d.id].map(o => (
                  <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--hint)" }}>{o.paid_at ? new Date(o.paid_at).toLocaleDateString("tr-TR") : "—"}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "var(--success)" }}>+₺{(o.amount || 0).toLocaleString("tr-TR")}</span>
                      {user?.rol === "patron" && (
                        <button className="btn btn-ghost btn-sm" onClick={() => silOdeme(d.id, o.id)} title="Bu ödemeyi sil" style={{ padding: "2px 6px", display: "flex" }}>
                          <Trash2 size={12} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
      {/* Ödeme modalı */}
      {payModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setPayModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--card)", borderRadius: 18,
            width: "100%", maxWidth: 480, padding: "20px 16px 40px",
          }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              {tab === "alacak" ? "Ödeme Al" : "Ödeme Yap"}
            </div>
            <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 16 }}>
              {payModal.customer_name}
              {payModal.payment_type === "taksit" && payModal.installment_count > 1 && (() => {
                const taksitTutari = Math.round((payModal.total_amount || 0) / (payModal.installment_count || 1));
                const odenenTaksit = Math.floor((payModal.paid_amount || 0) / taksitTutari);
                return <span style={{ marginLeft: 8, color: "var(--primary)", fontWeight: 600 }}>
                  · {odenenTaksit}/{payModal.installment_count}. taksit
                </span>;
              })()}
            </div>
            <form onSubmit={submitPay}>
              {payErr && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8, fontWeight: 600 }}>{payErr}</div>}
              <div className="form-group">
                <label className="form-label">Tutar (₺)</label>
                <input className="form-input" type="number" required autoFocus
                  inputMode="numeric" max={payModal.remaining || undefined}
                  value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0" />
                <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 4 }}>
                  {payModal.payment_type === "taksit" && payModal.installment_count > 1 && (
                    <>Aylık taksit: ₺{Math.round((payModal.total_amount || 0) / (payModal.installment_count || 1)).toLocaleString("tr-TR")} · </>
                  )}
                  Kalan: ₺{(payModal.remaining || 0).toLocaleString("tr-TR")}
                </div>
                {payModal.payment_type === "taksit" && payModal.installment_count > 1 && (
                  <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4 }}>
                    Bu sadece 1 aylık öneri — dilerseniz birden fazla ayı tek seferde (ör. tamamını) yatırabilirsiniz, taksit sayacı ödenen toplam tutara göre otomatik güncellenir.
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Ödeme Yöntemi</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["nakit", "kart"].map(t => (
                    <button key={t} type="button"
                      onClick={() => setPayForm(f => ({ ...f, payment_type: t }))}
                      style={{
                        flex: 1, padding: "10px", borderRadius: 10, border: "2px solid",
                        borderColor: payForm.payment_type === t ? "var(--primary)" : "var(--border)",
                        background: payForm.payment_type === t ? "rgba(0,122,255,0.08)" : "var(--bg2)",
                        fontWeight: 600, fontSize: 14, cursor: "pointer",
                        color: payForm.payment_type === t ? "var(--primary)" : "var(--text)",
                      }}>
                      {t === "nakit" ? "Nakit" : "Kart"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Kaydet</button>
                <button type="button" className="btn btn-ghost" onClick={() => setPayModal(null)}>İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
