import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, fotoUrl } from "../api";
import {
  Wrench, Search, MapPin, Phone, Clock, Smartphone, CircleX, X,
  CheckCircle2, Send, Store, ShieldCheck, Tag, Star, Repeat, Receipt,
  Headphones, User, BadgeCheck, Zap, Package,
} from "lucide-react";

const DURUM_LABEL = {
  bekliyor: "Bekliyor", tamirde: "Tamirde", parca_bekleniyor: "Parça Bekleniyor",
  hazir: "Hazır — Teslim Alabilirsiniz", teslim: "Teslim Edildi",
};

function fmt(n) { return (n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 }); }

const GUVEN_UNSURLARI = [
  { ic: ShieldCheck, baslik: "Garantili Tamir", aciklama: "Yapılan her işlem garanti kapsamında kayıt altında." },
  { ic: Zap, baslik: "Hızlı Teslimat", aciklama: "Çoğu tamir aynı gün içinde tamamlanır." },
  { ic: BadgeCheck, baslik: "Kaliteli Parça", aciklama: "Test edilmiş, uyumlu yedek parça kullanılır." },
  { ic: Receipt, baslik: "Şeffaf Fiyat", aciklama: "İşlem öncesi bilgilendirme, sürpriz ücret yok." },
];

/* ── Ortak modal kabuğu ──────────────────────────────────────── */

function Modal({ baslik, ikon: Ikon, onClose, children }) {
  useEffect(() => {
    function esc(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="mp-modal-overlay" onClick={onClose}>
      <div className="mp-modal" onClick={e => e.stopPropagation()}>
        <div className="mp-modal-title">
          {Ikon && <Ikon size={16} strokeWidth={2} />}
          <span style={{ flex: 1 }}>{baslik}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex" }}>
            <X size={17} strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Servis araçları (modal içeriği) ─────────────────────────── */

function TamirSorgu({ slug }) {
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState(null);
  const [loading, setLoading] = useState(false);

  async function ara(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try { setSonuc(await api.publicTamirDurumu(slug, q.trim())); }
    catch { setSonuc([]); }
    finally { setLoading(false); }
  }

  return (
    <>
      <form onSubmit={ara} style={{ display: "flex", gap: 8, marginBottom: sonuc ? 12 : 0 }}>
        <input className="form-input" style={{ flex: 1 }} placeholder="Telefon numarası veya tamir no (#T...)"
          value={q} onChange={e => setQ(e.target.value)} autoFocus />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>Sorgula</button>
      </form>
      {sonuc && (loading ? (
        <div style={{ fontSize: 13, color: "var(--hint)" }}>Aranıyor...</div>
      ) : sonuc.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--hint)" }}>Bu bilgiyle kayıt bulunamadı.</div>
      ) : sonuc.map((r, i) => (
        <div key={i} style={{ padding: "10px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>#{r.repair_no} — {r.device_model}</div>
          <div style={{ fontSize: 12.5, color: "var(--hint)", marginTop: 2 }}>{r.fault_desc || "—"}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: r.status === "hazir" ? "var(--green)" : "var(--accent)", marginTop: 4 }}>
            {DURUM_LABEL[r.status] || r.status}
          </div>
        </div>
      )))}
    </>
  );
}

function GarantiSorgu({ slug }) {
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState(null);
  const [loading, setLoading] = useState(false);

  async function ara(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try { setSonuc(await api.publicGarantiDurumu(slug, q.trim())); }
    catch { setSonuc([]); }
    finally { setLoading(false); }
  }

  return (
    <>
      <form onSubmit={ara} style={{ display: "flex", gap: 8, marginBottom: sonuc ? 12 : 0 }}>
        <input className="form-input" style={{ flex: 1 }} placeholder="Telefon numaranız"
          value={q} onChange={e => setQ(e.target.value)} autoFocus />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>Sorgula</button>
      </form>
      {sonuc && (loading ? (
        <div style={{ fontSize: 13, color: "var(--hint)" }}>Aranıyor...</div>
      ) : sonuc.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--hint)" }}>Bu numarayla garanti kaydı bulunamadı.</div>
      ) : sonuc.map((g, i) => {
        const kalanGun = Math.ceil((new Date(g.bitis_tarihi) - new Date()) / 86400000);
        const gecerli = g.aktif && kalanGun >= 0;
        return (
          <div key={i} style={{ padding: "10px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{g.cihaz}</div>
            <div style={{ fontSize: 12.5, color: "var(--hint)", marginTop: 2 }}>{g.tamir_aciklama}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: gecerli ? "var(--green)" : "var(--hint)", marginTop: 4 }}>
              {gecerli ? `Garantili — ${kalanGun} gün kaldı` : "Garanti süresi doldu"}
            </div>
          </div>
        );
      }))}
    </>
  );
}

