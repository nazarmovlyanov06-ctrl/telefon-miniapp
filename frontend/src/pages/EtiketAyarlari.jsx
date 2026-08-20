import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Printer, CircleX, Store } from "lucide-react";
import { EtiketIcerik } from "../components/UrunEtiketi";

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
      .catch(() => setForm({ etiket_genislik_mm: 40, etiket_yukseklik_mm: 30, etiket_logo_goster: false, etiket_kategori_goster: true, logo_url: null }));
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

  const onizlemeAyarlari = {
    ...form,
    etiket_genislik_mm: parseFloat(form.etiket_genislik_mm) || 40,
    etiket_yukseklik_mm: parseFloat(form.etiket_yukseklik_mm) || 30,
  };

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
      <div className="card" style={{ display: "flex", justifyContent: "center", padding: 20 }}>
        <EtiketIcerik item={ORNEK_URUN} ayarlar={onizlemeAyarlari} />
      </div>
    </div>
  );
}
