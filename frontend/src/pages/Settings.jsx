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
          <div className="section-title">Çalışanlar</div>
          {users.map((u) => (
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
