import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, fotoUrl } from "../api";
import ImeiInput from "../components/ImeiInput";
import UrunGorsel from "../components/UrunGorsel";
import OdemeBolustur, { varsayilanOdemeSatirlari } from "../components/OdemeBolustur";
import {
  Store, Package, CheckCircle2, Search, CircleX, User, Smartphone,
  HardDrive, Cpu, Wrench, Trash2, Banknote, Phone, Radio, History,
  X, Inbox, Send, Clock, Printer, Ban, Camera, Pencil,
} from "lucide-react";
import UrunEtiketModal from "../components/UrunEtiketModal";

const AKSESUAR_ETIKETLERI = { kutu: "Kutu", sarj_aleti: "Şarj Aleti", kilif: "Kılıf", kulaklik: "Kulaklık" };

// 60 günden fazla stokta bekleyen cihaz "durgun" sayılır — dükkan sahibi
// fiyat indirimi/promosyon kararını buna göre verebilsin diye.
const DURGUN_ESIK_GUN = 60;
function gunSayisi(tarihStr) {
  if (!tarihStr) return 0;
  return Math.floor((Date.now() - new Date(tarihStr)) / 86400000);
}

const SIRALAMA_SECENEKLERI = [
  { key: "yeni", label: "En Yeni" },
  { key: "eski", label: "En Eski" },
  { key: "fiyat_yuksek", label: "Fiyat: Yüksek" },
  { key: "fiyat_dusuk", label: "Fiyat: Düşük" },
  { key: "durgun", label: "Durgun Önce" },
];

// Etiket bileşeni {id, ad, satis_fiyati, kategori, barkot} bekliyor — 2.El
// cihazın kendi alan adlarını buna çevirir. Fiyat sadece SATILDIĞINDA
// belli olduğu için stoktaki cihazlarda satis_fiyati boş kalabilir —
// EtiketIcerik bu durumda fiyat satırını atlar. Barkot olarak IMEI
// kullanılır (zaten benzersiz), yoksa id'den türetilir.
function cihazToItem(c) {
  return {
    id: c.id, ad: c.model, satis_fiyati: c.satis_fiyati || null,
    kategori: [c.renk, c.depolama].filter(Boolean).join(" · ") || null,
    barkot: c.imei || null,
  };
}

// IMEI geçmişi eskiden sadece ikinci_el içinde aranıyordu — aynı IMEI'nin
// Sıfır Cihaz veya Tamir'de de kaydı varsa (ör. iade/çalıntı bir cihazın
// başka bir modülden tekrar satılmaya çalışılması) hiç görünmüyordu.
function DigerEslesmeler({ diger }) {
  if (!diger || (diger.sifir_cihaz.length === 0 && diger.tamir.length === 0)) return null;
  return (
    <div style={{ background: "rgba(246,162,74,0.1)", border: "1px solid rgba(246,162,74,0.3)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--orange)", marginBottom: 4 }}>Diğer modüllerde de bulundu</div>
      {diger.sifir_cihaz.map(s => (
        <div key={"sifir" + s.id} style={{ fontSize: 12, color: "var(--text)" }}>
          Sıfır Cihaz: {s.model} · {s.durum === "satildi" ? "Satıldı" : "Stokta"} · {(s.created_at || "").slice(0, 10)}
        </div>
      ))}
      {diger.tamir.map((t, i) => (
        <div key={"tamir" + i} style={{ fontSize: 12, color: "var(--text)" }}>
          Tamir: #{t.repair_no} · {t.device_model} · {(t.created_at || "").slice(0, 10)}
        </div>
      ))}
    </div>
  );
}

