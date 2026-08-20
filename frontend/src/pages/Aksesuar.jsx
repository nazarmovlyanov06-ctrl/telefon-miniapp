import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  Tag, CircleX, TriangleAlert, Trash2, Search, Filter, X, Pencil,
  Headphones, ArrowDownCircle, ArrowUpCircle, RefreshCw, Phone, Package,
} from "lucide-react";
import UrunGorsel from "../components/UrunGorsel";
import OdemeBolustur, { varsayilanOdemeSatirlari } from "../components/OdemeBolustur";

const DEFAULT_CATS = ["Şarj Aleti", "Kılıf", "Kırılmaz Cam", "Kulaklık", "Powerbank", "Diğer"];

const HAREKET_META = {
  giris: { label: "Stok girişi", color: "var(--success)", icon: ArrowDownCircle },
  cikis: { label: "Satış", color: "var(--danger)", icon: ArrowUpCircle },
  duzeltme: { label: "Düzeltme", color: "var(--accent)", icon: RefreshCw },
};

function AltPencere({ children, onClose, maxWidth = 420 }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth, margin: "0 auto", borderRadius: 18, maxHeight: "86vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function PencereBaslik({ children, onClose }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <span style={{ fontWeight: 700, fontSize: 16 }}>{children}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex" }}>
        <X size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

function tarihFmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ── Ürün Detay Modalı — karta tıklayınca açılır, stok geçmişi + aksiyonlar ── */
function UrunDetayModal({ item, onClose, onSat, onDuzenle, onSil, canDelete }) {
  const [hareketler, setHareketler] = useState(null);

  useEffect(() => {
    api.aksesuarHareketler(item.id).then(setHareketler).catch(() => setHareketler([]));
  }, [item.id]);

  const karMarji = item.alis_fiyati > 0 ? Math.round(((item.satis_fiyati - item.alis_fiyati) / item.alis_fiyati) * 100) : null;

  return (
    <AltPencere onClose={onClose}>
      <PencereBaslik onClose={onClose}>{item.ad}</PencereBaslik>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <UrunGorsel url={item.gorsel_url} yukle={f => api.aksesuarGorselYukle(item.id, f)} boyut={56} />
        <div>
          <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>{item.kategori || "Diğer"}</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: item.stok <= (item.min_stok ?? 5) ? "var(--danger)" : "var(--text)" }}>
            {item.stok} adet stokta
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "8px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "var(--hint)" }}>Alış</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{item.alis_fiyati}₺</div>
        </div>
        <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "8px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "var(--hint)" }}>Satış</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{item.satis_fiyati}₺</div>
        </div>
        <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "8px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "var(--hint)" }}>Kâr Marjı</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--success)" }}>{karMarji !== null ? `%${karMarji}` : "—"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {item.stok > 0 && <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => onSat(item)}>Sat</button>}
        <button className="btn btn-ghost btn-sm" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }} onClick={() => onDuzenle(item)}>
          <Pencil size={13} strokeWidth={2} /> Düzenle
        </button>
        {canDelete && (
          <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", display: "flex", alignItems: "center", padding: "0 10px" }} onClick={() => onSil(item)}>
            <Trash2 size={13} strokeWidth={2} />
          </button>
        )}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Stok Hareketleri</div>
      {hareketler === null ? (
        <div style={{ fontSize: 12, color: "var(--hint)" }}>Yükleniyor...</div>
      ) : hareketler.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--hint)" }}>Henüz hareket yok</div>
      ) : hareketler.map(h => {
        const meta = HAREKET_META[h.tur] || { label: h.tur, color: "var(--hint)", icon: RefreshCw };
        const HIkon = meta.icon;
        return (
          <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: "1px solid var(--divider)" }}>
            <HIkon size={14} stroke={meta.color} strokeWidth={2} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{meta.label}</div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>{tarihFmt(h.created_at)}{h.yapan_adi ? ` · ${h.yapan_adi}` : ""}</div>
            </div>
            <div style={{ fontWeight: 700, color: h.miktar > 0 ? "var(--success)" : "var(--danger)", fontSize: 13 }}>
              {h.miktar > 0 ? `+${h.miktar}` : h.miktar}
            </div>
          </div>
        );
      })}
    </AltPencere>
  );
}

