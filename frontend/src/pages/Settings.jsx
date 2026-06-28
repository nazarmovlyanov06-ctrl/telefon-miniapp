import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const ROLES = [
  { key: "patron", label: "👑 Patron" },
  { key: "teknisyen", label: "🔧 Teknisyen" },
  { key: "satis", label: "🛍️ Satış" },
  { key: "cirak", label: "🧑‍🔧 Çırak" },
];

export default function Settings({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => {
    if (user?.role === "patron") {
      api.users().then(setUsers).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  async function changeRole(u, role) {
    await api.changeRole(u.id, role);
    load();
  }

  async function onayla(u) {
    await api.onaylaUser(u.id);
    load();
  }

  async function reddet(u) {
    if (!confirm(`${u.name} reddedilsin mi? (silinir)`)) return;
    await api.reddetUser(u.id);
    load();
  }

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/more")}>← Geri</button>
        <div className="page-title" style={{ margin: 0 }}>⚙️ Ayarlar</div>
      </div>

      {user?.role !== "patron" ? (
        <div className="card" style={{ color: "var(--hint)", textAlign: "center", padding: 32 }}>
          Bu sayfayı sadece patron görebilir
        </div>
      ) : loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : (
        <>
          {users.some(u => u.durum === "bekliyor") && (
            <>
              <div className="section-title" style={{ color: "var(--danger)" }}>
                🔔 Onay Bekleyenler ({users.filter(u => u.durum === "bekliyor").length})
              </div>
              {users.filter(u => u.durum === "bekliyor").map(u => (
                <div key={u.id} className="card" style={{ borderLeft: "3px solid var(--danger)" }}>
                  <div className="card-row" style={{ marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: "var(--hint)" }}>ID: {u.telegram_id}</div>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 700 }}>⏳ Bekliyor</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-sm" style={{ background: "var(--success)", color: "#fff", padding: "6px 14px" }}
                      onClick={() => onayla(u)}>✅ Onayla</button>
                    <button className="btn btn-sm" style={{ background: "var(--danger)", color: "#fff", padding: "6px 14px" }}
                      onClick={() => reddet(u)}>❌ Reddet</button>
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="section-title">Çalışanlar</div>
          {users.filter(u => u.durum !== "bekliyor").map((u) => (
            <div key={u.id} className="card">
              <div className="card-row" style={{ marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: "var(--hint)" }}>ID: {u.telegram_id}</div>
                </div>
                <span className={`badge badge-${u.role}`}>
                  {ROLES.find((r) => r.key === u.role)?.label || u.role}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ROLES.map((r) => (
                  <button
                    key={r.key}
                    className={`tab ${u.role === r.key ? "active" : ""}`}
                    style={{ fontSize: 12, padding: "5px 10px" }}
                    onClick={() => changeRole(u, r.key)}
                    disabled={u.role === r.key}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
