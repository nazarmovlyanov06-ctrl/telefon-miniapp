import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const DURUMLAR = ["bekliyor", "gönderildi", "para_iade_alindi"];
const DURUM_LABEL = { bekliyor: "Bekliyor", gönderildi: "Gönderildi", para_iade_alindi: "Para İade Alındı" };
const DURUM_COLOR = { bekliyor: "badge-bekliyor", gönderildi: "badge-tamirde", para_iade_alindi: "badge-hazir" };

export default function ParcaIade() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [toptancilar, setToptancilar] = useState([]);
  const [parcalar, setParcalar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ toptanci_id: "", parca: "", part_id: null, miktar: "1", sebep: "" });
  const [parcaArama, setParcaArama] = useState("");
  const [parcaOneriler, setParcaOneriler] = useState([]);
  const [showParcaOner, setShowParcaOner] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [l, t, p] = await Promise.all([
        api.parcaIadeList(),
        api.toptanciList(),
        api.parts(),
      ]);
      setList(l); setToptancilar(t);
      setParcalar(p.filter ? p.filter(x => x.quantity > 0) : (p || []));
    } finally { setLoading(false); }
  }

  function handleParcaArama(val) {
    setParcaArama(val);
    setForm(f => ({ ...f, parca: val, part_id: null }));
    if (val.length >= 1) {
      const q = val.toLowerCase();
      const found = parcalar.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.device_model || "").toLowerCase().includes(q)
      ).slice(0, 8);
      setParcaOneriler(found);
      setShowParcaOner(found.length > 0);
    } else {
      setShowParcaOner(false);
    }
  }

  function secParca(p) {
    setParcaArama(p.name + (p.device_model ? ` (${p.device_model})` : ""));
    setForm(f => ({ ...f, parca: p.name, part_id: p.id, miktar: "1" }));
    setShowParcaOner(false);
  }

  const selectedParca = form.part_id ? parcalar.find(p => p.id === form.part_id) : null;

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.createParcaIade({
        ...form,
        toptanci_id: form.toptanci_id ? parseInt(form.toptanci_id) : null,
        miktar: parseInt(form.miktar),
        part_id: form.part_id || null,
      });
      setShowForm(false);
      setForm({ toptanci_id: "", parca: "", part_id: null, miktar: "1", sebep: "" });
      setParcaArama("");
      setShowParcaOner(false);
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function updateDurum(id, durum) {
    await api.updateParcaIadeDurum(id, durum);
    load();
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Parça İade</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setErr(""); }}>+ İade</button>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}

            {/* Stoktan parça seç */}
            <div className="form-group" style={{ position: "relative" }}>
              <label className="form-label">Parça (Stoktan Seç) *</label>
              <input
                className="form-input"
                required
                value={parcaArama}
                onChange={e => handleParcaArama(e.target.value)}
                onBlur={() => setTimeout(() => setShowParcaOner(false), 150)}
                placeholder="Parça adı yaz veya ara..."
                autoComplete="off"
              />
              {showParcaOner && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden", maxHeight: 220, overflowY: "auto"
                }}>
                  {parcaOneriler.map(p => (
                    <div key={p.id} onMouseDown={() => secParca(p)}
                      style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14,
                        borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div>{p.name}</div>
                        {p.device_model && <div style={{ fontSize: 11, color: "var(--hint)" }}>{p.device_model}</div>}
                      </div>
                      <span style={{ fontSize: 12, color: p.quantity <= 2 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
                        {p.quantity} adet
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedParca && (
              <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 10 }}>
                ✅ <strong>{selectedParca.name}</strong> — Stokta: {selectedParca.quantity} adet
                {selectedParca.purchase_price > 0 && ` · Alış: ₺${selectedParca.purchase_price}`}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Toptancı</label>
              <select className="form-select" value={form.toptanci_id} onChange={e => setForm({ ...form, toptanci_id: e.target.value })}>
                <option value="">Seç (opsiyonel)</option>
                {toptancilar.map(t => <option key={t.id} value={t.id}>{t.ad}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Adet</label>
              <input className="form-input" type="number" min="1"
                max={selectedParca ? selectedParca.quantity : 999}
                value={form.miktar}
                onChange={e => setForm({ ...form, miktar: e.target.value })} />
              {selectedParca && parseInt(form.miktar) > selectedParca.quantity && (
                <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>
                  ⚠️ Stokta sadece {selectedParca.quantity} adet var
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">İade Sebebi</label>
              <input className="form-input" value={form.sebep} onChange={e => setForm({ ...form, sebep: e.target.value })} placeholder="Arızalı, yanlış gönderim..." />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary"
                disabled={form.part_id && parseInt(form.miktar) > (selectedParca?.quantity || 0)}>
                Kaydet
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setParcaArama(""); }}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty"><div className="empty-icon">📦</div>İade kaydı yok</div>
      ) : list.map(i => (
        <div key={i.id} className="card">
          <div className="card-row">
            <div>
              <div style={{ fontWeight: 600 }}>{i.parca}</div>
              <div style={{ fontSize: 13, color: "var(--hint)" }}>
                {i.toptanci_adi ? `📦 ${i.toptanci_adi} · ` : ""}{i.miktar} adet
              </div>
              {i.sebep && <div style={{ fontSize: 12, color: "var(--hint)" }}>{i.sebep}</div>}
            </div>
            <span className={`badge ${DURUM_COLOR[i.durum] || ""}`}>{DURUM_LABEL[i.durum] || i.durum}</span>
          </div>
          {i.durum !== "para_iade_alindi" && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {i.durum === "bekliyor" && (
                <button className="btn btn-ghost btn-sm" onClick={() => updateDurum(i.id, "gönderildi")}>Gönderildi</button>
              )}
              {i.durum === "gönderildi" && (
                <button className="btn btn-primary btn-sm" onClick={() => updateDurum(i.id, "para_iade_alindi")}>Para Alındı ✓</button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