function FiyatSorgu({ slug }) {
  const [model, setModel] = useState("");
  const [sonuc, setSonuc] = useState(null);
  const [loading, setLoading] = useState(false);

  async function ara(e) {
    e.preventDefault();
    if (model.trim().length < 2) return;
    setLoading(true);
    try { setSonuc(await api.publicFiyatSorgu(slug, model.trim())); }
    catch { setSonuc({ adet: 0, ortalama: null, ornekler: [] }); }
    finally { setLoading(false); }
  }

  return (
    <>
      <form onSubmit={ara} style={{ display: "flex", gap: 8, marginBottom: sonuc ? 12 : 0 }}>
        <input className="form-input" style={{ flex: 1 }} placeholder="Cihaz modeli (ör. iPhone 13)"
          value={model} onChange={e => setModel(e.target.value)} autoFocus />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>Sorgula</button>
      </form>
      {sonuc && (loading ? (
        <div style={{ fontSize: 13, color: "var(--hint)" }}>Aranıyor...</div>
      ) : sonuc.adet === 0 ? (
        <div style={{ fontSize: 13, color: "var(--hint)" }}>Bu model için geçmiş kayıt bulunamadı, lütfen sorunuz.</div>
      ) : (
        <div>
          <div style={{ fontSize: 12.5, color: "var(--hint)", marginBottom: 6 }}>
            Son {sonuc.adet} tamire göre ortalama (tahmini, kesin fiyat değildir):
          </div>
          <div style={{ fontWeight: 800, fontSize: 20, color: "var(--orange)", marginBottom: 8 }}>
            ~{fmt(sonuc.ortalama)}₺
          </div>
          {sonuc.ornekler.map((o, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--hint)", padding: "3px 0" }}>
              {o.aciklama || "—"} · {fmt(o.fiyat)}₺
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function RandevuFormu({ slug }) {
  const [form, setForm] = useState({ musteri_adi: "", telefon: "", cihaz_model: "", aciklama: "" });
  const [gonderildi, setGonderildi] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function gonder(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api.publicRandevuTalebi(slug, form);
      setGonderildi(true);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  if (gonderildi) {
    return (
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <CheckCircle2 size={32} strokeWidth={1.6} stroke="var(--green)" style={{ marginBottom: 8 }} />
        <div style={{ fontWeight: 700, fontSize: 15 }}>Talebiniz alındı</div>
        <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 4 }}>Dükkân en kısa sürede sizinle iletişime geçecek.</div>
      </div>
    );
  }

  return (
    <form onSubmit={gonder}>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={13} strokeWidth={2} /> {err}</div>}
      <div className="form-group">
        <input className="form-input" required placeholder="Adınız Soyadınız" autoFocus
          value={form.musteri_adi} onChange={e => setForm(f => ({ ...f, musteri_adi: e.target.value }))} />
      </div>
      <div className="form-group">
        <input className="form-input" required type="tel" placeholder="Telefon"
          value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
      </div>
      <div className="form-group">
        <input className="form-input" placeholder="Cihaz modeli (opsiyonel)"
          value={form.cihaz_model} onChange={e => setForm(f => ({ ...f, cihaz_model: e.target.value }))} />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <textarea className="form-input" rows={3} placeholder="Arıza / talep açıklaması (opsiyonel)"
          value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))}
          style={{ width: "100%", resize: "vertical" }} />
      </div>
      <button type="submit" className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} disabled={busy}>
        {busy ? "Gönderiliyor..." : "Talep Gönder"}
      </button>
    </form>
  );
}

function TakasTeklifi({ slug }) {
  const [form, setForm] = useState({ musteri_adi: "", telefon: "", cihaz_model: "", aciklama: "" });
  const [foto, setFoto] = useState(null);
  const [gonderildi, setGonderildi] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function gonder(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api.publicTakasTeklifi(slug, { ...form, foto });
      setGonderildi(true);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  if (gonderildi) {
    return (
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <CheckCircle2 size={32} strokeWidth={1.6} stroke="var(--green)" style={{ marginBottom: 8 }} />
        <div style={{ fontWeight: 700, fontSize: 15 }}>Takas teklifiniz alındı</div>
        <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 4 }}>Dükkân değerlendirip sizinle iletişime geçecek.</div>
      </div>
    );
  }

  return (
    <form onSubmit={gonder}>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}
      <div className="form-group">
        <input className="form-input" required placeholder="Adınız Soyadınız" autoFocus
          value={form.musteri_adi} onChange={e => setForm(f => ({ ...f, musteri_adi: e.target.value }))} />
      </div>
      <div className="form-group">
        <input className="form-input" required type="tel" placeholder="Telefon"
          value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
      </div>
      <div className="form-group">
        <input className="form-input" required placeholder="Cihazınızın modeli"
          value={form.cihaz_model} onChange={e => setForm(f => ({ ...f, cihaz_model: e.target.value }))} />
      </div>
      <div className="form-group">
        <textarea className="form-input" rows={2} placeholder="Cihazın durumu (opsiyonel)" style={{ width: "100%", resize: "vertical" }}
          value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Cihaz fotoğrafı (opsiyonel)</label>
        <input type="file" accept="image/*" onChange={e => setFoto(e.target.files[0] || null)} />
      </div>
      <button type="submit" className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} disabled={busy}>
        {busy ? "Gönderiliyor..." : "Teklif Gönder"}
      </button>
    </form>
  );
}

