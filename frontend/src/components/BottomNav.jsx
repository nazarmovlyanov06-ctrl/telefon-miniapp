import { useNavigate, useLocation } from "react-router-dom";

const items = [
  { path: "/", icon: "🏠", label: "Ana Sayfa" },
  { path: "/repairs", icon: "🔧", label: "Tamirler" },
  { path: "/customers", icon: "👥", label: "Müşteriler" },
  { path: "/parts", icon: "📦", label: "Stok" },
  { path: "/more", icon: "⋯", label: "Daha" },
];

const HIDE_ON = ["/ai", "/search"];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (HIDE_ON.includes(pathname)) return null;

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.path}
          className={`nav-item ${pathname === item.path ? "active" : ""}`}
          onClick={() => navigate(item.path)}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
