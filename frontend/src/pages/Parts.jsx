import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";

const TABS = [
  { key: "stok", label: "📦 Stok" },
  { key: "orders", label: "🚚 Siparişler" },
  { key: "gecmis", label: "✅ Geçmiş" },
];

const MARKALAR = [
  "iPhone", "Samsung", "Xiaomi", "Redmi", "Realme", "Infinix", "Tecno",
  "Oppo", "OnePlus", "Vivo", "Huawei", "Honor", "General Mobile",
  "Motorola", "Nokia", "Casper", "Vestel", "Lenovo", "Asus", "Sony",
  "LG", "ZTE", "TCL", "Alcatel", "HTC", "Google Pixel", "Tablet / Diğer",
];

const PARCA_TURLERI_VARSAYILAN = [
  "Ekran", "Batarya", "Entegre", "Şarj Soketi", "Arka Kapak",
  "Kamera", "Hoparlör", "Mikrofon", "Diğer",
];

function loadParcaTurleri() {
  try {
    const s = localStorage.getItem("parca_turleri");
    if (s) return JSON.parse(s);
  } catch (_) {}
  return PARCA_TURLERI_VARSAYILAN;
}

function saveParcaTurleri(list) {
  try { localStorage.setItem("parca_turleri", JSON.stringify(list)); } catch (_) {}
}

function relativeGun(dateStr) {
  if (!dateStr) return "—";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Dün";
  return `${diff} gün önce`;
}

