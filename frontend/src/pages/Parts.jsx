import { useEffect, useState } from "react";
import { api } from "../api";

const TABS = [
  { key: "stok", label: "📦 Stok" },
  { key: "orders", label: "🚚 Siparişler" },
  { key: "shopping", label: "🛒 Alışveriş" },
];

export default function Parts() {
  const [tab, setTab] = useState("stok");
  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shopping, setShopping] = useState({ bekliyor: [], alindi: [] });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

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
    await api.markBought(id, {
      bought_from: firm || null,
      bought_price: price ? parseFloat(price) : null,
    });
    api.shopping().then(setShopping);
  }

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
            <input className="search-input" placeholder="🔍 Parça ara..." value={q}
              onChange={(e) => setQ(e.target.value)} />
          </div>
          {loading ? <div className="loading">Yükleniyor...</div> :
            parts.length === 0 ? <div className="empty"><div className="empty-icon">📦</div>Parça bulunamadı</div> :
            parts.map((p) => (
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
