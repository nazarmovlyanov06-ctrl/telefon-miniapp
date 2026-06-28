import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const YILDIZ = [1, 2, 3, 4, 5];

function fmt(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function GeriBildirim() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("sikayet");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tur: "sikayet", musteri_adi: "", telefon: "", puan: 5, mesaj: "" });
  const [err, setErr] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setList(await api.geriBildirimList()); }
    finally { setLoading(false); }
  }

  const sikayetler = list.filter(i => i.tur === "sikayet");
  const ovguler = list.filter(i => i.tur === "ovgu");
  const activeList = tab === "sikayet" ? sikayetler : ovguler;
  const bekleyen = activeList.filter(i => i.durum === "bekliyor").length;

  function openForm(tur) {
    setForm({ tur, musteri_adi: "", telefon: "", puan: 5, mesaj: "" });
    setShowForm(true);
    setErr("");
  }

  async function submit(e) {
    e.preventDefault(); setErr("");
    if (!form.mesaj.trim()) { setErr("Mesaj zorunlu"); return; }
    try {
      await api.createGeriBildirim({
        ...form,
        puan: form.tur === "ovgu" ? form.puan : null,
      });
      setShowForm(false);
      load();
    } catch (e) { setErr(e.message); }
  }

  async function incele(id) {
    await api.geriBildirimDurum(id, "incelendi");
    load();
  }

  async function sil(id) {
    if (!window.confirm("Silinsin mi?")) return;
    await api.deleteGeriBildirim(id);
    load();
  }

  return (
    <div className="page" style={{ paddingBottom: 90 }}>
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Şikayet / Övgü</h1>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => openForm("ovgu")}>+ Övgü</button>
          <button className="btn btn-primary btn-sm" onClick={() => openForm("sikayet")}>+ Şikayet</button>
        </div>
      </div>

      {/* Sekme */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${tab === "sikayet" ? "active" : ""}`}
          onClick={() => { setTab("sikayet"); setShowForm(false); }}>
          😤 Şikayetler {sikayetler.length > 0 && `(${sikayetler.length})`}
        </button>
        <button className={`tab ${tab === "ovgu" ? "active" : ""}`}
          onClick={() => { setTab("ovgu"); setShowForm(false); }}>
          ⭐ Övgüler {ovguler.length > 0 && `(${ovguler.length})`}
        </button>
      </div>

      {/* Özet */}
      {!loading && activeList.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-row">
            <span style={{ color: "var(--hint)", fontSize: 13 }}>
              {tab === "sikayet" ? "Toplam şikayet" : "Toplam övgü"}
            </span>
            <span style={{ fontWeight: 700 }}>{activeList.length}</span>
          </div>
          {bekleyen > 0 && (
            <div className="card-row" style={{ marginTop: 4 }}>
              <span style={{ color: "var(--hint)", fontSize: 13 }}>İncelenmemiş</span>
              <span style={{ fontWeight: 700, color: tab === "sikayet" ? "var(--danger)" : "var(--warn, #f59e0b)" }}>
                {bekleyen} adet
              </span>
            </div>
          )}
          {tab === "ovgu" && ovguler.some(i => i.puan) && (
            <div className="card-row" style={{ marginTop: 4 }}>
              <span style={{ color: "var(--hint)", fontSize: 13 }}>Ort. Puan</span>
              <span style={{ fontWeight: 700, color: "var(--success)" }}>
                ⭐ {(ovguler.filter(i => i.puan).reduce((s, i) => s + i.puan, 0) / ovguler.filter(i => i.puan).length).toFixed(1)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Yeni Kayıt Formu */}
      {showForm && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
            {form.tur === "sikayet" ? "😤 Yeni Şikayet" : "⭐ Yeni Övgü"}
          </div>
          <form onSubmit={submit}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8, fontWeight: 600 }}>❌ {err}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Müşteri Adı</label>
                <input className="form-input" value={form.musteri_adi}
                  onChange={e => setForm(f => ({ ...f, musteri_adi: e.target.value }))}
                  placeholder="(opsiyonel)" />
              </div>
              <div className="form-group">
                <label className="form-label">Telefon</label>
                <input className="form-input" value={form.telefon}
                  onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))}
                  placeholder="(opsiyonel)" />
              </div>
            </div>

            {form.tur === "ovgu" && (
              <div className="form-group">
                <label className="form-label">Puan</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {YILDIZ.map(y => (
                    <button key={y} type="button"
                      onClick={() => setForm(f => ({ ...f, puan: y }))}
                      style={{
                        fontSize: 22, background: "none", border: "none", cursor: "pointer",
                        opacity: form.puan >= y ? 1 : 0.25, transition: "opacity 0.1s",
                      }}>⭐</button>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Mesaj *</label>
              <textarea className="form-input" required rows={3}
                value={form.mesaj}
                onChange={e => setForm(f => ({ ...f, mesaj: e.target.value }))}
                placeholder={form.tur === "sikayet" ? "Şikayet detayı..." : "Müşteri ne dedi?"}
                style={{ resize: "vertical", minHeight: 72 }} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : activeList.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">{tab === "sikayet" ? "😤" : "⭐"}</div>
          {tab === "sikayet" ? "Şikayet kaydı yok" : "Övgü kaydı yok"}
        </div>
      ) : (
        activeList.map(item => (
          <div key={item.id} className="card" style={{
            marginBottom: 8,
            borderLeft: `3px solid ${item.durum === "bekliyor"
              ? (tab === "sikayet" ? "var(--danger)" : "var(--warn, #f59e0b)")
              : "var(--border)"}`,
            opacity: item.durum === "incelendi" ? 0.8 : 1,
          }}>
            <div className="card-row" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  {item.musteri_adi && (
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item.musteri_adi}</span>
                  )}
                  {item.puan && (
                    <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 700 }}>
                      {"⭐".repeat(item.puan)}
                    </span>
                  )}
                  {item.telefon && (
                    <span style={{ fontSize: 12, color: "var(--hint)" }}>📞 {item.telefon}</span>
                  )}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 4 }}>{item.mesaj}</div>
                <div style={{ fontSize: 11, color: "var(--hint)" }}>
                  {fmt(item.created_at)}
                  {item.device_model && ` · ${item.device_model}`}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{
                  display: "inline-block", padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: item.durum === "bekliyor"
                    ? (tab === "sikayet" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)")
                    : "var(--bg2)",
                  color: item.durum === "bekliyor"
                    ? (tab === "sikayet" ? "var(--danger)" : "var(--warn, #f59e0b)")
                    : "var(--hint)",
                }}>
                  {item.durum === "bekliyor" ? "⏳ Bekliyor" : "✅ İncelendi"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {item.durum === "bekliyor" && (
                <button className="btn btn-ghost btn-sm" onClick={() => incele(item.id)}>✅ İncelendi</button>
              )}
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                onClick={() => sil(item.id)}>🗑️ Sil</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
