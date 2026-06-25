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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ toptanci_id: "", parca: "", miktar: "1", sebep: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [l, t] = await Promise.all([api.parcaIadeList(), api.toptanciList()]);
      setList(l); setToptancilar(t);
    } finally { setLoading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    await api.createParcaIade({ ...form, toptanci_id: parseInt(form.toptanci_id), miktar: parseInt(form.miktar) });
    setShowForm(false);
    setForm({ toptanci_id: "", parca: "", miktar: "1", sebep: "" });
    load();
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
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ İade</button>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Toptancı *</label>
              <select className="form-select" required value={form.toptanci_id} onChange={e => setForm({ ...form, toptanci_id: e.target.value })}>
                <option value="">Seç</option>
                {toptancilar.map(t => <option key={t.id} value={t.id}>{t.ad}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Parça Adı *</label>
              <input className="form-input" required value={form.parca} onChange={e => setForm({ ...form, parca: e.target.value })} placeholder="Ekran, batarya..." />
            </div>
            <div className="form-group">
              <label className="form-label">Adet</label>
              <input className="form-input" type="number" min="1" value={form.miktar} onChange={e => setForm({ ...form, miktar: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">İade Sebebi</label>
              <input className="form-input" value={form.sebep} onChange={e => setForm({ ...form, sebep: e.target.value })} placeholder="Arızalı, yanlış gönderim..." />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {list.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>İade kaydı yok</div>
      ) : list.map(i => (
        <div key={i.id} className="card">
          <div className="card-row">
            <div>
              <div style={{ fontWeight: 600 }}>{i.parca}</div>
              <div style={{ fontSize: 13, color: "var(--hint)" }}>{i.toptanci_adi || "Toptancı"} · {i.miktar} adet</div>
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
