import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import ImeiInput from "../components/ImeiInput";

export default function IkinciEl() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("stok");
  const [kaynak, setKaynak] = useState("hepsi");
  const [list, setList] = useState([]);
  const [satilanlar, setSatilanlar] = useState([]);
  const [ozet, setOzet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showMasraf, setShowMasraf] = useState(false);
  const [showSat, setShowSat] = useState(false);
  const [form, setForm] = useState({ model: "", imei: "", renk: "", depolama: "", ram: "", ozellikler: "", kimden: "", kimden_telefon: "", alis_fiyati: "", kaynak: "dukkan", notlar: "" });
  const [masrafForm, setMasrafForm] = useState({ aciklama: "", tutar: "", tarih: today() });
  const [satForm, setSatForm] = useState({ satis_fiyati: "", satis_kanali: "Dükkan", musteri_adi: "", musteri_telefon: "", odeme_yontemi: "nakit" });
  const [err, setErr] = useState("");
  const [musteriler, setMusteriler] = useState([]);
  const [kimdenOner, setKimdenOner] = useState([]);
  const [showKimdenOner, setShowKimdenOner] = useState(false);
  const [satMusteriOner, setSatMusteriOner] = useState([]);
  const [showSatMusteriOner, setShowSatMusteriOner] = useState(false);
  const [imeiSon4, setImeiSon4] = useState("");
  const [imeiGecmis, setImeiGecmis] = useState(null);
  const [imeiLoading, setImeiLoading] = useState(false);

  useEffect(() => {
    load();
    api.customers("").then(setMusteriler).catch(() => {});
  }, []);

  async function load() {
    try {
      const [l, o, s] = await Promise.all([api.ikinciElList(), api.ikinciElOzet(), api.ikinciElSatilanlar()]);
      setList(l); setOzet(o); setSatilanlar(s);
    } finally { setLoading(false); }
  }

  function selectCihaz(c) {
    const isSame = selected?.id === c.id;
    setSelected(isSame ? null : c);
    setShowMasraf(false); setShowSat(false);
  }

  function handleSatMusteriChange(val) {
    setSatForm(f => ({ ...f, musteri_adi: val }));
    if (val.length >= 2) {
      const found = musteriler.filter(m =>
        m.name.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setSatMusteriOner(found);
      setShowSatMusteriOner(found.length > 0);
    } else {
      setShowSatMusteriOner(false);
    }
  }

  function handleKimdenChange(val) {
    setForm(f => ({ ...f, kimden: val }));
    if (val.length >= 2) {
      const found = musteriler.filter(m =>
        m.name.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setKimdenOner(found);
      setShowKimdenOner(found.length > 0);
    } else {
      setShowKimdenOner(false);
    }
  }

  async function submitAlim(e) {
    e.preventDefault(); setErr("");
    try {
      await api.createIkinciEl({ ...form, alis_fiyati: parseFloat(form.alis_fiyati) });
      setShowForm(false);
      setForm({ model: "", imei: "", renk: "", depolama: "", ram: "", ozellikler: "", kimden: "", kimden_telefon: "", alis_fiyati: "", kaynak: "dukkan", notlar: "" });
      load();
    } catch (e) { setErr(e.message); }
  }

  async function submitMasraf(e) {
    e.preventDefault(); setErr("");
    try {
      await api.ikinciElMasraf(selected.id, { ...masrafForm, tutar: parseFloat(masrafForm.tutar) });
      setShowMasraf(false);
      setMasrafForm({ aciklama: "", tutar: "", tarih: today() });
      const [l, o, s] = await Promise.all([api.ikinciElList(), api.ikinciElOzet(), api.ikinciElSatilanlar()]);
      setList(l); setOzet(o); setSatilanlar(s);
      // Seçili cihazı güncelle (yeni masraflarla)
      const updated = l.find(x => x.id === selected.id);
      if (updated) setSelected(updated);
    } catch (e) { setErr(e.message); }
  }

  async function submitSat(e) {
    e.preventDefault(); setErr("");
    try {
      await api.ikinciElSat(selected.id, { ...satForm, satis_fiyati: parseFloat(satForm.satis_fiyati) });
      setShowSat(false); setSelected(null);
      setSatForm({ satis_fiyati: "", satis_kanali: "Dükkan", musteri_adi: "", musteri_telefon: "", odeme_yontemi: "nakit" });
      load();
    } catch (e) { setErr(e.message); }
  }

  async function searchIMEI() {
    if (imeiSon4.length < 4) return;
    setImeiLoading(true); setImeiGecmis(null);
    try {
      const data = await api.ikinciElIMEI(imeiSon4);
      setImeiGecmis(data);
    } catch { setImeiGecmis([]); }
    finally { setImeiLoading(false); }
  }

  const filteredList = kaynak === "hepsi" ? list : list.filter(c => (c.kaynak || "dukkan") === kaynak);
  const filteredSatilanlar = kaynak === "hepsi" ? satilanlar : satilanlar.filter(c => (c.kaynak || "dukkan") === kaynak);

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>2. El Cihaz</h1>
        {tab === "stok" && <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Alım</button>}
      </div>

      {ozet && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div className="card" style={{ textAlign: "center", margin: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{ozet.stokta_adet ?? 0}</div>
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

      {/* Kaynak filtresi */}
      <div className="tabs" style={{ marginBottom: 8 }}>
        {[
          { key: "hepsi", label: "Hepsi" },
          { key: "dukkan", label: "🏪 Dükkan" },
          { key: "getmobile", label: "📦 Getmobil" },
        ].map(k => (
          <button key={k.key} className={`tab ${kaynak === k.key ? "active" : ""}`}
            onClick={() => setKaynak(k.key)}>{k.label}</button>
        ))}
      </div>

      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${tab === "stok" ? "active" : ""}`} onClick={() => setTab("stok")}>📦 Stok</button>
        <button className={`tab ${tab === "satilanlar" ? "active" : ""}`} onClick={() => setTab("satilanlar")}>✅ Satılanlar ({filteredSatilanlar.length})</button>
        <button className={`tab ${tab === "imei" ? "active" : ""}`} onClick={() => setTab("imei")}>🔍 IMEI</button>
      </div>

      {tab === "stok" && (
        <>
          {showForm && (
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Yeni Alım</div>
              <form onSubmit={submitAlim}>
                {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
                <div className="form-group">
                  <label className="form-label">Model *</label>
                  <input className="form-input" required value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="iPhone 13, Samsung A54..." />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Renk</label>
                    <input className="form-input" value={form.renk} onChange={e => setForm({ ...form, renk: e.target.value })} placeholder="Siyah, Beyaz..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hafıza</label>
                    <input className="form-input" value={form.depolama} onChange={e => setForm({ ...form, depolama: e.target.value })} placeholder="128GB, 256GB..." />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">RAM</label>
                    <input className="form-input" value={form.ram} onChange={e => setForm({ ...form, ram: e.target.value })} placeholder="6GB, 8GB..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Özellikler</label>
                    <input className="form-input" value={form.ozellikler} onChange={e => setForm({ ...form, ozellikler: e.target.value })} placeholder="Hasar, batarya..." />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">IMEI</label>
                  <ImeiInput
                    value={form.imei}
                    onChange={v => setForm({ ...form, imei: v })}
                    placeholder="15 haneli veya 📷 okut"
                  />
                </div>
                <div className="form-group" style={{ position: "relative" }}>
                  <label className="form-label">Kimden (Ad Soyad) *</label>
                  <input className="form-input" required value={form.kimden}
                    onChange={e => handleKimdenChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowKimdenOner(false), 150)}
                    placeholder="Kişi/firma adı" autoComplete="off" />
                  {showKimdenOner && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
                      background: "var(--card)", border: "1px solid var(--border)",
                      borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden" }}>
                      {kimdenOner.map(m => (
                        <div key={m.id}
                          onMouseDown={() => { setForm(f => ({ ...f, kimden: m.name, kimden_telefon: m.phone || f.kimden_telefon })); setShowKimdenOner(false); }}
                          style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14,
                            borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                          <span>👤 {m.name}</span>
                          {m.phone && <span style={{ fontSize: 12, color: "var(--hint)" }}>{m.phone}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Kimden (Telefon) *</label>
                  <input className="form-input" required inputMode="tel" value={form.kimden_telefon}
                    onChange={e => setForm(f => ({ ...f, kimden_telefon: e.target.value }))}
                    placeholder="0555..." />
                  {form.kimden && form.kimden_telefon && (
                    <div style={{ fontSize: 11, color: "var(--success)", marginTop: 3 }}>✓ Müşteri listesine otomatik eklenecek</div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Kaynak</label>
                  <select className="form-select" value={form.kaynak} onChange={e => setForm({ ...form, kaynak: e.target.value })}>
                    <option value="dukkan">🏪 Dükkan</option>
                    <option value="getmobile">📦 Getmobil</option>
                  </select>
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

          {filteredList.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Stokta 2. el cihaz yok</div>
          ) : filteredList.map(c => {
            const isSelected = selected?.id === c.id;
            const cMasraflar = c.masraflar || [];
            return (
              <div key={c.id}>
                <div className="card" onClick={() => selectCihaz(c)} style={{ cursor: "pointer" }}>
                  <div className="card-row" style={{ marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>📱 {c.model}</div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700 }}>{((c.alis_fiyati || 0) + (c.toplam_masraf || 0)).toLocaleString("tr-TR")} ₺</div>
                      <div style={{ fontSize: 11, color: "var(--hint)" }}>maliyet</div>
                    </div>
                  </div>
                  {/* Özellik chipler */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>
                    {c.renk && <Chip>{c.renk}</Chip>}
                    {c.depolama && <Chip>💾 {c.depolama}</Chip>}
                    {c.ram && <Chip>🧠 {c.ram}</Chip>}
                    {c.ozellikler && <Chip color="orange">{c.ozellikler}</Chip>}
                    {c.kaynak === "getmobile" && <Chip color="blue">📦 Getmobil</Chip>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--hint)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {c.imei && <span>IMEI: {c.imei}</span>}
                    {c.kimden && <span>👤 {c.kimden}</span>}
                    {c.alis_tarihi && <span>📅 {c.alis_tarihi}</span>}
                  </div>
                </div>
                {isSelected && (
                  <div className="card" style={{ marginTop: -8, borderRadius: "0 0 12px 12px", background: "var(--bg2)" }}>
                    {/* Masraf listesi */}
                    {cMasraflar.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--hint)" }}>
                          🔧 Masraflar (toplam: {(c.toplam_masraf || 0).toLocaleString("tr-TR")}₺)
                        </div>
                        {cMasraflar.map(m => (
                          <div key={m.id} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            fontSize: 13, padding: "6px 0",
                            borderBottom: "1px solid var(--border)",
                          }}>
                            <div>
                              <div>{m.aciklama}</div>
                              <div style={{ fontSize: 11, color: "var(--hint)" }}>📅 {m.tarih || "—"}</div>
                            </div>
                            <span style={{ fontWeight: 700 }}>₺{(m.tutar || 0).toLocaleString("tr-TR")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setShowMasraf(true); setShowSat(false); }}>+ Masraf</button>
                      <button className="btn btn-primary btn-sm" onClick={() => { setShowSat(true); setShowMasraf(false); }}>💰 Sat</button>
                    </div>
                    {showMasraf && (
                      <form onSubmit={submitMasraf} style={{ marginTop: 10 }}>
                        {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0" }}>❌ {err}</div>}
                        <div className="form-group">
                          <label className="form-label">Masraf Açıklaması</label>
                          <input className="form-input" required value={masrafForm.aciklama} onChange={e => setMasrafForm({ ...masrafForm, aciklama: e.target.value })} placeholder="Ekran, temizlik, batarya..." />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div className="form-group">
                            <label className="form-label">Tutar (₺)</label>
                            <input className="form-input" type="number" required value={masrafForm.tutar} onChange={e => setMasrafForm({ ...masrafForm, tutar: e.target.value })} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Tarih</label>
                            <input className="form-input" type="date" value={masrafForm.tarih} onChange={e => setMasrafForm({ ...masrafForm, tarih: e.target.value })} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="submit" className="btn btn-primary btn-sm">Kaydet</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMasraf(false)}>İptal</button>
                        </div>
                      </form>
                    )}
                    {showSat && (
                      <form onSubmit={submitSat} style={{ marginTop: 10 }}>
                        {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0" }}>❌ {err}</div>}
                        <div className="form-group" style={{ position: "relative" }}>
                          <label className="form-label">Müşteri Adı *</label>
                          <input className="form-input" required value={satForm.musteri_adi}
                            onChange={e => handleSatMusteriChange(e.target.value)}
                            onBlur={() => setTimeout(() => setShowSatMusteriOner(false), 150)}
                            placeholder="Ad Soyad" autoComplete="off" />
                          {showSatMusteriOner && (
                            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
                              background: "var(--card)", border: "1px solid var(--border)",
                              borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden" }}>
                              {satMusteriOner.map(m => (
                                <div key={m.id}
                                  onMouseDown={() => { setSatForm(f => ({ ...f, musteri_adi: m.name, musteri_telefon: m.phone || f.musteri_telefon })); setShowSatMusteriOner(false); }}
                                  style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14,
                                    borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                                  <span>👤 {m.name}</span>
                                  {m.phone && <span style={{ fontSize: 12, color: "var(--hint)" }}>{m.phone}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="form-group">
                          <label className="form-label">Müşteri Telefonu *</label>
                          <input className="form-input" required inputMode="tel" value={satForm.musteri_telefon}
                            onChange={e => setSatForm(f => ({ ...f, musteri_telefon: e.target.value }))}
                            placeholder="0555..." />
                          {satForm.musteri_adi && satForm.musteri_telefon && (
                            <div style={{ fontSize: 11, color: "var(--success)", marginTop: 3 }}>✓ Müşteri listesine otomatik eklenecek</div>
                          )}
                        </div>
                        <div className="form-group">
                          <label className="form-label">Satış Fiyatı (₺)</label>
                          <input className="form-input" type="number" required value={satForm.satis_fiyati} onChange={e => setSatForm({ ...satForm, satis_fiyati: e.target.value })} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div className="form-group">
                          <label className="form-label">Kanal</label>
                          <select className="form-select" value={satForm.satis_kanali} onChange={e => setSatForm({ ...satForm, satis_kanali: e.target.value })}>
                            {["Dükkan", "Getmobil", "Instagram", "Sahibinden", "Diğer"].map(k => <option key={k}>{k}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Ödeme</label>
                          <select className="form-select" value={satForm.odeme_yontemi} onChange={e => setSatForm({ ...satForm, odeme_yontemi: e.target.value })}>
                            <option value="nakit">💵 Nakit</option>
                            <option value="kart">💳 Kart</option>
                            <option value="taksit">📅 Taksit</option>
                          </select>
                        </div>
                        </div>
                        {satForm.satis_fiyati && (
                          <div style={{ fontSize: 13, color: "var(--success)", marginBottom: 8, fontWeight: 600 }}>
                            Kâr: {(parseFloat(satForm.satis_fiyati) - (c.alis_fiyati || 0) - (c.toplam_masraf || 0)).toLocaleString("tr-TR")} ₺
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
        </>
      )}

      {tab === "satilanlar" && (
        <>
          {filteredSatilanlar.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Henüz satılan cihaz yok</div>
          ) : filteredSatilanlar.map(c => {
            const satMasraflar = c.masraflar || [];
            return (
            <div key={c.id} className="card">
              <div className="card-row" style={{ marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>📱 {c.model}</div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: "var(--success)" }}>{(c.satis_fiyati || 0).toLocaleString("tr-TR")} ₺</div>
                  <div style={{ fontSize: 12, color: "var(--success)" }}>
                    Kâr: {((c.satis_fiyati || 0) - (c.alis_fiyati || 0) - (c.toplam_masraf || 0)).toLocaleString("tr-TR")} ₺
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                {c.renk && <Chip>{c.renk}</Chip>}
                {c.depolama && <Chip>💾 {c.depolama}</Chip>}
                {c.ram && <Chip>🧠 {c.ram}</Chip>}
              </div>
              <div style={{ fontSize: 12, color: "var(--hint)", display: "flex", gap: 10, flexWrap: "wrap", marginBottom: satMasraflar.length > 0 ? 8 : 0 }}>
                {c.musteri_adi && <span>👤 {c.musteri_adi}</span>}
                {c.musteri_telefon && <span>📞 {c.musteri_telefon}</span>}
                <span>📡 {c.satis_kanali || "Dükkan"}</span>
                <span>📅 {c.satis_tarihi || "—"}</span>
                {c.imei && <span>IMEI: {c.imei}</span>}
              </div>
              {/* Masraflar */}
              {satMasraflar.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--hint)", marginBottom: 5 }}>
                    🔧 MASRAFLAR · toplam {(c.toplam_masraf || 0).toLocaleString("tr-TR")}₺
                  </div>
                  {satMasraflar.map(m => (
                    <div key={m.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      fontSize: 13, padding: "4px 0",
                      borderBottom: "1px solid var(--border)",
                    }}>
                      <div>
                        <span style={{ fontWeight: 500 }}>{m.aciklama}</span>
                        <span style={{ fontSize: 11, color: "var(--hint)", marginLeft: 6 }}>📅 {m.tarih || "—"}</span>
                      </div>
                      <span style={{ fontWeight: 700 }}>₺{(m.tutar || 0).toLocaleString("tr-TR")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )})}
        </>
      )}

      {tab === "imei" && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>IMEI Son 4 Hane ile Sorgula</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input className="form-input" style={{ flex: 1 }}
              placeholder="Son 4 hane (örn: 1234)"
              maxLength={4}
              inputMode="numeric"
              value={imeiSon4}
              onChange={e => setImeiSon4(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && searchIMEI()} />
            <button className="btn btn-primary btn-sm" onClick={searchIMEI} disabled={imeiSon4.length < 4 || imeiLoading}>
              {imeiLoading ? "..." : "Ara"}
            </button>
          </div>
          {imeiGecmis === null ? (
            <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center" }}>IMEI son 4 hanesini girin</div>
          ) : imeiGecmis.length === 0 ? (
            <div className="empty"><div className="empty-icon">🔍</div>Kayıt bulunamadı</div>
          ) : imeiGecmis.map(c => (
            <div key={c.id} className="card">
              <div style={{ fontWeight: 600 }}>📱 {c.model}</div>
              <div style={{ fontSize: 12, color: "var(--hint)" }}>IMEI: {c.imei}</div>
              {c.kimden && <div style={{ fontSize: 12, color: "var(--hint)" }}>Kimden: {c.kimden}</div>}
              <div style={{ fontSize: 12, color: "var(--hint)" }}>
                Alış: ₺{c.alis_fiyati} · {c.alis_tarihi || "—"}
              </div>
              {c.satis_fiyati && (
                <div style={{ fontSize: 12, color: "var(--success)" }}>
                  Satış: ₺{c.satis_fiyati} · {c.musteri_adi || ""} · {c.satis_tarihi || ""}
                </div>
              )}
              {c.masraflar && c.masraflar.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--hint)", marginBottom: 2 }}>Masraflar:</div>
                  {c.masraflar.map(m => (
                    <div key={m.id} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                      <span>{m.aciklama}</span><span>₺{m.tutar}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }

function Chip({ children, color }) {
  const colors = {
    orange: { bg: "#fff7ed", text: "#c2410c" },
    blue: { bg: "#eff6ff", text: "#1d4ed8" },
  };
  const c = colors[color] || { bg: "var(--bg2)", text: "var(--hint)" };
  return (
    <span style={{
      fontSize: 11, padding: "2px 7px", borderRadius: 6,
      background: c.bg, color: c.text, fontWeight: 600,
    }}>{children}</span>
  );
}
