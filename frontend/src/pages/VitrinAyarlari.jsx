import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Store, CircleX, ExternalLink } from "lucide-react";

export default function VitrinAyarlari() {
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

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

      <form onSubmit={kaydet}>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}
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
