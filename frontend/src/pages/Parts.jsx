import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";

const TABS = [
  { key: "stok", label: "📦 Stok" },
  { key: "orders", label: "🚚 Siparişler" },
  { key: "gecmis", label: "✅ Geçmiş" },
];

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
  const [boughtData, setBoughtData] = useState({ toptanci: "", fiyat: "", stokEkle: true, stokMiktar: "1" });
  const [toptancilar, setToptancilar] = useState([]);
  const [toptanciOner, setToptanciOner] = useState([]);
  const [showToptanciOner, setShowToptanciOner] = useState(false);

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

  async function submitBought(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.markBought(boughtItem.id, {
        bought_from: boughtData.toptanci || null,
        bought_price: boughtData.fiyat ? parseFloat(boughtData.fiyat) : null,
        stok_ekle: boughtData.stokEkle,
        stok_miktar: parseInt(boughtData.stokMiktar) || 1,
      });
      setBoughtItem(null);
      setBoughtData({ toptanci: "", fiyat: "", stokEkle: true, stokMiktar: "1" });
      api.shopping().then(setShopping);
    } catch (e) { setErr(e.message); }
  }

  async function submitShopItem(e) {
    e.preventDefault(); setErr("");
    try {
      await api.addShoppingItem({
        part_name: shopForm.part_name,
        device_model: shopForm.device_model || null,
        quantity: parseInt(shopForm.quantity) || 1,
        estimated_price: shopForm.estimated_price ? parseFloat(shopForm.estimated_price) : null,
        supplier_hint: shopForm.supplier_hint || null,
      });
      setShowShopForm(false);
      setShopForm({ part_name: "", device_model: "", quantity: "1", estimated_price: "", supplier_hint: "" });
      api.shopping().then(setShopping);
    } catch (e) { setErr(e.message); }
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
          <div className="search-bar">
            <input className="search-input" placeholder="🔍 Parça ara..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
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
            filteredParts.map((p) => (
              <div key={p.id} className="list-item">
                <div className="list-item-body">
                  <div className="list-item-title">{p.name}</div>
                  <div className="list-item-sub">{p.device_model} · {p.part_type}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: p.quantity <= p.min_quantity ? "var(--danger)" : "var(--text)" }}>{p.quantity}</div>
                  <div style={{ fontSize: 11, color: "var(--hint)" }}>adet</div>
                </div>
              </div>
            ))
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
                  <label className="form-label">Cihaz Modeli</label>
                  <input className="form-input" value={shopForm.device_model} onChange={e => setShopForm({ ...shopForm, device_model: e.target.value })} placeholder="iPhone 13, Samsung A54..." />
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

                  <div className="form-group">
                    <label className="form-label">Ödenen Fiyat (₺)</label>
                    <input className="form-input" type="number" value={boughtData.fiyat} onChange={e => setBoughtData(d => ({ ...d, fiyat: e.target.value }))} placeholder="0" />
                  </div>

                  {/* Stoğa Ekle */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 12px", background: "var(--bg2)", borderRadius: 10 }}>
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
              <div key={item.id} className="list-item" style={{ opacity: 0.85 }}>
                <div className="list-item-body">
                  <div className="list-item-title">✅ {item.part_name}</div>
                  <div className="list-item-sub">
                    {item.device_model ? `${item.device_model} · ` : ""}
                    {item.bought_from || "Toptancı belirtilmedi"}
                    {item.bought_price ? ` · ₺${item.bought_price}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--hint)", flexShrink: 0 }}>×{item.quantity}</div>
              </div>
            ))
          }
        </>
      )}
    </div>
  );
}
