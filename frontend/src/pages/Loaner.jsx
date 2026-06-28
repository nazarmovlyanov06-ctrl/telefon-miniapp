import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Loaner() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("aktif");
  const [list, setList] = useState([]);
  const [gecmis, setGecmis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [hasarModal, setHasarModal] = useState(null);
  const [hasarForm, setHasarForm] = useState({ notu: "", tutar: "" });
  const [fotoModal, setFotoModal] = useState(null);
  const [fotolar, setFotolar] = useState([]);
  const [fotoLoading, setFotoLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ musteri_adi: "", cihaz: "", teslim_tarihi: today(), notlar: "" });
  const [musteriler, setMusteriler] = useState([]);
  const [oneriler, setOneriler] = useState([]);
  const [showOneriler, setShowOneriler] = useState(false);
  const [ikinciElStock, setIkinciElStock] = useState([]);
  const [cihazOneri, setCihazOneri] = useState([]);
  const [showCihazOneri, setShowCihazOneri] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    load();
    api.customers("").then(setMusteriler).catch(() => {});
    api.ikinciElList().then(list => setIkinciElStock((list || []).filter(c => !c.satis_fiyati))).catch(() => {});
  }, []);

  async function load() {
    try {
      const [aktif, iade] = await Promise.all([api.loanerList(), api.loanerGecmis()]);
      setList(aktif); setGecmis(iade);
    } finally { setLoading(false); }
  }

  async function openFotolar(loaner) {
    setFotoModal(loaner);
    setFotolar([]);
    setFotoLoading(true);
    try { setFotolar(await api.loanerFotolar(loaner.id)); } catch (_) {}
    finally { setFotoLoading(false); }
  }

  async function addFoto(e) {
    const file = e.target.files?.[0];
    if (!file || !fotoModal) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await api.addLoanerFoto(fotoModal.id, { foto: ev.target.result, aciklama: "" });
        setFotolar(await api.loanerFotolar(fotoModal.id));
      } catch (_) {}
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleMusteriChange(val) {
    setForm(f => ({ ...f, musteri_adi: val }));
    if (val.length >= 2) {
      const q = val.toLowerCase();
      const found = musteriler.filter(m =>
        m.name.toLowerCase().includes(q) || (m.phone || "").includes(q)
      ).slice(0, 5);
      setOneriler(found); setShowOneriler(found.length > 0);
    } else { setShowOneriler(false); }
  }

  function handleCihazChange(val) {
    setForm(f => ({ ...f, cihaz: val }));
    if (val.length >= 2) {
      const q = val.toLowerCase();
      const found = ikinciElStock.filter(c =>
        (c.model || "").toLowerCase().includes(q)
      ).slice(0, 5);
      setCihazOneri(found);
      setShowCihazOneri(found.length > 0);
    } else {
      setShowCihazOneri(false);
    }
  }

  async function submit(e) {
    e.preventDefault(); setErr("");
    try {
      await api.createLoaner(form);
      setShowForm(false);
      setForm({ musteri_adi: "", cihaz: "", teslim_tarihi: today(), notlar: "" });
      setShowOneriler(false);
      load();
    } catch (e) { setErr(e.message); }
  }

  function openHasarModal(loaner) {
    setHasarModal(loaner);
    setHasarForm({ notu: loaner.hasar_notu || "", tutar: loaner.hasar_tutar || "" });
  }

  async function saveHasar(e) {
    e.preventDefault();
    try {
      await api.loanerHasar(hasarModal.id, { notu: hasarForm.notu, tutar: hasarForm.tutar });
      setHasarModal(null);
      load();
    } catch (ex) { alert(ex.message); }
  }

  async function iade(loaner) {
    openHasarModal(loaner);
  }

  async function iadeKaydet() {
    try {
      if (hasarForm.notu || hasarForm.tutar) {
        await api.loanerHasar(hasarModal.id, { notu: hasarForm.notu, tutar: hasarForm.tutar });
      }
      await api.iadeLoaner(hasarModal.id);
      setHasarModal(null);
      load();
    } catch (ex) { alert(ex.message); }
  }

  function daysOut(teslim) {
    return Math.floor((new Date() - new Date(teslim)) / 86400000);
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Yedek Telefon</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setErr(""); }}>+ Teslim Et</button>
      </div>

      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${tab === "aktif" ? "active" : ""}`} onClick={() => setTab("aktif")}>
          📱 Dışarıda ({list.length})
        </button>
        <button className={`tab ${tab === "gecmis" ? "active" : ""}`} onClick={() => setTab("gecmis")}>
          📋 İade Edildi ({gecmis.length})
        </button>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
            <div className="form-group" style={{ position: "relative" }}>
              <label className="form-label">Müşteri Adı *</label>
              <input
                ref={inputRef}
                className="form-input"
                required
                value={form.musteri_adi}
                onChange={e => handleMusteriChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowOneriler(false), 150)}
                placeholder="Ad Soyad (kayıtlı müşterilerden önerir)"
                autoComplete="off"
              />
              {showOneriler && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
                  background: "rgba(var(--card-rgb, 255,255,255), 0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden" }}>
                  {oneriler.map(m => (
                    <div key={m.id} onMouseDown={() => { setForm(f => ({ ...f, musteri_adi: m.name })); setShowOneriler(false); }}
                      style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14,
                        borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                      <span>👤 {m.name}</span>
                      {m.phone && <span style={{ fontSize: 12, color: "var(--hint)" }}>{m.phone}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group" style={{ position: "relative" }}>
              <label className="form-label">Teslim Edilen Cihaz *</label>
              <input className="form-input" required value={form.cihaz}
                onChange={e => handleCihazChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowCihazOneri(false), 150)}
                placeholder="Samsung A12, Huawei P20..." />
              {showCihazOneri && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
                  background: "rgba(var(--card-rgb, 255,255,255), 0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden" }}>
                  {cihazOneri.map(c => (
                    <div key={c.id} onMouseDown={() => {
                      setForm(f => ({ ...f, cihaz: c.model || "" }));
                      setShowCihazOneri(false);
                    }} style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13,
                      borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                      <span>📱 {c.model}</span>
                      <span style={{ fontSize: 11, color: "var(--hint)" }}>2.El Stok</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Teslim Tarihi</label>
              <input className="form-input" type="date" value={form.teslim_tarihi}
                onChange={e => setForm({ ...form, teslim_tarihi: e.target.value })} />
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

      {/* Fotoğraf modalı */}
      {fotoModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 210,
          background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", padding: 0
        }} onClick={() => setFotoModal(null)}>
          <div className="card" style={{ width: "100%", borderRadius: "20px 20px 0 0", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div className="card-row" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📷 {fotoModal.cihaz} Fotoğrafları</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setFotoModal(null)}>✕</button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
              style={{ display: "none" }} onChange={addFoto} />
            <button className="btn btn-primary btn-sm" style={{ marginBottom: 12 }}
              onClick={() => fileInputRef.current?.click()}>
              📷 Fotoğraf Çek / Ekle
            </button>
            {fotoLoading ? (
              <div style={{ textAlign: "center", color: "var(--hint)", padding: 20 }}>Yükleniyor...</div>
            ) : fotolar.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--hint)", padding: 20 }}>Henüz fotoğraf yok</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {fotolar.map(f => (
                  <div key={f.id}>
                    <img src={f.foto} alt={f.aciklama || "foto"} style={{ width: "100%", borderRadius: 10, objectFit: "cover", aspectRatio: "1" }} />
                    {f.created_at && <div style={{ fontSize: 10, color: "var(--hint)", textAlign: "center", marginTop: 3 }}>
                      {new Date(f.created_at).toLocaleDateString("tr-TR")}
                    </div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hasar modalı */}
      {hasarModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div className="card" style={{ width: "100%", maxWidth: 400 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
              İade Al — {hasarModal.musteri_adi} ({hasarModal.cihaz})
            </div>
            <div className="form-group">
              <label className="form-label">Hasar Notu</label>
              <input className="form-input" value={hasarForm.notu}
                onChange={e => setHasarForm(f => ({ ...f, notu: e.target.value }))}
                placeholder="Ekran çatlak, tuş eksik... (opsiyonel)" />
            </div>
            <div className="form-group">
              <label className="form-label">Hasar Tutarı (₺)</label>
              <input className="form-input" type="number" value={hasarForm.tutar}
                onChange={e => setHasarForm(f => ({ ...f, tutar: e.target.value }))}
                placeholder="0" />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary" onClick={iadeKaydet}>✅ İade Al</button>
              <button className="btn btn-ghost" onClick={() => setHasarModal(null)}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* AKTİF */}
      {tab === "aktif" && (
        list.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Dışarıda yedek telefon yok</div>
        ) : list.map(l => {
          const gun = daysOut(l.teslim_tarihi);
          const warn = gun >= 7;
          return (
            <div key={l.id} className="card">
              <div className="card-row">
                <div>
                  <div style={{ fontWeight: 600 }}>👤 {l.musteri_adi}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)" }}>📱 {l.cihaz}</div>
                  <div style={{ fontSize: 12, color: warn ? "var(--danger)" : "var(--hint)" }}>
                    📅 {l.teslim_tarihi} · {gun === 0 ? "Bugün" : `${gun} gündür dışarıda`}{warn && " ⚠️"}
                  </div>
                  {l.notlar && <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 4 }}>{l.notlar}</div>}
                  {l.hasar_notu && (
                    <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>
                      ⚠️ Hasar: {l.hasar_notu}{l.hasar_tutar ? ` (₺${l.hasar_tutar})` : ""}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => iade(l)}>İade Al</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => openFotolar(l)}>📷</button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* GEÇMİŞ */}
      {tab === "gecmis" && (
        gecmis.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>İade kaydı yok</div>
        ) : gecmis.map(l => (
          <div key={l.id} className="card" style={{ opacity: 0.85 }}>
            <div className="card-row">
              <div>
                <div style={{ fontWeight: 600 }}>✅ {l.musteri_adi}</div>
                <div style={{ fontSize: 13, color: "var(--hint)" }}>📱 {l.cihaz}</div>
                <div style={{ fontSize: 12, color: "var(--hint)" }}>
                  Verildi: {l.teslim_tarihi} · İade: {l.iade_tarihi || "—"}
                </div>
                {l.hasar_notu && (
                  <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 2 }}>
                    ⚠️ {l.hasar_notu}{l.hasar_tutar ? ` · ₺${l.hasar_tutar}` : ""}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                {l.teslim_tarihi && l.iade_tarihi && (
                  <div style={{ fontSize: 13, color: "var(--hint)" }}>
                    {Math.floor((new Date(l.iade_tarihi) - new Date(l.teslim_tarihi)) / 86400000)} gün
                  </div>
                )}
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                  onClick={() => openFotolar(l)}>📷 Resimler</button>
              </div>
            </div>
            {l.notlar && <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 4 }}>{l.notlar}</div>}
          </div>
        ))
      )}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
