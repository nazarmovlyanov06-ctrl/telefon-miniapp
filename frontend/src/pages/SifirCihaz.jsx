import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import ImeiInput from "../components/ImeiInput";

export default function SifirCihaz({ user }) {
  const navigate = useNavigate();
  const [kaynak, setKaynak] = useState("hepsi");
  const [tab, setTab] = useState("stok");
  const [list, setList] = useState([]);
  const [satilanlar, setSatilanlar] = useState([]);
  const [ozet, setOzet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSat, setShowSat] = useState(false);
  const [err, setErr] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [musteriler, setMusteriler] = useState([]);
  const [satMusteriOner, setSatMusteriOner] = useState([]);
  const [showSatMusteriOner, setShowSatMusteriOner] = useState(false);

  const [form, setForm] = useState({
    model: "", imei: "", renk: "", depolama: "", kimden: "", kimden_telefon: "",
    kaynak: "dukkan", alis_fiyati: "", alis_tarihi: today(), notlar: ""
  });
  const [satForm, setSatForm] = useState({
    satis_fiyati: "", satis_kanali: "Dükkan", musteri_adi: "",
    musteri_telefon: "", odeme_yontemi: "nakit"
  });

  useEffect(() => {
    load();
    api.customers("").then(setMusteriler).catch(() => {});
  }, []);

  async function load() {
    try {
      const [l, o, s] = await Promise.all([api.sifirList(), api.sifirOzet(), api.sifirSatilanlar()]);
      setList(l); setOzet(o); setSatilanlar(s);
    } finally { setLoading(false); }
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

  async function submitAlim(e) {
    e.preventDefault(); setErr("");
    try {
      await api.createSifir({ ...form, alis_fiyati: parseFloat(form.alis_fiyati) });
      setShowForm(false);
      setForm({ model: "", imei: "", renk: "", depolama: "", kimden: "", kimden_telefon: "", kaynak: "dukkan", alis_fiyati: "", alis_tarihi: today(), notlar: "" });
      load();
    } catch (e) { setErr(e.message); }
  }

  async function deleteCihaz(id) {
    try {
      await api.deleteSifir(id);
      setDeleteId(null);
      setSelected(null);
      load();
    } catch (e) { setErr(e.message); }
  }

  async function submitSat(e) {
    e.preventDefault(); setErr("");
    try {
      await api.sifirSat(selected.id, { ...satForm, satis_fiyati: parseFloat(satForm.satis_fiyati) });
      setShowSat(false); setSelected(null);
      setSatForm({ satis_fiyati: "", satis_kanali: "Dükkan", musteri_adi: "", musteri_telefon: "", odeme_yontemi: "nakit" });
      load();
    } catch (e) { setErr(e.message); }
  }

  const filteredList = kaynak === "hepsi" ? list : list.filter(c => (c.kaynak || "dukkan") === kaynak);
  const filteredSatilanlar = kaynak === "hepsi" ? satilanlar : satilanlar.filter(c => (c.kaynak || "dukkan") === kaynak);

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>📦 Sıfır Cihaz</h1>
        {tab === "stok" && <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Ekle</button>}
      </div>

      {/* Özet */}
      {ozet && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div className="card" style={{ textAlign: "center", margin: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{ozet.stokta_adet ?? 0}</div>
            <div style={{ fontSize: 11, color: "var(--hint)" }}>Stokta</div>
          </div>
          <div className="card" style={{ textAlign: "center", margin: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--success)" }}>
              {(ozet.net_kar || 0).toLocaleString("tr-TR")}₺
            </div>
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
        <button className={`tab ${tab === "satilanlar" ? "active" : ""}`} onClick={() => setTab("satilanlar")}>
          ✅ Satılanlar ({filteredSatilanlar.length})
        </button>
      </div>

      {tab === "stok" && (
        <>
          {showForm && (
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Yeni Cihaz Ekle</div>
              <form onSubmit={submitAlim}>
                {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0" }}>❌ {err}</div>}
                <div className="form-group">
                  <label className="form-label">Model *</label>
                  <input className="form-input" required value={form.model}
                    onChange={e => setForm({ ...form, model: e.target.value })}
                    placeholder="iPhone 15, Samsung S24..." />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Renk</label>
                    <input className="form-input" value={form.renk}
                      onChange={e => setForm({ ...form, renk: e.target.value })}
                      placeholder="Siyah, Beyaz..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Depolama</label>
                    <input className="form-input" value={form.depolama}
                      onChange={e => setForm({ ...form, depolama: e.target.value })}
                      placeholder="128GB, 256GB..." />
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
                <div className="form-group">
                  <label className="form-label">Kimden (Ad Soyad) *</label>
                  <input className="form-input" required value={form.kimden}
                    onChange={e => setForm({ ...form, kimden: e.target.value })}
                    placeholder="Kişi/firma adı" />
                </div>
                <div className="form-group">
                  <label className="form-label">Kimden (Telefon) *</label>
                  <input className="form-input" required inputMode="tel" value={form.kimden_telefon}
                    onChange={e => setForm({ ...form, kimden_telefon: e.target.value })}
                    placeholder="0555..." />
                  {form.kimden && form.kimden_telefon && (
                    <div style={{ fontSize: 11, color: "var(--success)", marginTop: 3 }}>✓ Müşteri listesine otomatik eklenecek</div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Kaynak</label>
                  <select className="form-select" value={form.kaynak}
                    onChange={e => setForm({ ...form, kaynak: e.target.value })}>
                    <option value="dukkan">🏪 Dükkan</option>
                    <option value="getmobile">📦 Getmobil</option>
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Alış Fiyatı (₺) *</label>
                    <input className="form-input" type="number" required value={form.alis_fiyati}
                      onChange={e => setForm({ ...form, alis_fiyati: e.target.value })} placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alış Tarihi</label>
                    <input className="form-input" type="date" value={form.alis_tarihi}
                      onChange={e => setForm({ ...form, alis_tarihi: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Not</label>
                  <input className="form-input" value={form.notlar}
                    onChange={e => setForm({ ...form, notlar: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn btn-primary">Kaydet</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
                </div>
              </form>
            </div>
          )}

          {filteredList.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Stokta sıfır cihaz yok</div>
          ) : filteredList.map(c => {
            const isSelected = selected?.id === c.id;
            return (
              <div key={c.id}>
                <div className="card" onClick={() => { setSelected(isSelected ? null : c); setShowSat(false); }} style={{ cursor: "pointer" }}>
                  <div className="card-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>📱 {c.model}</div>
                      {(c.renk || c.depolama) && (
                        <div style={{ fontSize: 12, color: "var(--hint)" }}>
                          {[c.renk, c.depolama].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {c.imei && <div style={{ fontSize: 12, color: "var(--hint)" }}>IMEI: {c.imei}</div>}
                      {c.kimden && <div style={{ fontSize: 12, color: "var(--hint)" }}>Kimden: {c.kimden}</div>}
                      {c.kaynak === "getmobile" && <div style={{ fontSize: 11, color: "var(--hint)" }}>📦 Getmobil</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700 }}>{(c.alis_fiyati || 0).toLocaleString("tr-TR")} ₺</div>
                      <div style={{ fontSize: 11, color: "var(--hint)" }}>{c.alis_tarihi || "—"}</div>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="card" style={{ marginTop: -8, borderRadius: "0 0 12px 12px", background: "var(--bg2)" }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => setShowSat(true)}>💰 Sat</button>
                      {user?.role === "patron" && (
                        deleteId === c.id ? (
                          <>
                            <button className="btn btn-sm" style={{ background: "var(--danger)", color: "#fff", padding: "4px 12px", fontSize: 13 }}
                              onClick={() => deleteCihaz(c.id)}>Sil</button>
                            <button className="btn btn-ghost btn-sm"
                              onClick={() => setDeleteId(null)}>İptal</button>
                          </>
                        ) : (
                          <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                            onClick={() => setDeleteId(c.id)}>🗑 Sil</button>
                        )
                      )}
                    </div>

                    {showSat && (
                      <form onSubmit={submitSat} style={{ marginTop: 10 }}>
                        {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0" }}>❌ {err}</div>}

                        {/* Müşteri autocomplete */}
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
                                  onMouseDown={() => {
                                    setSatForm(f => ({ ...f, musteri_adi: m.name, musteri_telefon: m.phone || f.musteri_telefon }));
                                    setShowSatMusteriOner(false);
                                  }}

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
                            <div style={{ fontSize: 11, color: "var(--success)", marginTop: 3 }}>
                              ✓ Müşteri listesine otomatik eklenecek
                            </div>
                          )}
                        </div>

                        <div className="form-group">
                          <label className="form-label">Satış Fiyatı (₺) *</label>
                          <input className="form-input" type="number" required value={satForm.satis_fiyati}
                            onChange={e => setSatForm({ ...satForm, satis_fiyati: e.target.value })} />
                        </div>

                        {satForm.satis_fiyati && (
                          <div style={{ fontSize: 13, color: "var(--success)", marginBottom: 8, fontWeight: 600 }}>
                            Kâr: {(parseFloat(satForm.satis_fiyati) - (c.alis_fiyati || 0)).toLocaleString("tr-TR")} ₺
                          </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div className="form-group">
                            <label className="form-label">Kanal</label>
                            <select className="form-select" value={satForm.satis_kanali}
                              onChange={e => setSatForm({ ...satForm, satis_kanali: e.target.value })}>
                              {["Dükkan", "Getmobil", "Instagram", "Sahibinden", "Diğer"].map(k => <option key={k}>{k}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Ödeme</label>
                            <select className="form-select" value={satForm.odeme_yontemi}
                              onChange={e => setSatForm({ ...satForm, odeme_yontemi: e.target.value })}>
                              <option value="nakit">💵 Nakit</option>
                              <option value="kart">💳 Kart</option>
                              <option value="taksit">📅 Taksit</option>
                            </select>
                          </div>
                        </div>

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
        filteredSatilanlar.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Henüz satılan cihaz yok</div>
        ) : filteredSatilanlar.map(c => (
          <div key={c.id} className="card">
            <div className="card-row">
              <div>
                <div style={{ fontWeight: 600 }}>📱 {c.model}</div>
                {(c.renk || c.depolama) && (
                  <div style={{ fontSize: 12, color: "var(--hint)" }}>{[c.renk, c.depolama].filter(Boolean).join(" · ")}</div>
                )}
                {c.musteri_adi && <div style={{ fontSize: 13, color: "var(--text)" }}>👤 {c.musteri_adi}</div>}
                {c.musteri_telefon && <div style={{ fontSize: 12, color: "var(--hint)" }}>📞 {c.musteri_telefon}</div>}
                <div style={{ fontSize: 12, color: "var(--hint)" }}>📡 {c.satis_kanali || "Dükkan"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: "var(--success)" }}>{(c.satis_fiyati || 0).toLocaleString("tr-TR")} ₺</div>
                <div style={{ fontSize: 12, color: "var(--success)" }}>
                  Kâr: {((c.satis_fiyati || 0) - (c.alis_fiyati || 0)).toLocaleString("tr-TR")} ₺
                </div>
                <div style={{ fontSize: 11, color: "var(--hint)" }}>{c.satis_tarihi || "—"}</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
