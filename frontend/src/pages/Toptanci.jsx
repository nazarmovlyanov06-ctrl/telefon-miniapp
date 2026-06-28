import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Toptanci() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [alislar, setAlislar] = useState([]);
  const [alisLoading, setAlisLoading] = useState(false);
  const [alisErr, setAlisErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showAlisForm, setShowAlisForm] = useState(false);
  const [form, setForm] = useState({ ad: "", telefon: "", sehir: "", notlar: "" });
  const [alisForm, setAlisForm] = useState({ urun: "", miktar: "1", birim_fiyat: "", tarih: today(), notlar: "" });
  const [err, setErr] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try { setList(await api.toptanciList()); } finally { setLoading(false); }
  }

  async function selectToptanci(t) {
    setSelected(t);
    setAlislar([]);
    setAlisErr("");
    setAlisLoading(true);
    try { setAlislar(await api.toptanciAlislar(t.id)); }
    catch (e) { setAlisErr(e.message || "Geçmiş yüklenemedi"); }
    finally { setAlisLoading(false); }
  }

  async function submitToptanci(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.createToptanci(form);
      setShowForm(false);
      setForm({ ad: "", telefon: "", sehir: "", notlar: "" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function deleteToptanci(id) {
    if (!confirm("Bu toptancıyı silmek istiyor musun?")) return;
    await api.deleteToptanci(id);
    setSelected(null);
    load();
  }

  async function submitAlis(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.createToptanciAlis(selected.id, alisForm);
      setShowAlisForm(false);
      setAlisForm({ urun: "", miktar: "1", birim_fiyat: "", tarih: today(), notlar: "" });
      selectToptanci(selected);
    } catch (e) {
      setErr(e.message);
    }
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  if (selected) {
    const topToplam = alislar.reduce((s, a) => s + (a.toplam || 0), 0);
    const dolarKuru = parseFloat(localStorage.getItem("son_dolar_kuru") || "0");
    const topDolar = dolarKuru > 0 ? (topToplam / dolarKuru) : null;
    return (
      <div className="page">
        <div className="card-row" style={{ marginBottom: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>← Geri</button>
          <h1 className="page-title" style={{ margin: 0 }}>{selected.ad}</h1>
          <button className="btn btn-danger btn-sm" onClick={() => deleteToptanci(selected.id)}>Sil</button>
        </div>
        {selected.telefon && (
          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: "var(--hint)" }}>📞 {selected.telefon}</div>
            {selected.sehir && <div style={{ fontSize: 13, color: "var(--hint)" }}>📍 {selected.sehir}</div>}
          </div>
        )}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-row">
            <span style={{ color: "var(--hint)", fontSize: 13 }}>Toplam Harcama</span>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>{topToplam.toLocaleString("tr-TR")} ₺</div>
              {topDolar !== null && (
                <div style={{ fontSize: 12, color: "var(--hint)" }}>≈ ${topDolar.toFixed(0)}</div>
              )}
            </div>
          </div>
        </div>
        <div className="card-row" style={{ marginBottom: 10 }}>
          <div className="page-title" style={{ margin: 0, fontSize: 16 }}>Alış Geçmişi</div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAlisForm(true)}>+ Alış Ekle</button>
        </div>
        {showAlisForm && (
          <div className="card">
            <form onSubmit={submitAlis}>
              {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
              <div className="form-group">
                <label className="form-label">Ürün/Parça</label>
                <input className="form-input" required value={alisForm.urun} onChange={e => setAlisForm({ ...alisForm, urun: e.target.value })} placeholder="Ekran, batarya..." />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Miktar</label>
                  <input className="form-input" type="number" min="1" value={alisForm.miktar} onChange={e => setAlisForm({ ...alisForm, miktar: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Birim Fiyat (₺)</label>
                  <input className="form-input" type="number" required value={alisForm.birim_fiyat} onChange={e => setAlisForm({ ...alisForm, birim_fiyat: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tarih</label>
                <input className="form-input" type="date" value={alisForm.tarih} onChange={e => setAlisForm({ ...alisForm, tarih: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Not (opsiyonel)</label>
                <input className="form-input" value={alisForm.notlar} onChange={e => setAlisForm({ ...alisForm, notlar: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="btn btn-primary">Kaydet</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAlisForm(false)}>İptal</button>
              </div>
            </form>
          </div>
        )}
        {alisErr && <div style={{ color: "var(--danger)", fontSize: 13, textAlign: "center", padding: "6px 0", marginBottom: 4 }}>❌ {alisErr}</div>}
        {alisLoading ? <div style={{ textAlign: "center", color: "var(--hint)" }}>Yükleniyor...</div> :
          alislar.length === 0 && !alisErr ? <div className="card" style={{ color: "var(--hint)", textAlign: "center" }}>Henüz alış kaydı yok</div> :
          alislar.map(a => (
            <div key={a.id} className="card">
              <div className="card-row">
                <span style={{ fontWeight: 600 }}>{a.urun}</span>
                <span style={{ fontWeight: 700 }}>{(a.toplam || 0).toLocaleString("tr-TR")} ₺</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 4 }}>
                {a.miktar} adet × {a.birim_fiyat} ₺ · {a.tarih}
              </div>
              {a.notlar && <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 2 }}>{a.notlar}</div>}
            </div>
          ))
        }
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Toptancı Defteri</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Ekle</button>
      </div>
      {showForm && (
        <div className="card">
          <form onSubmit={submitToptanci}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
            <div className="form-group">
              <label className="form-label">Toptancı Adı *</label>
              <input className="form-input" required value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} placeholder="Firma adı" />
            </div>
            <div className="form-group">
              <label className="form-label">Telefon</label>
              <input className="form-input" value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} placeholder="0555..." />
            </div>
            <div className="form-group">
              <label className="form-label">Şehir</label>
              <input className="form-input" value={form.sehir} onChange={e => setForm({ ...form, sehir: e.target.value })} />
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
        <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Henüz toptancı eklenmedi</div>
      ) : list.map(t => (
        <div key={t.id} className="list-item" onClick={() => selectToptanci(t)}>
          <span style={{ fontSize: 26 }}>🏭</span>
          <div className="list-item-body">
            <div className="list-item-title">{t.ad}</div>
            {t.telefon && <div style={{ fontSize: 13, color: "var(--hint)" }}>{t.telefon}</div>}
            {t.sehir && <div style={{ fontSize: 12, color: "var(--hint)" }}>{t.sehir}</div>}
          </div>
          <span style={{ color: "var(--hint)" }}>›</span>
        </div>
      ))}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
