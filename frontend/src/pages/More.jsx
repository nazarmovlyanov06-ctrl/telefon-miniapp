import { useNavigate } from "react-router-dom";

const ITEMS = [
  // Finans
  { icon: "🏦", label: "Kasa",      path: "/kasa",       color: "#dcfce7", iconBg: "#16a34a" },
  { icon: "📉", label: "Giderler",  path: "/gider",      color: "#fef2f2", iconBg: "#dc2626" },
  { icon: "🎯", label: "Hedef",     path: "/hedef",      color: "#eff6ff", iconBg: "#2563eb" },
  { icon: "💳", label: "Borçlar",   path: "/debts",      color: "#fdf4ff", iconBg: "#9333ea" },
  // Satış & Stok
  { icon: "📱", label: "2. El",     path: "/ikinciel",   color: "#f0fdf4", iconBg: "#059669" },
  { icon: "🎧", label: "Aksesuar",  path: "/aksesuar",   color: "#fff7ed", iconBg: "#ea580c" },
  // Tedarik & İade
  { icon: "🏭", label: "Toptancı",  path: "/toptanci",   color: "#f0f9ff", iconBg: "#0284c7" },
  { icon: "↩️", label: "Parça İade",path: "/parca-iade", color: "#fefce8", iconBg: "#ca8a04" },
  // Müşteri
  { icon: "🛡️", label: "Garanti",   path: "/garanti",    color: "#f0fdf4", iconBg: "#16a34a" },
  { icon: "📲", label: "Yedek Tel", path: "/loaner",     color: "#eff6ff", iconBg: "#3b82f6" },
  { icon: "🚫", label: "Kara Liste",path: "/karalist",   color: "#fef2f2", iconBg: "#dc2626" },
  // Çalışan
  { icon: "💵", label: "Maaş",      path: "/maas",       color: "#fdf4ff", iconBg: "#7c3aed" },
  // Araçlar
  { icon: "🤖", label: "AI Asistan",path: "/ai",         color: "#f0f9ff", iconBg: "#0ea5e9" },
  { icon: "📱", label: "IMEI",      path: "/imei",       color: "#f8fafc", iconBg: "#475569" },
  { icon: "⚙️", label: "Ayarlar",   path: "/settings",   color: "#f8fafc", iconBg: "#64748b" },
];

export default function More({ user }) {
  const navigate = useNavigate();

  return (
    <div className="page" style={{ paddingBottom: 90 }}>
      {user && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "4px 0" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 18, flexShrink: 0,
          }}>
            {(user.name || "?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{user.name}</div>
            <span className={`badge badge-${user.role}`} style={{ fontSize: 11 }}>{roleLabel(user.role)}</span>
          </div>
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10,
      }}>
        {ITEMS.map(item => (
          <div
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 6, padding: "12px 4px", borderRadius: 12, cursor: "pointer",
              background: "var(--bg)", userSelect: "none",
              WebkitTapHighlightColor: "transparent",
            }}
            onTouchStart={e => e.currentTarget.style.opacity = "0.7"}
            onTouchEnd={e => e.currentTarget.style.opacity = "1"}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14, background: item.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
            }}>
              {item.icon}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", textAlign: "center", lineHeight: 1.2 }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
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
