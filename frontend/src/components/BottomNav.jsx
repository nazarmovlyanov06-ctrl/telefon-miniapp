import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, MoreHorizontal } from "lucide-react";
import { TUM_MODULLER } from "../moduleCatalog";
import { siraOku, altMenuAdediOku, degisimiDinle } from "../altMenuAyarlari";

const HIDE_ON = ["/ai", "/search"];

function ortaModulleriOku(patron) {
  const sira = siraOku();
  const adet = altMenuAdediOku();
  return sira
    .map(p => TUM_MODULLER.find(m => m.path === p))
    .filter(Boolean)
    .filter(m => patron || !m.patronOnly)
    .slice(0, adet);
}

export default function BottomNav({ user }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const patron = user?.rol === "patron";
  const [orta, setOrta] = useState(() => ortaModulleriOku(patron));

  useEffect(() => setOrta(ortaModulleriOku(patron)), [patron]);
  useEffect(() => degisimiDinle(() => setOrta(ortaModulleriOku(patron))), [patron]);

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
