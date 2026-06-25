import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const DEFAULT_CATS = ["Şarj Aleti", "Kılıf", "Kırılmaz Cam", "Kulaklık", "Powerbank", "Diğer"];

function loadKats() {
  try { return JSON.parse(localStorage.getItem("aksesuar_kategoriler")) || DEFAULT_CATS; }
  catch { return DEFAULT_CATS; }
}

export default function Aksesuar() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kategoriler, setKategoriler] = useState(loadKats);
  const [aktifKat, setAktifKat] = useState("Tümü");
  const [showKatYonet, setShowKatYonet] = useState(false);
  const [yeniKat, setYeniKat] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [satForm, setSatForm] = useState(null);
  const [form, setForm] = useState({ ad: "", stok: "1", alis_fiyati: "", satis_fiyati: "", kategori: "Diğer" });
  const [satData, setSatData] = useState({ miktar: "1", musteri_adi: "" });
  const [err, setErr] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try { setList(await api.aksesuarList()); } finally { setLoading(false); }
  }

  function saveKats(cats) {
    setKategoriler(cats);
    localStorage.setItem("aksesuar_kategoriler", JSON.stringify(cats));
  }

  function addKat() {
    const k = yeniKat.trim();
    if (k && !kategoriler.includes(k)) {
      saveKats([...kategoriler, k]);
    }
    setYeniKat("");
  }

  function removeKat(k) {
    saveKats(kategoriler.filter(c => c !== k));
    if (aktifKat === k) setAktifKat("Tümü");
  }

  async function submit(e) {
    e.preventDefault(); setErr("");
    try {
      await api.createAksesuar({
        ad: form.ad,
        stok: parseInt(form.stok),
        alis_fiyati: parseFloat(form.alis_fiyati),
        satis_fiyati: parseFloat(form.satis_fiyati),
        kategori: form.kategori,
      });
      setShowForm(false);
      setForm({ ad: "", stok: "1", alis_fiyati: "", satis_fiyati: "", kategori: "Diğer" });
      load();
    } catch (e) { setErr(e.message); }
  }

  async function submitSat(e) {
    e.preventDefault(); setErr("");
    try {
      await api.satAksesuar(satForm.id, { miktar: parseInt(satData.miktar), musteri_adi: satData.musteri_adi, tarih: today() });
      setSatForm(null);
      setSatData({ miktar: "1", musteri_adi: "" });
      load();
    } catch (e) { setErr(e.message); }
  }

  const filteredList = aktifKat === "Tümü" ? list : list.filter(a => (a.kategori || "Diğer") === aktifKat);

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Aksesuar</h1>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowKatYonet(!showKatYonet)}>🏷 Kategoriler</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Ekle</button>
        </div>
      </div>

      {/* Kategori Yönetimi */}
      {showKatYonet && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Kategorileri Yönet</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {kategoriler.map(k => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg2)", borderRadius: 20, padding: "4px 10px 4px 12px", fontSize: 13 }}>
                {k}
                <button onClick={() => removeKat(k)} style={{ border: "none", background: "none", color: "var(--danger)", cursor: "pointer", padding: "0 2px", fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input" style={{ flex: 1 }} placeholder="Yeni kategori adı" value={yeniKat} onChange={e => setYeniKat(e.target.value)} onKeyDown={e => e.key === "Enter" && addKat()} />
            <button className="btn btn-primary btn-sm" onClick={addKat}>Ekle</button>
          </div>
        </div>
      )}

      {/* Kategori Filtre Chipsleri */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 10, scrollbarWidth: "none" }}>
        {["Tümü", ...kategoriler].map(k => (
          <button
            key={k}
            onClick={() => setAktifKat(k)}
            style={{
              flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none",
              background: aktifKat === k ? "var(--accent)" : "var(--bg2)",
              color: aktifKat === k ? "#fff" : "var(--text)",
              fontWeight: aktifKat === k ? 700 : 400, fontSize: 13, cursor: "pointer",
            }}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Ürün Ekleme Formu */}
      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="form-select" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>
                {kategoriler.map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Ürün Adı *</label>
              <input className="form-input" required value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} placeholder="Örn: iPhone 15 Kılıf, 65W Şarj..." />
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

      {/* Satış Formu */}
      {satForm && (
        <div className="card" style={{ background: "var(--bg2)" }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Satış: {satForm.ad}</div>
          <form onSubmit={submitSat}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
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

      {/* Ürün Listesi */}
      {filteredList.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>
          {aktifKat === "Tümü" ? "Aksesuar eklenmedi" : `${aktifKat} kategorisinde ürün yok`}
        </div>
      ) : filteredList.map(a => (
        <div key={a.id} className="card">
          <div className="card-row">
            <div>
              <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginBottom: 2 }}>{a.kategori || "Diğer"}</div>
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
