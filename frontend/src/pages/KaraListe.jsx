import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function KaraListe() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ad: "", telefon: "", imei: "", sebep: "", notlar: "" });

  useEffect(() => { load(); }, []);

  async function load(query = "") {
    try { setList(await api.karaListe(query)); } finally { setLoading(false); }
  }

  function search(v) {
    setQ(v);
    load(v);
  }

  async function submit(e) {
    e.preventDefault();
    await api.createKara(form);
    setShowForm(false);
    setForm({ ad: "", telefon: "", imei: "", sebep: "", notlar: "" });
    load(q);
  }

  async function sil(id) {
    if (!confirm("Kara listeden çıkarmak istiyor musun?")) return;
    await api.deleteKara(id);
    load(q);
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>🚫 Kara Liste</h1>
        <button className="btn btn-danger btn-sm" onClick={() => setShowForm(true)}>+ Ekle</button>
      </div>

      <input
        className="form-input"
        style={{ marginBottom: 12 }}
        placeholder="Ad, telefon veya IMEI ile ara..."
        value={q}
        onChange={e => search(e.target.value)}
      />

      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Ad Soyad</label>
              <input className="form-input" value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} placeholder="İsteğe bağlı" />
            </div>
            <div className="form-group">
              <label className="form-label">Telefon</label>
              <input className="form-input" value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} placeholder="0555..." />
            </div>
            <div className="form-group">
              <label className="form-label">IMEI</label>
              <input className="form-input" value={form.imei} onChange={e => setForm({ ...form, imei: e.target.value })} placeholder="Cihaz IMEI" />
            </div>
            <div className="form-group">
              <label className="form-label">Sebep *</label>
              <input className="form-input" required value={form.sebep} onChange={e => setForm({ ...form, sebep: e.target.value })} placeholder="Çalıntı cihaz, ödeme yapmadı..." />
            </div>
            <div className="form-group">
              <label className="form-label">Not</label>
              <input className="form-input" value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-danger">Listeye Ekle</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {list.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Kara listede kayıt yok</div>
      ) : list.map(k => (
        <div key={k.id} className="card" style={{ borderLeft: "3px solid var(--danger)" }}>
          <div className="card-row">
            <div>
              {k.ad && <div style={{ fontWeight: 600 }}>🚫 {k.ad}</div>}
              {k.telefon && <div style={{ fontSize: 13, color: "var(--hint)" }}>📞 {k.telefon}</div>}
              {k.imei && <div style={{ fontSize: 13, color: "var(--hint)" }}>IMEI: {k.imei}</div>}
              <div style={{ fontSize: 13, color: "var(--danger)", marginTop: 4 }}>{k.sebep}</div>
              {k.notlar && <div style={{ fontSize: 12, color: "var(--hint)" }}>{k.notlar}</div>}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => sil(k.id)} style={{ padding: "4px 8px" }}>✓ Çıkar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