export default function Aksesuar({ user }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("urunler"); // urunler | gecmis
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kategoriler, setKategoriler] = useState(DEFAULT_CATS);
  const [aktifKat, setAktifKat] = useState("Tümü");
  const [urunArama, setUrunArama] = useState("");
  const [showKatYonet, setShowKatYonet] = useState(false);
  const [yeniKat, setYeniKat] = useState("");
  const [formModal, setFormModal] = useState(null); // null | { mode }
  const [form, setForm] = useState({ ad: "", stok: "1", alis_fiyati: "", satis_fiyati: "", kategori: "Diğer" });
  const [detayItem, setDetayItem] = useState(null);
  const [satForm, setSatForm] = useState(null);
  const [satData, setSatData] = useState({ miktar: "1", musteri_adi: "", musteri_telefon: "", odemeler: null, taksit_sayi: "1" });
  const [err, setErr] = useState("");
  const [deleteId, setDeleteId] = useState(null);

  // Satış Geçmişi sekmesi
  const [satislar, setSatislar] = useState([]);
  const [satisToplam, setSatisToplam] = useState(0);
  const [satisLoading, setSatisLoading] = useState(true);
  const [satisArama, setSatisArama] = useState("");
  const [satisSirala, setSatisSirala] = useState("yeni");
  const [satisBaslangic, setSatisBaslangic] = useState("");
  const [satisBitis, setSatisBitis] = useState("");
  const [showSatisFiltre, setShowSatisFiltre] = useState(false);
  const [satisDetay, setSatisDetay] = useState(null);

  useEffect(() => { load(); kategorileriYukle(); }, []);
  useEffect(() => { if (tab === "gecmis") satisYukle(); }, [tab]);

  const ilkSatisYuklemeRef = useRef(true);
  useEffect(() => {
    if (tab !== "gecmis") return;
    if (ilkSatisYuklemeRef.current) { ilkSatisYuklemeRef.current = false; return; }
    const t = setTimeout(satisYukle, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satisArama, satisSirala, satisBaslangic, satisBitis]);

  async function load() {
    try { setList(await api.aksesuarList()); } finally { setLoading(false); }
  }

  async function satisYukle() {
    setSatisLoading(true);
    try {
      const r = await api.aksesuarSatisGecmisi({
        q: satisArama, sirala: satisSirala,
        tarih_baslangic: satisBaslangic || undefined, tarih_bitis: satisBitis || undefined,
      });
      setSatislar(r.liste || []);
      setSatisToplam(r.toplam || 0);
    } finally { setSatisLoading(false); }
  }

  // Kategoriler artık dükkan genelinde ortak — önceden cihaza özel
  // localStorage'daydı, bir çalışanın eklediği kategori başka çalışanda hiç
  // görünmüyordu.
  async function kategorileriYukle() {
    try {
      const r = await api.aksesuarKategorileri();
      const ozel = (r.kategoriler || []).filter(k => !DEFAULT_CATS.includes(k));
      setKategoriler([...DEFAULT_CATS, ...ozel]);
    } catch { /* varsayılan listeyle devam */ }
  }

  async function addKat() {
    const k = yeniKat.trim();
    if (k && !kategoriler.includes(k)) {
      setKategoriler(kl => [...kl, k]);
      try { await api.aksesuarKategoriEkle(k); } catch { /* zaten varsa sorun değil */ }
    }
    setYeniKat("");
  }

  async function removeKat(k) {
    setKategoriler(kl => kl.filter(c => c !== k));
    if (aktifKat === k) setAktifKat("Tümü");
    try { await api.aksesuarKategoriSil(k); } catch { /* sessizce geç */ }
  }

  function yeniUrunAc() {
    setForm({ ad: "", stok: "1", alis_fiyati: "", satis_fiyati: "", kategori: "Diğer" });
    setErr("");
    setFormModal({ mode: "yeni" });
  }

  function duzenleAc(item) {
    setForm({
      ad: item.ad, stok: String(item.stok), alis_fiyati: String(item.alis_fiyati),
      satis_fiyati: String(item.satis_fiyati), kategori: item.kategori || "Diğer",
    });
    setErr("");
    setDetayItem(null);
    setFormModal({ mode: "duzenle", id: item.id });
  }

  async function submit(e) {
    e.preventDefault(); setErr("");
    const payload = {
      ad: form.ad, stok: parseInt(form.stok), alis_fiyati: parseFloat(form.alis_fiyati),
      satis_fiyati: parseFloat(form.satis_fiyati), kategori: form.kategori,
    };
    try {
      if (formModal.mode === "duzenle") await api.updateAksesuar(formModal.id, payload);
      else await api.createAksesuar(payload);
      if (form.kategori && !kategoriler.includes(form.kategori)) {
        setKategoriler(kl => [...kl, form.kategori]);
        api.aksesuarKategoriEkle(form.kategori).catch(() => {});
      }
      setFormModal(null);
      load();
    } catch (e) { setErr(e.message); }
  }

  function satAc(item) {
    setDetayItem(null);
    setSatData({ miktar: "1", musteri_adi: "", musteri_telefon: "", odemeler: null, taksit_sayi: "1" });
    setErr("");
    setSatForm(item);
  }

  async function submitSat(e) {
    e.preventDefault(); setErr("");
    const toplam = parseInt(satData.miktar || 1) * (satForm.satis_fiyati || 0);
    const odemeler = (satData.odemeler || varsayilanOdemeSatirlari(toplam)).filter(o => parseFloat(o.tutar) > 0);
    const alinan = odemeler.reduce((s, o) => s + (parseFloat(o.tutar) || 0), 0);
    if (toplam - alinan > 0.009 && !satData.musteri_adi.trim()) {
      setErr("Kalan tutar borç olarak yazılacaksa müşteri adı girilmeli");
      return;
    }
    try {
      await api.satAksesuar(satForm.id, {
        miktar: parseInt(satData.miktar), musteri_adi: satData.musteri_adi, musteri_telefon: satData.musteri_telefon,
        tarih: today(), odemeler, taksit_sayi: parseInt(satData.taksit_sayi) || 1,
      });
      setSatForm(null);
      load();
      if (tab === "gecmis") satisYukle();
    } catch (e) { setErr(e.message); }
  }

  async function deleteAksesuar(id) {
    try {
      await api.deleteAksesuar(id);
      setDeleteId(null);
      setDetayItem(null);
      load();
    } catch (e) { alert(e.message); }
  }

  const kategoriliList = aktifKat === "Tümü" ? list : list.filter(a => (a.kategori || "Diğer") === aktifKat);
  const filteredList = urunArama
    ? kategoriliList.filter(a => a.ad.toLowerCase().includes(urunArama.toLowerCase()))
    : kategoriliList;

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Aksesuar</h1>
        {tab === "urunler" && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowKatYonet(!showKatYonet)} style={{ display: "flex", alignItems: "center", gap: 6 }}><Tag size={14} strokeWidth={2} /> Kategoriler</button>
            <button className="btn btn-primary btn-sm" onClick={yeniUrunAc}>+ Ekle</button>
          </div>
        )}
      </div>

      {/* Sekme */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${tab === "urunler" ? "active" : ""}`} onClick={() => setTab("urunler")}>Ürünler</button>
        <button className={`tab ${tab === "gecmis" ? "active" : ""}`} onClick={() => setTab("gecmis")}>Satış Geçmişi</button>
      </div>

      {tab === "urunler" ? (
        <>
          {/* Kategori Yönetimi */}
          {showKatYonet && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Kategorileri Yönet</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {kategoriler.map(k => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg2)", borderRadius: 20, padding: "4px 10px 4px 12px", fontSize: 13 }}>
                    {k}
                    <button onClick={() => removeKat(k)} style={{ border: "none", background: "none", color: "var(--danger)", cursor: "pointer", padding: "0 2px", fontSize: 14, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="form-input" style={{ flex: 1 }} placeholder="Yeni kategori adı" value={yeniKat} onChange={e => setYeniKat(e.target.value)} onKeyDown={e => e.key === "Enter" && addKat()} />
                <button className="btn btn-primary btn-sm" onClick={addKat}>Ekle</button>
              </div>
            </div>
          )}

          {/* Arama */}
          <div className="form-group" style={{ position: "relative", marginBottom: 10 }}>
            <input className="form-input" style={{ paddingLeft: 36 }} value={urunArama}
              onChange={e => setUrunArama(e.target.value)} placeholder="Ürün adı ara..." />
            <Search size={15} strokeWidth={2} stroke="var(--hint)"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          </div>

          {/* Kategori Filtre Chipsleri */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 10, scrollbarWidth: "none" }}>
            {["Tümü", ...kategoriler].map(k => (
              <button key={k} onClick={() => setAktifKat(k)}
                style={{
                  flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none",
                  background: aktifKat === k ? "var(--accent)" : "var(--bg2)",
                  color: aktifKat === k ? "#fff" : "var(--text)",
                  fontWeight: aktifKat === k ? 700 : 400, fontSize: 13, cursor: "pointer",
                }}>
                {k}
              </button>
            ))}
          </div>

          {/* Ürün Listesi — kartlar tıklanabilir, detay penceresi açar */}
          {filteredList.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>
              {urunArama ? "Aramayla eşleşen ürün yok" : aktifKat === "Tümü" ? "Aksesuar eklenmedi" : `${aktifKat} kategorisinde ürün yok`}
            </div>
          ) : filteredList.map(a => (
            <div key={a.id} className="card" style={{ cursor: "pointer" }} onClick={() => setDetayItem(a)}>
              <div className="card-row">
                <div>
                  <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginBottom: 2 }}>{a.kategori || "Diğer"}</div>
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <div onClick={e => e.stopPropagation()}>
                      <UrunGorsel url={a.gorsel_url} yukle={f => api.aksesuarGorselYukle(a.id, f)} boyut={38} />
                    </div>
                    {a.ad}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--hint)" }}>
                    Alış: {a.alis_fiyati} ₺ · Satış: {a.satis_fiyati} ₺
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: a.stok <= 5 ? "var(--danger)" : "var(--text)" }}>{a.stok} adet</div>
                  {a.stok <= 5 && <div style={{ fontSize: 11, color: "var(--danger)", display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}><TriangleAlert size={11} strokeWidth={2} /> Düşük</div>}
                </div>
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          {/* Satış Geçmişi */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-row">
              <span style={{ color: "var(--hint)" }}>Toplam ({satislar.length} satış)</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: "var(--success)" }}>{satisToplam.toLocaleString("tr-TR")} ₺</span>
            </div>
          </div>

          <div className="form-group" style={{ position: "relative", marginBottom: 10 }}>
            <input className="form-input" style={{ paddingLeft: 36 }} value={satisArama}
              onChange={e => setSatisArama(e.target.value)} placeholder="Ürün veya müşteri adı ara..." />
            <Search size={15} strokeWidth={2} stroke="var(--hint)"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <select className="form-select" style={{ flex: 1 }} value={satisSirala} onChange={e => setSatisSirala(e.target.value)}>
              <option value="yeni">En Yeni Önce</option>
              <option value="eski">En Eski Önce</option>
              <option value="tutar_yuksek">Tutar: Yüksekten Düşüğe</option>
              <option value="tutar_dusuk">Tutar: Düşükten Yükseğe</option>
            </select>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSatisFiltre(s => !s)}
              style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <Filter size={14} strokeWidth={2} /> Tarih{(satisBaslangic || satisBitis) ? " •" : ""}
            </button>
          </div>

          {showSatisFiltre && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Bu Tarihten İtibaren</label>
                  <input className="form-input" type="date" value={satisBaslangic} max={satisBitis || undefined}
                    onChange={e => setSatisBaslangic(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Bu Tarihe Kadar</label>
                  <input className="form-input" type="date" value={satisBitis} min={satisBaslangic || undefined}
                    onChange={e => setSatisBitis(e.target.value)} />
                </div>
              </div>
              {(satisBaslangic || satisBitis) && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
                  onClick={() => { setSatisBaslangic(""); setSatisBitis(""); }}>Tarihi Temizle</button>
              )}
            </div>
          )}

          {satisLoading ? (
            <div className="loading">Yükleniyor...</div>
          ) : satislar.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>
              {satisArama || satisBaslangic || satisBitis ? "Aramayla eşleşen satış yok" : "Henüz satış yok"}
            </div>
          ) : satislar.map(s => (
            <div key={s.id} className="card" style={{ cursor: "pointer" }} onClick={() => setSatisDetay(s)}>
              <div className="card-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{s.urun_adi || "Silinmiş ürün"}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)" }}>
                    {s.miktar} adet{s.musteri_adi ? ` · ${s.musteri_adi}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{tarihFmt(s.created_at)}</div>
                </div>
                <div style={{ fontWeight: 700, color: "var(--success)" }}>{s.toplam.toLocaleString("tr-TR")} ₺</div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Ürün Ekle/Düzenle Modalı */}
      {formModal && (
        <AltPencere onClose={() => setFormModal(null)}>
          <PencereBaslik onClose={() => setFormModal(null)}>{formModal.mode === "duzenle" ? "Ürünü Düzenle" : "Yeni Ürün"}</PencereBaslik>
          <form onSubmit={submit}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="form-select" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>
                {kategoriler.map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Ürün Adı *</label>
              <input className="form-input" required value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} placeholder="Örn: iPhone 15 Kılıf, 65W Şarj..." />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div className="form-group">
                <label className="form-label">Stok</label>
                <input className="form-input" type="number" min="0" value={form.stok} onChange={e => setForm({ ...form, stok: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Alış (₺)</label>
                <input className="form-input" type="number" required value={form.alis_fiyati} onChange={e => setForm({ ...form, alis_fiyati: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Satış (₺)</label>
                <input className="form-input" type="number" required value={form.satis_fiyati} onChange={e => setForm({ ...form, satis_fiyati: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">{formModal.mode === "duzenle" ? "Güncelle" : "Kaydet"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setFormModal(null)}>İptal</button>
            </div>
          </form>
        </AltPencere>
      )}

      {/* Ürün Detay Modalı */}
      {detayItem && (
        <UrunDetayModal item={detayItem} onClose={() => setDetayItem(null)}
          onSat={satAc} onDuzenle={duzenleAc}
          onSil={item => { setDetayItem(null); setDeleteId(item.id); }}
          canDelete={user?.rol === "patron"} />
      )}

      {/* Satış Formu */}
      {satForm && (
        <AltPencere onClose={() => setSatForm(null)}>
          <PencereBaslik onClose={() => setSatForm(null)}>Satış: {satForm.ad}</PencereBaslik>
          <form onSubmit={submitSat}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}
            <div className="form-group">
              <label className="form-label">Adet (max {satForm.stok})</label>
              <input className="form-input" type="number" min="1" max={satForm.stok} required value={satData.miktar} onChange={e => setSatData({ ...satData, miktar: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Müşteri Adı (opsiyonel)</label>
              <input className="form-input" value={satData.musteri_adi} onChange={e => setSatData({ ...satData, musteri_adi: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Müşteri Telefonu (opsiyonel — müşteri portalında görünmesi için)</label>
              <input className="form-input" type="tel" value={satData.musteri_telefon} onChange={e => setSatData({ ...satData, musteri_telefon: e.target.value })} />
            </div>
            <div style={{ fontSize: 13, color: "var(--success)", marginBottom: 8 }}>
              Toplam: {(parseInt(satData.miktar || 1) * (satForm.satis_fiyati || 0)).toLocaleString("tr-TR")} ₺
            </div>
            <OdemeBolustur toplam={parseInt(satData.miktar || 1) * (satForm.satis_fiyati || 0)} yon="gelir"
              value={satData.odemeler} onChange={v => setSatData(f => ({ ...f, odemeler: v }))}
              taksitSayi={satData.taksit_sayi} onTaksitSayiChange={v => setSatData(f => ({ ...f, taksit_sayi: v }))} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Sat</button>
              <button type="button" className="btn btn-ghost" onClick={() => setSatForm(null)}>İptal</button>
            </div>
          </form>
        </AltPencere>
      )}

      {/* Satış Detay Modalı */}
      {satisDetay && (
        <AltPencere onClose={() => setSatisDetay(null)} maxWidth={360}>
          <PencereBaslik onClose={() => setSatisDetay(null)}>{satisDetay.urun_adi || "Satış"}</PencereBaslik>
          <div style={{ fontWeight: 300, fontSize: 24, color: "var(--success)", letterSpacing: -0.5, marginBottom: 4 }}>
            {satisDetay.toplam.toLocaleString("tr-TR")}₺
          </div>
          <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 14 }}>{tarihFmt(satisDetay.created_at)}</div>
          <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "10px 12px", fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Package size={13} strokeWidth={2} stroke="var(--hint)" /> {satisDetay.kategori || "Diğer"} · {satisDetay.miktar} adet</div>
            {satisDetay.musteri_adi && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Headphones size={13} strokeWidth={2} stroke="var(--hint)" /> {satisDetay.musteri_adi}</div>}
            {satisDetay.musteri_telefon && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Phone size={13} strokeWidth={2} stroke="var(--hint)" /> {satisDetay.musteri_telefon}</div>}
          </div>
        </AltPencere>
      )}

      {/* Silme Onayı */}
      {deleteId && (
        <AltPencere onClose={() => setDeleteId(null)} maxWidth={340}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Ürünü sil</div>
          <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 16 }}>Bu ürün kalıcı olarak silinecek. Emin misin?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ background: "var(--danger)" }} onClick={() => deleteAksesuar(deleteId)}>Sil</button>
            <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>İptal</button>
          </div>
        </AltPencere>
      )}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
