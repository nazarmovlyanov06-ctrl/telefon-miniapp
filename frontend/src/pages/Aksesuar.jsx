import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Aksesuar() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [satForm, setSatForm] = useState(null);
  const [form, setForm] = useState({ ad: "", stok: "1", alis_fiyati: "", satis_fiyati: "" });
  const [satData, setSatData] = useState({ miktar: "1", musteri_adi: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    try { setList(await api.aksesuarList()); } finally { setLoading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    await api.createAksesuar({
      ad: form.ad,
      stok: parseInt(form.stok),
      alis_fiyati: parseFloat(form.alis_fiyati),
      satis_fiyati: parseFloat(form.satis_fiyati),
    });
    setShowForm(false);
    setForm({ ad: "", stok: "1", alis_fiyati: "", satis_fiyati: "" });
    load();
  }

  async function submitSat(e) {
    e.preventDefault();
    await api.satAksesuar(satForm.id, { miktar: parseInt(satData.miktar), musteri_adi: satData.musteri_adi, tarih: today() });
    setSatForm(null);
    setSatData({ miktar: "1", musteri_adi: "" });
    load();
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Aksesuar Satış</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Ekle</button>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Ürün Adı *</label>
              <input className="form-input" required value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} placeholder="Kılıf, şarj aleti, powerbank..." />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div className="form-group">
                <label className="form-label">Stok</label>
                <input className="form-input" type="number" min="0" value={form.stok} onChange={e => setForm({ ...form, stok: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Alış (₺)</label>
                <input className="form-input" type="number" required value={form.alis_fiyati} onChange={e => setForm({ ...form, alis_fiyati: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Satış (₺)</label>
                <input className="form-input" type="number" required value={form.satis_fiyati} onChange={e => setForm({ ...form, satis_fiyati: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {satForm && (
        <div className="card" style={{ background: "var(--bg2)" }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Satış: {satForm.ad}</div>
          <form onSubmit={submitSat}>
            <div className="form-group">
              <label className="form-label">Adet (max {satForm.stok})</label>
              <input className="form-input" type="number" min="1" max={satForm.stok} required value={satData.miktar} onChange={e => setSatData({ ...satData, miktar: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Müşteri Adı (opsiyonel)</label>
              <input className="form-input" value={satData.musteri_adi} onChange={e => setSatData({ ...satData, musteri_adi: e.target.value })} />
            </div>
            <div style={{ fontSize: 13, color: "var(--success)", marginBottom: 8 }}>
              Toplam: {(parseInt(satData.miktar || 1) * (satForm.satis_fiyati || 0)).toLocaleString("tr-TR")} ₺
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Sat</button>
              <button type="button" className="btn btn-ghost" onClick={() => setSatForm(null)}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {list.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Aksesuar eklenmedi</div>
      ) : list.map(a => (
        <div key={a.id} className="card">
          <div className="card-row">
            <div>
              <div style={{ fontWeight: 600 }}>{a.ad}</div>
              <div style={{ fontSize: 13, color: "var(--hint)" }}>
                Alış: {a.alis_fiyati} ₺ · Satış: {a.satis_fiyati} ₺
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: a.stok <= 5 ? "var(--danger)" : "var(--text)" }}>{a.stok} adet</div>
                {a.stok <= 5 && <div style={{ fontSize: 11, color: "var(--danger)" }}>⚠ Düşük</div>}
              </div>
              {a.stok > 0 && (
                <button className="btn btn-primary btn-sm" onClick={() => setSatForm(a)}>Sat</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
