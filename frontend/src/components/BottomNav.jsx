import { useNavigate, useLocation } from "react-router-dom";
import { Home, Wrench, Users, Package, MoreHorizontal } from "lucide-react";

const items = [
  { path: "/", icon: Home, label: "Ana Sayfa" },
  { path: "/repairs", icon: Wrench, label: "Tamirler" },
  { path: "/customers", icon: Users, label: "Müşteriler" },
  { path: "/parts", icon: Package, label: "Stok" },
  { path: "/more", icon: MoreHorizontal, label: "Daha" },
];

const HIDE_ON = ["/ai", "/search"];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (HIDE_ON.includes(pathname)) return null;

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.path;
        return (
          <button
            key={item.path}
            className={`nav-item ${active ? "active" : ""}`}
            onClick={() => navigate(item.path)}
          >
            <span className="nav-icon">
              <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
