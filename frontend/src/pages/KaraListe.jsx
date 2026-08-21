import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Ban, CircleX, User, Phone, Pencil, X, Calendar, FileText } from "lucide-react";

export const KATEGORI_META = {
  odeme_yapmadi: { label: "Ödeme Yapmadı", renk: "var(--orange)" },
  kotu_niyet: { label: "Kötü Niyet / Dolandırıcılık", renk: "var(--red)" },
  sahte_cihaz: { label: "Sahte / Çalıntı Cihaz", renk: "var(--purple)" },
  hakaret_tehdit: { label: "Hakaret / Tehdit", renk: "var(--danger)" },
  diger: { label: "Diğer", renk: "var(--hint)" },
};

const BOS_FORM = { ad: "", telefon: "", imei: "", sebep: "", kategori: "", notlar: "", customer_id: null };

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR");
}

export default function KaraListe() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(BOS_FORM);
  const [musteriler, setMusteriler] = useState([]);
  const [musOneriler, setMusOneriler] = useState([]);
  const [showMusOner, setShowMusOner] = useState(false);
  const [detay, setDetay] = useState(null);

  useEffect(() => {
    load();
    api.customers("").then(setMusteriler).catch(() => {});
  }, []);

  async function load(query = "") {
    try { setList(await api.karaListe(query)); } finally { setLoading(false); }
  }

  function search(v) { setQ(v); load(v); }

  function handleAdChange(val) {
    setForm(f => ({ ...f, ad: val, customer_id: null }));
    if (val.length >= 2) {
      const found = musteriler.filter(m =>
        m.name.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setMusOneriler(found); setShowMusOner(found.length > 0);
    } else { setShowMusOner(false); }
  }

  function secMusteri(m) {
    setForm(f => ({ ...f, ad: m.name, telefon: m.phone || f.telefon, customer_id: m.id }));
    setShowMusOner(false);
  }

  function yeniEkleAc() {
    setForm(BOS_FORM); setEditId(null); setErr(""); setShowForm(true); setDetay(null);
  }

  function duzenleAc(k) {
    setForm({
      ad: k.ad || "", telefon: k.telefon || "", imei: k.imei || "",
      sebep: k.sebep || "", kategori: k.kategori || "", notlar: k.notlar || "",
      customer_id: k.customer_id || null,
    });
    setEditId(k.id); setErr(""); setShowForm(true); setDetay(null);
  }

  async function submit(e) {
    e.preventDefault(); setErr("");
    try {
      if (editId) await api.updateKara(editId, form);
      else await api.createKara(form);
      setShowForm(false);
      setForm(BOS_FORM);
      setEditId(null);
      setShowMusOner(false);
      load(q);
    } catch (e) { setErr(e.message); }
  }

  async function sil(id) {
    if (!confirm("Kara listeden çıkarmak istiyor musun?")) return;
    await api.deleteKara(id);
    setDetay(null);
    load(q);
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Ban size={18} strokeWidth={2} /> Kara Liste</h1>
        <button className="btn btn-danger btn-sm" onClick={yeniEkleAc}>+ Ekle</button>
      </div>

      <input className="form-input" style={{ marginBottom: 12 }}
        placeholder="Ad, telefon veya IMEI ile ara..."
        value={q} onChange={e => search(e.target.value)} />

      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}

            {/* Ad Soyad — müşteri autocomplete */}
            <div className="form-group" style={{ position: "relative" }}>
              <label className="form-label">Ad Soyad</label>
              <input className="form-input" value={form.ad}
                onChange={e => handleAdChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowMusOner(false), 150)}
                placeholder="İsim yaz, kayıtlı müşterilerden önerir"
                autoComplete="off" />
              {form.customer_id && (
                <div style={{ fontSize: 11, color: "var(--success)", marginTop: 4 }}>✓ Kayıtlı müşteriye bağlandı</div>
              )}
              {showMusOner && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden" }}>
                  {musOneriler.map(m => (
                    <div key={m.id} onMouseDown={() => secMusteri(m)}
                      style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14,
                        borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><User size={13} strokeWidth={2} /> {m.name}</span>
                      {m.phone && <span style={{ fontSize: 12, color: "var(--hint)" }}>{m.phone}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Telefon</label>
              <input className="form-input" value={form.telefon}
                onChange={e => setForm({ ...form, telefon: e.target.value, customer_id: null })} placeholder="0555..." />
            </div>
            <div className="form-group">
              <label className="form-label">IMEI</label>
              <input className="form-input" value={form.imei}
                onChange={e => setForm({ ...form, imei: e.target.value })} placeholder="Cihaz IMEI" />
            </div>
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="form-select" value={form.kategori}
                onChange={e => setForm({ ...form, kategori: e.target.value })}>
                <option value="">Seçiniz (opsiyonel)</option>
                {Object.entries(KATEGORI_META).map(([k, m]) => (
                  <option key={k} value={k}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Sebep *</label>
              <input className="form-input" required value={form.sebep}
                onChange={e => setForm({ ...form, sebep: e.target.value })} placeholder="Çalıntı cihaz, ödeme yapmadı..." />
            </div>
            <div className="form-group">
              <label className="form-label">Not</label>
              <input className="form-input" value={form.notlar}
                onChange={e => setForm({ ...form, notlar: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-danger">{editId ? "Kaydet" : "Listeye Ekle"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setEditId(null); }}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {list.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Kara listede kayıt yok</div>
      ) : list.map(k => {
        const kat = KATEGORI_META[k.kategori];
        return (
          <div key={k.id} className="card" style={{ borderLeft: "3px solid var(--danger)", cursor: "pointer" }}
            onClick={() => setDetay(k)}>
            <div className="card-row">
              <div style={{ minWidth: 0 }}>
                {k.ad && <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Ban size={13} strokeWidth={2} /> {k.ad}</div>}
                {k.telefon && <div style={{ fontSize: 13, color: "var(--hint)", display: "flex", alignItems: "center", gap: 6 }}><Phone size={11} strokeWidth={2} /> {k.telefon}</div>}
                {k.imei && <div style={{ fontSize: 13, color: "var(--hint)" }}>IMEI: {k.imei}</div>}
                <div style={{ fontSize: 13, color: "var(--danger)", marginTop: 4 }}>{k.sebep}</div>
                {k.notlar && <div style={{ fontSize: 12, color: "var(--hint)" }}>{k.notlar}</div>}
              </div>
              {kat && (
                <span className="badge" style={{ background: `${kat.renk}22`, color: kat.renk, flexShrink: 0 }}>{kat.label}</span>
              )}
            </div>
          </div>
        );
      })}

      {detay && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setDetay(null)}>
          <div className="card" style={{ width: "100%", maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8, color: "var(--danger)" }}>
                <Ban size={16} strokeWidth={2} /> {detay.ad || "İsimsiz kayıt"}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetay(null)}><X size={16} strokeWidth={2} /></button>
            </div>
            {detay.telefon && (
              <div className="card-row" style={{ padding: "6px 0" }}>
                <span style={{ color: "var(--hint)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Phone size={12} strokeWidth={2} /> Telefon</span>
                <span style={{ fontWeight: 500 }}>{detay.telefon}</span>
              </div>
            )}
            {detay.imei && (
              <div className="card-row" style={{ padding: "6px 0" }}>
                <span style={{ color: "var(--hint)", fontSize: 13 }}>IMEI</span>
                <span style={{ fontWeight: 500 }}>{detay.imei}</span>
              </div>
            )}
            {KATEGORI_META[detay.kategori] && (
              <div className="card-row" style={{ padding: "6px 0" }}>
                <span style={{ color: "var(--hint)", fontSize: 13 }}>Kategori</span>
                <span style={{ fontWeight: 600, color: KATEGORI_META[detay.kategori].renk }}>{KATEGORI_META[detay.kategori].label}</span>
              </div>
            )}
            <div className="card-row" style={{ padding: "6px 0", alignItems: "flex-start" }}>
              <span style={{ color: "var(--hint)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><FileText size={12} strokeWidth={2} /> Sebep</span>
              <span style={{ fontWeight: 500, textAlign: "right" }}>{detay.sebep}</span>
            </div>
            {detay.notlar && (
              <div className="card-row" style={{ padding: "6px 0", alignItems: "flex-start" }}>
                <span style={{ color: "var(--hint)", fontSize: 13 }}>Not</span>
                <span style={{ fontWeight: 500, textAlign: "right" }}>{detay.notlar}</span>
              </div>
            )}
            {detay.musteri_adi_baglantili && (
              <div className="card-row" style={{ padding: "6px 0" }}>
                <span style={{ color: "var(--hint)", fontSize: 13 }}>Bağlı Müşteri</span>
                <button className="btn btn-ghost btn-sm" style={{ padding: "2px 8px" }}
                  onClick={() => navigate(`/customers/${detay.customer_id}`)}>{detay.musteri_adi_baglantili} →</button>
              </div>
            )}
            <div className="card-row" style={{ padding: "6px 0" }}>
              <span style={{ color: "var(--hint)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Calendar size={12} strokeWidth={2} /> Eklendi</span>
              <span style={{ fontWeight: 500 }}>{fmt(detay.created_at)}{detay.ekleyen_adi ? ` · ${detay.ekleyen_adi}` : ""}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                onClick={() => duzenleAc(detay)}>
                <Pencil size={13} strokeWidth={2} /> Düzenle
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => sil(detay.id)}>Kara Listeden Çıkar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
