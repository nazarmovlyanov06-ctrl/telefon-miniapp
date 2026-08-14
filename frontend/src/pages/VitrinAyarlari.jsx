import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, fotoUrl } from "../api";
import { Store, CircleX, ExternalLink, Image, ImagePlus } from "lucide-react";

export default function VitrinAyarlari() {
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gorselYukleniyor, setGorselYukleniyor] = useState(null);
  const logoInputRef = useRef(null);
  const kapakInputRef = useRef(null);

  useEffect(() => { api.vitrinAyarlarim().then(setForm).catch(e => setErr(e.message)); }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setSaved(false); }

  async function kaydet(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api.vitrinAyarlariGuncelle(form);
      setSaved(true);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function gorselYukle(tip, file) {
    setErr(""); setGorselYukleniyor(tip);
    try {
      const r = tip === "logo" ? await api.vitrinLogoYukle(file) : await api.vitrinKapakYukle(file);
      set(tip === "logo" ? "logo_url" : "kapak_url", r.url);
    } catch (e) { setErr(e.message); }
    finally { setGorselYukleniyor(null); }
  }

  if (!form) return <div className="page"><div className="loading">Yükleniyor...</div></div>;

  const magazaUrl = `${window.location.origin}/magaza/${form.slug}`;

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/more")}>← Geri</button>
        <div className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 9 }}>
          <Store size={19} strokeWidth={2} /> Vitrin Ayarları
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 6 }}>Herkese açık mağaza sayfanız:</div>
        <a href={magazaUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent)", fontSize: 14, fontWeight: 600, wordBreak: "break-all" }}>
          {magazaUrl} <ExternalLink size={13} strokeWidth={2} />
        </a>
      </div>

      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--hint)", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
          <Image size={14} strokeWidth={2} /> GÖRSELLER
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <div onClick={() => logoInputRef.current?.click()}
            style={{
              width: 64, height: 64, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
              background: form.logo_url ? `url(${fotoUrl(form.logo_url)}) center/cover` : "var(--bg2)",
              border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            {!form.logo_url && <ImagePlus size={20} stroke="var(--hint)" strokeWidth={1.6} />}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Dükkân Logosu</div>
            <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 4 }}>Mağaza sayfanızda isminizin yanında görünür</div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => logoInputRef.current?.click()} disabled={gorselYukleniyor === "logo"}>
              {gorselYukleniyor === "logo" ? "Yükleniyor..." : form.logo_url ? "Değiştir" : "Yükle"}
            </button>
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => { if (e.target.files[0]) gorselYukle("logo", e.target.files[0]); e.target.value = ""; }} />
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>Kapak Fotoğrafı</div>
          <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 8 }}>Mağaza sayfanızın en üstünde geniş banner olarak görünür</div>
          {form.kapak_url && (
            <img src={fotoUrl(form.kapak_url)} alt="" style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => kapakInputRef.current?.click()} disabled={gorselYukleniyor === "kapak"}>
            {gorselYukleniyor === "kapak" ? "Yükleniyor..." : form.kapak_url ? "Değiştir" : "Yükle"}
          </button>
          <input ref={kapakInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => { if (e.target.files[0]) gorselYukle("kapak", e.target.files[0]); e.target.value = ""; }} />
        </div>
      </div>

      <form onSubmit={kaydet}>
        {saved && <div style={{ color: "var(--success)", fontSize: 13, marginBottom: 8 }}>Kaydedildi</div>}

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <input type="checkbox" checked={form.vitrin_aktif} onChange={e => set("vitrin_aktif", e.target.checked)} style={{ width: 18, height: 18 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Vitrin sayfası açık</div>
              <div style={{ fontSize: 12, color: "var(--hint)" }}>Kapatırsanız mağaza linkiniz "bulunamadı" gösterir</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Kısa Açıklama</label>
            <input className="form-input" value={form.vitrin_aciklama || ""} onChange={e => set("vitrin_aciklama", e.target.value)}
              placeholder="Örn: 15 yıllık tecrübe, tüm marka telefon tamiri" />
          </div>
          <div className="form-group">
            <label className="form-label">Telefon</label>
            <input className="form-input" value={form.telefon || ""} onChange={e => set("telefon", e.target.value)} placeholder="0555 123 45 67" />
          </div>
          <div className="form-group">
            <label className="form-label">Şehir</label>
            <input className="form-input" value={form.sehir || ""} onChange={e => set("sehir", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Adres</label>
            <input className="form-input" value={form.adres || ""} onChange={e => set("adres", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Çalışma Saatleri</label>
            <input className="form-input" value={form.calisma_saatleri || ""} onChange={e => set("calisma_saatleri", e.target.value)}
              placeholder="Hafta içi 09:00-19:00" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Hizmetler (virgülle ayırın)</label>
            <input className="form-input" value={form.hizmetler || ""} onChange={e => set("hizmetler", e.target.value)}
              placeholder="Ekran değişimi, Batarya değişimi, Su hasarı onarımı" />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy}>
          {busy ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>
    </div>
  );
}
