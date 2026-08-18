import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../api";
import { Wrench, Search, MessageCircle, Plus, ChevronUp, ChevronDown } from "lucide-react";

const TABS = [
  { key: "", label: "Tümü" },
  { key: "bekliyor", label: "Bekliyor" },
  { key: "tamirde", label: "Tamirde" },
  { key: "parca_bekleniyor", label: "Parça" },
  { key: "hazir", label: "Hazır" },
  { key: "teslim", label: "Teslim" },
];

const STATUS_LABEL = {
  bekliyor: "Bekliyor", tamirde: "Tamirde",
  parca_bekleniyor: "Parça", hazir: "Hazır", teslim: "Teslim",
};

const STATUS_RENK = {
  bekliyor: "var(--orange)", tamirde: "var(--blue)",
  parca_bekleniyor: "var(--purple)", hazir: "var(--green)", teslim: "var(--gray)",
};

function servisSuresi(created_at, status) {
  if (!created_at || status === "teslim") return null;
  const gun = Math.floor((Date.now() - new Date(created_at).getTime()) / 86400000);
  return gun;
}

const GUN_BG = {
  yesil: "rgba(74, 222, 128, 0.15)",
  turuncu: "rgba(246, 162, 74, 0.15)",
  kirmizi: "rgba(248, 113, 113, 0.15)",
};

function ServisGun({ gun, status }) {
  if (gun === null || status === "teslim") return null;
  let renk = "var(--green)", key = "yesil";
  if (gun >= 3) { renk = "var(--orange)"; key = "turuncu"; }
  if (gun >= 7) { renk = "var(--red)"; key = "kirmizi"; }
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color: renk,
      background: GUN_BG[key],
      padding: "2px 7px", borderRadius: 6,
    }}>
      {gun === 0 ? "Bugün" : `${gun}g`}
    </span>
  );
}

function SortTh({ label, col, sort, setSort }) {
  const active = sort.col === col;
  return (
    <th className="sortable" onClick={() => setSort(s => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }))}>
      <span className="th-inner">
        {label}
        {active && (sort.dir === "asc" ? <ChevronUp size={12} strokeWidth={2.4} /> : <ChevronDown size={12} strokeWidth={2.4} />)}
      </span>
    </th>
  );
}

function openWA(phone, model) {
  const raw = (phone || "").replace(/\D/g, "");
  if (!raw) { alert("Müşteri telefon numarası kayıtlı değil"); return; }
  const num = raw.startsWith("90") ? raw : raw.startsWith("0") ? "9" + raw : "90" + raw;
  const text = encodeURIComponent(`Merhaba, ${model || "cihazınız"} tamiri tamamlandı, teslim alabilirsiniz. ✅`);
  window.open(`https://wa.me/${num}?text=${text}`, "_blank");
}

