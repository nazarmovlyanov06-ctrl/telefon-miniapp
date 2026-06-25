import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function IkinciEl() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("stok");
  const [list, setList] = useState([]);
  const [ozet, setOzet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showMasraf, setShowMasraf] = useState(false);
  const [showSat, setShowSat] = useState(false);
  const [form, setForm] = useState({ model: "", imei: "", kimden: "", alis_fiyati: "", notlar: "" });
  const [masrafForm, setMasrafForm] = useState({ aciklama: "", tutar: "", tarih: today() });
  const [satForm, setSatForm] = useState({ satis_fiyati: "", satis_kanali: "Dükkan" });
  const [err, setErr] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [l, o] = await Promise.all([api.ikinciElList(), api.ikinciElOzet()]);
      setList(l); setOzet(o);
    } finally { setLoading(false); }
  }

  async function submitAlim(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.createIkinciEl({ ...form, alis_fiyati: parseFloat(form.alis_fiyati) });
      setShowForm(false);
      setForm({ model: "", imei: "", kimden: "", alis_fiyati: "", notlar: "" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function submitMasraf(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.ikinciElMasraf(selected.id, { ...masrafForm, tutar: parseFloat(masrafForm.tutar) });
      setShowMasraf(false);
      setMasrafForm({ aciklama: "", tutar: "", tarih: today() });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function submitSat(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.ikinciElSat(selected.id, { ...satForm, satis_fiyati: parseFloat(satForm.satis_fiyati) });
      setShowSat(false);
      setSelected(null);
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>2. El Cihaz</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Alım</button>
      </div>

      {ozet && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div className="card" style={{ textAlign: "center", margin: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{ozet.stokta_adet ?? ozet.stok_adet ?? 0}</div>
            <div style={{ fontSize: 11, color: "var(--hint)" }}>Stokta</div>
          </div>
          <div className="card" style={{ textAlign: "center", margin: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--success)" }}>{(ozet.net_kar || 0).toLocaleString("tr-TR")}₺</div>
            <div style={{ fontSize: 11, color: "var(--hint)" }}>Toplam Kâr</div>
          </div>
          <div className="card" style={{ textAlign: "center", margin: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{ozet.satilan_adet}</div>
            <div style={{ fontSize: 11, color: "var(--hint)" }}>Satılan</div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Yeni Alım</div>
          <form onSubmit={submitAlim}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
            <div className="form-group">
              <label className="form-label">Model *</label>
              <input className="form-input" required value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="iPhone 13, Samsung A54..." />
            </div>
            <div className="form-group">
              <label className="form-label">IMEI</label>
              <input className="form-input" value={form.imei} onChange={e => setForm({ ...form, imei: e.target.value })} placeholder="15 haneli" />
            </div>
            <div className="form-group">
              <label className="form-label">Kimden</label>
              <input className="form-input" value={form.kimden} onChange={e => setForm({ ...form, kimden: e.target.value })} placeholder="Kişi/firma adı" />
            </div>
            <div className="form-group">
              <label className="form-label">Alış Fiyatı (₺) *</label>
              <input className="form-input" type="number" required value={form.alis_fiyati} onChange={e => setForm({ ...form, alis_fiyati: e.target.value })} placeholder="0" />
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
        <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Stokta 2. el cihaz yok</div>
      ) : list.map(c => {
        const isSelected = selected?.id === c.id;
        return (
          <div key={c.id}>
            <div className="card" onClick={() => setSelected(isSelected ? null : c)} style={{ cursor: "pointer" }}>
              <div className="card-row">
                <div>
                  <div style={{ fontWeight: 600 }}>📱 {c.model}</div>
                  {c.imei && <div style={{ fontSize: 12, color: "var(--hint)" }}>IMEI: {c.imei}</div>}
                  {c.kimden && <div style={{ fontSize: 12, color: "var(--hint)" }}>Kimden: {c.kimden}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>{(c.toplam_maliyet || c.alis_fiyati || 0).toLocaleString("tr-TR")} ₺</div>
                  <div style={{ fontSize: 11, color: "var(--hint)" }}>maliyet</div>
                </div>
              </div>
            </div>
            {isSelected && (
              <div className="card" style={{ marginTop: -8, borderRadius: "0 0 12px 12px", background: "var(--bg2)" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowMasraf(true)}>+ Masraf</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowSat(true)}>💰 Sat</button>
                </div>
                {showMasraf && (
                  <form onSubmit={submitMasraf} style={{ marginTop: 10 }}>
                    {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
                    <div className="form-group">
                      <label className="form-label">Masraf Açıklaması</label>
                      <input className="form-input" required value={masrafForm.aciklama} onChange={e => setMasrafForm({ ...masrafForm, aciklama: e.target.value })} placeholder="Ekran, temizlik..." />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tutar (₺)</label>
                      <input className="form-input" type="number" required value={masrafForm.tutar} onChange={e => setMasrafForm({ ...masrafForm, tutar: e.target.value })} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="submit" className="btn btn-primary btn-sm">Kaydet</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMasraf(false)}>İptal</button>
                    </div>
                  </form>
                )}
                {showSat && (
                  <form onSubmit={submitSat} style={{ marginTop: 10 }}>
                    {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
                    <div className="form-group">
                      <label className="form-label">Satış Fiyatı (₺)</label>
                      <input className="form-input" type="number" required value={satForm.satis_fiyati} onChange={e => setSatForm({ ...satForm, satis_fiyati: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kanal</label>
                      <select className="form-select" value={satForm.satis_kanali} onChange={e => setSatForm({ ...satForm, satis_kanali: e.target.value })}>
                        {["Dükkan", "Getmobil", "Instagram", "Sahibinden", "Diğer"].map(k => <option key={k}>{k}</option>)}
                      </select>
                    </div>
                    {satForm.satis_fiyati && (
                      <div style={{ fontSize: 13, color: "var(--success)", marginBottom: 8, fontWeight: 600 }}>
                        Kâr: {(parseFloat(satForm.satis_fiyati) - (c.toplam_maliyet || c.alis_fiyati || 0)).toLocaleString("tr-TR")} ₺
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="submit" className="btn btn-primary btn-sm">Sat</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSat(false)}>İptal</button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
