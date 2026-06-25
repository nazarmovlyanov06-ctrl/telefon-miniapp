import { useNavigate } from "react-router-dom";

const MENU = [
  { icon: "📱", label: "IMEI Sorgula", path: "/imei" },
  { icon: "💰", label: "Borç Takibi", path: "/debts" },
  { icon: "📊", label: "Raporlar", path: "/reports" },
  { icon: "⚙️", label: "Ayarlar", path: "/settings" },
];

export default function More({ user }) {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page-title">⋯ Daha</div>

      {user && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 4 }}>
            <span className={`badge badge-${user.role}`}>{roleLabel(user.role)}</span>
          </div>
        </div>
      )}

      {MENU.map((item) => (
        <div key={item.path} className="list-item" onClick={() => navigate(item.path)}>
          <span style={{ fontSize: 26 }}>{item.icon}</span>
          <div className="list-item-body">
            <div className="list-item-title">{item.label}</div>
          </div>
          <span style={{ color: "var(--hint)" }}>›</span>
        </div>
      ))}
    </div>
  );
}

function roleLabel(role) {
  const labels = {
    patron: "👑 Patron", teknisyen: "🔧 Teknisyen",
    satis: "🛍️ Satış", cirak: "🧑‍🔧 Çırak",
  };
  return labels[role] || role;
}
