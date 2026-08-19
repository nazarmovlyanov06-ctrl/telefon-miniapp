import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { CircleX, Trash2, Search } from "lucide-react";
import OdemeBolustur, { varsayilanOdemeSatirlari } from "../components/OdemeBolustur";

const DEFAULT_KATEGORILER = ["Kira", "Elektrik", "Su", "İnternet", "Vergi", "Sigorta", "Malzeme", "Diğer"];

const PERIYOT = [
  { key: "bugun", label: "Bugün" },
  { key: "hafta", label: "Bu Hafta" },
  { key: "ay", label: "Bu Ay" },
  { key: "ozel", label: "Özel" },
];

function bugunISO() { return new Date().toISOString().slice(0, 10); }
function gunOnce(gun) {
  const d = new Date();
  d.setDate(d.getDate() - gun);
  return d.toISOString().slice(0, 10);
}

export default function Gider({ user }) {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [kategoriler, setKategoriler] = useState(DEFAULT_KATEGORILER);
  const [ozelKategoriMod, setOzelKategoriMod] = useState(false);
  const [form, setForm] = useState({ kategori: "Kira", tutar: "", aciklama: "", tarih: today(), odemeler: null, taksit_sayi: "1", alacakli_adi: "" });
  const [periyot, setPeriyot] = useState("ay");
  const [ozelBaslangic, setOzelBaslangic] = useState(() => gunOnce(7));
  const [ozelBitis, setOzelBitis] = useState(bugunISO);
  const [arama, setArama] = useState("");

  // Dükkanın ortak kategori listesi — önceden cihaza özel localStorage'daydı,
  // bir çalışanın eklediği kategori başka çalışanda hiç görünmüyordu.
  async function kategorileriYukle() {
    try {
      const r = await api.giderKategorileri();
      const ozel = (r.kategoriler || []).filter(k => !DEFAULT_KATEGORILER.includes(k));
      setKategoriler([...DEFAULT_KATEGORILER, ...ozel]);
    } catch { /* varsayılan listeyle devam */ }
  }

  async function kategoriEkle(ad) {
    const k = ad.trim();
    if (!k || kategoriler.includes(k)) return;
    setKategoriler(kl => [...kl, k]);
    try { await api.giderKategoriEkle(k); } catch { /* zaten varsa sorun değil */ }
  }

  useEffect(() => { kategorileriYukle(); }, []);

  useEffect(() => {
    if (periyot === "ozel" && (!ozelBaslangic || !ozelBitis)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periyot, ozelBaslangic, ozelBitis]);

  // Arama yazarken her tuşta değil, 300ms bekleyip sakinleşince çek.
  const ilkYuklemeRef = useRef(true);
  useEffect(() => {
    if (ilkYuklemeRef.current) { ilkYuklemeRef.current = false; return; }
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arama]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.giderList({ periyot, baslangic: ozelBaslangic, bitis: ozelBitis, q: arama });
      setList(res.giderler || res || []);
    } finally { setLoading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const tutar = parseFloat(form.tutar) || 0;
    const odemeler = (form.odemeler || varsayilanOdemeSatirlari(tutar)).filter(o => parseFloat(o.tutar) > 0);
    const alinan = odemeler.reduce((s, o) => s + (parseFloat(o.tutar) || 0), 0);
    if (tutar - alinan > 0.009 && !form.alacakli_adi.trim()) {
      setErr("Kalan tutar borç yazılacaksa kime borçlanıldığı girilmeli");
      return;
    }
    if (!form.kategori.trim()) {
      setErr("Kategori girilmeli");
      return;
    }
    try {
      await api.createGider({
        ...form, tutar, odemeler, taksit_sayi: parseInt(form.taksit_sayi) || 1,
      });
      kategoriEkle(form.kategori);
      setShowForm(false);
      setOzelKategoriMod(false);
      setForm({ kategori: "Kira", tutar: "", aciklama: "", tarih: today(), odemeler: null, taksit_sayi: "1", alacakli_adi: "" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function sil(id) {
    if (!confirm("Bu gideri silmek istiyorsun?")) return;
    await api.deleteGider(id);
    load();
  }

  const toplam = Array.isArray(list) ? list.reduce((s, g) => s + (g.tutar || 0), 0) : 0;
  const formTutar = parseFloat(form.tutar) || 0;
  const formAlinan = (form.odemeler || varsayilanOdemeSatirlari(formTutar)).reduce((s, o) => s + (parseFloat(o.tutar) || 0), 0);
  const kalanBorc = formTutar - formAlinan;

  const periyotLabel = {
    bugun: "bugün", hafta: "bu hafta", ay: "bu ay",
    ozel: `${ozelBaslangic?.split("-").reverse().join(".")} – ${ozelBitis?.split("-").reverse().join(".")}`,
  };

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Gider Takibi</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Ekle</button>
      </div>

      {/* Periyot seçici */}
      <div style={{ display: "flex", background: "var(--bg2)", borderRadius: 12, padding: 3, gap: 3, marginBottom: 10 }}>
        {PERIYOT.map(p => (
          <button key={p.key} onClick={() => setPeriyot(p.key)}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 13, transition: "all 0.15s",
              background: periyot === p.key ? "var(--bg)" : "transparent",
              color: periyot === p.key ? "var(--text)" : "var(--hint)",
              boxShadow: periyot === p.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>{p.label}</button>
        ))}
      </div>

      {periyot === "ozel" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <input type="date" className="form-input" style={{ flex: 1 }}
            value={ozelBaslangic} max={ozelBitis}
            onChange={e => setOzelBaslangic(e.target.value)} />
          <span style={{ color: "var(--hint)", fontSize: 13 }}>—</span>
          <input type="date" className="form-input" style={{ flex: 1 }}
            value={ozelBitis} min={ozelBaslangic} max={bugunISO()}
            onChange={e => setOzelBitis(e.target.value)} />
        </div>
      )}

      <div className="form-group" style={{ position: "relative", marginBottom: 10 }}>
        <input className="form-input" style={{ paddingLeft: 36 }} value={arama}
          onChange={e => setArama(e.target.value)} placeholder="Kategori veya açıklamada ara..." />
        <Search size={15} strokeWidth={2} stroke="var(--hint)"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-row">
          <span style={{ color: "var(--hint)" }}>Toplam Gider ({periyotLabel[periyot]})</span>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--danger)" }}>{toplam.toLocaleString("tr-TR")} ₺</span>
        </div>
      </div>

      {loading && <div className="loading">Yükleniyor...</div>}

      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}
            <div className="form-group">
              <label className="form-label">Kategori</label>
              {ozelKategoriMod ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="form-input" autoFocus placeholder="Yeni kategori adı"
                    value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })} />
                  <button type="button" className="btn btn-ghost btn-sm"
                    onClick={() => { setOzelKategoriMod(false); setForm(f => ({ ...f, kategori: kategoriler[0] })); }}>
                    Vazgeç
                  </button>
                </div>
              ) : (
                <select className="form-select" value={form.kategori}
                  onChange={e => {
                    if (e.target.value === "__yeni__") { setOzelKategoriMod(true); setForm(f => ({ ...f, kategori: "" })); }
                    else setForm({ ...form, kategori: e.target.value });
                  }}>
                  {kategoriler.map(k => <option key={k}>{k}</option>)}
                  <option value="__yeni__">+ Yeni Kategori Ekle</option>
                </select>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Tutar (₺) *</label>
              <input className="form-input" type="number" required value={form.tutar} onChange={e => setForm({ ...form, tutar: e.target.value })} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Açıklama</label>
              <input className="form-input" value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Tarih</label>
              <input className="form-input" type="date" value={form.tarih} onChange={e => setForm({ ...form, tarih: e.target.value })} />
            </div>
            <OdemeBolustur toplam={parseFloat(form.tutar) || 0} yon="gider"
              value={form.odemeler} onChange={v => setForm(f => ({ ...f, odemeler: v }))}
              taksitSayi={form.taksit_sayi} onTaksitSayiChange={v => setForm(f => ({ ...f, taksit_sayi: v }))} />
            {kalanBorc > 0.009 && (
              <div className="form-group">
                <label className="form-label">Kime Borçlanıldı *</label>
                <input className="form-input" value={form.alacakli_adi}
                  onChange={e => setForm({ ...form, alacakli_adi: e.target.value })}
                  placeholder="Ör: Ev sahibi, Elektrik şirketi..." />
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {!loading && list.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>
          {arama ? "Aramayla eşleşen gider kaydı yok" : "Bu dönemde gider kaydı yok"}
        </div>
      ) : list.map(g => (
        <div key={g.id} className="card">
          <div className="card-row">
            <div>
              <div style={{ fontWeight: 600 }}>{g.kategori}</div>
              {g.aciklama && <div style={{ fontSize: 13, color: "var(--hint)" }}>{g.aciklama}</div>}
              <div style={{ fontSize: 12, color: "var(--hint)" }}>{g.tarih}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 700, color: "var(--danger)" }}>{(g.tutar || 0).toLocaleString("tr-TR")} ₺</span>
              {user?.rol === "patron" && (
                <button className="btn btn-ghost btn-sm" onClick={() => sil(g.id)} style={{ padding: "4px 8px", display: "flex" }}><Trash2 size={13} strokeWidth={2} /></button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
