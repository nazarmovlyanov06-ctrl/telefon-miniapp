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
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ musteri_adi: "", cihaz: "", teslim_tarihi: today(), notlar: "" });
  const [musteriler, setMusteriler] = useState([]);
  const [oneriler, setOneriler] = useState([]);
  const [showOneriler, setShowOneriler] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    load();
    api.customers("").then(setMusteriler).catch(() => {});
  }, []);

  async function load() {
    try {
      const [aktif, iade] = await Promise.all([api.loanerList(), api.loanerGecmis()]);
      setList(aktif); setGecmis(iade);
    } finally { setLoading(false); }
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
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden" }}>
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
            <div className="form-group">
              <label className="form-label">Teslim Edilen Cihaz *</label>
              <input className="form-input" required value={form.cihaz}
                onChange={e => setForm({ ...form, cihaz: e.target.value })}
                placeholder="Samsung A12, Huawei P20..." />
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
                <button className="btn btn-primary btn-sm" onClick={() => iade(l)}>İade Al</button>
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
              {l.teslim_tarihi && l.iade_tarihi && (
                <div style={{ fontSize: 13, color: "var(--hint)", textAlign: "right" }}>
                  {Math.floor((new Date(l.iade_tarihi) - new Date(l.teslim_tarihi)) / 86400000)} gün
                </div>
              )}
            </div>
            {l.notlar && <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 4 }}>{l.notlar}</div>}
          </div>
        ))
      )}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