export default function IkinciEl({ user }) {
  const navigate = useNavigate();
  const [priceHidden, setPriceHidden] = useState(() => localStorage.getItem("priceHidden") === "1");
  const [tab, setTab] = useState("stok");
  const [kaynak, setKaynak] = useState("hepsi");
  const [list, setList] = useState([]);
  const [satilanlar, setSatilanlar] = useState([]);
  const [ozet, setOzet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showMasraf, setShowMasraf] = useState(false);
  const [showSat, setShowSat] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [etiketModalItems, setEtiketModalItems] = useState(null);
  const [topluEtiketModal, setTopluEtiketModal] = useState(false);
  const [topluEtiketSecili, setTopluEtiketSecili] = useState(new Set());
  const [form, setForm] = useState({ model: "", imei: "", renk: "", depolama: "", ram: "", ozellikler: "", kimden: "", kimden_telefon: "", alis_fiyati: "", kaynak: "dukkan", notlar: "", aksesuarlar: {} });
  const [masrafForm, setMasrafForm] = useState({ aciklama: "", tutar: "", tarih: today() });
  const [satForm, setSatForm] = useState({ satis_fiyati: "", satis_kanali: "Dükkan", musteri_adi: "", musteri_telefon: "", odemeler: null, taksit_sayi: "1" });
  const [err, setErr] = useState("");
  const [musteriler, setMusteriler] = useState([]);
  const [kimdenOner, setKimdenOner] = useState([]);
  const [showKimdenOner, setShowKimdenOner] = useState(false);
  const [satMusteriOner, setSatMusteriOner] = useState([]);
  const [showSatMusteriOner, setShowSatMusteriOner] = useState(false);
  // Kara liste uyarısı — sayfada birden fazla alan (alış: kimden telefonu +
  // IMEI, satış: müşteri telefonu) aynı anda kontrol edilebildiği için her
  // birinin sonucu ayrı bir "kaynak" altında tutulup birleştiriliyor —
  // aksi halde biri boş dönünce diğerinin bulduğu eşleşmeyi silerdi.
  const [karaUyari, setKaraUyari] = useState([]);
  const karaTimers = useRef({});
  const karaSonuclar = useRef({});

  function karaBirlestir() {
    const map = new Map();
    Object.values(karaSonuclar.current).forEach(arr => (arr || []).forEach(k => map.set(k.id, k)));
    setKaraUyari(Array.from(map.values()));
  }

  function karaKontrolEt(kaynak, deger, minLen = 7) {
    clearTimeout(karaTimers.current[kaynak]);
    if (deger && deger.length >= minLen) {
      karaTimers.current[kaynak] = setTimeout(() => {
        api.karaListe(deger).then(r => { karaSonuclar.current[kaynak] = r || []; karaBirlestir(); }).catch(() => {});
      }, 600);
    } else {
      karaSonuclar.current[kaynak] = [];
      karaBirlestir();
    }
  }
  const [imeiSon4, setImeiSon4] = useState("");
  const [imeiGecmis, setImeiGecmis] = useState(null);
  const [imeiLoading, setImeiLoading] = useState(false);
  const [imeiModal, setImeiModal] = useState(null); // { imei, model }
  const [imeiModalData, setImeiModalData] = useState([]);
  const [imeiModalDiger, setImeiModalDiger] = useState({ sifir_cihaz: [], tamir: [] });
  const [imeiModalLoading, setImeiModalLoading] = useState(false);
  const [siralama, setSiralama] = useState("yeni");
  const [showDuzenle, setShowDuzenle] = useState(false);
  const [duzenleForm, setDuzenleForm] = useState(null);
  const [fotolar, setFotolar] = useState([]);
  const [fotoLoading, setFotoLoading] = useState(false);
  const fotoInputRef = useRef(null);

  useEffect(() => {
    load();
    api.customers("").then(setMusteriler).catch(() => {});
  }, []);

  async function load() {
    try {
      const [l, o, s] = await Promise.all([api.ikinciElList(), api.ikinciElOzet(), api.ikinciElSatilanlar()]);
      setList(l); setOzet(o); setSatilanlar(s);
    } finally { setLoading(false); }
  }

  function selectCihaz(c) {
    setSelected(c);
    setShowMasraf(false); setShowSat(false); setShowDuzenle(false);
    setDuzenleForm({
      model: c.model, imei: c.imei || "", renk: c.renk || "", depolama: c.depolama || "",
      ram: c.ram || "", ozellikler: c.ozellikler || "", kimden: c.kimden || "",
      kimden_telefon: c.kimden_telefon || "", alis_fiyati: c.alis_fiyati ?? "", notlar: c.notlar || "",
    });
    loadFotolar(c.id);
  }

  function closeSelected() {
    setSelected(null); setShowMasraf(false); setShowSat(false); setShowDuzenle(false); setFotolar([]);
  }

  async function loadFotolar(id) {
    setFotoLoading(true);
    try { setFotolar(await api.ikinciElFotolar(id)); } catch { setFotolar([]); }
    finally { setFotoLoading(false); }
  }

  async function addFoto(e) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await api.addIkinciElFoto(selected.id, { foto: ev.target.result, aciklama: "" });
        setFotolar(await api.ikinciElFotolar(selected.id));
      } catch (_) {}
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function deleteFoto(fotoId) {
    try {
      await api.deleteIkinciElFoto(selected.id, fotoId);
      setFotolar(await api.ikinciElFotolar(selected.id));
    } catch (_) {}
  }

  async function submitDuzenle(e) {
    e.preventDefault(); setErr("");
    try {
      await api.updateIkinciEl(selected.id, { ...duzenleForm, alis_fiyati: parseFloat(duzenleForm.alis_fiyati) });
      setShowDuzenle(false);
      const [l, o, s] = await Promise.all([api.ikinciElList(), api.ikinciElOzet(), api.ikinciElSatilanlar()]);
      setList(l); setOzet(o); setSatilanlar(s);
      const updated = l.find(x => x.id === selected.id);
      if (updated) setSelected(updated);
    } catch (e) { setErr(e.message); }
  }

  function handleSatMusteriChange(val) {
    setSatForm(f => ({ ...f, musteri_adi: val }));
    if (val.length >= 2) {
      const found = musteriler.filter(m =>
        m.name.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setSatMusteriOner(found);
      setShowSatMusteriOner(found.length > 0);
    } else {
      setShowSatMusteriOner(false);
    }
  }

  function handleKimdenChange(val) {
    setForm(f => ({ ...f, kimden: val }));
    if (val.length >= 2) {
      const found = musteriler.filter(m =>
        m.name.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setKimdenOner(found);
      setShowKimdenOner(found.length > 0);
    } else {
      setShowKimdenOner(false);
    }
  }

  async function submitAlim(e) {
    e.preventDefault(); setErr("");
    try {
      await api.createIkinciEl({ ...form, alis_fiyati: parseFloat(form.alis_fiyati) });
      setShowForm(false);
      setForm({ model: "", imei: "", renk: "", depolama: "", ram: "", ozellikler: "", kimden: "", kimden_telefon: "", alis_fiyati: "", kaynak: "dukkan", notlar: "", aksesuarlar: {} });
      karaSonuclar.current = {}; setKaraUyari([]);
      load();
    } catch (e) { setErr(e.message); }
  }

  async function submitMasraf(e) {
    e.preventDefault(); setErr("");
    try {
      await api.ikinciElMasraf(selected.id, { ...masrafForm, tutar: parseFloat(masrafForm.tutar) });
      setShowMasraf(false);
      setMasrafForm({ aciklama: "", tutar: "", tarih: today() });
      const [l, o, s] = await Promise.all([api.ikinciElList(), api.ikinciElOzet(), api.ikinciElSatilanlar()]);
      setList(l); setOzet(o); setSatilanlar(s);
      // Seçili cihazı güncelle (yeni masraflarla)
      const updated = l.find(x => x.id === selected.id);
      if (updated) setSelected(updated);
    } catch (e) { setErr(e.message); }
  }

  async function deleteCihaz(id) {
    try {
      await api.deleteIkinciEl(id);
      setDeleteId(null);
      setSelected(null);
      load();
    } catch (e) { setErr(e.message); }
  }

  async function submitSat(e) {
    e.preventDefault(); setErr("");
    try {
      const satisFiyati = parseFloat(satForm.satis_fiyati) || 0;
      await api.ikinciElSat(selected.id, {
        ...satForm,
        satis_fiyati: satisFiyati,
        odemeler: (satForm.odemeler || varsayilanOdemeSatirlari(satisFiyati)).filter(o => parseFloat(o.tutar) > 0),
        taksit_sayi: satForm.taksit_sayi ? parseInt(satForm.taksit_sayi) : 1,
      });
      setShowSat(false); setSelected(null);
      setSatForm({ satis_fiyati: "", satis_kanali: "Dükkan", musteri_adi: "", musteri_telefon: "", odemeler: null, taksit_sayi: "1" });
      karaSonuclar.current = {}; setKaraUyari([]);
      load();
    } catch (e) { setErr(e.message); }
  }

  async function openImeiModal(imei, model) {
    setImeiModal({ imei, model });
    setImeiModalLoading(true);
    setImeiModalData([]);
    setImeiModalDiger({ sifir_cihaz: [], tamir: [] });
    try {
      const data = await api.ikinciElIMEITam(imei);
      setImeiModalData(data.ikinci_el || []);
      setImeiModalDiger({ sifir_cihaz: data.sifir_cihaz || [], tamir: data.tamir || [] });
    } catch { setImeiModalData([]); }
    finally { setImeiModalLoading(false); }
  }

  async function searchIMEI() {
    if (imeiSon4.length < 4) return;
    setImeiLoading(true); setImeiGecmis(null);
    setImeiModalDiger({ sifir_cihaz: [], tamir: [] });
    try {
      const data = await api.ikinciElIMEI(imeiSon4);
      setImeiGecmis(data.ikinci_el || []);
      setImeiModalDiger({ sifir_cihaz: data.sifir_cihaz || [], tamir: data.tamir || [] });
    } catch { setImeiGecmis([]); }
    finally { setImeiLoading(false); }
  }

  const filteredList = kaynak === "hepsi" ? list : list.filter(c => (c.kaynak || "dukkan") === kaynak);
  const filteredSatilanlar = kaynak === "hepsi" ? satilanlar : satilanlar.filter(c => (c.kaynak || "dukkan") === kaynak);
  const sortedList = [...filteredList].sort((a, b) => {
    const maliyet = (c) => (c.alis_fiyati || 0) + (c.toplam_masraf || 0);
    if (siralama === "eski") return new Date(a.created_at) - new Date(b.created_at);
    if (siralama === "fiyat_yuksek") return maliyet(b) - maliyet(a);
    if (siralama === "fiyat_dusuk") return maliyet(a) - maliyet(b);
    if (siralama === "durgun") return gunSayisi(b.created_at) - gunSayisi(a.created_at);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0, flex: 1 }}>2. El Cihaz</h1>
        {tab === "stok" && (
          <button className="btn btn-ghost btn-sm" title="Toplu Etiket Yazdır"
            onClick={() => { setTopluEtiketSecili(new Set()); setTopluEtiketModal(true); }}>
            <Printer size={14} strokeWidth={2.4} />
          </button>
        )}
        {tab === "stok" && <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Alım</button>}
      </div>

      {ozet && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div className="card" style={{ textAlign: "center", margin: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{ozet.stokta_adet ?? 0}</div>
            <div style={{ fontSize: 11, color: "var(--hint)" }}>Stokta</div>
          </div>
          <div className="card" style={{ textAlign: "center", margin: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--success)" }}>{(ozet.net_kar || 0).toLocaleString("tr-TR")}₺</div>
            <div style={{ fontSize: 11, color: "var(--hint)" }}>Toplam Kâr</div>
          </div>
          <div className="card" style={{ textAlign: "center", margin: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{ozet.satilan_adet}</div>
            <div style={{ fontSize: 11, color: "var(--hint)" }}>Satılan</div>
          </div>
        </div>
      )}

      {/* Kaynak filtresi */}
      <div className="card-row" style={{ marginBottom: 8, gap: 8 }}>
        <div className="tabs" style={{ flex: 1, margin: 0 }}>
          {[
            { key: "hepsi", label: "Hepsi", icon: null },
            { key: "dukkan", label: "Dükkan", icon: Store },
            { key: "getmobile", label: "Getmobil", icon: Package },
          ].map(k => (
            <button key={k.key} className={`tab ${kaynak === k.key ? "active" : ""}`}
              onClick={() => setKaynak(k.key)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {k.icon && <k.icon size={13} strokeWidth={2} />}{k.label}
            </button>
          ))}
        </div>
        {tab === "stok" && (
          <select className="form-select" value={siralama} onChange={e => setSiralama(e.target.value)}
            style={{ width: "auto", fontSize: 12, padding: "6px 8px", flexShrink: 0 }}>
            {SIRALAMA_SECENEKLERI.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        )}
      </div>

      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${tab === "stok" ? "active" : ""}`} onClick={() => setTab("stok")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Package size={13} strokeWidth={2} /> Stok
        </button>
        <button className={`tab ${tab === "satilanlar" ? "active" : ""}`} onClick={() => setTab("satilanlar")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={13} strokeWidth={2} /> Satılanlar ({filteredSatilanlar.length})
        </button>
        <button className={`tab ${tab === "imei" ? "active" : ""}`} onClick={() => setTab("imei")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Search size={13} strokeWidth={2} /> IMEI
        </button>
      </div>

      {tab === "stok" && (
        <>
          {showForm && (
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Yeni Alım</div>
              <form onSubmit={submitAlim}>
                {err && <div style={{ color: "var(--red)", fontSize: 13, padding: "8px 0", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}
                <div className="form-group">
                  <label className="form-label">Model *</label>
                  <input className="form-input" required value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="iPhone 13, Samsung A54..." />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Renk</label>
                    <input className="form-input" value={form.renk} onChange={e => setForm({ ...form, renk: e.target.value })} placeholder="Siyah, Beyaz..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hafıza</label>
                    <input className="form-input" value={form.depolama} onChange={e => setForm({ ...form, depolama: e.target.value })} placeholder="128GB, 256GB..." />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">RAM</label>
                    <input className="form-input" value={form.ram} onChange={e => setForm({ ...form, ram: e.target.value })} placeholder="6GB, 8GB..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Özellikler</label>
                    <input className="form-input" value={form.ozellikler} onChange={e => setForm({ ...form, ozellikler: e.target.value })} placeholder="Hasar, batarya..." />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Gelen Aksesuarlar</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Object.entries(AKSESUAR_ETIKETLERI).map(([key, label]) => {
                      const secili = !!form.aksesuarlar[key];
                      return (
                        <button key={key} type="button"
                          onClick={() => setForm(f => ({ ...f, aksesuarlar: { ...f.aksesuarlar, [key]: !secili } }))}
                          style={{
                            padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                            cursor: "pointer",
                            border: `1px solid ${secili ? "var(--accent)" : "var(--border)"}`,
                            background: secili ? "rgba(94,168,255,0.12)" : "transparent",
                            color: secili ? "var(--accent)" : "var(--hint)",
                          }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">IMEI</label>
                  <ImeiInput
                    value={form.imei}
                    onChange={v => { setForm({ ...form, imei: v }); karaKontrolEt("alis_imei", v, 8); }}
                    placeholder="15 haneli veya kamerayla okut"
                  />
                </div>
                <div className="form-group" style={{ position: "relative" }}>
                  <label className="form-label">Kimden (Ad Soyad) *</label>
                  <input className="form-input" required value={form.kimden}
                    onChange={e => handleKimdenChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowKimdenOner(false), 150)}
                    placeholder="Kişi/firma adı" autoComplete="off" />
                  {showKimdenOner && (
                    <div className="ac-dropdown">
                      {kimdenOner.map(m => (
                        <div key={m.id}
                          onMouseDown={() => { setForm(f => ({ ...f, kimden: m.name, kimden_telefon: m.phone || f.kimden_telefon })); setShowKimdenOner(false); if (m.phone) karaKontrolEt("alis_tel", m.phone); }}
                          style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14,
                            borderBottom: "1px solid var(--divider)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><User size={13} strokeWidth={2} /> {m.name}</span>
                          {m.phone && <span style={{ fontSize: 12, color: "var(--hint)" }}>{m.phone}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Kimden (Telefon) *</label>
                  <input className="form-input" required inputMode="tel" value={form.kimden_telefon}
                    onChange={e => { setForm(f => ({ ...f, kimden_telefon: e.target.value })); karaKontrolEt("alis_tel", e.target.value); }}
                    placeholder="0555..." />
                  {form.kimden && form.kimden_telefon && (
                    <div style={{ fontSize: 11, color: "var(--success)", marginTop: 3 }}>✓ Müşteri listesine otomatik eklenecek</div>
                  )}
                  {karaUyari.length > 0 && (
                    <div style={{ background: "rgba(239,68,68,0.12)", borderRadius: 8, padding: "8px 12px", marginTop: 8, borderLeft: "3px solid #ef4444" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}><Ban size={14} strokeWidth={2} /> Kara Listede!</div>
                      {karaUyari.map(k => (
                        <div key={k.id} style={{ fontSize: 12, color: "var(--text)", marginTop: 2 }}>{k.ad}{k.sebep ? ` — ${k.sebep}` : ""}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Kaynak</label>
                  <select className="form-select" value={form.kaynak} onChange={e => setForm({ ...form, kaynak: e.target.value })}>
                    <option value="dukkan">Dükkan</option>
                    <option value="getmobile">Getmobil</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Alış Fiyatı (₺) *</label>
                  <input className="form-input" type="number" required value={form.alis_fiyati} onChange={e => setForm({ ...form, alis_fiyati: e.target.value })} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Not</label>
                  <input className="form-input" value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn btn-primary">Kaydet</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
                </div>
              </form>
            </div>
          )}

          {filteredList.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Stokta 2. el cihaz yok</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {sortedList.map(c => {
                const gun = gunSayisi(c.created_at);
                const durgun = gun >= DURGUN_ESIK_GUN;
                const maliyet = (c.alis_fiyati || 0) + (c.toplam_masraf || 0);
                return (
                  <div key={c.id} className="card" style={{ padding: 0, overflow: "hidden", cursor: "pointer", margin: 0 }}
                    onClick={() => selectCihaz(c)}>
                    <div style={{ position: "relative", aspectRatio: "1 / 1" }}>
                      <UrunGorsel url={c.gorsel_url} yukle={f => api.ikinciElGorselYukle(c.id, f)} boyut="100%" />
                      {durgun && (
                        <span style={{
                          position: "absolute", top: 6, left: 6, fontSize: 10, fontWeight: 700,
                          padding: "2px 7px", borderRadius: 20, background: "rgba(239,68,68,0.9)", color: "#fff",
                          display: "flex", alignItems: "center", gap: 3,
                        }}><Clock size={9} strokeWidth={2.5} /> {gun}g</span>
                      )}
                      {c.kaynak === "getmobile" && (
                        <span style={{
                          position: "absolute", top: 6, right: 6, fontSize: 10, fontWeight: 700,
                          padding: "2px 7px", borderRadius: 20, background: "rgba(94,168,255,0.9)", color: "#fff",
                        }}>Getmobil</span>
                      )}
                    </div>
                    <div style={{ padding: "8px 10px 10px" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.model}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--hint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                        {[c.renk, c.depolama].filter(Boolean).join(" · ") || " "}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginTop: 5 }}>
                        {priceHidden ? "••••" : maliyet.toLocaleString("tr-TR") + " ₺"}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--hint)" }}>maliyet</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "satilanlar" && (
        <>
          {filteredSatilanlar.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Henüz satılan cihaz yok</div>
          ) : filteredSatilanlar.map(c => {
            const satMasraflar = c.masraflar || [];
            return (
            <div key={c.id} className="card">
              <div className="card-row" style={{ marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 7 }}>
                  <Smartphone size={16} strokeWidth={2} /> {c.model}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: ((c.satis_fiyati || 0) - (c.alis_fiyati || 0) - (c.toplam_masraf || 0)) >= 0 ? "var(--success)" : "var(--red)" }}>
                    {priceHidden ? "••••" : (c.satis_fiyati || 0).toLocaleString("tr-TR") + " ₺"}
                  </div>
                  <div style={{ fontSize: 12, color: ((c.satis_fiyati || 0) - (c.alis_fiyati || 0) - (c.toplam_masraf || 0)) >= 0 ? "var(--success)" : "var(--red)" }}>
                    Kâr: {((c.satis_fiyati || 0) - (c.alis_fiyati || 0) - (c.toplam_masraf || 0)).toLocaleString("tr-TR")} ₺
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                {c.renk && <Chip>{c.renk}</Chip>}
                {c.depolama && <Chip icon={HardDrive}>{c.depolama}</Chip>}
                {c.ram && <Chip icon={Cpu}>{c.ram}</Chip>}
              </div>
              <div style={{ fontSize: 12, color: "var(--hint)", display: "flex", gap: 10, flexWrap: "wrap", marginBottom: satMasraflar.length > 0 ? 8 : 0 }}>
                {c.musteri_adi && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><User size={11} strokeWidth={2} /> {c.musteri_adi}</span>}
                {c.musteri_telefon && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={11} strokeWidth={2} /> {c.musteri_telefon}</span>}
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Radio size={11} strokeWidth={2} /> {c.satis_kanali || "Dükkan"}</span>
                <span>{c.satis_tarihi || "—"}</span>
                {c.imei && (
                  <span
                    onClick={e => { e.stopPropagation(); openImeiModal(c.imei, c.model); }}
                    style={{ cursor: "pointer", color: "var(--primary)", fontWeight: 600, textDecoration: "underline", display: "flex", alignItems: "center", gap: 4 }}
                  ><History size={11} strokeWidth={2} /> IMEI Geçmişi</span>
                )}
              </div>
              {/* Masraflar */}
              {satMasraflar.length > 0 && (
                <div style={{ borderTop: "1px solid var(--divider)", paddingTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--hint)", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
                    <Wrench size={11} strokeWidth={2} /> MASRAFLAR · toplam {(c.toplam_masraf || 0).toLocaleString("tr-TR")}₺
                  </div>
                  {satMasraflar.map(m => (
                    <div key={m.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      fontSize: 13, padding: "4px 0",
                      borderBottom: "1px solid var(--divider)",
                    }}>
                      <div>
                        <span style={{ fontWeight: 500 }}>{m.aciklama}</span>
                        <span style={{ fontSize: 11, color: "var(--hint)", marginLeft: 6 }}>{m.tarih || "—"}</span>
                      </div>
                      <span style={{ fontWeight: 700 }}>₺{(m.tutar || 0).toLocaleString("tr-TR")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )})}
        </>
      )}

      {/* IMEI Geçmiş Modalı */}
      {imeiModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={() => setImeiModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--card)", borderRadius: 18,
            width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto",
            padding: "20px 16px 32px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 7 }}>
                  <Smartphone size={16} strokeWidth={2} /> {imeiModal.model}
                </div>
                <div style={{ fontSize: 12, color: "var(--hint)" }}>IMEI: {imeiModal.imei}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setImeiModal(null)}><X size={15} strokeWidth={2} /></button>
            </div>

            <DigerEslesmeler diger={imeiModalDiger} />

            {imeiModalLoading ? (
              <div style={{ textAlign: "center", padding: 20, color: "var(--hint)" }}>Yükleniyor...</div>
            ) : imeiModalData.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "var(--hint)" }}>Kayıt bulunamadı</div>
            ) : (() => {
              const toplam_kar = imeiModalData
                .filter(r => r.durum === "satildi")
                .reduce((s, r) => s + (r.satis_fiyati || 0) - (r.alis_fiyati || 0) - (r.toplam_masraf || 0), 0);
              return (
                <>
                  {/* Toplam kâr kutusu */}
                  {imeiModalData.length > 1 && (
                    <div style={{
                      background: toplam_kar >= 0 ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.1)",
                      borderRadius: 10, padding: "10px 14px", marginBottom: 14,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <span style={{ fontWeight: 600 }}>{imeiModalData.filter(r => r.durum === "satildi").length} kez satıldı</span>
                      <span style={{ fontWeight: 700, color: toplam_kar >= 0 ? "var(--success)" : "var(--red)" }}>
                        Toplam Kâr: ₺{toplam_kar.toLocaleString("tr-TR")}
                      </span>
                    </div>
                  )}

                  {/* Her döngü */}
                  {imeiModalData.map((r, i) => {
                    const kar = (r.satis_fiyati || 0) - (r.alis_fiyati || 0) - (r.toplam_masraf || 0);
                    return (
                      <div key={r.id} style={{
                        border: "1px solid var(--divider)", borderRadius: 12,
                        marginBottom: 10, overflow: "hidden",
                      }}>
                        {/* Başlık */}
                        <div style={{ background: "var(--bg2)", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "var(--hint)" }}>
                          {i + 1}. Döngü
                        </div>
                        {/* Alış satırı */}
                        <div style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Inbox size={13} strokeWidth={2} /> Alındı</div>
                            <div style={{ fontSize: 12, color: "var(--hint)" }}>
                              {r.kimden || "—"} {r.kimden_telefon ? `· ${r.kimden_telefon}` : ""}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--hint)" }}>{r.alis_tarihi || r.created_at?.slice(0,10) || "—"}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 700 }}>₺{(r.alis_fiyati || 0).toLocaleString("tr-TR")}</div>
                            {(r.toplam_masraf || 0) > 0 && (
                              <div style={{ fontSize: 11, color: "var(--red)" }}>+₺{r.toplam_masraf.toLocaleString("tr-TR")} masraf</div>
                            )}
                          </div>
                        </div>
                        {/* Masraflar */}
                        {r.masraflar?.length > 0 && (
                          <div style={{ padding: "0 12px 8px", borderTop: "1px dashed var(--divider)" }}>
                            {r.masraflar.map(m => (
                              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", color: "var(--hint)" }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Wrench size={10} strokeWidth={2} /> {m.aciklama}</span>
                                <span>₺{(m.tutar||0).toLocaleString("tr-TR")}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Satış satırı */}
                        {r.durum === "satildi" ? (
                          <div style={{
                            padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center",
                            borderTop: "1px solid var(--divider)",
                            background: kar >= 0 ? "rgba(74,222,128,0.05)" : "rgba(248,113,113,0.05)",
                          }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Send size={13} strokeWidth={2} /> Satıldı</div>
                              <div style={{ fontSize: 12, color: "var(--hint)" }}>
                                {r.musteri_adi || "—"} {r.musteri_telefon ? `· ${r.musteri_telefon}` : ""}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--hint)" }}>{r.satis_tarihi || "—"} · {r.satis_kanali || "Dükkan"}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 700 }}>₺{(r.satis_fiyati || 0).toLocaleString("tr-TR")}</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: kar >= 0 ? "var(--success)" : "var(--red)" }}>
                                {kar >= 0 ? "+" : ""}₺{kar.toLocaleString("tr-TR")} kâr
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--divider)", color: "var(--hint)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                            <Clock size={13} strokeWidth={2} /> Hâlâ stokta
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Cihaz Detay Modalı — kart tasarımına geçince eski satır-içi açılan
          panel yerine tek bir modal kullanılıyor; düzenleme formu ve
          fotoğraf galerisi de buraya eklendi. */}
      {selected && (() => {
        const c = selected;
        const cMasraflar = c.masraflar || [];
        const gun = gunSayisi(c.created_at);
        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }} onClick={closeSelected}>
            <div className="card" style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto" }}
              onClick={e => e.stopPropagation()}>
              <div className="card-row" style={{ marginBottom: 10, alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <UrunGorsel url={c.gorsel_url} yukle={f => api.ikinciElGorselYukle(c.id, f)} boyut={46} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.model}</div>
                    {gun >= DURGUN_ESIK_GUN && (
                      <div style={{ fontSize: 11, color: "var(--red)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={10} strokeWidth={2.5} /> {gun} gündür stokta
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" title="Düzenle"
                    onClick={() => { setShowDuzenle(v => !v); setShowMasraf(false); setShowSat(false); }}>
                    <Pencil size={14} strokeWidth={2} />
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={closeSelected}><X size={15} strokeWidth={2} /></button>
                </div>
              </div>

              {err && <div style={{ color: "var(--red)", fontSize: 13, padding: "4px 0 10px", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}

              {showDuzenle ? (
                <form onSubmit={submitDuzenle} style={{ marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Model *</label>
                    <input className="form-input" required value={duzenleForm.model} onChange={e => setDuzenleForm(f => ({ ...f, model: e.target.value }))} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Renk</label>
                      <input className="form-input" value={duzenleForm.renk} onChange={e => setDuzenleForm(f => ({ ...f, renk: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Hafıza</label>
                      <input className="form-input" value={duzenleForm.depolama} onChange={e => setDuzenleForm(f => ({ ...f, depolama: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">RAM</label>
                      <input className="form-input" value={duzenleForm.ram} onChange={e => setDuzenleForm(f => ({ ...f, ram: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Özellikler</label>
                      <input className="form-input" value={duzenleForm.ozellikler} onChange={e => setDuzenleForm(f => ({ ...f, ozellikler: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">IMEI</label>
                    <input className="form-input" value={duzenleForm.imei} onChange={e => setDuzenleForm(f => ({ ...f, imei: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kimden</label>
                    <input className="form-input" value={duzenleForm.kimden} onChange={e => setDuzenleForm(f => ({ ...f, kimden: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kimden Telefon</label>
                    <input className="form-input" value={duzenleForm.kimden_telefon} onChange={e => setDuzenleForm(f => ({ ...f, kimden_telefon: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alış Fiyatı (₺) *</label>
                    <input className="form-input" type="number" required value={duzenleForm.alis_fiyati} onChange={e => setDuzenleForm(f => ({ ...f, alis_fiyati: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Not</label>
                    <input className="form-input" value={duzenleForm.notlar} onChange={e => setDuzenleForm(f => ({ ...f, notlar: e.target.value }))} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" className="btn btn-primary btn-sm">Kaydet</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDuzenle(false)}>İptal</button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                    {c.renk && <Chip>{c.renk}</Chip>}
                    {c.depolama && <Chip icon={HardDrive}>{c.depolama}</Chip>}
                    {c.ram && <Chip icon={Cpu}>{c.ram}</Chip>}
                    {c.ozellikler && <Chip color="orange">{c.ozellikler}</Chip>}
                    {c.kaynak === "getmobile" && <Chip color="blue" icon={Package}>Getmobil</Chip>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--hint)", display: "flex", flexDirection: "column", gap: 3, marginBottom: 12 }}>
                    {c.imei && (
                      <span onClick={() => openImeiModal(c.imei, c.model)}
                        style={{ cursor: "pointer", color: "var(--primary)", fontWeight: 600, textDecoration: "underline", display: "flex", alignItems: "center", gap: 4, width: "fit-content" }}>
                        <History size={11} strokeWidth={2} /> IMEI: {c.imei}
                      </span>
                    )}
                    {c.kimden && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><User size={11} strokeWidth={2} /> {c.kimden}{c.kimden_telefon ? ` · ${c.kimden_telefon}` : ""}</span>}
                    {c.alis_tarihi && <span>Alış: {c.alis_tarihi}</span>}
                  </div>
                </>
              )}

              {/* Ek Fotoğraflar galerisi */}
              <div style={{ marginBottom: 14, borderTop: "1px solid var(--divider)", paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--hint)", display: "flex", alignItems: "center", gap: 5 }}>
                    <Camera size={12} strokeWidth={2} /> Ek Fotoğraflar ({fotolar.length})
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => fotoInputRef.current?.click()}>+ Ekle</button>
                </div>
                <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={addFoto} />
                {fotoLoading ? (
                  <div style={{ fontSize: 12, color: "var(--hint)" }}>Yükleniyor...</div>
                ) : fotolar.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    {fotolar.map(f => (
                      <div key={f.id} style={{ position: "relative" }}>
                        <img src={fotoUrl(f.foto)} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }} />
                        <button onClick={() => deleteFoto(f.id)} title="Sil"
                          style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                          <X size={10} strokeWidth={3} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Masraf listesi */}
              {cMasraflar.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--hint)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Wrench size={12} strokeWidth={2} /> Masraflar (toplam: {(c.toplam_masraf || 0).toLocaleString("tr-TR")}₺)
                  </div>
                  {cMasraflar.map(m => (
                    <div key={m.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      fontSize: 13, padding: "6px 0",
                      borderBottom: "1px solid var(--divider)",
                    }}>
                      <div>
                        <div>{m.aciklama}</div>
                        <div style={{ fontSize: 11, color: "var(--hint)" }}>{m.tarih || "—"}</div>
                      </div>
                      <span style={{ fontWeight: 700 }}>₺{(m.tutar || 0).toLocaleString("tr-TR")}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowMasraf(true); setShowSat(false); setShowDuzenle(false); }}>+ Masraf</button>
                <button className="btn btn-primary btn-sm" onClick={() => { setShowSat(true); setShowMasraf(false); setShowDuzenle(false); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Banknote size={13} strokeWidth={2} /> Sat
                </button>
                <button className="btn btn-ghost btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}
                  onClick={() => setEtiketModalItems([cihazToItem(c)])}>
                  <Printer size={13} strokeWidth={2} /> Etiket Yazdır
                </button>
                {user?.rol === "patron" && (
                  deleteId === c.id ? (
                    <>
                      <button className="btn btn-sm" style={{ background: "var(--red)", color: "#191b20", padding: "4px 12px", fontSize: 13 }}
                        onClick={() => deleteCihaz(c.id)}>Sil</button>
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => setDeleteId(null)}>İptal</button>
                    </>
                  ) : (
                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)", display: "flex", alignItems: "center", gap: 6 }}
                      onClick={() => setDeleteId(c.id)}><Trash2 size={13} strokeWidth={2} /> Sil</button>
                  )
                )}
              </div>
              {showMasraf && (
                <form onSubmit={submitMasraf} style={{ marginTop: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Masraf Açıklaması</label>
                    <input className="form-input" required value={masrafForm.aciklama} onChange={e => setMasrafForm({ ...masrafForm, aciklama: e.target.value })} placeholder="Ekran, temizlik, batarya..." />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div className="form-group">
                      <label className="form-label">Tutar (₺)</label>
                      <input className="form-input" type="number" required value={masrafForm.tutar} onChange={e => setMasrafForm({ ...masrafForm, tutar: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tarih</label>
                      <input className="form-input" type="date" value={masrafForm.tarih} onChange={e => setMasrafForm({ ...masrafForm, tarih: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" className="btn btn-primary btn-sm">Kaydet</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMasraf(false)}>İptal</button>
                  </div>
                </form>
              )}
              {showSat && (
                <form onSubmit={submitSat} style={{ marginTop: 10 }}>
                  <div className="form-group" style={{ position: "relative" }}>
                    <label className="form-label">Müşteri Adı *</label>
                    <input className="form-input" required value={satForm.musteri_adi}
                      onChange={e => handleSatMusteriChange(e.target.value)}
                      onBlur={() => setTimeout(() => setShowSatMusteriOner(false), 150)}
                      placeholder="Ad Soyad" autoComplete="off" />
                    {showSatMusteriOner && (
                      <div className="ac-dropdown">
                        {satMusteriOner.map(m => (
                          <div key={m.id}
                            onMouseDown={() => { setSatForm(f => ({ ...f, musteri_adi: m.name, musteri_telefon: m.phone || f.musteri_telefon })); setShowSatMusteriOner(false); if (m.phone) karaKontrolEt("satis_tel", m.phone); }}
                            style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14,
                              borderBottom: "1px solid var(--divider)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><User size={13} strokeWidth={2} /> {m.name}</span>
                            {m.phone && <span style={{ fontSize: 12, color: "var(--hint)" }}>{m.phone}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Müşteri Telefonu *</label>
                    <input className="form-input" required inputMode="tel" value={satForm.musteri_telefon}
                      onChange={e => { setSatForm(f => ({ ...f, musteri_telefon: e.target.value })); karaKontrolEt("satis_tel", e.target.value); }}
                      placeholder="0555..." />
                    {satForm.musteri_adi && satForm.musteri_telefon && (
                      <div style={{ fontSize: 11, color: "var(--success)", marginTop: 3 }}>✓ Müşteri listesine otomatik eklenecek</div>
                    )}
                    {karaUyari.length > 0 && (
                      <div style={{ background: "rgba(239,68,68,0.12)", borderRadius: 8, padding: "8px 12px", marginTop: 8, borderLeft: "3px solid #ef4444" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}><Ban size={14} strokeWidth={2} /> Kara Listede!</div>
                        {karaUyari.map(k => (
                          <div key={k.id} style={{ fontSize: 12, color: "var(--text)", marginTop: 2 }}>
                            {k.ad}{k.sebep ? ` — ${k.sebep}` : ""}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Satış Fiyatı (₺)</label>
                    <input className="form-input" type="number" required value={satForm.satis_fiyati} onChange={e => setSatForm({ ...satForm, satis_fiyati: e.target.value })} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Kanal</label>
                      <select className="form-select" value={satForm.satis_kanali} onChange={e => setSatForm({ ...satForm, satis_kanali: e.target.value })}>
                        {["Dükkan", "Getmobil", "Instagram", "Sahibinden", "Diğer"].map(k => <option key={k}>{k}</option>)}
                      </select>
                    </div>
                  </div>
                  <OdemeBolustur toplam={parseFloat(satForm.satis_fiyati) || 0} yon="gelir"
                    value={satForm.odemeler} onChange={v => setSatForm(f => ({ ...f, odemeler: v }))}
                    taksitSayi={satForm.taksit_sayi} onTaksitSayiChange={v => setSatForm(f => ({ ...f, taksit_sayi: v }))} />
                  {satForm.satis_fiyati && (
                    <div style={{ fontSize: 13, color: "var(--success)", marginBottom: 8, fontWeight: 600 }}>
                      Kâr: {(parseFloat(satForm.satis_fiyati) - (c.alis_fiyati || 0) - (c.toplam_masraf || 0)).toLocaleString("tr-TR")} ₺
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" className="btn btn-primary btn-sm">Sat</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSat(false)}>İptal</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {tab === "imei" && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>IMEI Son 4 Hane ile Sorgula</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input className="form-input" style={{ flex: 1 }}
              placeholder="Son 4 hane (örn: 1234)"
              maxLength={4}
              inputMode="numeric"
              value={imeiSon4}
              onChange={e => setImeiSon4(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && searchIMEI()} />
            <button className="btn btn-primary btn-sm" onClick={searchIMEI} disabled={imeiSon4.length < 4 || imeiLoading}>
              {imeiLoading ? "..." : "Ara"}
            </button>
          </div>
          {imeiGecmis !== null && <DigerEslesmeler diger={imeiModalDiger} />}
          {imeiGecmis === null ? (
            <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center" }}>IMEI son 4 hanesini girin</div>
          ) : imeiGecmis.length === 0 ? (
            <div className="empty"><div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><Search size={40} stroke="var(--dim)" strokeWidth={1.5} /></div>Kayıt bulunamadı</div>
          ) : imeiGecmis.map(c => (
            <div key={c.id} className="card">
              <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}><Smartphone size={15} strokeWidth={2} /> {c.model}</div>
              <div style={{ fontSize: 12, color: "var(--hint)" }}>IMEI: {c.imei}</div>
              {c.kimden && <div style={{ fontSize: 12, color: "var(--hint)" }}>Kimden: {c.kimden}</div>}
              <div style={{ fontSize: 12, color: "var(--hint)" }}>
                Alış: ₺{c.alis_fiyati} · {c.alis_tarihi || "—"}
              </div>
              {c.satis_fiyati && (
                <div style={{ fontSize: 12, color: "var(--success)" }}>
                  Satış: ₺{c.satis_fiyati} · {c.musteri_adi || ""} · {c.satis_tarihi || ""}
                </div>
              )}
              {c.masraflar && c.masraflar.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--hint)", marginBottom: 2 }}>Masraflar:</div>
                  {c.masraflar.map(m => (
                    <div key={m.id} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                      <span>{m.aciklama}</span><span>₺{m.tutar}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {topluEtiketModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setTopluEtiketModal(false)}>
          <div className="card" style={{ width: "100%", maxWidth: 420, maxHeight: "80vh", display: "flex", flexDirection: "column" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Toplu Etiket Yazdır ({topluEtiketSecili.size})</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setTopluEtiketModal(false)}><X size={16} strokeWidth={2} /></button>
            </div>
            <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 8 }}>Etiketi basılacak cihazları seç.</div>
            <div style={{ overflowY: "auto", flex: 1, marginBottom: 12 }}>
              {filteredList.map(c => {
                const secili = topluEtiketSecili.has(c.id);
                return (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderBottom: "1px solid var(--divider)", cursor: "pointer" }}>
                    <input type="checkbox" checked={secili} style={{ width: 16, height: 16, flexShrink: 0 }}
                      onChange={() => setTopluEtiketSecili(s => {
                        const yeni = new Set(s);
                        if (secili) yeni.delete(c.id); else yeni.add(c.id);
                        return yeni;
                      })} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.model}</div>
                      <div style={{ fontSize: 11, color: "var(--hint)" }}>{[c.renk, c.depolama].filter(Boolean).join(" · ")}{c.imei ? ` · ${c.imei}` : ""}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" disabled={topluEtiketSecili.size === 0} style={{ flex: 1 }}
                onClick={() => {
                  setEtiketModalItems(filteredList.filter(c => topluEtiketSecili.has(c.id)).map(cihazToItem));
                  setTopluEtiketModal(false);
                }}>
                {topluEtiketSecili.size} Etiket Yazdır
              </button>
              <button className="btn btn-ghost" onClick={() => setTopluEtiketModal(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {etiketModalItems && (
        <UrunEtiketModal items={etiketModalItems} barkotOnEk="IKI" onClose={() => setEtiketModalItems(null)} />
      )}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }

function Chip({ children, color, icon: Icon }) {
  const colors = {
    orange: { bg: "rgba(246,162,74,0.15)", text: "var(--orange)" },
    blue: { bg: "rgba(94,168,255,0.15)", text: "var(--blue)" },
  };
  const c = colors[color] || { bg: "var(--bg2)", text: "var(--hint)" };
  return (
    <span style={{
      fontSize: 11, padding: "2px 8px", borderRadius: 6,
      background: c.bg, color: c.text, fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {Icon && <Icon size={11} strokeWidth={2} />}
      {children}
    </span>
  );
}
