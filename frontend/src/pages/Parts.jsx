import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  Package, Truck, CheckCircle2, Search, Plus, X, History, TriangleAlert, Trash2, CircleX,
  Pencil, Wrench, Banknote, Zap, Undo2, DollarSign, RefreshCw, User, Factory,
} from "lucide-react";
import BrandModelPicker from "../components/BrandModelPicker";
import PartTypePicker from "../components/PartTypePicker";
import PartsBrowser from "../components/PartsBrowser";
import { partTypeIcon } from "../partTypeIcons";

const TABS = [
  { key: "stok", label: "Stok" },
  { key: "orders", label: "Siparişler" },
  { key: "gecmis", label: "Geçmiş" },
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

export default function Parts({ user }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "stok");
  const [parts, setParts] = useState([]);
  const [shopping, setShopping] = useState({ bekliyor: [], alindi: [] });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletePartId, setDeletePartId] = useState(null);
  const [deleteOrderId, setDeleteOrderId] = useState(null);
  const [lowStock, setLowStock] = useState(searchParams.get("low_stock") === "true");

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
  const [matchingParts, setMatchingParts] = useState([]);
  const [boughtExistingId, setBoughtExistingId] = useState(null);
  const [gecmisQ, setGecmisQ] = useState("");
  const [ekleDolarMode, setEkleDolarMode] = useState(false);
  const [ekleDolarMiktar, setEkleDolarMiktar] = useState("");

  // Stok ekle formu
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", device_model: "", part_type: "", quantity: "1", min_quantity: "2", purchase_price: "", sale_price: "", toptanci: "", toptanci_id: null });
  const [addErr, setAddErr] = useState("");
  const [addDolarMode, setAddDolarMode] = useState(false);
  const [addDolarMiktar, setAddDolarMiktar] = useState("");
  const [addTopOner, setAddTopOner] = useState([]);
  const [showAddTopOner, setShowAddTopOner] = useState(false);

  // Stok düş / ekle panel
  const [selectedPart, setSelectedPart] = useState(null);
  const [panelTab, setPanelTab] = useState("ekle"); // "ekle" | "dus" | "gecmis"
  const [hareketler, setHareketler] = useState([]);
  const [hareketLoading, setHareketLoading] = useState(false);
  const [kullanForm, setKullanForm] = useState({ sebep: "tamir", aciklama: "", miktar: "1" });
  const [kullanErr, setKullanErr] = useState("");
  const [ekleForm, setEkleForm] = useState({ miktar: "1", fiyat: "", aciklama: "", toptanci: "" });
  const [ekleErr, setEkleErr] = useState("");
  const [ekleTopOner, setEkleTopOner] = useState([]);
  const [showEkleTopOner, setShowEkleTopOner] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", device_model: "", part_type: "", min_quantity: "2", purchase_price: "", sale_price: "" });
  const [editErr, setEditErr] = useState("");

  // Yeni parça form — mevcut parça önerisi
  const [addEklePart, setAddEklePart] = useState(null);
  const [showOner, setShowOner] = useState(false);
  const [addBrand, setAddBrand] = useState(""); // marka chip seçimi
  const [shopBrand, setShopBrand] = useState(""); // sipariş formu marka

  // Parça türü yönetimi
  const [parcaTurleri, setParcaTurleri] = useState(loadParcaTurleri);

  const [sortBy, setSortBy] = useState("yeni"); // "yeni" | "stok" | "isim"
  const [err, setErr] = useState("");
  const [priceHidden, setPriceHidden] = useState(() => localStorage.getItem("priceHidden") === "1");

  useEffect(() => {
    api.toptanciList().then(setToptancilar).catch(() => {});
  }, []);

  useEffect(() => {
    if (!boughtItem) { setMatchingParts([]); setBoughtExistingId(null); return; }
    api.parts({ q: boughtItem.part_name }).then(m => {
      const matches = m.filter(p => p.quantity > 0).slice(0, 4);
      setMatchingParts(matches);
      setBoughtExistingId(matches.length > 0 ? matches[0].id : null);
    }).catch(() => {});
  }, [boughtItem]);

  useEffect(() => {
    setLoading(true);
    if (tab === "stok") {
      const params = {};
      if (q) params.q = q;
      if (lowStock) params.low_stock = true;
      api.parts(params).then(setParts).finally(() => setLoading(false));
    } else {
      api.shopping().then(setShopping).finally(() => setLoading(false));
    }
  }, [tab, q, lowStock]);

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
      localStorage.setItem("son_dolar_kuru", String(rate));
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
        existing_part_id: boughtData.stokEkle ? boughtExistingId : null,
      });
      const willAddStock = boughtData.stokEkle;
      const partName = boughtItem.part_name;
      setBoughtItem(null);
      setBoughtData({ toptanci: "", fiyat: "", stokEkle: true, stokMiktar: "1", partType: "", dollarMode: false, dollarAmount: "" });
      api.shopping().then(setShopping);
      if (willAddStock) {
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
    setEditForm({
      name: p.name, device_model: p.device_model || "", part_type: p.part_type || "",
      min_quantity: String(p.min_quantity ?? 2),
      purchase_price: p.purchase_price ? String(p.purchase_price) : "",
      sale_price: p.sale_price ? String(p.sale_price) : "",
    });
    setEditErr("");
    // Önceki incelenen parçanın geçmişi burada tutulmasın — panel her yeni
    // parça için sıfırdan başlasın, yoksa "Geçmiş" boş gelmediği için tekrar
    // çekilmiyor ve önceki parçanın hareketleri yanlışlıkla gösteriliyordu.
    setHareketler([]);
    if (tab === "gecmis") {
      setHareketLoading(true);
      try { setHareketler(await api.partHareketler(p.id)); }
      finally { setHareketLoading(false); }
    }
  }

  async function submitEdit(e) {
    e.preventDefault(); setEditErr("");
    if (!editForm.name.trim()) { setEditErr("Parça adı gerekli"); return; }
    try {
      await api.updatePart(selectedPart.id, {
        name: editForm.name,
        device_model: editForm.device_model || null,
        part_type: editForm.part_type || null,
        quantity: selectedPart.quantity, // değiştirilmiyor — backend gönderilmezse 0'a sıfırlıyor
        min_quantity: parseInt(editForm.min_quantity) || 0,
        purchase_price: editForm.purchase_price ? parseFloat(editForm.purchase_price) : 0,
        sale_price: editForm.sale_price ? parseFloat(editForm.sale_price) : 0,
      });
      setSelectedPart(null);
      api.parts(q ? { q } : {}).then(setParts);
    } catch (e) { setEditErr(e.message); }
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

  function turEkle(t) {
    if (!t || parcaTurleri.includes(t)) return;
    const updated = [...parcaTurleri, t];
    setParcaTurleri(updated);
    saveParcaTurleri(updated);
  }

  function turSil(tur) {
    const updated = parcaTurleri.filter(t => t !== tur);
    setParcaTurleri(updated);
    saveParcaTurleri(updated);
  }

  async function submitEkle(e) {
    e.preventDefault(); setEkleErr("");
    try {
      const aciklama = [ekleForm.toptanci, ekleForm.aciklama].filter(Boolean).join(" - ") || null;
      await api.stokEkle(selectedPart.id, {
        miktar: parseInt(ekleForm.miktar) || 1,
        fiyat: ekleForm.fiyat ? parseFloat(ekleForm.fiyat) : null,
        aciklama,
      });
      setSelectedPart(null);
      setEkleForm({ miktar: "1", fiyat: "", aciklama: "", toptanci: "" });
      api.parts(q ? { q } : {}).then(setParts);
    } catch (e) { setEkleErr(e.message); }
  }

  function handleEkleTop(val) {
    setEkleForm(f => ({ ...f, toptanci: val }));
    if (val.length >= 1) {
      const found = toptancilar.filter(t => t.ad.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
      setEkleTopOner(found); setShowEkleTopOner(found.length > 0);
    } else { setShowEkleTopOner(false); }
  }

  async function deletePart(id) {
    try {
      await api.deletePart(id);
      setDeletePartId(null);
      setSelectedPart(null);
      api.parts(q ? { q } : {}).then(setParts);
    } catch (e) { setErr(e.message); }
  }

  async function deleteOrder(id) {
    try {
      await api.deleteShoppingItem(id);
      setDeleteOrderId(null);
      api.shopping().then(setShopping);
    } catch (e) { setErr(e.message); }
  }

  function handleAddTop(val) {
    setAddForm(f => ({ ...f, toptanci: val, toptanci_id: null }));
    if (val.length >= 1) {
      const found = toptancilar.filter(t => t.ad.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
      setAddTopOner(found); setShowAddTopOner(found.length > 0);
    } else { setShowAddTopOner(false); }
  }

  async function resolveToptanciId() {
    const ad = addForm.toptanci.trim();
    if (!ad) return null;
    if (addForm.toptanci_id) return addForm.toptanci_id;
    const mevcut = toptancilar.find(t => t.ad.toLowerCase() === ad.toLowerCase());
    if (mevcut) return mevcut.id;
    const yeni = await api.createToptanci({ ad });
    api.toptanciList().then(setToptancilar);
    return yeni.id;
  }

  async function submitAddPart(e) {
    e.preventDefault(); setAddErr("");
    try {
      const combinedModel = [addBrand, addForm.device_model].filter(Boolean).join(" ").trim();
      const toptanciId = await resolveToptanciId();
      if (addEklePart) {
        await api.stokEkle(addEklePart.id, {
          miktar: parseInt(addForm.quantity) || 1,
          fiyat: addForm.purchase_price ? parseFloat(addForm.purchase_price) : null,
          aciklama: null,
          toptanci_id: toptanciId,
        });
      } else {
        await api.createPart({
          name: addForm.name,
          device_model: combinedModel || null,
          part_type: addForm.part_type || null,
          quantity: parseInt(addForm.quantity) || 0,
          min_quantity: parseInt(addForm.min_quantity) || 2,
          purchase_price: addForm.purchase_price ? parseFloat(addForm.purchase_price) : 0,
          sale_price: addForm.sale_price ? parseFloat(addForm.sale_price) : 0,
          toptanci_id: toptanciId,
        });
      }
      setShowAddForm(false);
      setAddForm({ name: "", device_model: "", part_type: "", quantity: "1", min_quantity: "2", purchase_price: "", sale_price: "", toptanci: "", toptanci_id: null });
      setAddDolarMode(false);
      setAddDolarMiktar("");
      setAddEklePart(null);
      setAddBrand("");
      api.parts(q ? { q } : {}).then(setParts);
    } catch (e) { setAddErr(e.message); }
  }

  const flatMode = q.trim().length > 0 || lowStock;
  const filteredParts = [...parts].sort((a, b) => {
    if (sortBy === "stok") return b.quantity - a.quantity;
    if (sortBy === "isim") return (a.name || "").localeCompare(b.name || "", "tr");
    return b.id - a.id; // yeni (default)
  });

  return (
    <div className="page">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Package size={19} strokeWidth={2} /> Stok & Siparişler
      </div>

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
          <div style={{ display: "flex", gap: 8, marginBottom: lowStock ? 6 : 10 }}>
            <div className="search-bar" style={{ flex: 1, margin: 0 }}>
              <div className="inset search-input" style={{ borderRadius: 13, display: "flex", alignItems: "center", gap: 9, flex: 1 }}>
                <Search size={16} stroke="var(--hint)" strokeWidth={2} />
                <input style={{ background: "none", border: "none", outline: "none", color: "var(--text)", font: "inherit", fontSize: 15, flex: 1 }}
                  placeholder="Parça ara..." value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(v => !v)}><Plus size={14} strokeWidth={2.4} /> Ekle</button>
          </div>
          {lowStock && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, background: "rgba(246,162,74,0.12)", borderRadius: 10, padding: "9px 13px" }}>
              <TriangleAlert size={15} stroke="var(--orange)" strokeWidth={2} />
              <span style={{ color: "var(--orange)", fontWeight: 600, fontSize: 13, flex: 1 }}>Azalan stok filtresi aktif</span>
              <button onClick={() => setLowStock(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex", padding: 0 }}>
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          )}

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
                        <X size={15} strokeWidth={2} />
                      </button>
                    </div>
                    <form onSubmit={submitAddPart}>
                      {addErr && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {addErr}</div>}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Eklenecek Adet</label>
                          <input className="form-input" type="number" min="1" required value={addForm.quantity}
                            onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span className="form-label" style={{ margin: 0 }}>
                              {addDolarMode ? "Dolar ($)" : "Alış Fiyatı (₺)"}
                            </span>
                            <button type="button"
                              onClick={() => { setAddDolarMode(m => !m); setAddDolarMiktar(""); setAddForm(f => ({ ...f, purchase_price: "" })); }}
                              style={{ marginLeft: "auto", fontSize: 10, padding: "2px 7px", borderRadius: 10, border: "none",
                                background: addDolarMode ? "var(--accent)" : "var(--bg2)", color: addDolarMode ? "#fff" : "var(--hint)",
                                cursor: "pointer", fontWeight: 700 }}>
                              $
                            </button>
                          </div>
                          {addDolarMode ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <input className="form-input" type="number" step="0.01"
                                value={addDolarMiktar} placeholder="0.00"
                                onChange={e => {
                                  setAddDolarMiktar(e.target.value);
                                  const tl = dollarRate ? String(Math.round(parseFloat(e.target.value || 0) * dollarRate)) : "";
                                  setAddForm(f => ({ ...f, purchase_price: tl }));
                                }} />
                              {dollarRate && <span style={{ fontSize: 11, color: "var(--hint)", alignSelf: "center", whiteSpace: "nowrap" }}>≈{addForm.purchase_price}₺</span>}
                            </div>
                          ) : (
                            <input className="form-input" type="number" step="0.01" value={addForm.purchase_price}
                              onChange={e => setAddForm(f => ({ ...f, purchase_price: e.target.value }))}
                              placeholder="Opsiyonel" />
                          )}
                          {addDolarMode && !dollarRate && (
                            <button type="button" onClick={fetchDollarRate} disabled={kurLoading}
                              style={{ marginTop: 4, fontSize: 11, padding: "3px 10px", borderRadius: 10,
                                border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--hint)" }}>
                              {kurLoading ? "..." : <><RefreshCw size={11} strokeWidth={2} /> Kur al</>}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="form-group" style={{ marginTop: 8, position: "relative" }}>
                        <label className="form-label">Toptancı</label>
                        <input className="form-input" value={addForm.toptanci}
                          onChange={e => handleAddTop(e.target.value)}
                          onBlur={() => setTimeout(() => setShowAddTopOner(false), 150)}
                          placeholder="Hangi toptancıdan alındı..." autoComplete="off" />
                        {showAddTopOner && (
                          <div className="ac-dropdown">
                            {addTopOner.map(t => (
                              <div key={t.id} onMouseDown={() => { setAddForm(f => ({ ...f, toptanci: t.ad, toptanci_id: t.id })); setShowAddTopOner(false); }}
                                style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                                {t.ad}
                              </div>
                            ))}
                          </div>
                        )}
                        {addForm.toptanci && !toptancilar.find(t => t.ad.toLowerCase() === addForm.toptanci.trim().toLowerCase()) && (
                          <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 4 }}>Listede yok — kaydedince yeni toptancı olarak eklenecek</div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button type="submit" className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}><Plus size={13} strokeWidth={2.4} /> Stok Ekle</button>
                        <button type="button" className="btn btn-ghost btn-sm"
                          onClick={() => { setShowAddForm(false); setAddEklePart(null); setAddForm({ name: "", device_model: "", part_type: "", quantity: "1", min_quantity: "2", purchase_price: "", sale_price: "", toptanci: "", toptanci_id: null }); setAddDolarMode(false); setAddDolarMiktar(""); }}>
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
                      {addErr && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {addErr}</div>}
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
                      <BrandModelPicker brand={addBrand} model={addForm.device_model}
                        onBrand={setAddBrand}
                        onModel={v => setAddForm(f => ({ ...f, device_model: v }))} />
                      <div style={{ marginTop: 8 }}>
                        <PartTypePicker value={addForm.part_type}
                          onChange={v => setAddForm(f => ({ ...f, part_type: v }))}
                          customTypes={parcaTurleri} onAddCustom={turEkle}
                          onRemoveCustom={turSil} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
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
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span className="form-label" style={{ margin: 0 }}>
                              {addDolarMode ? "Dolar ($)" : "Alış (₺)"}
                            </span>
                            <button type="button"
                              onClick={() => { setAddDolarMode(m => !m); setAddDolarMiktar(""); setAddForm(f => ({ ...f, purchase_price: "" })); }}
                              style={{ marginLeft: "auto", fontSize: 10, padding: "2px 7px", borderRadius: 10, border: "none",
                                background: addDolarMode ? "var(--accent)" : "var(--bg2)", color: addDolarMode ? "#fff" : "var(--hint)",
                                cursor: "pointer", fontWeight: 700 }}>
                              $
                            </button>
                          </div>
                          {addDolarMode ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <input className="form-input" type="number" step="0.01"
                                value={addDolarMiktar} placeholder="0.00"
                                onChange={e => {
                                  setAddDolarMiktar(e.target.value);
                                  const tl = dollarRate ? String(Math.round(parseFloat(e.target.value || 0) * dollarRate)) : "";
                                  setAddForm(f => ({ ...f, purchase_price: tl }));
                                }} />
                              {dollarRate && <span style={{ fontSize: 11, color: "var(--hint)", alignSelf: "center", whiteSpace: "nowrap" }}>≈{addForm.purchase_price}₺</span>}
                            </div>
                          ) : (
                            <input className="form-input" type="number" value={addForm.purchase_price}
                              onChange={e => setAddForm(f => ({ ...f, purchase_price: e.target.value }))}
                              placeholder="0" />
                          )}
                          {addDolarMode && !dollarRate && (
                            <button type="button" onClick={fetchDollarRate} disabled={kurLoading}
                              style={{ marginTop: 4, fontSize: 11, padding: "3px 10px", borderRadius: 10,
                                border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--hint)" }}>
                              {kurLoading ? "..." : <><RefreshCw size={11} strokeWidth={2} /> Kur al</>}
                            </button>
                          )}
                        </div>
                        <div className="form-group" style={{ margin: 0, position: "relative" }}>
                          <label className="form-label">Toptancı</label>
                          <input className="form-input" value={addForm.toptanci}
                            onChange={e => handleAddTop(e.target.value)}
                            onBlur={() => setTimeout(() => setShowAddTopOner(false), 150)}
                            placeholder="Hangi toptancıdan..." autoComplete="off" />
                          {showAddTopOner && (
                            <div className="ac-dropdown">
                              {addTopOner.map(t => (
                                <div key={t.id} onMouseDown={() => { setAddForm(f => ({ ...f, toptanci: t.ad, toptanci_id: t.id })); setShowAddTopOner(false); }}
                                  style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                                  {t.ad}
                                </div>
                              ))}
                            </div>
                          )}
                          {addForm.toptanci && !toptancilar.find(t => t.ad.toLowerCase() === addForm.toptanci.trim().toLowerCase()) && (
                            <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 4 }}>Yeni toptancı olarak eklenecek</div>
                          )}
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Satış (₺)</label>
                          <input className="form-input" type="number" step="0.01" value={addForm.sale_price}
                            onChange={e => setAddForm(f => ({ ...f, sale_price: e.target.value }))}
                            placeholder="Opsiyonel" />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button type="submit" className="btn btn-primary btn-sm">Kaydet</button>
                        <button type="button" className="btn btn-ghost btn-sm"
                          onClick={() => { setShowAddForm(false); setAddForm({ name: "", device_model: "", part_type: "", quantity: "1", min_quantity: "2", purchase_price: "", sale_price: "", toptanci: "", toptanci_id: null }); setAddDolarMode(false); setAddDolarMiktar(""); }}>
                          İptal
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })()}
          {/* Sıralama */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--hint)", fontWeight: 600, flexShrink: 0 }}>SIRALA:</span>
            {[
              { key: "yeni", label: "Yeni" },
              { key: "stok", label: "Stok" },
              { key: "isim", label: "İsim" },
            ].map(s => (
              <button key={s.key} onClick={() => setSortBy(s.key)}
                style={{
                  padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer",
                  background: sortBy === s.key ? "var(--accent)" : "var(--bg2)",
                  color: sortBy === s.key ? "#fff" : "var(--text)",
                  fontWeight: sortBy === s.key ? 700 : 400, fontSize: 12,
                }}>
                {s.label}
              </button>
            ))}
            <button onClick={() => setLowStock(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer",
                background: lowStock ? "var(--orange)" : "var(--bg2)",
                color: lowStock ? "#191b20" : "var(--text)",
                fontWeight: lowStock ? 700 : 400, fontSize: 12, marginLeft: "auto",
              }}>
              <TriangleAlert size={12} strokeWidth={2.2} /> Kritik Stok
            </button>
          </div>
          {loading ? <div className="loading">Yükleniyor...</div> : (() => {
            function renderPart(p) {
              const isSelected = selectedPart?.id === p.id;
              const SEBEP_LABEL = { tamir: "Tamire", satis: "Satış", hasar: "Hasar", diger: "Diğer", satin_alma: "Satın Alındı" };
              const PartIcon = partTypeIcon(p.part_type);
              return (
                <div key={p.id}>
                  {/* Parça satırı */}
                  <div className="list-item" style={{ background: isSelected ? "var(--bg2)" : undefined }}>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 30, height: 30, borderRadius: 9, flexShrink: 0, position: "relative", zIndex: 1,
                      background: "linear-gradient(135deg, var(--surf-hi), var(--surf-lo))",
                      boxShadow: "var(--edge-lit), var(--edge-dark)",
                    }}>
                      <PartIcon size={16} stroke="var(--hint)" strokeWidth={1.8} />
                    </div>
                    <div className="list-item-body" style={{ cursor: "pointer" }} onClick={() => openPanel(p, "ekle")}>
                      <div className="list-item-title">{p.name}</div>
                      <div className="list-item-sub">
                        {p.device_model} · {p.part_type}
                        {(p.purchase_price || p.sale_price) && (
                          priceHidden ? " · Alış: •••₺ · Satış: •••₺" :
                          ` · Alış: ${(p.purchase_price || 0).toLocaleString("tr-TR")}₺ · Satış: ${p.sale_price ? p.sale_price.toLocaleString("tr-TR") + "₺" : "—"}`
                        )}
                        {p.toptanci_adi ? ` · ${p.toptanci_adi}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: 18, color: p.quantity <= p.min_quantity ? "var(--danger)" : "var(--text)" }}>{p.quantity}</div>
                        <div style={{ fontSize: 11, color: "var(--hint)" }}>adet</div>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: "4px 8px", fontSize: 16 }}
                        onClick={e => { e.stopPropagation(); openPanel(p, "gecmis"); }}
                        title="Stok geçmişi"
                      ><History size={15} strokeWidth={2}/></button>
                      {user?.rol === "patron" && (
                        deletePartId === p.id ? (
                          <div style={{ display: "flex", gap: 3 }} onClick={e => e.stopPropagation()}>
                            <button className="btn btn-sm" style={{ background: "var(--danger)", color: "#fff", padding: "4px 8px", fontSize: 12 }}
                              onClick={() => deletePart(p.id)}>Sil</button>
                            <button className="btn btn-ghost btn-sm" style={{ padding: "4px 8px", fontSize: 12 }}
                              onClick={() => setDeletePartId(null)}><X size={13} strokeWidth={2}/></button>
                          </div>
                        ) : (
                          <button className="btn btn-ghost btn-sm" style={{ padding: "4px 7px", fontSize: 14, color: "var(--danger)", opacity: 0.7 }}
                            onClick={e => { e.stopPropagation(); setDeletePartId(p.id); }}><Trash2 size={14} strokeWidth={2}/></button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Panel */}
                  {isSelected && (
                    <div className="card" style={{ marginTop: -4, borderRadius: "0 0 12px 12px", background: "var(--bg2)", marginBottom: 8 }}>
                      {/* Panel sekme */}
                      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                        {[
                          { key: "ekle", label: "Stok Ekle", clr: "var(--success)" },
                          { key: "dus", label: "Stok Düş", clr: "var(--danger)" },
                          { key: "duzenle", label: "Düzenle", clr: "var(--purple)" },
                          { key: "gecmis", label: "Geçmiş", clr: "var(--accent)" },
                        ].map(s => (
                          <button key={s.key} onClick={() => {
                            setPanelTab(s.key);
                            if (s.key === "gecmis") {
                              // Her sekme değişiminde tazele — önceki parçadan kalan
                              // hareketler "boş değil" diye tekrar çekilmeyip yanlışlıkla
                              // gösterilmesin.
                              setHareketLoading(true);
                              api.partHareketler(p.id).then(setHareketler).finally(() => setHareketLoading(false));
                            }
                          }}
                            style={{ padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer",
                              background: panelTab === s.key ? s.clr : "var(--bg)",
                              color: panelTab === s.key ? "#fff" : "var(--text)", fontWeight: 600, fontSize: 12 }}>
                            {s.label}
                          </button>
                        ))}
                      </div>

                      {/* Stok Ekle formu */}
                      {panelTab === "ekle" && (
                        <form onSubmit={submitEkle} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {ekleErr && <div style={{ color: "var(--red)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {ekleErr}</div>}
                          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8 }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label">Adet</label>
                              <input className="form-input" type="number" min="1" required
                                value={ekleForm.miktar}
                                onChange={e => setEkleForm(f => ({ ...f, miktar: e.target.value }))} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                <span className="form-label" style={{ margin: 0 }}>
                                  {ekleDolarMode ? "Dolar ($)" : "Alış Fiyatı (₺)"}
                                </span>
                                <button type="button"
                                  onClick={() => { setEkleDolarMode(m => !m); setEkleDolarMiktar(""); setEkleForm(f => ({ ...f, fiyat: "" })); }}
                                  style={{ marginLeft: "auto", fontSize: 10, padding: "2px 7px", borderRadius: 10, border: "none",
                                    background: ekleDolarMode ? "var(--accent)" : "var(--bg2)", color: ekleDolarMode ? "#fff" : "var(--hint)",
                                    cursor: "pointer", fontWeight: 700 }}>
                                  $
                                </button>
                              </div>
                              {ekleDolarMode ? (
                                <div style={{ display: "flex", gap: 4 }}>
                                  <input className="form-input" type="number" step="0.01"
                                    value={ekleDolarMiktar} placeholder="0.00"
                                    onChange={e => {
                                      setEkleDolarMiktar(e.target.value);
                                      const tl = dollarRate ? String(Math.round(parseFloat(e.target.value || 0) * dollarRate)) : "";
                                      setEkleForm(f => ({ ...f, fiyat: tl }));
                                    }} />
                                  {dollarRate && <span style={{ fontSize: 11, color: "var(--hint)", alignSelf: "center", whiteSpace: "nowrap" }}>≈{ekleForm.fiyat}₺</span>}
                                </div>
                              ) : (
                                <input className="form-input" type="number" step="0.01"
                                  value={ekleForm.fiyat}
                                  onChange={e => setEkleForm(f => ({ ...f, fiyat: e.target.value }))}
                                  placeholder="Opsiyonel" />
                              )}
                            </div>
                          </div>
                          {ekleDolarMode && !dollarRate && (
                            <button type="button" onClick={fetchDollarRate} disabled={kurLoading}
                              style={{ alignSelf: "flex-start", fontSize: 11, padding: "3px 10px", borderRadius: 10,
                                border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--hint)" }}>
                              {kurLoading ? "..." : <><RefreshCw size={11} strokeWidth={2} /> Kur al</>}
                            </button>
                          )}
                          <div className="form-group" style={{ margin: 0, position: "relative" }}>
                            <label className="form-label">Toptancı</label>
                            <input className="form-input" value={ekleForm.toptanci}
                              onChange={e => handleEkleTop(e.target.value)}
                              onBlur={() => setTimeout(() => setShowEkleTopOner(false), 150)}
                              placeholder="Toptancı adı..." autoComplete="off" />
                            {showEkleTopOner && (
                              <div className="ac-dropdown">
                                {ekleTopOner.map(t => (
                                  <div key={t.id} onMouseDown={() => { setEkleForm(f => ({ ...f, toptanci: t.ad })); setShowEkleTopOner(false); }}
                                    style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                                    {t.ad}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Not / Açıklama</label>
                            <input className="form-input" value={ekleForm.aciklama}
                              onChange={e => setEkleForm(f => ({ ...f, aciklama: e.target.value }))}
                              placeholder="Opsiyonel not..." />
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="submit" className="btn btn-sm" style={{ background: "var(--success)", color: "#fff" }}>Ekle</button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedPart(null)}>İptal</button>
                          </div>
                        </form>
                      )}

                      {/* Stok Düş formu */}
                      {panelTab === "dus" && (
                        <>
                          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                            {[
                              { key: "tamir", label: "Tamire Takıldı" },
                              { key: "satis", label: "Satıldı" },
                              { key: "hasar", label: "Hasar/Kayıp" },
                              { key: "diger", label: "Diğer" },
                              { key: "iade", label: "İade Et" },
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
                          {kullanForm.sebep === "iade" ? (
                            <div style={{ padding: "8px 0" }}>
                              <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 8 }}>
                                Parça iade sayfasına yönlendirileceksiniz.
                              </div>
                              <button className="btn btn-sm" style={{ background: "var(--orange)", color: "#191b20", display: "flex", alignItems: "center", gap: 6 }}
                                onClick={() => {
                                  navigate(`/parca-iade?part_id=${p.id}&part_name=${encodeURIComponent(p.name)}`);
                                }}>
                                <Undo2 size={13} strokeWidth={2} /> İade Sayfasına Git
                              </button>
                            </div>
                          ) : (
                          <form onSubmit={submitKullan} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {kullanErr && <div style={{ color: "var(--red)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {kullanErr}</div>}
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
                              <button type="submit" className="btn btn-sm" style={{ background: "var(--danger)", color: "#fff" }}>Düş</button>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedPart(null)}>İptal</button>
                            </div>
                          </form>
                          )}
                        </>
                      )}

                      {/* Düzenle — isim, model, tür, min stok, alış/satış fiyatı */}
                      {panelTab === "duzenle" && (
                        <form onSubmit={submitEdit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {editErr && <div style={{ color: "var(--red)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {editErr}</div>}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Parça Adı *</label>
                            <input className="form-input" required value={editForm.name}
                              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Cihaz Modeli</label>
                            <input className="form-input" value={editForm.device_model}
                              onChange={e => setEditForm(f => ({ ...f, device_model: e.target.value }))} />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label">Min. Stok</label>
                              <input className="form-input" type="number" min="0" value={editForm.min_quantity}
                                onChange={e => setEditForm(f => ({ ...f, min_quantity: e.target.value }))} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label">Alış Fiyatı (₺)</label>
                              <input className="form-input" type="number" step="0.01" value={editForm.purchase_price}
                                onChange={e => setEditForm(f => ({ ...f, purchase_price: e.target.value }))} />
                            </div>
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Satış Fiyatı (₺)</label>
                            <input className="form-input" type="number" step="0.01" value={editForm.sale_price}
                              onChange={e => setEditForm(f => ({ ...f, sale_price: e.target.value }))}
                              placeholder="Müşteriye satılacak fiyat" />
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            <button type="submit" className="btn btn-primary btn-sm">Kaydet</button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedPart(null)}>İptal</button>
                          </div>
                        </form>
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
                                {SEBEP_LABEL[h.sebep] || "Diğer"}
                                {h.aciklama ? ` — ${h.aciklama}` : ""}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--hint)" }}>
                                {h.tarih}
                                {h.yapan_adi ? <span style={{ marginLeft: 6, background: "var(--bg)", borderRadius: 6, padding: "1px 6px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}><User size={10} strokeWidth={2} /> {h.yapan_adi}</span> : ""}
                              </div>
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
            }

            if (flatMode) {
              return filteredParts.length === 0
                ? <div className="empty"><div className="empty-icon" style={{display:"flex",justifyContent:"center"}}><Package size={40} stroke="var(--dim)" strokeWidth={1.5}/></div>Parça bulunamadı</div>
                : filteredParts.map(renderPart);
            }
            return <PartsBrowser parts={parts} renderLeaf={(leafParts) => [...leafParts].sort((a, b) => b.id - a.id).map(renderPart)} />;
          })()}
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
                {err && <div style={{ color: "var(--red)", fontSize: 13, padding: "8px 0", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}
                <div className="form-group">
                  <label className="form-label">Parça Adı *</label>
                  <input className="form-input" required value={shopForm.part_name} onChange={e => setShopForm({ ...shopForm, part_name: e.target.value })} placeholder="Ekran, batarya, entegre..." />
                </div>
                <BrandModelPicker brand={shopBrand} model={shopForm.device_model}
                  onBrand={setShopBrand}
                  onModel={v => setShopForm(f => ({ ...f, device_model: v }))} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className="form-group">
                    <label className="form-label">Adet</label>
                    <input className="form-input" type="number" min="1" value={shopForm.quantity} onChange={e => setShopForm({ ...shopForm, quantity: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tahmini Fiyat (₺)</label>
                    <input className="form-input" type="number" value={shopForm.estimated_price} onChange={e => setShopForm({ ...shopForm, estimated_price: e.target.value })} />
                    {shopForm.estimated_price && dollarRate && (
                      <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 3 }}>
                        ≈ ${(parseFloat(shopForm.estimated_price) / dollarRate).toFixed(2)} USD
                      </div>
                    )}
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
              <div className="empty"><div className="empty-icon" style={{display:"flex",justifyContent:"center"}}><Truck size={40} stroke="var(--dim)" strokeWidth={1.5}/></div>Bekleyen sipariş yok</div>
            ) : shopping.bekliyor.map((item) => (
              <div key={item.id} className="card">
                <div className="card-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{item.part_name}</div>
                    <div style={{ fontSize: 13, color: "var(--hint)" }}>
                      {item.device_model || "—"} · ×{item.quantity}
                      {item.estimated_price ? ` · ~₺${item.estimated_price}` : ""}
                      {item.supplier_hint ? ` · ${item.supplier_hint}` : ""}
                    </div>
                    {item.ekleyen && <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><User size={10} strokeWidth={2} /> {item.ekleyen}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    {user?.rol === "patron" && (
                      deleteOrderId === item.id ? (
                        <div style={{ display: "flex", gap: 3 }}>
                          <button className="btn btn-sm" style={{ background: "var(--danger)", color: "#fff", padding: "4px 8px", fontSize: 12 }}
                            onClick={() => deleteOrder(item.id)}>Sil</button>
                          <button className="btn btn-ghost btn-sm" style={{ padding: "4px 8px", fontSize: 12 }}
                            onClick={() => setDeleteOrderId(null)}><X size={13} strokeWidth={2}/></button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost btn-sm" style={{ padding: "4px 7px", fontSize: 14, color: "var(--danger)", opacity: 0.7 }}
                          onClick={() => setDeleteOrderId(item.id)}><Trash2 size={14} strokeWidth={2}/></button>
                      )
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => { setBoughtItem(item); setBoughtData(d => ({ ...d, stokMiktar: String(item.quantity || 1) })); }}>
                      <CheckCircle2 size={13} strokeWidth={2} /> Aldım
                    </button>
                  </div>
                </div>
              </div>
            ))
          }

          {/* ALDIM MODAL */}
          {boughtItem && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
              <div style={{ background: "var(--bg)", borderRadius: 20, padding: "20px 16px 32px", width: "100%", maxWidth: 480 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} strokeWidth={2} /> Alındı: {boughtItem.part_name}</div>
                <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 14 }}>{boughtItem.device_model}</div>
                <form onSubmit={submitBought}>
                  {err && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}

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
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Factory size={13} strokeWidth={2} /> {t.ad}</span>
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
                      <DollarSign size={12} strokeWidth={2} /> Dolar ile gir
                    </button>
                    {dollarRate && <span style={{ fontSize: 12, color: "var(--hint)" }}>1$ = ₺{dollarRate}</span>}
                    <button type="button" onClick={fetchDollarRate} disabled={kurLoading}
                      style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 16, border: "1px solid var(--border)",
                        background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--hint)" }}>
                      {kurLoading ? "..." : <><RefreshCw size={11} strokeWidth={2} /> Kur</>}
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
                        <PartTypePicker value={boughtData.partType}
                          onChange={v => setBoughtData(d => ({ ...d, partType: v }))}
                          customTypes={parcaTurleri} onAddCustom={turEkle} onRemoveCustom={turSil} />
                      </div>
                    )}
                    {boughtData.stokEkle && matchingParts.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, color: "var(--hint)", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
                          Hangi stoğa eklensin?
                        </div>
                        {matchingParts.map(p => (
                          <div key={p.id}
                            onClick={() => setBoughtExistingId(p.id)}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                              borderRadius: 8, marginBottom: 4,
                              background: boughtExistingId === p.id ? "rgba(36,129,204,0.12)" : "transparent",
                              border: `1.5px solid ${boughtExistingId === p.id ? "var(--accent)" : "var(--border)"}`,
                              cursor: "pointer" }}>
                            <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                              border: `2px solid ${boughtExistingId === p.id ? "var(--accent)" : "var(--hint)"}`,
                              background: boughtExistingId === p.id ? "var(--accent)" : "transparent" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 12 }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: "var(--hint)" }}>
                                {p.device_model ? `${p.device_model} · ` : ""}{p.quantity} stok
                              </div>
                            </div>
                          </div>
                        ))}
                        <div
                          onClick={() => setBoughtExistingId(null)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                            borderRadius: 8,
                            background: boughtExistingId === null ? "rgba(36,129,204,0.12)" : "transparent",
                            border: `1.5px solid ${boughtExistingId === null ? "var(--accent)" : "var(--border)"}`,
                            cursor: "pointer" }}>
                          <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                            border: `2px solid ${boughtExistingId === null ? "var(--accent)" : "var(--hint)"}`,
                            background: boughtExistingId === null ? "var(--accent)" : "transparent" }} />
                          <div style={{ fontSize: 12, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}><Plus size={11} strokeWidth={2.4} /> Yeni stok kaydı oluştur</div>
                        </div>
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
          <div className="search-bar" style={{ marginBottom: 10 }}>
            <input className="search-input" placeholder="Geçmişte ara..." value={gecmisQ} onChange={e => setGecmisQ(e.target.value)} />
          </div>
          {loading ? <div className="loading">Yükleniyor...</div> :
            shopping.alindi.filter(i =>
              !gecmisQ || i.part_name.toLowerCase().includes(gecmisQ.toLowerCase()) ||
              (i.device_model || "").toLowerCase().includes(gecmisQ.toLowerCase()) ||
              (i.bought_from || "").toLowerCase().includes(gecmisQ.toLowerCase())
            ).length === 0 ? (
              <div className="empty"><div className="empty-icon" style={{display:"flex",justifyContent:"center"}}><CheckCircle2 size={40} stroke="var(--dim)" strokeWidth={1.5}/></div>Henüz alınan parça yok</div>
            ) : shopping.alindi.filter(i =>
              !gecmisQ || i.part_name.toLowerCase().includes(gecmisQ.toLowerCase()) ||
              (i.device_model || "").toLowerCase().includes(gecmisQ.toLowerCase()) ||
              (i.bought_from || "").toLowerCase().includes(gecmisQ.toLowerCase())
            ).map((item) => (
              <div key={item.id} className="list-item" style={{ opacity: 0.9 }}>
                <div className="list-item-body">
                  <div className="list-item-title" style={{ display: "flex", alignItems: "center", gap: 7 }}><CheckCircle2 size={14} strokeWidth={2} /> {item.part_name}</div>
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