export default function Repairs() {
  const [repairs, setRepairs] = useState([]);
  const [tab, setTab] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState({ col: "created_at", dir: "desc" });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const s = params.get("status");
    setTab(s || "");
    // location.search'e bağlı: sayfa zaten açıkken (ör. Ana Sayfa'daki durum
    // kartlarından) farklı bir status ile tekrar gelindiğinde bileşen yeniden
    // mount olmaz — [] bağımlılığıyla bu efekt bir daha çalışmaz ve filtre
    // eski değerde takılı kalırdı ("yanlış gösteriyor, elle değiştirince düzeliyor").
  }, [location.search]);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (tab) params.status = tab;
    if (q) params.q = q;
    api.repairs(params).then(setRepairs).finally(() => setLoading(false));
  }, [tab, q]);

  const sortedRepairs = useMemo(() => {
    const list = [...repairs];
    const { col, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let av = a[col], bv = b[col];
      if (col === "created_at") { av = new Date(av || 0).getTime(); bv = new Date(bv || 0).getTime(); }
      else { av = (av || "").toString().toLowerCase(); bv = (bv || "").toString().toLowerCase(); }
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return list;
  }, [repairs, sort]);

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 9 }}>
          <Wrench size={19} strokeWidth={2} /> Tamirler
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate("/repairs/new")}>
          <Plus size={14} strokeWidth={2.4} /> Yeni
        </button>
      </div>

      <div className="search-bar">
        <div className="inset search-input" style={{ borderRadius: 13, display: "flex", alignItems: "center", gap: 9, flex: 1 }}>
          <Search size={16} stroke="var(--hint)" strokeWidth={2} />
          <input
            style={{ background: "none", border: "none", outline: "none", color: "var(--text)", font: "inherit", fontSize: 15, flex: 1 }}
            placeholder="Müşteri, model, tamir no..."
            value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : repairs.length === 0 ? (
        <div className="empty">
          <div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}>
            <Wrench size={40} stroke="var(--dim)" strokeWidth={1.5} />
          </div>
          Tamir bulunamadı
        </div>
      ) : (
        <>
          <div className="mobile-list">
            {repairs.map(r => {
              const gun = servisSuresi(r.created_at, r.status);
              return (
                <div key={r.id} className="list-item" onClick={() => navigate(`/repairs/${r.id}`)}>
                  <div style={{
                    width: 4, borderRadius: 4, alignSelf: "stretch", flexShrink: 0,
                    background: STATUS_RENK[r.status] || "var(--divider)",
                    marginRight: 4, position: "relative", zIndex: 1,
                  }} />
                  <div className="list-item-body">
                    <div className="list-item-title">
                      {r.customer_name || "—"} · {r.device_model}
                    </div>
                    <div className="list-item-sub">
                      #{r.repair_no} · {r.fault_desc || "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0, position: "relative", zIndex: 1 }}>
                    <span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    <ServisGun gun={gun} status={r.status} />
                    {r.status === "hazir" && (
                      <button
                        onClick={e => { e.stopPropagation(); openWA(r.customer_phone, r.device_model); }}
                        style={{
                          background: "#25D366", color: "#fff", border: "none",
                          borderRadius: 8, padding: "4px 8px", fontSize: 12,
                          cursor: "pointer", fontWeight: 700, lineHeight: 1.4,
                          display: "flex", alignItems: "center", gap: 4,
                        }}
                        title="WhatsApp ile bildir"
                      ><MessageCircle size={12} strokeWidth={2.2} /> WA</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="desktop-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <SortTh label="Tamir No" col="repair_no" sort={sort} setSort={setSort} />
                  <SortTh label="Müşteri" col="customer_name" sort={sort} setSort={setSort} />
                  <SortTh label="Cihaz" col="device_model" sort={sort} setSort={setSort} />
                  <SortTh label="Arıza" col="fault_desc" sort={sort} setSort={setSort} />
                  <SortTh label="Durum" col="status" sort={sort} setSort={setSort} />
                  <SortTh label="Tarih" col="created_at" sort={sort} setSort={setSort} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedRepairs.map(r => {
                  const gun = servisSuresi(r.created_at, r.status);
                  return (
                    <tr key={r.id} onClick={() => navigate(`/repairs/${r.id}`)}>
                      <td>#{r.repair_no}</td>
                      <td>{r.customer_name || "—"}</td>
                      <td>{r.device_model}</td>
                      <td>{r.fault_desc || "—"}</td>
                      <td>
                        <span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                        {" "}<ServisGun gun={gun} status={r.status} />
                      </td>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleDateString("tr-TR") : "—"}</td>
                      <td>
                        {r.status === "hazir" && (
                          <button
                            onClick={e => { e.stopPropagation(); openWA(r.customer_phone, r.device_model); }}
                            style={{
                              background: "#25D366", color: "#fff", border: "none",
                              borderRadius: 8, padding: "4px 8px", fontSize: 12,
                              cursor: "pointer", fontWeight: 700, lineHeight: 1.4,
                              display: "flex", alignItems: "center", gap: 4,
                            }}
                            title="WhatsApp ile bildir"
                          ><MessageCircle size={12} strokeWidth={2.2} /> WA</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
