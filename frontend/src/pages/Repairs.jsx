import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../api";
import { Wrench, Search, MessageCircle, Plus, ChevronUp, ChevronDown, Check } from "lucide-react";

const TABS = [
  { key: "", label: "Tümü" },
  { key: "bekliyor", label: "Bekliyor" },
  { key: "tamirde", label: "Tamirde" },
  { key: "parca_bekleniyor", label: "Parça" },
  { key: "hazir", label: "Hazır" },
  { key: "teslim", label: "Teslim" },
  { key: "iptal", label: "İptal" },
];

const STATUS_LABEL = {
  bekliyor: "Bekliyor", tamirde: "Tamirde",
  parca_bekleniyor: "Parça", hazir: "Hazır", teslim: "Teslim", iptal: "İptal",
};

const STATUS_RENK = {
  bekliyor: "var(--orange)", tamirde: "var(--blue)",
  parca_bekleniyor: "var(--purple)", hazir: "var(--green)", teslim: "var(--gray)", iptal: "var(--red)",
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

// "bekliyor"dan doğrudan "hazır"a atlanamaz — RepairDetail.jsx'teki akış
// kuralıyla aynı (backend de zorluyor). Buradan sadece bu dört "basit" duruma
// tek tıkla geçilebilir; Teslim (fiyat/kasa) ve İptal (iade bilgisi) kendi
// formlarını gerektirdiği için buradan değil, tamirin detayından yapılır.
const DURUM_SIRASI = {
  bekliyor: ["tamirde"],
  tamirde: ["parca_bekleniyor", "hazir"],
  parca_bekleniyor: ["tamirde", "hazir"],
  hazir: ["tamirde"],
  teslim: [],
  iptal: [],
};
const HIZLI_DURUMLAR = ["bekliyor", "tamirde", "parca_bekleniyor", "hazir"];

function DurumSecPencere({ repair, onClose, onDegisti }) {
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  async function sec(status) {
    if (status === repair.status || saving) return;
    setSaving(true);
    try {
      await api.updateRepairStatus(repair.id, status);
      onDegisti(repair.id, status);
      onClose();
    } catch (e) {
      const mesaj = e.message || "Durum değiştirilemedi";
      // "Tamirde"ye geçiş cihaz muayenesi onaylanmadan yapılamaz — bu sadece
      // tamirin detayından yapılabildiği için listeden dead-end alert yerine
      // oraya yönlendiriyoruz.
      if (/muayene/i.test(mesaj) && confirm(mesaj + "\n\nTamirin detayına gidip tamamlamak ister misiniz?")) {
        navigate(`/repairs/${repair.id}`);
        return;
      }
      alert(mesaj);
      setSaving(false);
    }
  }
  const erisilebilirler = DURUM_SIRASI[repair.status] || [];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "20px 20px 0 0" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          {repair.customer_name || "—"} · {repair.device_model}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {HIZLI_DURUMLAR.map(key => {
            const buDurum = repair.status === key;
            const erisilebilir = buDurum || erisilebilirler.includes(key);
            return (
              <button key={key} disabled={saving || !erisilebilir} onClick={() => sec(key)}
                title={!erisilebilir ? `'${STATUS_LABEL[repair.status]}' durumundan doğrudan geçilemez` : undefined}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: 10, fontFamily: "inherit",
                  border: buDurum ? `1.5px solid ${STATUS_RENK[key]}` : "1px solid var(--divider)",
                  background: buDurum ? "rgba(255,255,255,0.05)" : "transparent",
                  color: "var(--text)", fontSize: 14, fontWeight: 600,
                  cursor: erisilebilir ? "pointer" : "not-allowed",
                  opacity: erisilebilir ? 1 : 0.35,
                }}>
                {STATUS_LABEL[key]}
                {buDurum && <Check size={16} stroke={STATUS_RENK[key]} strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>
        {repair.status !== "teslim" && repair.status !== "iptal" && (
          <button onClick={() => navigate(`/repairs/${repair.id}`)}
            style={{
              width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 10,
              border: "1px dashed var(--divider)", background: "transparent",
              color: "var(--hint)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
            Teslim Et / İptal Et — tamirin detayına git
          </button>
        )}
      </div>
    </div>
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
  const [durumSecim, setDurumSecim] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  function durumDegisti(repairId, status) {
    setRepairs(list => list.map(r => r.id === repairId ? { ...r, status } : r));
  }

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
    // location.search'i okuyan efekt tab'ı setTab ile güncelliyor; aynı render
    // döngüsünde bu efekt henüz ESKİ tab değeriyle (ör. "") tetiklenip filtresiz
    // bir istek atıyor, hemen ardından tab değişince YENİ (filtreli) istek de
    // atılıyordu. Filtresiz istek ağda geç dönerse filtreli sonucun üzerine
    // yazıp yanlış (karışık durumlu) listeyi gösteriyordu. `iptal` bayrağı geç
    // kalan/eski isteklerin sonucunu uygulamayı engelliyor.
    let iptal = false;
    setLoading(true);
    const params = {};
    if (tab) params.status = tab;
    if (q) params.q = q;
    api.repairs(params)
      .then(r => { if (!iptal) setRepairs(r); })
      .finally(() => { if (!iptal) setLoading(false); });
    return () => { iptal = true; };
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
                    <span className={`badge badge-${r.status}`} onClick={e => { e.stopPropagation(); setDurumSecim(r); }}
                      style={{ cursor: "pointer" }}>{STATUS_LABEL[r.status]}</span>
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
                        <span className={`badge badge-${r.status}`} onClick={e => { e.stopPropagation(); setDurumSecim(r); }}
                          style={{ cursor: "pointer" }}>{STATUS_LABEL[r.status]}</span>
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

      {durumSecim && (
        <DurumSecPencere repair={durumSecim} onClose={() => setDurumSecim(null)} onDegisti={durumDegisti} />
      )}
    </div>
  );
}
