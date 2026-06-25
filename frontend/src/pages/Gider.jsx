import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const KATEGORILER = ["Kira", "Elektrik", "Su", "İnternet", "Vergi", "Sigorta", "Malzeme", "Diğer"];

export default function Gider() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ kategori: "Kira", tutar: "", aciklama: "", tarih: today() });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await api.giderList();
      setList(res.giderler || res || []);
    } finally { setLoading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.createGider({ ...form, tutar: parseFloat(form.tutar) });
      setShowForm(false);
      setForm({ kategori: "Kira", tutar: "", aciklama: "", tarih: today() });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function sil(id) {
    if (!confirm("Bu gideri silmek istiyorsun?")) return;
    await api.deleteGider(id);
    load();
  }

  const toplam = Array.isArray(list) ? list.reduce((s, g) => s + (g.tutar || 0), 0) : 0;

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Gider Takibi</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Ekle</button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-row">
          <span style={{ color: "var(--hint)" }}>Bu Ay Toplam Gider</span>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--danger)" }}>{toplam.toLocaleString("tr-TR")} ₺</span>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="form-select" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>
                {KATEGORILER.map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tutar (₺) *</label>
              <input className="form-input" type="number" required value={form.tutar} onChange={e => setForm({ ...form, tutar: e.target.value })} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Açıklama</label>
              <input className="form-input" value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Tarih</label>
              <input className="form-input" type="date" value={form.tarih} onChange={e => setForm({ ...form, tarih: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {list.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Bu ay gider kaydı yok</div>
      ) : list.map(g => (
        <div key={g.id} className="card">
          <div className="card-row">
            <div>
              <div style={{ fontWeight: 600 }}>{g.kategori}</div>
              {g.aciklama && <div style={{ fontSize: 13, color: "var(--hint)" }}>{g.aciklama}</div>}
              <div style={{ fontSize: 12, color: "var(--hint)" }}>{g.tarih}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 700, color: "var(--danger)" }}>{(g.tutar || 0).toLocaleString("tr-TR")} ₺</span>
              <button className="btn btn-ghost btn-sm" onClick={() => sil(g.id)} style={{ padding: "4px 8px" }}>🗑</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