const ARACLAR = [
  { key: "tamir", ikon: Search, baslik: "Tamir Durumu Sorgula", aciklama: "Cihazınız hazır mı, öğrenin", bilesen: TamirSorgu },
  { key: "garanti", ikon: ShieldCheck, baslik: "Garanti Sorgula", aciklama: "Garantiniz devam ediyor mu", bilesen: GarantiSorgu },
  { key: "fiyat", ikon: Tag, baslik: "Fiyat Tahmini Al", aciklama: "Modelinize göre ortalama ücret", bilesen: FiyatSorgu },
  { key: "randevu", ikon: Send, baslik: "Randevu / Tamir Talebi", aciklama: "Cihazınız için talep bırakın", bilesen: RandevuFormu },
  { key: "takas", ikon: Repeat, baslik: "Cihaz Takas Teklifi", aciklama: "Eski cihazınıza teklif alın", bilesen: TakasTeklifi },
];

/* ── Ürün vitrini ────────────────────────────────────────────── */

function UrunDetayModal({ urun, onClose, whatsappHref }) {
  const waHref = whatsappHref
    ? `${whatsappHref}?text=${encodeURIComponent(`Merhaba, "${urun.ad}" ile ilgili bilgi almak istiyorum.`)}`
    : null;
  return (
    <Modal baslik={urun.ad} ikon={urun.tur === "aksesuar" ? Headphones : Smartphone} onClose={onClose}>
      <span className="badge" style={{ background: urun.rozetBg, color: urun.rozetRenk, marginBottom: 12, display: "inline-block" }}>
        {urun.rozet}
      </span>
      {urun.detaylar.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {urun.detaylar.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: "1px solid var(--divider)" }}>
              <span style={{ color: "var(--hint)" }}>{k}</span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontWeight: 800, fontSize: 22, color: "var(--orange)", marginBottom: 14 }}>
        {urun.fiyat ? `${fmt(urun.fiyat)}₺` : "Fiyat için sorunuz"}
      </div>
      {waHref && (
        <a href={waHref} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ width: "100%", display: "flex", justifyContent: "center" }}>
          WhatsApp'tan Sor
        </a>
      )}
    </Modal>
  );
}

