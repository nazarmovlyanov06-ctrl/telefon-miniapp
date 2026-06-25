import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Garanti() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    musteri_adi: "", telefon: "", cihaz: "", tamir_aciklama: "",
    baslangic_tarihi: today(), sure_gun: "90"
  });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [g, c] = await Promise.all([api.garantiList(), api.customers()]);
      setList(g); setCustomers(c);
    } finally { setLoading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    await api.createGaranti({ ...form, sure_gun: parseInt(form.sure_gun) });
    setShowForm(false);
    setForm({ musteri_adi: "", telefon: "", cihaz: "", tamir_aciklama: "", baslangic_tarihi: today(), sure_gun: "90" });
    load();
  }

  async function kapat(id) {
    if (!confirm("Bu garantiyi kapatmak istiyorsun?")) return;
    await api.kapatGaranti(id);
    load();
  }

  const now = new Date();

  function daysLeft(bitis) {
    const d = Math.ceil((new Date(bitis) - now) / 86400000);
    return d;
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Garanti Takibi</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Ekle</button>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Müşteri Adı *</label>
              <input className="form-input" required value={form.musteri_adi} onChange={e => setForm({ ...form, musteri_adi: e.target.value })} placeholder="Ad Soyad" />
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
                <div style={{
                  fontWeight: 700, fontSize: 13,
                  color: expired ? "var(--danger)" : warn ? "var(--warn)" : "var(--success)"
                }}>
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
