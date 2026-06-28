import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

function fmt(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function GeriBildirim({ user }) {
  const navigate = useNavigate();
  const isPatron = user?.role === "patron";
  const [tab, setTab] = useState("sikayet");
  const [list, setList] = useState([]);
  const [skor, setSkor] = useState([]);
  const [kullanicilar, setKullanicilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bekleyen, setBekleyen] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ hedef_id: "", tur: "sikayet", mesaj: "" });
  const [err, setErr] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    load();
    return () => { api.geriBildirimGoruldu().catch(() => {}); };
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [l, s, b, u] = await Promise.all([
        api.geriBildirimList(),
        api.geriBildirimSkor(),
        api.geriBildirimBekleyen(),
        api.users(),
      ]);
      setList(l);
      setSkor(s);
      setBekleyen(b.bekleyen || 0);
      setKullanicilar(u.filter(u2 => u2.tg_id !== user?.tg_id));
    } finally {
      setLoading(false);
    }
  }

  const activeList = list.filter(i => i.tur === tab);

  async function submit(e) {
    e.preventDefault(); setErr("");
    if (!form.hedef_id) { setErr("Çalışan seçilmedi"); return; }
    if (!form.mesaj.trim()) { setErr("Mesaj yaz"); return; }
    try {
      await api.createGeriBildirim(form);
      setShowForm(false);
      setSubmitted(true);
      setForm({ hedef_id: "", tur: "sikayet", mesaj: "" });
      load();
      setTimeout(() => setSubmitted(false), 3000);
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="page" style={{ paddingBottom: 90 }}>
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Şikayet / Övgü</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(v => !v); setErr(""); }}>+ Yeni</button>
      </div>

      {/* Yeni şikayet/övgü bildirimi */}
      {!isPatron && bekleyen > 0 && (
        <div style={{
          background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--danger)" }}>
            {bekleyen} yeni {bekleyen === 1 ? "bildirim" : "bildirim"} var
          </span>
        </div>
      )}

      {submitted && (
        <div style={{
          background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.35)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 12, fontWeight: 600, fontSize: 14, color: "var(--success)",
        }}>
          ✅ Gönderildi (anonim)
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Yeni Bildirim (Anonim)</div>
          <form onSubmit={submit}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8, fontWeight: 600 }}>❌ {err}</div>}

            <div className="form-group">
              <label className="form-label">Türü</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ v: "sikayet", l: "😤 Şikayet" }, { v: "ovgu", l: "⭐ Övgü" }].map(t => (
                  <button key={t.v} type="button"
                    onClick={() => setForm(f => ({ ...f, tur: t.v }))}
                    style={{
                      flex: 1, padding: "9px 0", borderRadius: 10, border: "1.5px solid", cursor: "pointer",
                      fontWeight: 700, fontSize: 13,
                      borderColor: form.tur === t.v ? (t.v === "sikayet" ? "var(--danger)" : "var(--success)") : "var(--border)",
                      background: form.tur === t.v ? (t.v === "sikayet" ? "rgba(239,68,68,0.10)" : "rgba(34,197,94,0.10)") : "var(--bg2)",
                      color: form.tur === t.v ? (t.v === "sikayet" ? "var(--danger)" : "var(--success)") : "var(--hint)",
                    }}>{t.l}</button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Hakkında</label>
              <select className="form-select" required value={form.hedef_id}
                onChange={e => setForm(f => ({ ...f, hedef_id: parseInt(e.target.value) }))}>
                <option value="">Çalışan seç...</option>
                {kullanicilar.map(u => (
                  <option key={u.id} value={u.id}>{u.first_name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Mesaj</label>
              <textarea className="form-input" required rows={3}
                value={form.mesaj}
                onChange={e => setForm(f => ({ ...f, mesaj: e.target.value }))}
                placeholder={form.tur === "sikayet" ? "Ne oldu?" : "Ne yaptı?"}
                style={{ resize: "vertical", minHeight: 72 }} />
            </div>

            <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 10 }}>
              🔒 Kim gönderdiğin gizli kalır
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Gönder</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {/* Skor kartı */}
      {skor.length > 0 && (
        <>
          <div className="section-title">Çalışan Skoru</div>
          <div className="card" style={{ marginBottom: 14 }}>
            {skor.map((s, i) => (
              <div key={s.id} className="card-row" style={{ padding: "8px 0", borderBottom: i < skor.length - 1 ? "1px solid var(--bg2)" : "none" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{s.first_name}</span>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>
                    ⭐ {s.ovgu_sayisi || 0}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--danger)", fontWeight: 600 }}>
                    😤 {s.sikayet_sayisi || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sekme */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${tab === "sikayet" ? "active" : ""}`}
          onClick={() => setTab("sikayet")}>
          😤 Şikayetler ({list.filter(i => i.tur === "sikayet").length})
        </button>
        <button className={`tab ${tab === "ovgu" ? "active" : ""}`}
          onClick={() => setTab("ovgu")}>
          ⭐ Övgüler ({list.filter(i => i.tur === "ovgu").length})
        </button>
      </div>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : activeList.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">{tab === "sikayet" ? "😤" : "⭐"}</div>
          {tab === "sikayet" ? "Şikayet yok" : "Övgü yok"}
        </div>
      ) : (
        activeList.map(item => (
          <div key={item.id} className="card" style={{
            marginBottom: 8,
            borderLeft: `3px solid ${item.goruldu === 0
              ? (tab === "sikayet" ? "var(--danger)" : "var(--success)")
              : "var(--border)"}`,
          }}>
            <div className="card-row" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                {/* Patron: kim → kime görür */}
                {isPatron ? (
                  <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>
                      {item.gonderen_adi || "?"} → {item.hedef_adi || "?"}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>Anonim</span> → Siz
                  </div>
                )}
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>{item.mesaj}</div>
                <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 6 }}>{fmt(item.created_at)}</div>
              </div>
              {item.goruldu === 0 && (
                <div style={{
                  flexShrink: 0, width: 8, height: 8, borderRadius: "50%",
                  background: tab === "sikayet" ? "var(--danger)" : "var(--success)",
                  marginTop: 4,
                }} />
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
