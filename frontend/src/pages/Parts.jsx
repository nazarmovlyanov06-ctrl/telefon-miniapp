import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";

const TABS = [
  { key: "stok", label: "📦 Stok" },
  { key: "orders", label: "🚚 Siparişler" },
  { key: "shopping", label: "🛒 Alışveriş" },
];

export default function Parts() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "stok");
  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shopping, setShopping] = useState({ bekliyor: [], alindi: [] });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState("Tümü");
  const [typeFilter, setTypeFilter] = useState("Tümü");
  const [showShopForm, setShowShopForm] = useState(false);
  const [shopForm, setShopForm] = useState({ part_name: "", device_model: "", quantity: "1", estimated_price: "", supplier_hint: "" });
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    if (tab === "stok") {
      api.parts(q ? { q } : {}).then(setParts).finally(() => setLoading(false));
    } else if (tab === "orders") {
      api.orders().then(setOrders).finally(() => setLoading(false));
    } else {
      api.shopping().then(setShopping).finally(() => setLoading(false));
    }
  }, [tab, q]);

  async function markBought(id) {
    const firm = prompt("Hangi toptancıdan? (boş bırakabilirsin)");
    const price = prompt("Fiyat? (₺, boş bırakabilirsin)");
    await api.markBought(id, { bought_from: firm || null, bought_price: price ? parseFloat(price) : null });
    api.shopping().then(setShopping);
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

  // Marka ve tür filtreleri için benzersiz değerleri çıkar
  const brands = ["Tümü", ...new Set(parts.map(p => (p.device_model || "").split(" ")[0]).filter(Boolean).sort())];
  const types = ["Tümü", ...new Set(parts.map(p => p.part_type).filter(Boolean).sort())];

  const filteredParts = parts.filter(p => {
    const brandMatch = brandFilter === "Tümü" || (p.device_model || "").toLowerCase().startsWith(brandFilter.toLowerCase());
    const typeMatch = typeFilter === "Tümü" || p.part_type === typeFilter;
    return brandMatch && typeMatch;
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

      {tab === "stok" && (
        <>
          <div className="search-bar">
            <input className="search-input" placeholder="🔍 Parça ara..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {/* Marka filtresi */}
          {brands.length > 1 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--hint)", marginBottom: 4, fontWeight: 600 }}>MARKA</div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
                {brands.map(b => (
                  <button key={b} onClick={() => { setBrandFilter(b); setTypeFilter("Tümü"); }}
                    style={{
                      flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: "none",
                      background: brandFilter === b ? "var(--accent)" : "var(--bg2)",
                      color: brandFilter === b ? "#fff" : "var(--text)",
                      fontWeight: brandFilter === b ? 700 : 400, fontSize: 12, cursor: "pointer",
                    }}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tür/Kategori filtresi */}
          {types.length > 1 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--hint)", marginBottom: 4, fontWeight: 600 }}>PARÇA TÜRÜ</div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
                {types.map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    style={{
                      flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: "none",
                      background: typeFilter === t ? "var(--success)" : "var(--bg2)",
                      color: typeFilter === t ? "#fff" : "var(--text)",
                      fontWeight: typeFilter === t ? 700 : 400, fontSize: 12, cursor: "pointer",
                    }}>
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
                  <div style={{
                    fontWeight: 700, fontSize: 18,
                    color: p.quantity <= p.min_quantity ? "var(--danger)" : "var(--text)"
                  }}>{p.quantity}</div>
                  <div style={{ fontSize: 11, color: "var(--hint)" }}>adet</div>
                </div>
              </div>
            ))
          }
        </>
      )}

      {tab === "orders" && (
        <>
          {loading ? <div className="loading">Yükleniyor...</div> :
            orders.length === 0 ? <div className="empty"><div className="empty-icon">🚚</div>Sipariş yok</div> :
            orders.map((o) => (
              <div key={o.id} className="card">
                <div className="card-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>{o.part_name}</div>
                    <div style={{ fontSize: 13, color: "var(--hint)" }}>
                      {o.device_model} · {o.supplier_name || "Toptancı belirtilmedi"}
                    </div>
                  </div>
                  <span className={`badge badge-${o.status === "geldi" ? "hazir" : "bekliyor"}`}>
                    {o.status === "geldi" ? "✅ Geldi" : "⏳ Bekleniyor"}
                  </span>
                </div>
                {o.status !== "geldi" && (
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
                    onClick={async () => { await api.markArrived(o.id); api.orders().then(setOrders); }}>
                    ✅ Geldi Olarak İşaretle
                  </button>
                )}
              </div>
            ))
          }
        </>
      )}

      {tab === "shopping" && (
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

          {shopping.bekliyor.length === 0 && shopping.alindi.length === 0 ? (
            <div className="empty"><div className="empty-icon">🛒</div>Liste boş</div>
          ) : (
            <>
              {shopping.bekliyor.length > 0 && (
                <>
                  <div className="section-title">Bekleyenler ({shopping.bekliyor.length})</div>
                  {shopping.bekliyor.map((item) => (
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
                        <button className="btn btn-primary btn-sm" onClick={() => markBought(item.id)}>
                          ✅ Aldım
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {shopping.alindi.length > 0 && (
                <>
                  <div className="section-title">Son Alınanlar</div>
                  {shopping.alindi.map((item) => (
                    <div key={item.id} className="list-item" style={{ opacity: 0.6 }}>
                      <div className="list-item-body">
                        <div className="list-item-title">✅ {item.part_name}</div>
                        <div className="list-item-sub">
                          {item.bought_from || "—"} {item.bought_price ? `· ₺${item.bought_price}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