export default function Parts() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "stok");
  const [parts, setParts] = useState([]);
  const [shopping, setShopping] = useState({ bekliyor: [], alindi: [] });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState("Tümü");
  const [typeFilter, setTypeFilter] = useState("Tümü");

  // Sipariş Ver
  const [showShopForm, setShowShopForm] = useState(false);
  const [shopForm, setShopForm] = useState({ part_name: "", device_model: "", quantity: "1", estimated_price: "", supplier_hint: "" });

  // Aldım modal
  const [boughtItem, setBoughtItem] = useState(null);
  const [boughtData, setBoughtData] = useState({ toptanci: "", fiyat: "", stokEkle: true, stokMiktar: "1", partType: "", dollarMode: false, dollarAmount: "" });
  const [toptancilar, setToptancilar] = useState([]);
  const [toptanciOner, setToptanciOner] = useState([]);
  const [showToptanciOner, setShowToptanciOner] = useState(false);
  const [dollarRate, setDollarRate] = useState(null);
  const [kurLoading, setKurLoading] = useState(false);

  // Stok ekle formu
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", device_model: "", part_type: "", quantity: "1", min_quantity: "2", purchase_price: "" });
  const [addErr, setAddErr] = useState("");

  // Stok düş / ekle panel
  const [selectedPart, setSelectedPart] = useState(null);
  const [panelTab, setPanelTab] = useState("ekle"); // "ekle" | "dus" | "gecmis"
  const [hareketler, setHareketler] = useState([]);
  const [hareketLoading, setHareketLoading] = useState(false);
  const [kullanForm, setKullanForm] = useState({ sebep: "tamir", aciklama: "", miktar: "1" });
  const [kullanErr, setKullanErr] = useState("");
  const [ekleForm, setEkleForm] = useState({ miktar: "1", fiyat: "", aciklama: "" });
  const [ekleErr, setEkleErr] = useState("");

  // Yeni parça form — mevcut parça önerisi
  const [addEklePart, setAddEklePart] = useState(null);
  const [showOner, setShowOner] = useState(false);
  const [addBrand, setAddBrand] = useState(""); // marka chip seçimi
  const [shopBrand, setShopBrand] = useState(""); // sipariş formu marka

  // Parça türü yönetimi
  const [parcaTurleri, setParcaTurleri] = useState(loadParcaTurleri);
  const [turDuzenle, setTurDuzenle] = useState(false);
  const [yeniTur, setYeniTur] = useState("");

  const [err, setErr] = useState("");

  useEffect(() => {
    api.toptanciList().then(setToptancilar).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    if (tab === "stok") {
      api.parts(q ? { q } : {}).then(setParts).finally(() => setLoading(false));
    } else {
      api.shopping().then(setShopping).finally(() => setLoading(false));
    }
  }, [tab, q]);

  function handleToptanciChange(val) {
    setBoughtData(d => ({ ...d, toptanci: val }));
    if (val.length >= 1) {
      const found = toptancilar.filter(t => t.ad.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
      setToptanciOner(found);
      setShowToptanciOner(found.length > 0);
    } else {
      setShowToptanciOner(false);
    }
  }

  async function fetchDollarRate() {
    setKurLoading(true);
    try {
      const r = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json");
      const data = await r.json();
      const rate = Math.round(data.usd.try * 100) / 100;
      setDollarRate(rate);
    } catch(e) {
      setErr("Dolar kuru alınamadı");
    } finally {
      setKurLoading(false);
    }
  }

  async function submitBought(e) {
    e.preventDefault();
    setErr("");
    try {
      // Yeni toptancıyı otomatik kaydet
      const toptanciAdi = boughtData.toptanci.trim() || null;
      if (toptanciAdi && !toptancilar.find(t => t.ad === toptanciAdi)) {
        try {
          await api.createToptanci({ ad: toptanciAdi });
          api.toptanciList().then(setToptancilar);
        } catch(_) {}
      }

      await api.markBought(boughtItem.id, {
        bought_from: toptanciAdi,
        bought_price: boughtData.fiyat ? parseFloat(boughtData.fiyat) : null,
        stok_ekle: boughtData.stokEkle,
        stok_miktar: parseInt(boughtData.stokMiktar) || 1,
        part_type: boughtData.partType || null,
      });
      const willAddStock = boughtData.stokEkle;
      const partName = boughtItem.part_name;
      setBoughtItem(null);
      setBoughtData({ toptanci: "", fiyat: "", stokEkle: true, stokMiktar: "1", partType: "", dollarMode: false, dollarAmount: "" });
      api.shopping().then(setShopping);
      if (willAddStock) {
        setBrandFilter("Tümü");
        setTypeFilter("Tümü");
        setQ(partName);
        api.parts({ q: partName }).then(setParts);
        setTab("stok");
      }
    } catch (e) { setErr(e.message); }
  }

  async function submitShopItem(e) {
    e.preventDefault(); setErr("");
    try {
      const combinedShopModel = [shopBrand, shopForm.device_model].filter(Boolean).join(" ").trim();
      await api.addShoppingItem({
        part_name: shopForm.part_name,
        device_model: combinedShopModel || null,
        quantity: parseInt(shopForm.quantity) || 1,
        estimated_price: shopForm.estimated_price ? parseFloat(shopForm.estimated_price) : null,
        supplier_hint: shopForm.supplier_hint || null,
      });
      setShowShopForm(false);
      setShopForm({ part_name: "", device_model: "", quantity: "1", estimated_price: "", supplier_hint: "" });
      setShopBrand("");
      api.shopping().then(setShopping);
    } catch (e) { setErr(e.message); }
  }

  async function openPanel(p, tab = "ekle") {
    if (selectedPart?.id === p.id && panelTab === tab) {
      setSelectedPart(null); return;
    }
    setSelectedPart(p);
    setPanelTab(tab);
    setKullanForm({ sebep: "tamir", aciklama: "", miktar: "1" });
    setKullanErr("");
    setEkleForm({ miktar: "1", fiyat: "", aciklama: "" });
    setEkleErr("");
    if (tab === "gecmis") {
      setHareketLoading(true);
      try { setHareketler(await api.partHareketler(p.id)); }
      finally { setHareketLoading(false); }
    }
  }

  async function submitKullan(e) {
    e.preventDefault(); setKullanErr("");
    try {
      await api.kullanPart(selectedPart.id, {
        miktar: parseInt(kullanForm.miktar) || 1,
        sebep: kullanForm.sebep,
        aciklama: kullanForm.aciklama,
      });
      setSelectedPart(null);
      setKullanForm({ sebep: "tamir", aciklama: "", miktar: "1" });
      api.parts(q ? { q } : {}).then(setParts);
    } catch (e) { setKullanErr(e.message); }
  }

  function turEkle() {
    const t = yeniTur.trim();
    if (!t || parcaTurleri.includes(t)) return;
    const updated = [...parcaTurleri, t];
    setParcaTurleri(updated);
    saveParcaTurleri(updated);
    setYeniTur("");
  }

  function turSil(tur) {
    const updated = parcaTurleri.filter(t => t !== tur);
    setParcaTurleri(updated);
    saveParcaTurleri(updated);
  }

  async function submitEkle(e) {
    e.preventDefault(); setEkleErr("");
    try {
      await api.stokEkle(selectedPart.id, {
        miktar: parseInt(ekleForm.miktar) || 1,
        fiyat: ekleForm.fiyat ? parseFloat(ekleForm.fiyat) : null,
        aciklama: ekleForm.aciklama || null,
      });
      setSelectedPart(null);
      setEkleForm({ miktar: "1", fiyat: "", aciklama: "" });
      api.parts(q ? { q } : {}).then(setParts);
    } catch (e) { setEkleErr(e.message); }
  }

  async function submitAddPart(e) {
    e.preventDefault(); setAddErr("");
    try {
      const combinedModel = [addBrand, addForm.device_model].filter(Boolean).join(" ").trim();
      if (addEklePart) {
        await api.stokEkle(addEklePart.id, {
          miktar: parseInt(addForm.quantity) || 1,
          fiyat: addForm.purchase_price ? parseFloat(addForm.purchase_price) : null,
          aciklama: null,
        });
      } else {
        await api.createPart({
          name: addForm.name,
          device_model: combinedModel || null,
          part_type: addForm.part_type || null,
          quantity: parseInt(addForm.quantity) || 0,
          min_quantity: parseInt(addForm.min_quantity) || 2,
          purchase_price: addForm.purchase_price ? parseFloat(addForm.purchase_price) : 0,
          sale_price: 0,
        });
      }
      setShowAddForm(false);
      setAddForm({ name: "", device_model: "", part_type: "", quantity: "1", min_quantity: "2", purchase_price: "" });
      setAddEklePart(null);
      setAddBrand("");
      api.parts(q ? { q } : {}).then(setParts);
    } catch (e) { setAddErr(e.message); }
  }

  const brands = ["Tümü", ...new Set(parts.map(p => (p.device_model || "").split(" ")[0]).filter(Boolean).sort())];
  const types = ["Tümü", ...new Set(parts.map(p => p.part_type).filter(Boolean).sort())];
  const filteredParts = parts.filter(p => {
    const bm = brandFilter === "Tümü" || (p.device_model || "").toLowerCase().startsWith(brandFilter.toLowerCase());
    const tm = typeFilter === "Tümü" || p.part_type === typeFilter;
    return bm && tm;
  });

  return (
    <div className="page">
      <div className="page-title">📦 Stok & Siparişler</div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* STOK TAB */}
      {tab === "stok" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div className="search-bar" style={{ flex: 1, margin: 0 }}>
              <input className="search-input" placeholder="🔍 Parça ara..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(v => !v)}>+ Ekle</button>
          </div>

          {showAddForm && (() => {
            const oner = addForm.name.length >= 2 && !addEklePart
              ? parts.filter(p => p.name.toLowerCase().includes(addForm.name.toLowerCase())).slice(0, 5)
              : [];
            return (
              <div className="card" style={{ marginBottom: 12 }}>
                {addEklePart ? (
                  // ── Mevcut parçaya stok ekle modu ──
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <div style={{ background: "rgba(99,102,241,0.12)", borderRadius: 8, padding: "6px 10px", flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{addEklePart.name}</div>
                        <div style={{ fontSize: 12, color: "var(--hint)" }}>
                          {addEklePart.device_model}{addEklePart.part_type ? ` · ${addEklePart.part_type}` : ""} · Mevcut: {addEklePart.quantity} adet
                        </div>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm"
                        onClick={() => { setAddEklePart(null); setAddForm(f => ({ ...f, name: "" })); }}>
                        ✕
                      </button>
                    </div>
                    <form onSubmit={submitAddPart}>
                      {addErr && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8, fontWeight: 600 }}>❌ {addErr}</div>}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Eklenecek Adet</label>
                          <input className="form-input" type="number" min="1" required value={addForm.quantity}
                            onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Alış Fiyatı (₺)</label>
                          <input className="form-input" type="number" step="0.01" value={addForm.purchase_price}
                            onChange={e => setAddForm(f => ({ ...f, purchase_price: e.target.value }))}
                            placeholder="Opsiyonel" />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button type="submit" className="btn btn-primary btn-sm">➕ Stok Ekle</button>
                        <button type="button" className="btn btn-ghost btn-sm"
                          onClick={() => { setShowAddForm(false); setAddEklePart(null); setAddForm({ name: "", device_model: "", part_type: "", quantity: "1", min_quantity: "2", purchase_price: "" }); }}>
                          İptal
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  // ── Yeni parça kayıt modu ──
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>Yeni Parça</div>
                    <form onSubmit={submitAddPart}>
                      {addErr && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8, fontWeight: 600 }}>❌ {addErr}</div>}
                      <div className="form-group" style={{ position: "relative" }}>
                        <label className="form-label">Parça Adı *</label>
                        <input className="form-input" required value={addForm.name}
                          onChange={e => { setAddForm(f => ({ ...f, name: e.target.value })); setShowOner(true); }}
                          onBlur={() => setTimeout(() => setShowOner(false), 200)}
                          placeholder="Ekran, batarya, entegre..." autoComplete="off" />
                        {showOner && oner.length > 0 && (
                          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                            background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10,
                            boxShadow: "0 4px 16px rgba(0,0,0,0.18)", overflow: "hidden" }}>
                            <div style={{ padding: "6px 12px", fontSize: 11, color: "var(--hint)", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>
                              MEVCUT PARÇALAR — seçerek stok ekle
                            </div>
                            {oner.map(p => (
                              <div key={p.id}
                                onMouseDown={() => {
                                  setAddEklePart(p);
                                  setAddForm(f => ({ ...f, name: p.name, quantity: "1", purchase_price: "" }));
                                  setShowOner(false);
                                }}
                                style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)",
                                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                                  <div style={{ fontSize: 11, color: "var(--hint)" }}>
                                    {p.device_model}{p.part_type ? ` · ${p.part_type}` : ""}
                                  </div>
                                </div>
                                <div style={{ fontWeight: 700, color: p.quantity <= p.min_quantity ? "var(--danger)" : "var(--success)", fontSize: 14 }}>
                                  {p.quantity} adet
                                </div>
                              </div>
                            ))}
                            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--hint)", fontStyle: "italic" }}>
                              Yeni kayıt için yukarıda seçim yapma, direkt kaydet
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Marka seç */}
                      <div className="form-group" style={{ margin: "0 0 8px" }}>
                        <label className="form-label">Marka</label>
                        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
                          {MARKALAR.map(m => (
                            <button key={m} type="button"
                              onClick={() => setAddBrand(addBrand === m ? "" : m)}
                              style={{ flexShrink: 0, padding: "5px 11px", borderRadius: 20, border: "2px solid",
                                borderColor: addBrand === m ? "var(--accent)" : "var(--border)",
                                background: addBrand === m ? "var(--accent)" : "transparent",
                                color: addBrand === m ? "#fff" : "var(--text)",
                                fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Model</label>
                          <input className="form-input" value={addForm.device_model}
                            onChange={e => setAddForm(f => ({ ...f, device_model: e.target.value }))}
                            placeholder={addBrand ? `${addBrand} sonrası model...` : "13 Pro Max, A54..."} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Parça Türü</label>
                          <select className="form-select" value={addForm.part_type}
                            onChange={e => setAddForm(f => ({ ...f, part_type: e.target.value }))}>
                            <option value="">— Seç —</option>
                            {parcaTurleri.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      {/* Tür yönetimi */}
                      <div style={{ marginTop: 4 }}>
                        <button type="button" onClick={() => setTurDuzenle(v => !v)}
                          style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                          {turDuzenle ? "▲ Tür listesini kapat" : "✏️ Parça türü ekle/çıkar"}
                        </button>
                        {turDuzenle && (
                          <div style={{ marginTop: 8, background: "var(--bg)", borderRadius: 8, padding: 10, border: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                              {parcaTurleri.map(t => (
                                <span key={t} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg2)",
                                  padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                  {t}
                                  <button type="button" onClick={() => turSil(t)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 14, lineHeight: 1, padding: 0 }}>
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <input className="form-input" value={yeniTur} onChange={e => setYeniTur(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), turEkle())}
                                placeholder="Yeni tür ekle..." style={{ flex: 1 }} />
                              <button type="button" className="btn btn-primary btn-sm" onClick={turEkle}>+</button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Adet</label>
                          <input className="form-input" type="number" min="0" value={addForm.quantity}
                            onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Min. Stok</label>
                          <input className="form-input" type="number" min="0" value={addForm.min_quantity}
                            onChange={e => setAddForm(f => ({ ...f, min_quantity: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Alış (₺)</label>
                          <input className="form-input" type="number" value={addForm.purchase_price}
                            onChange={e => setAddForm(f => ({ ...f, purchase_price: e.target.value }))}
                            placeholder="0" />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button type="submit" className="btn btn-primary btn-sm">Kaydet</button>
                        <button type="button" className="btn btn-ghost btn-sm"
                          onClick={() => { setShowAddForm(false); setAddForm({ name: "", device_model: "", part_type: "", quantity: "1", min_quantity: "2", purchase_price: "" }); }}>
                          İptal
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })()}
          {brands.length > 1 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--hint)", marginBottom: 4, fontWeight: 600 }}>MARKA</div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
                {brands.map(b => (
                  <button key={b} onClick={() => { setBrandFilter(b); setTypeFilter("Tümü"); }}
                    style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: "none",
                      background: brandFilter === b ? "var(--accent)" : "var(--bg2)",
                      color: brandFilter === b ? "#fff" : "var(--text)",
                      fontWeight: brandFilter === b ? 700 : 400, fontSize: 12, cursor: "pointer" }}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}
          {types.length > 1 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--hint)", marginBottom: 4, fontWeight: 600 }}>PARÇA TÜRÜ</div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
                {types.map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: "none",
                      background: typeFilter === t ? "var(--success)" : "var(--bg2)",
                      color: typeFilter === t ? "#fff" : "var(--text)",
                      fontWeight: typeFilter === t ? 700 : 400, fontSize: 12, cursor: "pointer" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          {loading ? <div className="loading">Yükleniyor...</div> :
            filteredParts.length === 0 ? <div className="empty"><div className="empty-icon">📦</div>Parça bulunamadı</div> :
            filteredParts.map((p) => {
              const isSelected = selectedPart?.id === p.id;
              const SEBEP_LABEL = { tamir: "🔧 Tamire", satis: "💰 Satış", hasar: "💥 Hasar", diger: "📦 Diğer", satin_alma: "📥 Satın Alındı" };
              return (
                <div key={p.id}>
                  {/* Parça satırı */}
                  <div className="list-item" style={{ background: isSelected ? "var(--bg2)" : undefined }}>
                    <div className="list-item-body" style={{ cursor: "pointer" }} onClick={() => openPanel(p, "ekle")}>
                      <div className="list-item-title">{p.name}</div>
                      <div className="list-item-sub">{p.device_model} · {p.part_type}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: 18, color: p.quantity <= p.min_quantity ? "var(--danger)" : "var(--text)" }}>{p.quantity}</div>
                        <div style={{ fontSize: 11, color: "var(--hint)" }}>adet</div>
                      </div>
                      {/* Geçmiş butonu */}
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: "4px 8px", fontSize: 16 }}
                        onClick={e => { e.stopPropagation(); openPanel(p, "gecmis"); }}
                        title="Stok geçmişi"
                      >📋</button>
                    </div>
                  </div>

                  {/* Panel */}
                  {isSelected && (
                    <div className="card" style={{ marginTop: -4, borderRadius: "0 0 12px 12px", background: "var(--bg2)", marginBottom: 8 }}>
                      {/* Panel sekme */}
                      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                        {[
                          { key: "ekle", label: "➕ Stok Ekle" },
                          { key: "dus", label: "➖ Stok Düş" },
                          { key: "gecmis", label: "📋 Geçmiş" },
                        ].map(s => (
                          <button key={s.key} onClick={() => {
                            setPanelTab(s.key);
                            if (s.key === "gecmis" && (!hareketler.length || selectedPart?.id !== p.id)) {
                              setHareketLoading(true);
                              api.partHareketler(p.id).then(setHareketler).finally(() => setHareketLoading(false));
                            }
                          }}
                            style={{ padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer",
                              background: panelTab === s.key ? "var(--accent)" : "var(--bg)",
                              color: panelTab === s.key ? "#fff" : "var(--text)", fontWeight: 600, fontSize: 12 }}>
                            {s.label}
                          </button>
                        ))}
                      </div>

                      {/* Stok Ekle formu */}
                      {panelTab === "ekle" && (
                        <form onSubmit={submitEkle} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {ekleErr && <div style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600 }}>❌ {ekleErr}</div>}
                          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8 }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label">Adet</label>
                              <input className="form-input" type="number" min="1" required
                                value={ekleForm.miktar}
                                onChange={e => setEkleForm(f => ({ ...f, miktar: e.target.value }))} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label">Alış Fiyatı (₺)</label>
                              <input className="form-input" type="number" step="0.01"
                                value={ekleForm.fiyat}
                                onChange={e => setEkleForm(f => ({ ...f, fiyat: e.target.value }))}
                                placeholder="Opsiyonel" />
                            </div>
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Açıklama / Toptancı</label>
                            <input className="form-input" value={ekleForm.aciklama}
                              onChange={e => setEkleForm(f => ({ ...f, aciklama: e.target.value }))}
                              placeholder="Nereden alındı, not..." />
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="submit" className="btn btn-primary btn-sm">➕ Ekle</button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedPart(null)}>İptal</button>
                          </div>
                        </form>
                      )}

                      {/* Stok Düş formu */}
                      {panelTab === "dus" && (
                        <>
                          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                            {[
                              { key: "tamir", label: "🔧 Tamire Takıldı" },
                              { key: "satis", label: "💰 Satıldı" },
                              { key: "hasar", label: "💥 Hasar/Kayıp" },
                              { key: "diger", label: "📦 Diğer" },
                            ].map(s => (
                              <button key={s.key} type="button"
                                onClick={() => setKullanForm(f => ({ ...f, sebep: s.key }))}
                                style={{
                                  padding: "6px 12px", borderRadius: 20, border: "2px solid",
                                  borderColor: kullanForm.sebep === s.key ? "var(--accent)" : "var(--border)",
                                  background: kullanForm.sebep === s.key ? "var(--accent)" : "transparent",
                                  color: kullanForm.sebep === s.key ? "#fff" : "var(--text)",
                                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                                }}>
                                {s.label}
                              </button>
                            ))}
                          </div>
                          <form onSubmit={submitKullan} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {kullanErr && <div style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600 }}>❌ {kullanErr}</div>}
                            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8 }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Adet</label>
                                <input className="form-input" type="number" min="1" max={p.quantity}
                                  value={kullanForm.miktar}
                                  onChange={e => setKullanForm(f => ({ ...f, miktar: e.target.value }))} />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">
                                  {kullanForm.sebep === "tamir" ? "Tamir No / Cihaz" :
                                   kullanForm.sebep === "satis" ? "Müşteri Adı" :
                                   kullanForm.sebep === "hasar" ? "Hasar Açıklaması" : "Açıklama"}
                                </label>
                                <input className="form-input" value={kullanForm.aciklama}
                                  onChange={e => setKullanForm(f => ({ ...f, aciklama: e.target.value }))}
                                  placeholder={
                                    kullanForm.sebep === "tamir" ? "#1042 iPhone 13" :
                                    kullanForm.sebep === "satis" ? "Ad Soyad" :
                                    kullanForm.sebep === "hasar" ? "Neden hasar gördü?" : "Not"
                                  } />
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button type="submit" className="btn btn-primary btn-sm">Düş</button>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedPart(null)}>İptal</button>
                            </div>
                          </form>
                        </>
                      )}

                      {/* Geçmiş listesi */}
                      {panelTab === "gecmis" && (
                        hareketLoading ? <div style={{ textAlign: "center", padding: 12, color: "var(--hint)" }}>Yükleniyor...</div> :
                        hareketler.length === 0 ? (
                          <div style={{ textAlign: "center", padding: 12, color: "var(--hint)", fontSize: 14 }}>
                            Henüz hareket kaydı yok
                          </div>
                        ) : hareketler.map((h, i) => (
                          <div key={h.id} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                            padding: "8px 0", borderBottom: i < hareketler.length - 1 ? "1px solid var(--border)" : "none",
                          }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>
                                {SEBEP_LABEL[h.sebep] || "📦 Diğer"}
                                {h.aciklama ? ` — ${h.aciklama}` : ""}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--hint)" }}>{h.tarih}</div>
                            </div>
                            <div style={{ fontWeight: 700, color: h.hareket === "giris" ? "var(--success)" : "var(--danger)", fontSize: 15, flexShrink: 0 }}>
                              {h.hareket === "giris" ? "+" : "-"}{h.miktar} adet
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          }
        </>
      )}

      {/* SİPARİŞLER TAB — alisveris_listesi bekliyor */}
      {tab === "orders" && (
        <>
          <button className="btn btn-primary" style={{ marginBottom: 12 }} onClick={() => setShowShopForm(!showShopForm)}>
            + Sipariş Ver
          </button>

          {showShopForm && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Yeni Sipariş</div>
              <form onSubmit={submitShopItem}>
                {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
                <div className="form-group">
                  <label className="form-label">Parça Adı *</label>
                  <input className="form-input" required value={shopForm.part_name} onChange={e => setShopForm({ ...shopForm, part_name: e.target.value })} placeholder="Ekran, batarya, entegre..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Marka</label>
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
                    {MARKALAR.map(m => (
                      <button key={m} type="button"
                        onClick={() => setShopBrand(shopBrand === m ? "" : m)}
                        style={{ flexShrink: 0, padding: "5px 11px", borderRadius: 20, border: "2px solid",
                          borderColor: shopBrand === m ? "var(--accent)" : "var(--border)",
                          background: shopBrand === m ? "var(--accent)" : "transparent",
                          color: shopBrand === m ? "#fff" : "var(--text)",
                          fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input className="form-input" value={shopForm.device_model}
                    onChange={e => setShopForm({ ...shopForm, device_model: e.target.value })}
                    placeholder={shopBrand ? `${shopBrand} sonrası model...` : "13 Pro Max, A54..."} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className="form-group">
                    <label className="form-label">Adet</label>
                    <input className="form-input" type="number" min="1" value={shopForm.quantity} onChange={e => setShopForm({ ...shopForm, quantity: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tahmini Fiyat (₺)</label>
                    <input className="form-input" type="number" value={shopForm.estimated_price} onChange={e => setShopForm({ ...shopForm, estimated_price: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Toptancı / Not</label>
                  <input className="form-input" value={shopForm.supplier_hint} onChange={e => setShopForm({ ...shopForm, supplier_hint: e.target.value })} placeholder="Nereden alınacak?" />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn btn-primary">Ekle</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowShopForm(false)}>İptal</button>
                </div>
              </form>
            </div>
          )}

          {loading ? <div className="loading">Yükleniyor...</div> :
            shopping.bekliyor.length === 0 ? (
              <div className="empty"><div className="empty-icon">🚚</div>Bekleyen sipariş yok</div>
            ) : shopping.bekliyor.map((item) => (
              <div key={item.id} className="card">
                <div className="card-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.part_name}</div>
                    <div style={{ fontSize: 13, color: "var(--hint)" }}>
                      {item.device_model || "—"} · ×{item.quantity}
                      {item.estimated_price ? ` · ~₺${item.estimated_price}` : ""}
                      {item.supplier_hint ? ` · ${item.supplier_hint}` : ""}
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => { setBoughtItem(item); setBoughtData(d => ({ ...d, stokMiktar: String(item.quantity || 1) })); }}>
                    ✅ Aldım
                  </button>
                </div>
              </div>
            ))
          }

          {/* ALDIM MODAL */}
          {boughtItem && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
              <div style={{ background: "var(--bg)", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", width: "100%" }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>✅ Alındı: {boughtItem.part_name}</div>
                <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 14 }}>{boughtItem.device_model}</div>
                <form onSubmit={submitBought}>
                  {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>❌ {err}</div>}

                  {/* Toptancı Autocomplete */}
                  <div className="form-group" style={{ position: "relative" }}>
                    <label className="form-label">Toptancı</label>
                    <input className="form-input" value={boughtData.toptanci}
                      onChange={e => handleToptanciChange(e.target.value)}
                      onBlur={() => setTimeout(() => setShowToptanciOner(false), 150)}
                      placeholder="Toptancı adı yazın..." autoComplete="off" />
                    {showToptanciOner && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
                        background: "var(--card)", border: "1px solid var(--border)",
                        borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden" }}>
                        {toptanciOner.map(t => (
                          <div key={t.id} onMouseDown={() => { setBoughtData(d => ({ ...d, toptanci: t.ad })); setShowToptanciOner(false); }}
                            style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14, borderBottom: "1px solid var(--border)",
                              display: "flex", justifyContent: "space-between" }}>
                            <span>🏭 {t.ad}</span>
                            {t.sehir && <span style={{ fontSize: 12, color: "var(--hint)" }}>{t.sehir}</span>}
                          </div>
                        ))}
                        <div onMouseDown={() => { setShowToptanciOner(false); }}
                          style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
                          + Yeni toptancı olarak kaydet
                        </div>
                      </div>
                    )}
                    {boughtData.toptanci && !toptancilar.find(t => t.ad === boughtData.toptanci) && !showToptanciOner && (
                      <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 4 }}>
                        ℹ Yeni toptancı olarak kaydedilecek
                      </div>
                    )}
                  </div>

                  {/* Dolar Kuru */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <button type="button"
                      onClick={() => setBoughtData(d => ({ ...d, dollarMode: !d.dollarMode, dollarAmount: "", fiyat: "" }))}
                      style={{ padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                        background: boughtData.dollarMode ? "var(--accent)" : "var(--bg2)",
                        color: boughtData.dollarMode ? "#fff" : "var(--text)" }}>
                      💵 Dolar ile gir
                    </button>
                    {dollarRate && <span style={{ fontSize: 12, color: "var(--hint)" }}>1$ = ₺{dollarRate}</span>}
                    <button type="button" onClick={fetchDollarRate} disabled={kurLoading}
                      style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 16, border: "1px solid var(--border)",
                        background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--hint)" }}>
                      {kurLoading ? "..." : "🔄 Kur"}
                    </button>
                  </div>

                  {boughtData.dollarMode ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Dolar ($)</label>
                        <input className="form-input" type="number" step="0.01" value={boughtData.dollarAmount}
                          onChange={e => {
                            const usd = parseFloat(e.target.value) || 0;
                            const tl = dollarRate ? String(Math.round(usd * dollarRate)) : "";
                            setBoughtData(d => ({ ...d, dollarAmount: e.target.value, fiyat: tl }));
                          }}
                          placeholder="0.00" />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">TL karşılığı</label>
                        <input className="form-input" type="number" value={boughtData.fiyat}
                          onChange={e => setBoughtData(d => ({ ...d, fiyat: e.target.value }))}
                          placeholder={dollarRate ? `≈ ₺${dollarRate}/dolar` : "Kur al →"} />
                      </div>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Ödenen Fiyat (₺)</label>
                      <input className="form-input" type="number" value={boughtData.fiyat} onChange={e => setBoughtData(d => ({ ...d, fiyat: e.target.value }))} placeholder="0" />
                    </div>
                  )}

                  {/* Stoğa Ekle */}
                  <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" id="stokEkle" checked={boughtData.stokEkle}
                        onChange={e => setBoughtData(d => ({ ...d, stokEkle: e.target.checked }))}
                        style={{ width: 18, height: 18 }} />
                      <label htmlFor="stokEkle" style={{ fontWeight: 600, fontSize: 14 }}>Stoğa ekle</label>
                      {boughtData.stokEkle && (
                        <input type="number" min="1" value={boughtData.stokMiktar}
                          onChange={e => setBoughtData(d => ({ ...d, stokMiktar: e.target.value }))}
                          style={{ width: 60, marginLeft: "auto" }} className="form-input" />
                      )}
                      {boughtData.stokEkle && <span style={{ fontSize: 13, color: "var(--hint)" }}>adet</span>}
                    </div>
                    {boughtData.stokEkle && (
                      <div style={{ marginTop: 8 }}>
                        <label className="form-label">Parça Türü</label>
                        <select className="form-select" value={boughtData.partType}
                          onChange={e => setBoughtData(d => ({ ...d, partType: e.target.value }))}>
                          <option value="">— Seç (opsiyonel) —</option>
                          {parcaTurleri.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Kaydet</button>
                    <button type="button" className="btn btn-ghost" onClick={() => { setBoughtItem(null); setErr(""); }}>İptal</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* GEÇMİŞ TAB — alisveris_listesi alındı */}
      {tab === "gecmis" && (
        <>
          {loading ? <div className="loading">Yükleniyor...</div> :
            shopping.alindi.length === 0 ? (
              <div className="empty"><div className="empty-icon">✅</div>Henüz alınan parça yok</div>
            ) : shopping.alindi.map((item) => (
              <div key={item.id} className="list-item" style={{ opacity: 0.9 }}>
                <div className="list-item-body">
                  <div className="list-item-title">✅ {item.part_name}</div>
                  <div className="list-item-sub">
                    {item.device_model ? `${item.device_model} · ` : ""}
                    {item.bought_from || "Toptancı belirtilmedi"}
                    {item.bought_price ? ` · ₺${item.bought_price}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>×{item.quantity}</div>
                  <div style={{ fontSize: 11, color: "var(--hint)" }}>{relativeGun(item.bought_at)}</div>
                </div>
              </div>
            ))
          }
        </>
      )}
    </div>
  );
}
