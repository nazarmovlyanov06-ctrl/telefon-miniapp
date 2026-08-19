import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, MoreHorizontal } from "lucide-react";
import { TUM_MODULLER } from "../moduleCatalog";
import { siraOku, altMenuAdediOku, degisimiDinle } from "../altMenuAyarlari";

const HIDE_ON = ["/ai", "/search"];

function ortaModulleriOku() {
  const sira = siraOku();
  const adet = altMenuAdediOku();
  return sira.slice(0, adet)
    .map(p => TUM_MODULLER.find(m => m.path === p))
    .filter(Boolean);
}

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [orta, setOrta] = useState(ortaModulleriOku);

  useEffect(() => degisimiDinle(() => setOrta(ortaModulleriOku())), []);

  if (HIDE_ON.includes(pathname)) return null;

  const items = [
    { path: "/", icon: Home, label: "Ana Sayfa" },
    ...orta.map(m => ({ path: m.path, icon: m.icon, label: m.label })),
    { path: "/more", icon: MoreHorizontal, label: "Daha" },
  ];

  return (
    <nav className={"bottom-nav" + (items.length > 5 ? " bottom-nav-scroll" : "")}>
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
