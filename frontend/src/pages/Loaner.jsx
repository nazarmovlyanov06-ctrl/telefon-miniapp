import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Loaner() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ musteri_adi: "", cihaz: "", teslim_tarihi: today(), notlar: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    try { setList(await api.loanerList()); } finally { setLoading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    await api.createLoaner(form);
    setShowForm(false);
    setForm({ musteri_adi: "", cihaz: "", teslim_tarihi: today(), notlar: "" });
    load();
  }

  async function iade(id) {
    if (!confirm("Cihaz iade alındı mı?")) return;
    await api.iadeLoaner(id);
    load();
  }

  function daysOut(teslim) {
    return Math.floor((new Date() - new Date(teslim)) / 86400000);
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Yedek Telefon</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Teslim Et</button>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Müşteri Adı *</label>
              <input className="form-input" required value={form.musteri_adi} onChange={e => setForm({ ...form, musteri_adi: e.target.value })} placeholder="Ad Soyad" />
            </div>
            <div className="form-group">
              <label className="form-label">Teslim Edilen Cihaz *</label>
              <input className="form-input" required value={form.cihaz} onChange={e => setForm({ ...form, cihaz: e.target.value })} placeholder="Samsung A12, Huawei P20..." />
            </div>
            <div className="form-group">
              <label className="form-label">Teslim Tarihi</label>
              <input className="form-input" type="date" value={form.teslim_tarihi} onChange={e => setForm({ ...form, teslim_tarihi: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Not</label>
              <input className="form-input" value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {list.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Dışarıda yedek telefon yok</div>
      ) : list.map(l => {
        const gun = daysOut(l.teslim_tarihi);
        const warn = gun >= 7;
        return (
          <div key={l.id} className="card">
            <div className="card-row">
              <div>
                <div style={{ fontWeight: 600 }}>📱 {l.musteri_adi}</div>
                <div style={{ fontSize: 13, color: "var(--hint)" }}>{l.cihaz}</div>
                <div style={{ fontSize: 12, color: warn ? "var(--danger)" : "var(--hint)" }}>
                  {gun === 0 ? "Bugün teslim edildi" : `${gun} gündür dışarıda`}
                  {warn && " ⚠️"}
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => iade(l.id)}>İade Al</button>
            </div>
            {l.notlar && <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 6 }}>{l.notlar}</div>}
          </div>
        );
      })}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
