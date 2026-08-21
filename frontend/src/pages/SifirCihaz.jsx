import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import UrunGorsel from "../components/UrunGorsel";
import ImeiInput from "../components/ImeiInput";
import OdemeBolustur, { varsayilanOdemeSatirlari } from "../components/OdemeBolustur";
import {
  Store, Package, CheckCircle2, CircleX, Smartphone, Trash2, Banknote,
  User, Phone, Radio, History, X, Inbox, Send, Clock, Printer, Ban, Tag, Pencil,
} from "lucide-react";
import UrunEtiketModal from "../components/UrunEtiketModal";

const AKSESUAR_ETIKETLERI = { kutu: "Kutu", sarj_aleti: "Şarj Aleti", kilif: "Kılıf", kulaklik: "Kulaklık" };

// Bkz. IkinciEl.jsx'teki cihazToItem — aynı mantık: fiyat sadece satıldığında
// belli olur, barkot olarak IMEI kullanılır.
function cihazToItem(c) {
  return {
    id: c.id, ad: c.model, satis_fiyati: c.satis_fiyati || null,
    kategori: [c.renk, c.depolama].filter(Boolean).join(" · ") || null,
    barkot: c.imei || null,
  };
}

export default function SifirCihaz({ user }) {
  const navigate = useNavigate();
  const [priceHidden, setPriceHidden] = useState(() => localStorage.getItem("priceHidden") === "1");
  const [kaynak, setKaynak] = useState("hepsi");
  const [tab, setTab] = useState("stok");
  const [list, setList] = useState([]);
  const [satilanlar, setSatilanlar] = useState([]);
  const [ozet, setOzet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSat, setShowSat] = useState(false);
  const [err, setErr] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [etiketModalItems, setEtiketModalItems] = useState(null);
  const [topluEtiketModal, setTopluEtiketModal] = useState(false);
  const [topluEtiketSecili, setTopluEtiketSecili] = useState(new Set());
  const [musteriler, setMusteriler] = useState([]);
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
  const [imeiModal, setImeiModal] = useState(null);
  const [imeiModalData, setImeiModalData] = useState([]);
  const [imeiModalLoading, setImeiModalLoading] = useState(false);

  const [form, setForm] = useState({
    model: "", imei: "", renk: "", depolama: "", kimden: "", kimden_telefon: "",
    kaynak: "dukkan", alis_fiyati: "", liste_fiyati: "", alis_tarihi: today(), notlar: "", aksesuarlar: {}
  });
  const [listeFiyatDuzenle, setListeFiyatDuzenle] = useState(null); // { id, deger }
  const [satForm, setSatForm] = useState({
    satis_fiyati: "", satis_kanali: "Dükkan", musteri_adi: "",
    musteri_telefon: "", odemeler: null, taksit_sayi: "1"
  });

  useEffect(() => {
    load();
    api.customers("").then(setMusteriler).catch(() => {});
  }, []);

  async function load() {
    try {
      const [l, o, s] = await Promise.all([api.sifirList(), api.sifirOzet(), api.sifirSatilanlar()]);
      setList(l); setOzet(o); setSatilanlar(s);
    } finally { setLoading(false); }
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

  async function openImeiModal(imei, model) {
    setImeiModal({ imei, model });
    setImeiModalLoading(true);
    setImeiModalData([]);
    try {
      const data = await api.sifirIMEITam(imei);
      setImeiModalData(data);
    } catch { setImeiModalData([]); }
    finally { setImeiModalLoading(false); }
  }

  async function submitAlim(e) {
    e.preventDefault(); setErr("");
    try {
      await api.createSifir({ ...form, alis_fiyati: parseFloat(form.alis_fiyati), liste_fiyati: form.liste_fiyati ? parseFloat(form.liste_fiyati) : null });
      setShowForm(false);
      setForm({ model: "", imei: "", renk: "", depolama: "", kimden: "", kimden_telefon: "", kaynak: "dukkan", alis_fiyati: "", liste_fiyati: "", alis_tarihi: today(), notlar: "", aksesuarlar: {} });
      karaSonuclar.current = {}; setKaraUyari([]);
      load();
    } catch (e) { setErr(e.message); }
  }

  async function kaydetListeFiyat() {
    try {
      await api.sifirListeFiyatGuncelle(listeFiyatDuzenle.id, listeFiyatDuzenle.deger ? parseFloat(listeFiyatDuzenle.deger) : null);
      setListeFiyatDuzenle(null);
      load();
    } catch (e) { setErr(e.message); }
  }

  async function deleteCihaz(id) {
    try {
      await api.deleteSifir(id);
      setDeleteId(null);
      setSelected(null);
      load();
    } catch (e) { setErr(e.message); }
  }

  async function submitSat(e) {
    e.preventDefault(); setErr("");
    try {
      const satisFiyati = parseFloat(satForm.satis_fiyati) || 0;
      await api.sifirSat(selected.id, {
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

  const filteredList = kaynak === "hepsi" ? list : list.filter(c => (c.kaynak || "dukkan") === kaynak);
  const filteredSatilanlar = kaynak === "hepsi" ? satilanlar : satilanlar.filter(c => (c.kaynak || "dukkan") === kaynak);

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 9, flex: 1 }}>
          <Package size={18} strokeWidth={2} /> Sıfır Cihaz
        </h1>
        {tab === "stok" && (
          <button className="btn btn-ghost btn-sm" title="Toplu Etiket Yazdır"
            onClick={() => { setTopluEtiketSecili(new Set()); setTopluEtiketModal(true); }}>
            <Printer size={14} strokeWidth={2.4} />
          </button>
        )}
        {tab === "stok" && <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Ekle</button>}
      </div>

      {/* Özet */}
      {ozet && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div className="card" style={{ textAlign: "center", margin: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{ozet.stokta_adet ?? 0}</div>
            <div style={{ fontSize: 11, color: "var(--hint)" }}>Stokta</div>
          </div>
          <div className="card" style={{ textAlign: "center", margin: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--success)" }}>
              {(ozet.net_kar || 0).toLocaleString("tr-TR")}₺
            </div>
            <div style={{ fontSize: 11, color: "var(--hint)" }}>Toplam Kâr</div>
          </div>
          <div className="card" style={{ textAlign: "center", margin: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{ozet.satilan_adet}</div>
            <div style={{ fontSize: 11, color: "var(--hint)" }}>Satılan</div>
          </div>
        </div>
      )}

      {/* Kaynak filtresi */}
      <div className="tabs" style={{ marginBottom: 8 }}>
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

      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${tab === "stok" ? "active" : ""}`} onClick={() => setTab("stok")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Package size={13} strokeWidth={2} /> Stok
        </button>
        <button className={`tab ${tab === "satilanlar" ? "active" : ""}`} onClick={() => setTab("satilanlar")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={13} strokeWidth={2} /> Satılanlar ({filteredSatilanlar.length})
        </button>
      </div>

      {tab === "stok" && (
        <>
          {showForm && (
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Yeni Cihaz Ekle</div>
              <form onSubmit={submitAlim}>
                {err && <div style={{ color: "var(--red)", fontSize: 13, padding: "8px 0", display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}
                <div className="form-group">
                  <label className="form-label">Model *</label>
                  <input className="form-input" required value={form.model}
                    onChange={e => setForm({ ...form, model: e.target.value })}
                    placeholder="iPhone 15, Samsung S24..." />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Renk</label>
                    <input className="form-input" value={form.renk}
                      onChange={e => setForm({ ...form, renk: e.target.value })}
                      placeholder="Siyah, Beyaz..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Depolama</label>
                    <input className="form-input" value={form.depolama}
                      onChange={e => setForm({ ...form, depolama: e.target.value })}
                      placeholder="128GB, 256GB..." />
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
                <div className="form-group">
                  <label className="form-label">Kimden (Ad Soyad) *</label>
                  <input className="form-input" required value={form.kimden}
                    onChange={e => setForm({ ...form, kimden: e.target.value })}
                    placeholder="Kişi/firma adı" />
                </div>
                <div className="form-group">
                  <label className="form-label">Kimden (Telefon) *</label>
                  <input className="form-input" required inputMode="tel" value={form.kimden_telefon}
                    onChange={e => { setForm({ ...form, kimden_telefon: e.target.value }); karaKontrolEt("alis_tel", e.target.value); }}
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
                  <select className="form-select" value={form.kaynak}
                    onChange={e => setForm({ ...form, kaynak: e.target.value })}>
                    <option value="dukkan">Dükkan</option>
                    <option value="getmobile">Getmobil</option>
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Alış Fiyatı (₺) *</label>
                    <input className="form-input" type="number" required value={form.alis_fiyati}
                      onChange={e => setForm({ ...form, alis_fiyati: e.target.value })} placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alış Tarihi</label>
                    <input className="form-input" type="date" value={form.alis_tarihi}
                      onChange={e => setForm({ ...form, alis_tarihi: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Liste Fiyatı (₺) — Katalogda gösterilir</label>
                  <input className="form-input" type="number" value={form.liste_fiyati}
                    onChange={e => setForm({ ...form, liste_fiyati: e.target.value })}
                    placeholder="Boş bırakılırsa katalogda fiyat görünmez" />
                </div>
                <div className="form-group">
                  <label className="form-label">Not</label>
                  <input className="form-input" value={form.notlar}
                    onChange={e => setForm({ ...form, notlar: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn btn-primary">Kaydet</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
                </div>
              </form>
            </div>
          )}

          {filteredList.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Stokta sıfır cihaz yok</div>
          ) : filteredList.map(c => {
            const isSelected = selected?.id === c.id;
            return (
              <div key={c.id}>
                <div className="card" onClick={() => { setSelected(isSelected ? null : c); setShowSat(false); }} style={{ cursor: "pointer" }}>
                  <div className="card-row">
                    <div>
                      <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                        <UrunGorsel url={c.gorsel_url} yukle={f => api.sifirCihazGorselYukle(c.id, f)} boyut={38} />
                        <Smartphone size={15} strokeWidth={2} /> {c.model}
                      </div>
                      {(c.renk || c.depolama) && (
                        <div style={{ fontSize: 12, color: "var(--hint)" }}>
                          {[c.renk, c.depolama].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {c.imei && <div style={{ fontSize: 12, color: "var(--hint)" }}>IMEI: {c.imei}</div>}
                      {c.kimden && <div style={{ fontSize: 12, color: "var(--hint)" }}>Kimden: {c.kimden}</div>}
                      {c.kaynak === "getmobile" && (
                        <div style={{ fontSize: 11, color: "var(--hint)", display: "flex", alignItems: "center", gap: 4 }}>
                          <Package size={10} strokeWidth={2} /> Getmobil
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700 }}>
                        {priceHidden ? "••••" : (c.alis_fiyati || 0).toLocaleString("tr-TR") + " ₺"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--hint)" }}>{c.alis_tarihi || "—"}</div>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="card" style={{ marginTop: -8, borderRadius: "0 0 12px 12px", background: "var(--bg2)" }}>
                    <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--divider)" }}>
                      {listeFiyatDuzenle?.id === c.id ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input className="form-input" type="number" autoFocus style={{ flex: 1 }}
                            placeholder="Katalog fiyatı"
                            value={listeFiyatDuzenle.deger}
                            onChange={e => setListeFiyatDuzenle(v => ({ ...v, deger: e.target.value }))} />
                          <button className="btn btn-primary btn-sm" onClick={kaydetListeFiyat}>Kaydet</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setListeFiyatDuzenle(null)}>İptal</button>
                        </div>
                      ) : (
                        <div className="card-row" style={{ cursor: "pointer" }}
                          onClick={() => setListeFiyatDuzenle({ id: c.id, deger: c.liste_fiyati ?? "" })}>
                          <span style={{ fontSize: 12.5, color: "var(--hint)", display: "flex", alignItems: "center", gap: 6 }}>
                            <Tag size={12} strokeWidth={2} /> Liste Fiyatı (Katalog)
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                            {c.liste_fiyati ? c.liste_fiyati.toLocaleString("tr-TR") + " ₺" : "Belirtilmemiş"}
                            <Pencil size={11} strokeWidth={2} stroke="var(--hint)" />
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => setShowSat(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
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

                    {showSat && (
                      <form onSubmit={submitSat} style={{ marginTop: 10 }}>
                        {err && <div style={{ color: "var(--red)", fontSize: 13, padding: "8px 0" }}>{err}</div>}

                        {/* Müşteri autocomplete */}
                        <div className="form-group" style={{ position: "relative" }}>
                          <label className="form-label">Müşteri Adı *</label>
                          <input className="form-input" required value={satForm.musteri_adi}
                            onChange={e => handleSatMusteriChange(e.target.value)}
                            onBlur={() => setTimeout(() => setShowSatMusteriOner(false), 150)}
                            placeholder="Ad Soyad" autoComplete="off" />
                          {showSatMusteriOner && (
                            <div className="ac-dropdown" style={{ zIndex: 99 }}>
                              {satMusteriOner.map(m => (
                                <div key={m.id}
                                  onMouseDown={() => {
                                    setSatForm(f => ({ ...f, musteri_adi: m.name, musteri_telefon: m.phone || f.musteri_telefon }));
                                    setShowSatMusteriOner(false);
                                    if (m.phone) karaKontrolEt("satis_tel", m.phone);
                                  }}
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
                            <div style={{ fontSize: 11, color: "var(--success)", marginTop: 3 }}>
                              ✓ Müşteri listesine otomatik eklenecek
                            </div>
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
                          <label className="form-label">Satış Fiyatı (₺) *</label>
                          <input className="form-input" type="number" required value={satForm.satis_fiyati}
                            onChange={e => setSatForm({ ...satForm, satis_fiyati: e.target.value })} />
                        </div>

                        {satForm.satis_fiyati && (
                          <div style={{ fontSize: 13, color: "var(--success)", marginBottom: 8, fontWeight: 600 }}>
                            Kâr: {(parseFloat(satForm.satis_fiyati) - (c.alis_fiyati || 0)).toLocaleString("tr-TR")} ₺
                          </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div className="form-group">
                            <label className="form-label">Kanal</label>
                            <select className="form-select" value={satForm.satis_kanali}
                              onChange={e => setSatForm({ ...satForm, satis_kanali: e.target.value })}>
                              {["Dükkan", "Getmobil", "Instagram", "Sahibinden", "Diğer"].map(k => <option key={k}>{k}</option>)}
                            </select>
                          </div>
                        </div>

                        <OdemeBolustur toplam={parseFloat(satForm.satis_fiyati) || 0} yon="gelir"
                          value={satForm.odemeler} onChange={v => setSatForm(f => ({ ...f, odemeler: v }))}
                          taksitSayi={satForm.taksit_sayi} onTaksitSayiChange={v => setSatForm(f => ({ ...f, taksit_sayi: v }))} />

                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="submit" className="btn btn-primary btn-sm">Sat</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSat(false)}>İptal</button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {tab === "satilanlar" && (
        filteredSatilanlar.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>Henüz satılan cihaz yok</div>
        ) : filteredSatilanlar.map(c => (
          <div key={c.id} className="card">
            <div className="card-row">
              <div>
                <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                  <Smartphone size={15} strokeWidth={2} /> {c.model}
                </div>
                {(c.renk || c.depolama) && (
                  <div style={{ fontSize: 12, color: "var(--hint)" }}>{[c.renk, c.depolama].filter(Boolean).join(" · ")}</div>
                )}
                {c.musteri_adi && <div style={{ fontSize: 13, color: "var(--text)", display: "flex", alignItems: "center", gap: 5 }}><User size={12} strokeWidth={2} /> {c.musteri_adi}</div>}
                {c.musteri_telefon && <div style={{ fontSize: 12, color: "var(--hint)", display: "flex", alignItems: "center", gap: 5 }}><Phone size={11} strokeWidth={2} /> {c.musteri_telefon}</div>}
                <div style={{ fontSize: 12, color: "var(--hint)", display: "flex", alignItems: "center", gap: 5 }}><Radio size={11} strokeWidth={2} /> {c.satis_kanali || "Dükkan"}</div>
                {c.imei && (
                  <span onClick={e => { e.stopPropagation(); openImeiModal(c.imei, c.model); }}
                    style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600, textDecoration: "underline", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <History size={11} strokeWidth={2} /> IMEI Geçmişi
                  </span>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: ((c.satis_fiyati || 0) - (c.alis_fiyati || 0)) >= 0 ? "var(--success)" : "var(--red)" }}>
                  {priceHidden ? "••••" : (c.satis_fiyati || 0).toLocaleString("tr-TR") + " ₺"}
                </div>
                <div style={{ fontSize: 12, color: ((c.satis_fiyati || 0) - (c.alis_fiyati || 0)) >= 0 ? "var(--success)" : "var(--red)" }}>
                  Kâr: {priceHidden ? "••••" : ((c.satis_fiyati || 0) - (c.alis_fiyati || 0)).toLocaleString("tr-TR") + " ₺"}
                </div>
                <div style={{ fontSize: 11, color: "var(--hint)" }}>{c.satis_tarihi || "—"}</div>
              </div>
            </div>
          </div>
        ))
      )}
      {/* IMEI Geçmiş Modalı */}
      {imeiModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setImeiModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--card)", borderRadius: 18,
            width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", padding: "20px 16px 32px",
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

            {imeiModalLoading ? (
              <div style={{ textAlign: "center", padding: 20, color: "var(--hint)" }}>Yükleniyor...</div>
            ) : imeiModalData.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "var(--hint)" }}>Kayıt bulunamadı</div>
            ) : (() => {
              const toplam_kar = imeiModalData
                .filter(r => r.durum === "satildi")
                .reduce((s, r) => s + (r.satis_fiyati || 0) - (r.alis_fiyati || 0), 0);
              return (
                <>
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
                  {imeiModalData.map((r, i) => {
                    const kar = (r.satis_fiyati || 0) - (r.alis_fiyati || 0);
                    return (
                      <div key={r.id} style={{ border: "1px solid var(--divider)", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
                        <div style={{ background: "var(--bg2)", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "var(--hint)" }}>
                          {i + 1}. Döngü
                        </div>
                        <div style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Inbox size={13} strokeWidth={2} /> Alındı</div>
                            <div style={{ fontSize: 12, color: "var(--hint)" }}>{r.kimden || "—"} {r.kimden_telefon ? `· ${r.kimden_telefon}` : ""}</div>
                            <div style={{ fontSize: 11, color: "var(--hint)" }}>{r.alis_tarihi || r.created_at?.slice(0,10) || "—"}</div>
                          </div>
                          <div style={{ fontWeight: 700 }}>₺{(r.alis_fiyati || 0).toLocaleString("tr-TR")}</div>
                        </div>
                        {r.durum === "satildi" ? (
                          <div style={{
                            padding: "10px 12px", display: "flex", justifyContent: "space-between",
                            borderTop: "1px solid var(--divider)",
                            background: kar >= 0 ? "rgba(74,222,128,0.05)" : "rgba(248,113,113,0.05)",
                          }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Send size={13} strokeWidth={2} /> Satıldı</div>
                              <div style={{ fontSize: 12, color: "var(--hint)" }}>{r.musteri_adi || "—"} {r.musteri_telefon ? `· ${r.musteri_telefon}` : ""}</div>
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
        <UrunEtiketModal items={etiketModalItems} barkotOnEk="SIF" onClose={() => setEtiketModalItems(null)} />
      )}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
