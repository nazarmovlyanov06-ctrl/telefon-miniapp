import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Maas() {
  const navigate = useNavigate();
  const now = new Date();
  const [calisanlar, setCalisanlar] = useState([]);
  const [ozet, setOzet] = useState({ calisanlar: [], toplam_maas: 0, toplam_avans: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("calisanlar");
  const [showCalisan, setShowCalisan] = useState(false);
  const [showAvans, setShowAvans] = useState(false);
  const [cForm, setCForm] = useState({ ad: "", telefon: "", aylik_maas: "" });
  const [aForm, setAForm] = useState({ calisan_id: "", tutar: "", tarih: today(), notlar: "" });
  const [err, setErr] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [c, o] = await Promise.all([
        api.calisanlar(),
        api.maasOzet(now.getFullYear(), now.getMonth() + 1),
      ]);
      setCalisanlar(c); setOzet(o);
    } finally { setLoading(false); }
  }

  async function submitCalisan(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.createCalisan({ ...cForm, aylik_maas: parseFloat(cForm.aylik_maas) });
      setShowCalisan(false);
      setCForm({ ad: "", telefon: "", aylik_maas: "" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function submitAvans(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.createAvans({ ...aForm, calisan_id: parseInt(aForm.calisan_id), tutar: parseFloat(aForm.tutar) });
      setShowAvans(false);
      setAForm({ calisan_id: "", tutar: "", tarih: today(), notlar: "" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Maaş & Avans</h1>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "calisanlar" ? "active" : ""}`} onClick={() => setTab("calisanlar")}>Çalışanlar</button>
        <button className={`tab ${tab === "aylik" ? "active" : ""}`} onClick={() => setTab("aylik")}>{aylar[now.getMonth()]} Özeti</button>
      </div>

      {tab === "calisanlar" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button className="btn btn-primary" onClick={() => setShowCalisan(true)}>+ Çalışan Ekle</button>
            <button className="btn btn-ghost" onClick={() => setShowAvans(true)}>+ Avans</button>
          </div>

          {showCalisan && (
            <div className="card">
              <form onSubmit={submitCalisan}>
                {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
                <div className="form-group">
                  <label className="form-label">Ad Soyad *</label>
                  <input className="form-input" required value={cForm.ad} onChange={e => setCForm({ ...cForm, ad: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input className="form-input" value={cForm.telefon} onChange={e => setCForm({ ...cForm, telefon: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Aylık Maaş (₺) *</label>
                  <input className="form-input" type="number" required value={cForm.aylik_maas} onChange={e => setCForm({ ...cForm, aylik_maas: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn btn-primary">Kaydet</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowCalisan(false)}>İptal</button>
                </div>
              </form>
            </div>
          )}

          {showAvans && (
            <div className="card">
              <form onSubmit={submitAvans}>
                {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
                <div className="form-group">
                  <label className="form-label">Çalışan *</label>
                  <select className="form-select" required value={aForm.calisan_id} onChange={e => setAForm({ ...aForm, calisan_id: e.target.value })}>
                    <option value="">Seç</option>
                    {calisanlar.map(c => <option key={c.id} value={c.id}>{c.ad}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Avans Tutarı (₺) *</label>
                  <input className="form-input" type="number" required value={aForm.tutar} onChange={e => setAForm({ ...aForm, tutar: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tarih</label>
                  <input className="form-input" type="date" value={aForm.tarih} onChange={e => setAForm({ ...aForm, tarih: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Not</label>
                  <input className="form-input" value={aForm.notlar} onChange={e => setAForm({ ...aForm, notlar: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn btn-primary">Kaydet</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAvans(false)}>İptal</button>
                </div>
              </form>
            </div>
          )}

          {calisanlar.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Çalışan eklenmedi</div>
          ) : calisanlar.map(c => (
            <div key={c.id} className="card">
              <div className="card-row">
                <div>
                  <div style={{ fontWeight: 600 }}>👤 {c.ad}</div>
                  {c.telefon && <div style={{ fontSize: 13, color: "var(--hint)" }}>📞 {c.telefon}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>{(c.aylik_maas || 0).toLocaleString("tr-TR")} ₺</div>
                  <div style={{ fontSize: 12, color: "var(--hint)" }}>aylık maaş</div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === "aylik" && (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--hint)", marginBottom: 10 }}>
            {aylar[now.getMonth()]} {now.getFullYear()} Maaş Özeti
          </div>
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-row">
              <span style={{ color: "var(--hint)" }}>Toplam Maaş</span>
              <span style={{ fontWeight: 600 }}>{(ozet.toplam_maas || 0).toLocaleString("tr-TR")} ₺</span>
            </div>
            <div className="card-row">
              <span style={{ color: "var(--hint)" }}>Toplam Avans</span>
              <span style={{ color: "var(--danger)" }}>-{(ozet.toplam_avans || 0).toLocaleString("tr-TR")} ₺</span>
            </div>
          </div>
          {(ozet.calisanlar || []).length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Veri yok</div>
          ) : (ozet.calisanlar || []).map(o => (
            <div key={o.calisan_id} className="card">
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{o.ad}</div>
              <div className="card-row">
                <span style={{ color: "var(--hint)", fontSize: 13 }}>Maaş</span>
                <span>{(o.aylik_maas || 0).toLocaleString("tr-TR")} ₺</span>
              </div>
              <div className="card-row">
                <span style={{ color: "var(--hint)", fontSize: 13 }}>Alınan Avans</span>
                <span style={{ color: "var(--danger)" }}>-{(o.alinan_avans || 0).toLocaleString("tr-TR")} ₺</span>
              </div>
              <div className="card-row" style={{ borderTop: "1px solid var(--bg2)", marginTop: 6, paddingTop: 6 }}>
                <span style={{ fontWeight: 700 }}>Net Ödeme</span>
                <span style={{ fontWeight: 700, color: "var(--success)" }}>{(o.kalan || 0).toLocaleString("tr-TR")} ₺</span>
              </div>
              {o.odendi && <div style={{ fontSize: 12, color: "var(--success)", marginTop: 4 }}>✓ Ödendi</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