function UrunVitrini({ slug, whatsappHref, onSayi }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [aktifTur, setAktifTur] = useState(null);
  const [detay, setDetay] = useState(null);

  useEffect(() => {
    api.publicCihazlar(slug)
      .then(d => { setData(d); onSayi?.((d.sifir?.length || 0) + (d.ikinci_el?.length || 0) + (d.aksesuar?.length || 0)); })
      .catch(() => setData({ ikinci_el: [], sifir: [], aksesuar: [] }));
  }, [slug]);

  const urunler = useMemo(() => {
    if (!data) return [];
    const norm = [];
    for (const c of data.sifir || []) {
      norm.push({
        id: `s${c.id}`, tur: "sifir", ad: c.model, fiyat: c.satis_fiyati,
        rozet: "Sıfır", rozetBg: "rgba(74,222,128,0.15)", rozetRenk: "var(--green)",
        meta: [c.renk, c.depolama].filter(Boolean).join(" · "),
        detaylar: [["Renk", c.renk], ["Depolama", c.depolama]].filter(([, v]) => v),
      });
    }
    for (const c of data.ikinci_el || []) {
      norm.push({
        id: `i${c.id}`, tur: "ikinci_el", ad: c.model, fiyat: c.satis_fiyati,
        rozet: "2. El", rozetBg: "rgba(157,210,255,0.15)", rozetRenk: "var(--blue2)",
        meta: [c.renk, c.depolama, c.ram].filter(Boolean).join(" · "),
        detaylar: [["Renk", c.renk], ["Depolama", c.depolama], ["RAM", c.ram]].filter(([, v]) => v),
      });
    }
    for (const a of data.aksesuar || []) {
      norm.push({
        id: `a${a.id}`, tur: "aksesuar", ad: a.ad, fiyat: a.satis_fiyati,
        rozet: a.kategori || "Aksesuar", rozetBg: "rgba(246,162,74,0.15)", rozetRenk: "var(--orange)",
        meta: a.kategori || "", detaylar: [["Kategori", a.kategori]].filter(([, v]) => v),
      });
    }
    return norm;
  }, [data]);

  const filtreli = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return urunler.filter(u => {
      if (aktifTur && u.tur !== aktifTur) return false;
      if (qq && !`${u.ad} ${u.meta}`.toLowerCase().includes(qq)) return false;
      return true;
    });
  }, [urunler, q, aktifTur]);

  if (!data || urunler.length === 0) return null;

  const turler = [
    { key: null, label: `Tümü (${urunler.length})` },
    { key: "sifir", label: `Sıfır (${data.sifir?.length || 0})` },
    { key: "ikinci_el", label: `2. El (${data.ikinci_el?.length || 0})` },
    { key: "aksesuar", label: `Aksesuar (${data.aksesuar?.length || 0})` },
  ].filter(t => t.key === null || !t.label.includes("(0)"));

  return (
    <>
      <h2 className="mp-section-title"><Package size={17} strokeWidth={2} /> Satıştakiler</h2>

      <div className="mp-filters">
        <input className="form-input" placeholder="Ürün veya model ara..."
          value={q} onChange={e => setQ(e.target.value)} />
        <div className="mp-chip-row">
          {turler.map(t => (
            <button key={t.key || "all"} className={"mp-chip" + (aktifTur === t.key ? " active" : "")}
              onClick={() => setAktifTur(t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      {filtreli.length === 0 ? (
        <div className="mp-empty">Bu aramaya uyan ürün yok.</div>
      ) : (
        <div className="mp-grid">
          {filtreli.map((u, i) => (
            <button key={u.id} className="mp-product" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}
              onClick={() => setDetay(u)}>
              <div className="mp-product-img">
                {u.tur === "aksesuar"
                  ? <Headphones size={34} strokeWidth={1.4} />
                  : <Smartphone size={34} strokeWidth={1.4} />}
                <span className="badge mp-badge-tl" style={{ background: u.rozetBg, color: u.rozetRenk }}>{u.rozet}</span>
              </div>
              <div className="mp-product-body">
                <div className="mp-product-name">{u.ad}</div>
                {u.meta && <div className="mp-product-meta">{u.meta}</div>}
                <div className="mp-product-price">{u.fiyat ? `${fmt(u.fiyat)}₺` : "Sorunuz"}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {detay && <UrunDetayModal urun={detay} whatsappHref={whatsappHref} onClose={() => setDetay(null)} />}
    </>
  );
}

/* ── Değerlendirmeler ────────────────────────────────────────── */

function Degerlendirmeler({ slug, onOzet }) {
  const [data, setData] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ repair_no: "", telefon: "", puan: 5, yorum: "" });
  const [err, setErr] = useState("");
  const [gonderildi, setGonderildi] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.publicDegerlendirmeler(slug)
      .then(d => { setData(d); onOzet?.(d); })
      .catch(() => setData({ ortalama: null, adet: 0, yorumlar: [] }));
  }, [slug]);

  async function gonder(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api.publicDegerlendirmeEkle(slug, form);
      setGonderildi(true); setShowForm(false);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  if (!data) return null;

  return (
    <>
      <h2 className="mp-section-title">
        <Star size={17} strokeWidth={2} /> Değerlendirmeler
        {data.ortalama && (
          <span style={{ color: "var(--hint)", fontWeight: 500, fontSize: 13.5 }}>
            {data.ortalama} / 5 · {data.adet} yorum
          </span>
        )}
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setShowForm(true)}>
          Yorum Bırak
        </button>
      </h2>

      {gonderildi && (
        <div style={{ fontSize: 13, color: "var(--green)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={14} strokeWidth={2} /> Teşekkürler, değerlendirmeniz onay sonrası yayınlanacak.
        </div>
      )}

      {data.yorumlar.length === 0 ? (
        <div className="mp-empty">Henüz değerlendirme yok.</div>
      ) : (
        <div className="card">
          {data.yorumlar.map((y, i) => (
            <div key={i} style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                {[1, 2, 3, 4, 5].map(p => (
                  <Star key={p} size={12} strokeWidth={1.6} fill={p <= y.puan ? "var(--orange)" : "none"} stroke={p <= y.puan ? "var(--orange)" : "var(--hint)"} />
                ))}
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{y.musteri_adi}</span>
              </div>
              {y.yorum && <div style={{ fontSize: 13, color: "var(--hint)" }}>{y.yorum}</div>}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal baslik="Değerlendirme Bırak" ikon={Star} onClose={() => setShowForm(false)}>
          <form onSubmit={gonder}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}
            <div style={{ fontSize: 12.5, color: "var(--hint)", marginBottom: 10 }}>
              Sadece teslim edilmiş bir tamir için yorum bırakabilirsiniz.
            </div>
            <div className="form-group">
              <input className="form-input" placeholder="Tamir No (#T...)" required autoFocus
                value={form.repair_no} onChange={e => setForm(f => ({ ...f, repair_no: e.target.value }))} />
            </div>
            <div className="form-group">
              <input className="form-input" placeholder="Telefon" required
                value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[1, 2, 3, 4, 5].map(p => (
                <button type="button" key={p} onClick={() => setForm(f => ({ ...f, puan: p }))}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <Star size={24} strokeWidth={1.6} fill={p <= form.puan ? "var(--orange)" : "none"} stroke={p <= form.puan ? "var(--orange)" : "var(--hint)"} />
                </button>
              ))}
            </div>
            <textarea className="form-input" rows={3} placeholder="Yorumunuz (opsiyonel)" style={{ width: "100%", resize: "vertical" }}
              value={form.yorum} onChange={e => setForm(f => ({ ...f, yorum: e.target.value }))} />
            <button type="submit" className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} disabled={busy}>
              {busy ? "..." : "Gönder"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ── Sayfa ───────────────────────────────────────────────────── */

export default function MagazaPublic() {
  const { slug } = useParams();
  const [dukkan, setDukkan] = useState(null);
  const [err, setErr] = useState("");
  const [acikArac, setAcikArac] = useState(null);
  const [urunSayisi, setUrunSayisi] = useState(null);
  const [puanOzet, setPuanOzet] = useState(null);

  useEffect(() => {
    api.publicDukkan(slug).then(setDukkan).catch(() => setErr("notfound"));
  }, [slug]);

  if (err) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 24, textAlign: "center" }}>
        <Store size={40} stroke="var(--dim)" strokeWidth={1.5} />
        <div style={{ fontWeight: 700 }}>Dükkân bulunamadı</div>
      </div>
    );
  }
  if (!dukkan) return null;

  const waBase = dukkan.telefon
    ? `https://wa.me/${dukkan.telefon.replace(/\D/g, "").replace(/^0/, "90")}`
    : null;
  const hizmetler = (dukkan.hizmetler || "").split(",").map(h => h.trim()).filter(Boolean);
  const aktif = ARACLAR.find(a => a.key === acikArac);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <header className="mp-hero">
        {dukkan.kapak_url && (
          <div className="mp-hero-cover" style={{ backgroundImage: `url(${fotoUrl(dukkan.kapak_url)})` }} />
        )}
        <div className="mp-container mp-hero-inner">
          <div className="mp-reveal">
            {dukkan.logo_url
              ? <img className="mp-logo" src={fotoUrl(dukkan.logo_url)} alt="" />
              : <div className="mp-logo-fallback"><Wrench size={34} strokeWidth={1.6} stroke="var(--gold)" /></div>}
            <h1 className="mp-title">{dukkan.ad}</h1>
            {dukkan.vitrin_aciklama && <p className="mp-desc">{dukkan.vitrin_aciklama}</p>}
          </div>

          <div className="mp-info-row mp-reveal mp-reveal-1">
            {dukkan.telefon && <span><Phone size={12} strokeWidth={2} /> {dukkan.telefon}</span>}
            {(dukkan.adres || dukkan.sehir) && <span><MapPin size={12} strokeWidth={2} /> {[dukkan.adres, dukkan.sehir].filter(Boolean).join(", ")}</span>}
            {dukkan.calisma_saatleri && <span><Clock size={12} strokeWidth={2} /> {dukkan.calisma_saatleri}</span>}
          </div>

          {hizmetler.length > 0 && (
            <div className="mp-hizmet-row mp-reveal mp-reveal-1">
              {hizmetler.map(h => <span key={h} className="badge" style={{ background: "var(--bg2)", color: "var(--text)" }}>{h}</span>)}
            </div>
          )}

          <div className="mp-stats-row mp-reveal mp-reveal-2">
            {urunSayisi > 0 && <div className="mp-stat"><b>{urunSayisi}</b><span>Satılık</span></div>}
            {puanOzet?.ortalama && <div className="mp-stat"><b>{puanOzet.ortalama}</b><span>Puan</span></div>}
            {hizmetler.length > 0 && <div className="mp-stat"><b>{hizmetler.length}</b><span>Hizmet</span></div>}
          </div>

          <div className="mp-cta-row mp-reveal mp-reveal-3">
            {waBase && (
              <a href={waBase} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                WhatsApp'tan Yaz
              </a>
            )}
            <Link to={`/magaza/${slug}/panelim`} className="btn btn-ghost btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <User size={13} strokeWidth={2} /> Müşteri Paneli
            </Link>
          </div>
        </div>
      </header>

      <div className="mp-container" style={{ paddingBottom: 10 }}>
        <h2 className="mp-section-title"><Wrench size={17} strokeWidth={2} /> Servis İşlemleri</h2>
        <div className="mp-tools">
          {ARACLAR.map(a => (
            <button key={a.key} className="mp-tool-btn" onClick={() => setAcikArac(a.key)}>
              <a.ikon size={19} strokeWidth={1.8} stroke="var(--gold)" />
              <span>
                <span className="mp-tool-baslik" style={{ display: "block" }}>{a.baslik}</span>
                <span className="mp-tool-aciklama" style={{ display: "block" }}>{a.aciklama}</span>
              </span>
            </button>
          ))}
        </div>

        <UrunVitrini slug={slug} whatsappHref={waBase} onSayi={setUrunSayisi} />

        <h2 className="mp-section-title"><BadgeCheck size={17} strokeWidth={2} /> Neden Biz?</h2>
        <div className="mp-guven-row">
          {GUVEN_UNSURLARI.map(g => (
            <div className="mp-guven-card" key={g.baslik}>
              <g.ic size={20} strokeWidth={1.7} stroke="var(--gold)" />
              <div className="mp-guven-baslik">{g.baslik}</div>
              <div className="mp-guven-aciklama">{g.aciklama}</div>
            </div>
          ))}
        </div>

        <Degerlendirmeler slug={slug} onOzet={setPuanOzet} />
      </div>

      <footer className="mp-footer">
        <div style={{ display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap", marginBottom: 10 }}>
          <Link to={`/magaza/${slug}/panelim`} style={{ color: "var(--hint)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <User size={13} strokeWidth={2} /> Müşteri Paneli
          </Link>
          <Link to={`/magaza/${slug}/fis`} style={{ color: "var(--hint)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Receipt size={13} strokeWidth={2} /> Dijital Fiş
          </Link>
        </div>
        {dukkan.ad}
      </footer>

      {aktif && (
        <Modal baslik={aktif.baslik} ikon={aktif.ikon} onClose={() => setAcikArac(null)}>
          <aktif.bilesen slug={slug} />
        </Modal>
      )}
    </div>
  );
}
