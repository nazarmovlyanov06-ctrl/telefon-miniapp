import { useNavigate } from "react-router-dom";

const SECTIONS = [
  {
    title: "💰 Finans",
    items: [
      { icon: "🏦", label: "Günlük Kasa", path: "/kasa" },
      { icon: "📉", label: "Gider Takibi", path: "/gider" },
      { icon: "💰", label: "Borç Takibi", path: "/debts" },
      { icon: "🎯", label: "Aylık Hedef", path: "/hedef" },
    ],
  },
  {
    title: "📦 Stok & Satış",
    items: [
      { icon: "📱", label: "2. El Cihaz", path: "/ikinciel" },
      { icon: "🎧", label: "Aksesuar Satış", path: "/aksesuar" },
      { icon: "↩️", label: "Parça İade", path: "/parca-iade" },
    ],
  },
  {
    title: "🏭 Tedarik",
    items: [
      { icon: "🏭", label: "Toptancı Defteri", path: "/toptanci" },
    ],
  },
  {
    title: "👥 Müşteri",
    items: [
      { icon: "🛡️", label: "Garanti Takibi", path: "/garanti" },
      { icon: "📲", label: "Yedek Telefon", path: "/loaner" },
      { icon: "🚫", label: "Kara Liste", path: "/karalist" },
    ],
  },
  {
    title: "👤 Çalışan",
    items: [
      { icon: "💵", label: "Maaş & Avans", path: "/maas" },
    ],
  },
  {
    title: "🔧 Araçlar",
    items: [
      { icon: "📱", label: "IMEI Sorgula", path: "/imei" },
      { icon: "💳", label: "Borç Takibi", path: "/debts" },
      { icon: "⚙️", label: "Ayarlar", path: "/settings" },
    ],
  },
];

export default function More({ user }) {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page-title">⋯ Daha Fazla</div>

      {user && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 4 }}>
            <span className={`badge badge-${user.role}`}>{roleLabel(user.role)}</span>
          </div>
        </div>
      )}

      {SECTIONS.map(section => (
        <div key={section.title}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--hint)", margin: "14px 0 6px" }}>{section.title}</div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {section.items.map((item, idx) => (
              <div
                key={item.path}
                className="list-item"
                onClick={() => navigate(item.path)}
                style={{ borderBottom: idx < section.items.length - 1 ? "1px solid var(--bg2)" : "none" }}
              >
                <span style={{ fontSize: 22, minWidth: 30, textAlign: "center" }}>{item.icon}</span>
                <div className="list-item-body">
                  <div className="list-item-title">{item.label}</div>
                </div>
                <span style={{ color: "var(--hint)" }}>›</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ height: 20 }} />
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
