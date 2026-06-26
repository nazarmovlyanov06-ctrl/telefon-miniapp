import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import VoiceInput from "../components/VoiceInput";
import ImeiInput from "../components/ImeiInput";

const ARIZA_CHIPS = [
  "Ekran kırık", "Batarya", "Şarj sorunu", "Hoparlör",
  "Kamera", "Açılmıyor", "Su hasarı", "Tuş arızası",
  "Ön kamera", "Kasa hasarı", "Touch ID", "Face ID",
  "Mikrofon", "Wifi sorunu", "Bluetooth", "Sinyal yok",
];

export default function NewRepair() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customer_name: "", customer_phone: "",
    device_model: "", imei: "", fault_desc: "",
    estimated_price: "", notes: "",
  });

  // Şablonlar
  const [sablonlar, setSablonlar] = useState([]);
  const [sablonModal, setSablonModal] = useState(false);

  // Model autocomplete
  const [modeller, setModeller] = useState([]);
  const [modelOneri, setModelOneri] = useState([]);
  const [modelFocus, setModelFocus] = useState(false);

  // Arıza öneriler (geçmiş)
  const [arizaGecmis, setArizaGecmis] = useState([]);

  useEffect(() => {
    api.sablonlar().then(setSablonlar).catch(() => {});
    api.repairModeller().then(setModeller).catch(() => {});
    api.repairArizaOneri().then(setArizaGecmis).catch(() => {});
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function modelDegisti(v) {
    set("device_model", v);
    if (v.length >= 2) {
      const oneri = modeller.filter(m => m.toLowerCase().includes(v.toLowerCase())).slice(0, 6);
      setModelOneri(oneri);
    } else {
      setModelOneri([]);
    }
  }

  function sablonUygula(s) {
    setForm(f => ({
      ...f,
      device_model: s.cihaz_model || f.device_model,
      fault_desc: s.ariza || f.fault_desc,
      estimated_price: s.tahmini_ucret ? String(s.tahmini_ucret) : f.estimated_price,
      notes: s.notlar || f.notes,
    }));
    setSablonModal(false);
    api.sablon_kullan(s.id).catch(() => {});
  }

  function chipEkle(chip) {
    set("fault_desc", form.fault_desc ? form.fault_desc + ", " + chip : chip);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.device_model || !form.fault_desc) {
      setError("Cihaz modeli ve arıza açıklaması zorunlu");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.createRepair({
        ...form,
        estimated_price: form.estimated_price ? parseFloat(form.estimated_price) : null,
      });
      navigate(`/repairs/${res.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Tüm arıza chip'leri (geçmiş + sabit)
  const tumChipler = [...new Set([...arizaGecmis.slice(0, 6), ...ARIZA_CHIPS])].slice(0, 16);

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/repairs")}>← Geri</button>
        <div className="page-title" style={{ margin: 0, flex: 1 }}>Yeni Tamir</div>
        {sablonlar.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setSablonModal(true)}>⭐ Şablon</button>
        )}
      </div>

      {/* Şablon Modal */}
      {sablonModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", padding: 16 }}
          onClick={() => setSablonModal(false)}>
          <div className="card" style={{ width: "100%", maxHeight: "70vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>⭐ Şablon Seç</div>
            {sablonlar.map(s => (
              <div key={s.id} onClick={() => sablonUygula(s)}
                style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg2)", marginBottom: 8, cursor: "pointer" }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.ad}</div>
                <div style={{ fontSize: 12, color: "var(--hint)" }}>
                  {s.cihaz_model || "—"} · {s.ariza || "—"}{s.tahmini_ucret ? ` · ${s.tahmini_ucret}₺` : ""}
                </div>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => setSablonModal(false)}>Kapat</button>
          </div>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={submit}>
        <div className="section-title">Müşteri</div>
        <div className="card">
          <div className="form-group">
            <label className="form-label">Müşteri Adı *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="form-input" style={{ flex: 1 }} placeholder="Ad Soyad"
                value={form.customer_name}
                onChange={e => set("customer_name", e.target.value)} />
              <VoiceInput onResult={v => set("customer_name", v)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Telefon</label>
            <input className="form-input" placeholder="05xx xxx xx xx" type="tel"
              value={form.customer_phone}
              onChange={e => set("customer_phone", e.target.value)} />
          </div>
        </div>

        <div className="section-title">Cihaz</div>
        <div className="card">
          <div className="form-group" style={{ position: "relative" }}>
            <label className="form-label">Cihaz Modeli *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input className="form-input" placeholder="iPhone 14, Samsung A54..."
                  value={form.device_model}
                  onChange={e => modelDegisti(e.target.value)}
                  onFocus={() => setModelFocus(true)}
                  onBlur={() => setTimeout(() => setModelFocus(false), 150)}
                  autoComplete="off" />
                {modelFocus && modelOneri.length > 0 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                    background: "var(--card)", border: "1px solid var(--border)",
                    borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                  }}>
                    {modelOneri.map((m, i) => (
                      <div key={i} onMouseDown={() => { set("device_model", m); setModelOneri([]); }}
                        style={{ padding: "10px 14px", fontSize: 14, cursor: "pointer", borderBottom: i < modelOneri.length - 1 ? "1px solid var(--border)" : "none" }}>
                        {m}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <VoiceInput onResult={v => { set("device_model", v); modelDegisti(v); }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">IMEI</label>
            <ImeiInput value={form.imei} onChange={v => set("imei", v)} />
          </div>

          <div className="form-group">
            <label className="form-label">Arıza *</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input className="form-input" style={{ flex: 1 }} placeholder="Ekran kırık, batarya..."
                value={form.fault_desc}
                onChange={e => set("fault_desc", e.target.value)} />
              <VoiceInput onResult={v => set("fault_desc", form.fault_desc ? form.fault_desc + " " + v : v)} />
            </div>
            {/* Chip seçiciler */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tumChipler.map(c => (
                <button key={c} type="button"
                  onClick={() => chipEkle(c)}
                  style={{
                    padding: "4px 10px", borderRadius: 20, border: "1px solid var(--border)",
                    background: form.fault_desc.includes(c) ? "var(--accent)" : "var(--bg2)",
                    color: form.fault_desc.includes(c) ? "#fff" : "var(--text)",
                    fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                  }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Tahmini Ücret (₺)</label>
            <input className="form-input" placeholder="0" type="number"
              value={form.estimated_price}
              onChange={e => set("estimated_price", e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Not</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="form-input" style={{ flex: 1 }} placeholder="Ek bilgi..."
                value={form.notes}
                onChange={e => set("notes", e.target.value)} />
              <VoiceInput onResult={v => set("notes", form.notes ? form.notes + " " + v : v)} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ flex: 1 }}>
            {saving ? "Kaydediliyor..." : "✅ Tamir Kaydı Oluştur"}
          </button>
          {form.device_model && form.fault_desc && (
            <button type="button" className="btn btn-ghost"
              onClick={async () => {
                const ad = `${form.device_model} — ${form.fault_desc}`;
                try {
                  await api.createSablon({
                    ad,
                    cihaz_model: form.device_model,
                    ariza: form.fault_desc,
                    tahmini_ucret: form.estimated_price ? parseFloat(form.estimated_price) : null,
                    notlar: form.notes || null,
                  });
                  const s = await api.sablonlar();
                  setSablonlar(s);
                  alert("⭐ Şablon kaydedildi!");
                } catch {}
              }}
              title="Şablon olarak kaydet">
              ⭐
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
