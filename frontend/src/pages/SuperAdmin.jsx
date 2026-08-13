import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  ShieldAlert, Store, BarChart3, Wallet, LifeBuoy, Activity,
  Users, Wrench, TrendingUp, CircleX, Clock,
} from "lucide-react";

const TABS = [
  { key: "dukkanlar", label: "Dükkânlar", icon: Store },
  { key: "istatistik", label: "İstatistik", icon: BarChart3 },
  { key: "mali", label: "Mali Durum", icon: Wallet },
  { key: "destek", label: "Destek", icon: LifeBuoy },
  { key: "aktivite", label: "Aktivite", icon: Activity },
];

const DURUM_META = {
  deneme: { label: "Deneme", color: "var(--blue)" },
  aktif: { label: "Aktif", color: "var(--green)" },
  askida: { label: "Askıda", color: "var(--orange)" },
  iptal: { label: "İptal", color: "var(--red)" },
};

function DukkanlarTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [changingId, setChangingId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setList(await api.adminDukkanlar()); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function degistir(id, durum) {
    setChangingId(id);
    try {
      await api.adminSetAbonelik(id, durum);
      await load();
    } catch (e) { setErr(e.message); }
    finally { setChangingId(null); }
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (err) return (
    <div style={{ color: "var(--danger)", fontSize: 13, display: "flex", alignItems: "center", gap: 6, padding: "12px 0" }}>
      <CircleX size={14} strokeWidth={2} /> {err}
    </div>
  );
  if (list.length === 0) return (
    <div className="empty"><div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><Store size={40} stroke="var(--dim)" strokeWidth={1.5} /></div>Henüz dükkân yok</div>
  );

  return (
    <>
      <div className="mobile-list">
        {list.map(d => {
          const meta = DURUM_META[d.abonelik_durumu] || { label: d.abonelik_durumu, color: "var(--hint)" };
          return (
            <div key={d.id} className="card" style={{ marginBottom: 8 }}>
              <div className="card-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{d.ad}</div>
                  <div style={{ fontSize: 12, color: "var(--hint)" }}>{d.slug} · {d.sehir || "—"}</div>
                  <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 2, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Users size={11} strokeWidth={2} /> {d.kullanici_sayisi}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Wrench size={11} strokeWidth={2} /> {d.tamir_sayisi}</span>
                  </div>
                </div>
                <span className="badge" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.label}</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {Object.entries(DURUM_META).map(([key, m]) => (
                  <button key={key} disabled={changingId === d.id || d.abonelik_durumu === key}
                    onClick={() => degistir(d.id, key)}
                    className="btn btn-ghost btn-sm"
                    style={{ opacity: d.abonelik_durumu === key ? 0.4 : 1, fontSize: 12 }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="desktop-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Dükkân</th>
              <th>Şehir</th>
              <th>Kullanıcı</th>
              <th>Tamir</th>
              <th>Durum</th>
              <th>Değiştir</th>
            </tr>
          </thead>
          <tbody>
            {list.map(d => {
              const meta = DURUM_META[d.abonelik_durumu] || { label: d.abonelik_durumu, color: "var(--hint)" };
              return (
                <tr key={d.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{d.ad}</div>
                    <div style={{ fontSize: 12, color: "var(--hint)" }}>{d.slug}</div>
                  </td>
                  <td>{d.sehir || "—"}</td>
                  <td>{d.kullanici_sayisi}</td>
                  <td>{d.tamir_sayisi}</td>
                  <td><span className="badge" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.label}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {Object.entries(DURUM_META).map(([key, m]) => (
                        <button key={key} disabled={changingId === d.id || d.abonelik_durumu === key}
                          onClick={(e) => { e.stopPropagation(); degistir(d.id, key); }}
                          className="btn btn-ghost btn-sm"
                          style={{ opacity: d.abonelik_durumu === key ? 0.4 : 1, fontSize: 11, padding: "4px 8px" }}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function IstatistikTab() {
  const [stat, setStat] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.adminIstatistik().then(setStat).catch(e => setErr(e.message));
  }, []);

  if (err) return (
    <div style={{ color: "var(--danger)", fontSize: 13, display: "flex", alignItems: "center", gap: 6, padding: "12px 0" }}>
      <CircleX size={14} strokeWidth={2} /> {err}
    </div>
  );
  if (!stat) return <div className="loading">Yükleniyor...</div>;

  const CARDS = [
    { label: "Toplam Dükkân", value: stat.toplam_dukkan, icon: Store, color: "var(--blue)" },
    { label: "Aktif Abonelik", value: stat.aktif_dukkan, icon: TrendingUp, color: "var(--green)" },
    { label: "Deneme Sürümü", value: stat.deneme_dukkan, icon: Clock, color: "var(--gold)" },
    { label: "Askıda", value: stat.askida_dukkan, icon: ShieldAlert, color: "var(--orange)" },
    { label: "Aktif Kullanıcı", value: stat.toplam_kullanici, icon: Users, color: "var(--purple)" },
    { label: "Toplam Tamir", value: stat.toplam_tamir, icon: Wrench, color: "var(--blue2)" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
      {CARDS.map(c => (
        <div key={c.label} className="stat-card" style={{ padding: 16 }}>
          <c.icon size={18} stroke={c.color} strokeWidth={2} />
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{c.value ?? 0}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
      <div className="stat-card" style={{ padding: 16 }}>
        <TrendingUp size={18} stroke="var(--green)" strokeWidth={2} />
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{stat.son_30gun_yeni_dukkan ?? 0}</div>
        <div className="stat-label">Son 30 Gün Yeni</div>
      </div>
    </div>
  );
}

function YakindaTab({ icon: Icon, label }) {
  return (
    <div className="empty">
      <div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}>
        <Icon size={40} stroke="var(--dim)" strokeWidth={1.5} />
      </div>
      {label} — yakında
    </div>
  );
}

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("dukkanlar");

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/more")}>← Geri</button>
        <div className="page-title" style={{ margin: 0, flex: 1, display: "flex", alignItems: "center", gap: 9 }}>
          <ShieldAlert size={19} strokeWidth={2} /> Süper Admin
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        {TABS.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dukkanlar" && <DukkanlarTab />}
      {tab === "istatistik" && <IstatistikTab />}
      {tab === "mali" && <YakindaTab icon={Wallet} label="Mali Durum" />}
      {tab === "destek" && <YakindaTab icon={LifeBuoy} label="Destek" />}
      {tab === "aktivite" && <YakindaTab icon={Activity} label="Aktivite" />}
    </div>
  );
}
