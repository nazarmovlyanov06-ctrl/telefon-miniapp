import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Garanti() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [musteriler, setMusteriler] = useState([]);
  const [oneriler, setOneriler] = useState([]);
  const [showOneriler, setShowOneriler] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    musteri_adi: "", telefon: "", cihaz: "", tamir_aciklama: "",
    baslangic_tarihi: today(), sure_gun: "90"
  });

  useEffect(() => {
    load();
    api.customers("").then(setMusteriler).catch(() => {});
  }, []);

  async function load() {
    try { setList(await api.garantiList()); } finally { setLoading(false); }
  }

  function handleMusteriChange(val) {
    setForm(f => ({ ...f, musteri_adi: val }));
    if (val.length >= 2) {
      const q = val.toLowerCase();
      const found = musteriler.filter(m =>
        m.name.toLowerCase().includes(q) || (m.phone || "").includes(q)
      ).slice(0, 5);
      setOneriler(found);
      setShowOneriler(found.length > 0);
    } else {
      setShowOneriler(false);
    }
  }

  function secMusteri(m) {
    setForm(f => ({ ...f, musteri_adi: m.name, telefon: m.phone || f.telefon }));
    setShowOneriler(false);
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.createGaranti({ ...form, sure_gun: parseInt(form.sure_gun) });
      setShowForm(false);
      setForm({ musteri_adi: "", telefon: "", cihaz: "", tamir_aciklama: "", baslangic_tarihi: today(), sure_gun: "90" });
      setShowOneriler(false);
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function kapat(id) {
    if (!confirm("Bu garantiyi kapatmak istiyorsun?")) return;
    await api.kapatGaranti(id);
    load();
  }

  const now = new Date();

  function daysLeft(bitis) {
    return Math.ceil((new Date(bitis) - now) / 86400000);
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Garanti Takibi</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setErr(""); }}>+ Ekle</button>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
            <div className="form-group" style={{ position: "relative" }}>
              <label className="form-label">Müşteri Adı *</label>
              <input
                className="form-input" required
                value={form.musteri_adi}
                onChange={e => handleMusteriChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowOneriler(false), 150)}
                placeholder="Ad Soyad"
                autoComplete="off"
              />
              {showOneriler && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden",
                }}>
                  {oneriler.map(m => (
                    <div key={m.id} onMouseDown={() => secMusteri(m)}
                      style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                      <span>👤 {m.name}</span>
                      {m.phone && <span style={{ fontSize: 12, color: "var(--hint)" }}>{m.phone}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Telefon</label>
              <input className="form-input" value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} placeholder="0555..." />
            </div>
            <div className="form-group">
              <label className="form-label">Cihaz *</label>
              <input className="form-input" required value={form.cihaz} onChange={e => setForm({ ...form, cihaz: e.target.value })} placeholder="iPhone 14, Samsung A54..." />
            </div>
            <div className="form-group">
              <label className="form-label">Yapılan Tamir *</label>
              <input className="form-input" required value={form.tamir_aciklama} onChange={e => setForm({ ...form, tamir_aciklama: e.target.value })} placeholder="Ekran değişimi, batarya..." />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Başlangıç</label>
                <input className="form-input" type="date" value={form.baslangic_tarihi} onChange={e => setForm({ ...form, baslangic_tarihi: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Süre (gün)</label>
                <select className="form-select" value={form.sure_gun} onChange={e => setForm({ ...form, sure_gun: e.target.value })}>
                  <option value="30">30 gün</option>
                  <option value="60">60 gün</option>
                  <option value="90">90 gün</option>
                  <option value="180">6 ay</option>
                  <option value="365">1 yıl</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {list.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Aktif garanti kaydı yok</div>
      ) : list.map(g => {
        const dl = daysLeft(g.bitis_tarihi);
        const warn = dl <= 7 && dl >= 0;
        const expired = dl < 0;
        return (
          <div key={g.id} className="card">
            <div className="card-row">
              <div>
                <div style={{ fontWeight: 600 }}>{g.musteri_adi}</div>
                <div style={{ fontSize: 13, color: "var(--hint)" }}>{g.cihaz} · {g.tamir_aciklama}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: expired ? "var(--danger)" : warn ? "var(--warn)" : "var(--success)" }}>
                  {expired ? "Süresi Doldu" : `${dl} gün kaldı`}
                </div>
                <div style={{ fontSize: 11, color: "var(--hint)" }}>Bitiş: {g.bitis_tarihi}</div>
              </div>
            </div>
            {g.telefon && <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 4 }}>📞 {g.telefon}</div>}
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => kapat(g.id)}>✓ Kapat</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
