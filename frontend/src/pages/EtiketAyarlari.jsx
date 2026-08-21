import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Printer, CircleX, Store, Move } from "lucide-react";
import { EtiketIcerik, ETIKET_AYAR_VARSAYILAN } from "../components/UrunEtiketi";

const ORNEK_URUN = { id: 1, ad: "Örnek Ürün", satis_fiyati: 199, kategori: "Kılıf", barkot: null };

export default function EtiketAyarlari({ user }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(null); // null = yükleniyor
  const [err, setErr] = useState("");
  const [kaydedildi, setKaydedildi] = useState(false);
  const patron = user?.rol === "patron";

  useEffect(() => {
    api.etiketAyarlari()
      .then(setForm)
      .catch(() => setForm(ETIKET_AYAR_VARSAYILAN));
  }, []);

  async function kaydet(e) {
    e.preventDefault(); setErr(""); setKaydedildi(false);
    try {
      await api.etiketAyarlariGuncelle(form);
      setKaydedildi(true);
      setTimeout(() => setKaydedildi(false), 2500);
    } catch (e) { setErr(e.message); }
  }

  if (!form) return <div className="loading">Yükleniyor...</div>;

  const onizlemeGenislikMm = parseFloat(form.etiket_genislik_mm) || 40;
  const onizlemeAyarlari = {
    ...form,
    etiket_genislik_mm: onizlemeGenislikMm,
    etiket_yukseklik_mm: parseFloat(form.etiket_yukseklik_mm) || 30,
  };
  // Küçük etiketler düzenlerken rahat sürüklenebilsin diye büyütülür, büyük
  // etiketler ekrana sığsın diye küçültülür — sürükleme/boyutlandırma
  // matematiği gerçek render edilmiş piksel boyutunu ölçtüğü için ölçekten
  // etkilenmez.
  const onizlemeOlcek = Math.min(3, Math.max(0.4, 300 / (onizlemeGenislikMm * 3.78)));

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Printer size={19} strokeWidth={2} /> Etiket Ayarları
        </h1>
      </div>
      <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 14 }}>
        Aksesuar'da yazdırılan barkotlu fiyat etiketlerinin boyutunu ve görünümünü buradan ayarlayabilirsin.
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <fieldset disabled={!patron} style={{ border: "none", padding: 0, margin: 0 }}>
          <form onSubmit={kaydet}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Genişlik (mm)</label>
                <input className="form-input" type="number" min="10" max="200" value={form.etiket_genislik_mm}
                  onChange={e => setForm(f => ({ ...f, etiket_genislik_mm: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Yükseklik (mm)</label>
                <input className="form-input" type="number" min="10" max="200" value={form.etiket_yukseklik_mm}
                  onChange={e => setForm(f => ({ ...f, etiket_yukseklik_mm: e.target.value }))} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={!!form.etiket_kategori_goster}
                onChange={e => setForm(f => ({ ...f, etiket_kategori_goster: e.target.checked }))} style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13.5 }}>Kategori adını etikette göster</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={!!form.etiket_ayirici_cizgi_goster}
                onChange={e => setForm(f => ({ ...f, etiket_ayirici_cizgi_goster: e.target.checked }))} style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13.5 }}>Ürün adı ile fiyat arasına çizgi çek</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: form.logo_url ? 4 : 12, cursor: form.logo_url ? "pointer" : "not-allowed", opacity: form.logo_url ? 1 : 0.5 }}>
              <input type="checkbox" disabled={!form.logo_url || !patron} checked={!!form.etiket_logo_goster}
                onChange={e => setForm(f => ({ ...f, etiket_logo_goster: e.target.checked }))} style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13.5 }}>Dükkan logosunu etikette göster</span>
            </label>
            {!form.logo_url && (
              <div style={{ fontSize: 11.5, color: "var(--hint)", marginBottom: 12, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                <Store size={12} strokeWidth={2} /> Henüz logo yüklenmemiş —
                <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "2px 8px", height: "auto" }} onClick={() => navigate("/vitrin-ayarlari")}>
                  Vitrin Ayarları'ndan yükle
                </button>
              </div>
            )}
            {patron && (
              <button type="submit" className="btn btn-primary">{kaydedildi ? "Kaydedildi ✓" : "Kaydet"}</button>
            )}
          </form>
        </fieldset>
        {!patron && (
          <div style={{ fontSize: 11.5, color: "var(--hint)", marginTop: 8 }}>Bu ayarları sadece patron değiştirebilir.</div>
        )}
      </div>

      <div className="section-title">Önizleme</div>
      {patron && (
        <div style={{ fontSize: 11.5, color: "var(--hint)", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
          <Move size={12} strokeWidth={2} /> Logoyu, ürün adı/fiyat bloğunu ve barkodu ayrı ayrı sürükleyerek taşı, mavi tutamaçlarla enine veya boyuna büyüt/küçült
        </div>
      )}
      <div className="card" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 30, minHeight: 220, overflow: "auto" }}>
        <div style={{ transform: `scale(${onizlemeOlcek})` }}>
          <EtiketIcerik item={ORNEK_URUN} ayarlar={onizlemeAyarlari}
            duzenlenebilir={patron}
            onLogoTasi={(x, y) => setForm(f => ({ ...f, etiket_logo_x_pct: x, etiket_logo_y_pct: y }))}
            onLogoBoyutlandir={(w, h) => setForm(f => ({ ...f, etiket_logo_genislik_mm: w, etiket_logo_yukseklik_mm: h }))}
            onMetinTasi={(x, y) => setForm(f => ({ ...f, etiket_metin_x_pct: x, etiket_metin_y_pct: y }))}
            onMetinBoyutlandir={(w, h) => setForm(f => ({ ...f, etiket_metin_genislik_mm: w, etiket_metin_yukseklik_mm: h }))}
            onBarkotTasi={(x, y) => setForm(f => ({ ...f, etiket_barkot_x_pct: x, etiket_barkot_y_pct: y }))}
            onBarkotBoyutlandir={(w, h) => setForm(f => ({ ...f, etiket_barkot_genislik_mm: w, etiket_barkot_yukseklik_mm: h }))} />
        </div>
      </div>
    </div>
  );
}
