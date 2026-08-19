import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import VoiceInput from "../components/VoiceInput";
import ImeiInput from "../components/ImeiInput";
import PatternLock from "../components/PatternLock";
import { Star, Lock, Hash, Shapes, CheckCircle2, Ban, Mic, Loader2, Sparkles, TriangleAlert } from "lucide-react";

// PIN pad bileşeni
function PinPad({ value, onChange }) {
  function press(d) {
    if (d === "⌫") { onChange(value.slice(0, -1)); return; }
    if (value.length >= 8) return;
    onChange(value + d);
  }
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {/* PIN göstergesi */}
      <div style={{ display: "flex", gap: 14, justifyContent: "center", minHeight: 28, alignItems: "center" }}>
        {value.length === 0
          ? <span style={{ color: "var(--hint)", fontSize: 14 }}>PIN gir</span>
          : Array.from({ length: value.length }, (_, i) => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--accent)" }} />
          ))
        }
      </div>
      {/* Numpad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: 220 }}>
        {keys.map((k, i) => k === "" ? <div key={i} /> : (
          <button key={i} type="button" onClick={() => press(k)}
            style={{
              height: 56, borderRadius: 14, border: "1.5px solid var(--border)",
              background: k === "⌫" ? "var(--bg2)" : "var(--card)",
              color: "var(--text)", fontSize: k === "⌫" ? 20 : 22, fontWeight: 700,
              cursor: "pointer", transition: "background 0.1s",
            }}
            onTouchStart={e => e.currentTarget.style.background = "var(--accent)"}
            onTouchEnd={e => e.currentTarget.style.background = k === "⌫" ? "var(--bg2)" : "var(--card)"}
          >{k}</button>
        ))}
      </div>
      {value.length > 0 && (
        <button type="button" onClick={() => onChange("")}
          style={{ fontSize: 13, color: "var(--hint)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          Temizle
        </button>
      )}
    </div>
  );
}

const ARIZA_CHIPS = [
  "Ekran kırık", "Batarya", "Şarj sorunu", "Hoparlör",
  "Kamera", "Açılmıyor", "Su hasarı", "Tuş arızası",
  "Ön kamera", "Kasa hasarı", "Touch ID", "Face ID",
  "Mikrofon", "Wifi sorunu", "Bluetooth", "Sinyal yok",
];

function telefonTamMi(v) {
  const rakam = (v || "").replace(/\D/g, "");
  return rakam.length === 10 || rakam.length === 11;
}

export default function NewRepair() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [hataAlan, setHataAlan] = useState(null);
  const [form, setForm] = useState({
    customer_name: "", customer_phone: "",
    device_model: "", imei: "", fault_desc: "",
    estimated_price: "", notes: "",
  });

  // Zorunlu alanlara odaklanıp kaydırmak için — kayıt, bunlar doldurulmadan
  // atlanamaz: müşteri adı, eksiksiz telefon, cihaz modeli, arıza; ekran
  // kilidi açıksa PIN/desen de.
  const musteriAdiRef = useRef(null);
  const telefonRef = useRef(null);
  const modelRef = useRef(null);
  const arizaRef = useRef(null);
  const kilitRef = useRef(null);

  // Ekran kilidi
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockType, setLockType] = useState("pin"); // "pin" | "pattern"
  const [lockPin, setLockPin] = useState("");
  const [lockPattern, setLockPattern] = useState("");

  // Şablonlar
  const [sablonlar, setSablonlar] = useState([]);
  const [sablonModal, setSablonModal] = useState(false);

  // Model autocomplete
  const [modeller, setModeller] = useState([]);
  const [modelOneri, setModelOneri] = useState([]);
  const [modelFocus, setModelFocus] = useState(false);

  // Arıza öneriler (geçmiş)
  const [arizaGecmis, setArizaGecmis] = useState([]);

  // Kara liste uyarı
  const [karaUyari, setKaraUyari] = useState([]);
  const karaTimer = useRef(null);

  // Tek mikrofonla karışık anlatıp AI'ın alanları ayırması
  const [sesDinleniyor, setSesDinleniyor] = useState(false);
  const [sesIsleniyor, setSesIsleniyor] = useState(false);
  const [sesHata, setSesHata] = useState("");
  const [aiDoldurdu, setAiDoldurdu] = useState(false);

  // Müşteri autocomplete
  const [musteriler, setMusteriler] = useState([]);
  const [musteriOner, setMusteriOner] = useState([]);
  const [showMusteriOner, setShowMusteriOner] = useState(false);
  const [musteriSec, setMusteriSec] = useState(null);

  useEffect(() => {
    api.sablonlar().then(setSablonlar).catch(() => {});
    api.repairModeller().then(setModeller).catch(() => {});
    api.repairArizaOneri().then(setArizaGecmis).catch(() => {});
    api.customers("").then(setMusteriler).catch(() => {});
  }, []);

  function musteriAdiDegisti(v) {
    setForm(f => ({ ...f, customer_name: v }));
    setMusteriSec(null);
    if (v.length >= 2) {
      const q = v.toLowerCase();
      const found = musteriler.filter(m =>
        m.name.toLowerCase().includes(q) || (m.phone || "").includes(q)
      ).slice(0, 6);
      setMusteriOner(found);
      setShowMusteriOner(found.length > 0);
    } else {
      setShowMusteriOner(false);
    }
  }

  function musteriSecildi(m) {
    setForm(f => ({ ...f, customer_name: m.name, customer_phone: m.phone || "" }));
    setMusteriSec(m);
    setShowMusteriOner(false);
    // Kara liste kontrolü
    if (m.phone) {
      api.karaListe(m.phone).then(r => setKaraUyari(r || [])).catch(() => {});
    }
  }

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    if (k === "customer_phone") {
      clearTimeout(karaTimer.current);
      if (v.length >= 7) {
        karaTimer.current = setTimeout(() => {
          api.karaListe(v).then(r => setKaraUyari(r || [])).catch(() => {});
        }, 600);
      } else {
        setKaraUyari([]);
      }
    }
  }

  // Tek mikrofona basıp karışık anlatınca (isim, telefon, model, arıza vb.)
  // AI metni ayrıştırıp forma dolduruyor — kaydı KENDİSİ oluşturmuyor,
  // kullanıcı kontrol edip "Kaydet"e basmalı.
  function sesleDoldur() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSesHata("Tarayıcınız ses girişini desteklemiyor"); return; }
    const recognition = new SR();
    recognition.lang = "tr-TR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setSesHata("");
    setAiDoldurdu(false);
    setSesDinleniyor(true);
    recognition.onresult = async (e) => {
      const transcript = e.results[0][0].transcript;
      setSesDinleniyor(false);
      setSesIsleniyor(true);
      try {
        const r = await api.aiTamirAyikla(transcript);
        const a = r.alanlar || {};
        if (Object.keys(a).length === 0) {
          setSesHata(r.hata || "Alan bulunamadı, lütfen elle girin");
        } else {
          setForm(f => ({
            ...f,
            customer_name: a.customer_name != null ? String(a.customer_name) : f.customer_name,
            customer_phone: a.customer_phone != null ? String(a.customer_phone) : f.customer_phone,
            device_model: a.device_model != null ? String(a.device_model) : f.device_model,
            fault_desc: a.fault_desc != null ? String(a.fault_desc) : f.fault_desc,
            estimated_price: a.estimated_price != null ? String(a.estimated_price) : f.estimated_price,
            notes: a.notes != null ? String(a.notes) : f.notes,
          }));
          if (a.screen_lock_type === "pin" || a.screen_lock_type === "pattern") {
            setLockEnabled(true);
            setLockType(a.screen_lock_type);
            if (a.screen_lock_type === "pin" && a.screen_lock_value) {
              setLockPin(String(a.screen_lock_value).replace(/\D/g, ""));
            }
          }
          setAiDoldurdu(true);
        }
      } catch (err) {
        setSesHata(err.message || "AI hatası, lütfen elle girin");
      } finally {
        setSesIsleniyor(false);
      }
    };
    recognition.onerror = () => { setSesDinleniyor(false); setSesHata("Ses algılanamadı, tekrar deneyin"); };
    recognition.onend = () => setSesDinleniyor(false);
    recognition.start();
  }

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

  function dogrula() {
    if (!form.customer_name.trim()) {
      return { ref: musteriAdiRef, alan: "musteriAdi", mesaj: "Müşteri adını girmeden kayıt oluşturulamaz." };
    }
    if (!telefonTamMi(form.customer_phone)) {
      return { ref: telefonRef, alan: "telefon", mesaj: "Telefon numarasını eksiksiz girin (ör. 0555 123 45 67)." };
    }
    if (!form.device_model.trim()) {
      return { ref: modelRef, alan: "model", mesaj: "Cihaz modelini girmeden kayıt oluşturulamaz." };
    }
    if (!form.fault_desc.trim()) {
      return { ref: arizaRef, alan: "ariza", mesaj: "Arıza açıklamasını girmeden kayıt oluşturulamaz." };
    }
    if (lockEnabled) {
      const kilitDolu = lockType === "pin" ? lockPin.length >= 4 : lockPattern.length > 0;
      if (!kilitDolu) {
        return {
          ref: kilitRef, alan: "kilit",
          mesaj: `Ekran kilidi açık işaretlendi — ${lockType === "pin" ? "PIN kodunu" : "deseni"} girmeden kayıt oluşturulamaz.`,
        };
      }
    }
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    const hata = dogrula();
    if (hata) {
      setError(hata.mesaj);
      setHataAlan(hata.alan);
      hata.ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      hata.ref.current?.focus?.();
      setTimeout(() => setHataAlan(null), 1700);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const lockValue = lockEnabled
        ? (lockType === "pin" ? lockPin : lockPattern)
        : null;
      const res = await api.createRepair({
        ...form,
        customer_id: musteriSec?.id || null,
        estimated_price: form.estimated_price ? parseFloat(form.estimated_price) : null,
        screen_lock_type: lockEnabled ? lockType : null,
        screen_lock_value: lockValue || null,
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
          <button className="btn btn-ghost btn-sm" onClick={() => setSablonModal(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}><Star size={14} strokeWidth={2} /> Şablon</button>
        )}
      </div>

      {/* Şablon Modal */}
      {sablonModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSablonModal(false)}>
          <div className="card" style={{ width: "100%", maxWidth: 480, maxHeight: "70vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}><Star size={15} strokeWidth={2} /> Şablon Seç</div>
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

      {/* Tek mikrofonla karışık anlatıp AI'ın alanları ayırması */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={sesleDoldur} disabled={sesDinleniyor || sesIsleniyor}
          style={{
            width: 46, height: 46, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
            background: sesDinleniyor ? "var(--danger)" : "var(--accent)",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s",
          }}>
          {sesIsleniyor ? <Loader2 size={20} strokeWidth={2} className="spin" /> : <Mic size={20} strokeWidth={2} />}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={13} strokeWidth={2} /> Sesle Doldur
          </div>
          <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 2 }}>
            {sesDinleniyor ? "Dinliyorum, konuşun..." : sesIsleniyor ? "AI alanları dolduruyor..." :
              "Basın, müşteri adı / telefon / cihaz / arızayı karışık anlatın"}
          </div>
        </div>
      </div>
      {sesHata && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--danger)", fontSize: 12.5, margin: "-6px 0 12px", padding: "0 4px" }}>
          <TriangleAlert size={13} strokeWidth={2} /> {sesHata}
        </div>
      )}
      {aiDoldurdu && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600,
          color: "var(--orange)", background: "rgba(246,162,74,0.10)", borderRadius: 10,
          padding: "9px 12px", margin: "-6px 0 12px",
        }}>
          <TriangleAlert size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
          AI alanları doldurdu — lütfen kontrol edip "Kaydet"e basın, otomatik kaydetmedi.
        </div>
      )}

      <form onSubmit={submit}>
        <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Lock size={13} strokeWidth={2} /> Ekran Kilidi
          {lockEnabled && <span style={{ color: "var(--danger)" }}>*</span>}
        </div>
        <div ref={kilitRef} tabIndex={-1} className={"card" + (hataAlan === "kilit" ? " alan-hata" : "")} style={{ marginBottom: 8 }}>
          {/* Açma/kapama */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: lockEnabled ? 16 : 0 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Ekran kilidi var mı?</div>
              <div style={{ fontSize: 13, color: "var(--hint)" }}>PIN, şifre veya desen</div>
            </div>
            <div
              onClick={() => setLockEnabled(v => !v)}
              style={{
                width: 48, height: 28, borderRadius: 14, cursor: "pointer", transition: "background 0.2s",
                background: lockEnabled ? "var(--accent)" : "var(--border)",
                position: "relative",
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: lockEnabled ? 23 : 3,
                width: 22, height: 22, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }} />
            </div>
          </div>

          {lockEnabled && (
            <div>
              {/* Tip seçimi */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {[{ k: "pin", l: "PIN / Şifre", Icon: Hash }, { k: "pattern", l: "Desen", Icon: Shapes }].map(t => (
                  <button key={t.k} type="button"
                    onClick={() => { setLockType(t.k); setLockPin(""); setLockPattern(""); }}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 12, border: "1.5px solid",
                      borderColor: lockType === t.k ? "var(--accent)" : "var(--border)",
                      background: lockType === t.k ? "rgba(var(--accent-rgb,99,102,241),0.12)" : "var(--bg2)",
                      color: lockType === t.k ? "var(--accent)" : "var(--text)",
                      fontWeight: 700, fontSize: 14, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}>
                    <t.Icon size={14} strokeWidth={2} /> {t.l}
                  </button>
                ))}
              </div>

              {lockType === "pin" ? (
                <PinPad value={lockPin} onChange={setLockPin} />
              ) : (
                <div>
                  <div style={{ textAlign: "center", color: "var(--hint)", fontSize: 13, marginBottom: 12 }}>
                    Müşterinin deseni ile aynı şekilde çiz
                  </div>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <PatternLock value={lockPattern} onChange={setLockPattern} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="section-title">Müşteri</div>
        <div className="card">
          <div className="form-group" style={{ position: "relative" }}>
            <label className="form-label">Müşteri Adı *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input ref={musteriAdiRef} className={"form-input" + (hataAlan === "musteriAdi" ? " alan-hata" : "")} style={{ flex: 1 }} placeholder="Ad Soyad"
                value={form.customer_name}
                onChange={e => musteriAdiDegisti(e.target.value)}
                onBlur={() => setTimeout(() => setShowMusteriOner(false), 150)}
                onFocus={() => form.customer_name.length >= 2 && setShowMusteriOner(musteriOner.length > 0)}
                autoComplete="off" />
              <VoiceInput onResult={v => musteriAdiDegisti(v)} />
            </div>
            {showMusteriOner && (
              <div className="ac-dropdown" style={{ zIndex: 99, maxHeight: 200, overflowY: "auto" }}>
                {musteriOner.map(m => (
                  <div key={m.id} onMouseDown={() => musteriSecildi(m)}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: "var(--hint)" }}>{m.phone || "Telefon yok"}</div>
                  </div>
                ))}
              </div>
            )}
            {musteriSec && (
              <div style={{ fontSize: 12, color: "var(--success)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}><CheckCircle2 size={12} strokeWidth={2} /> Kayıtlı müşteri seçildi</div>
            )}
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Telefon *</label>
            <input ref={telefonRef} className={"form-input" + (hataAlan === "telefon" ? " alan-hata" : "")} placeholder="05xx xxx xx xx" type="tel"
              value={form.customer_phone}
              onChange={e => set("customer_phone", e.target.value)} />
            {karaUyari.length > 0 && (
              <div style={{ background: "rgba(239,68,68,0.12)", borderRadius: 8, padding: "8px 12px", marginTop: 8, borderLeft: "3px solid #ef4444" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}><Ban size={14} strokeWidth={2} /> Kara Listede!</div>
                {karaUyari.map(k => (
                  <div key={k.id} style={{ fontSize: 12, color: "var(--text)", marginTop: 2 }}>
                    {k.ad}{k.sebep ? ` — ${k.sebep}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="section-title">Cihaz</div>
        <div className="card">
          <div className="form-group" style={{ position: "relative" }}>
            <label className="form-label">Cihaz Modeli *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input ref={modelRef} className={"form-input" + (hataAlan === "model" ? " alan-hata" : "")} placeholder="iPhone 14, Samsung A54..."
                  value={form.device_model}
                  onChange={e => modelDegisti(e.target.value)}
                  onFocus={() => setModelFocus(true)}
                  onBlur={() => setTimeout(() => setModelFocus(false), 150)}
                  autoComplete="off" />
                {modelFocus && modelOneri.length > 0 && (
                  <div className="ac-dropdown" style={{ zIndex: 50 }}>
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
              <input ref={arizaRef} className={"form-input" + (hataAlan === "ariza" ? " alan-hata" : "")} style={{ flex: 1 }} placeholder="Ekran kırık, batarya..."
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
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            {saving ? "Kaydediliyor..." : (<><CheckCircle2 size={15} strokeWidth={2} /> Tamir Kaydı Oluştur</>)}
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
                  alert("Şablon kaydedildi!");
                } catch {}
              }}
              title="Şablon olarak kaydet"
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Star size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
