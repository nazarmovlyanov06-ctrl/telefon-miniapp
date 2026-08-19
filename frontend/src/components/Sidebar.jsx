import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Wrench, Home, Users, Package, Search, Sparkles,
  Landmark, TrendingDown, Target, CreditCard,
  Smartphone, Headphones, Factory, Undo2,
  ShieldCheck, PhoneCall, Ban, MessageSquareWarning,
  Banknote, BarChart3, ScanLine, Settings, LogOut, Store, CalendarClock,
  Star, Repeat, MessageCircle,
} from "lucide-react";
import { api, setToken } from "../api";

const ANA = [
  { path: "/", icon: Home, label: "Ana Sayfa" },
  { path: "/repairs", icon: Wrench, label: "Tamirler" },
  { path: "/customers", icon: Users, label: "Müşteriler" },
  { path: "/parts", icon: Package, label: "Stok" },
  { path: "/search", icon: Search, label: "Ara" },
];

const FINANS = [
  { path: "/kasa", icon: Landmark, label: "Kasa", patronOnly: true },
  { path: "/gider", icon: TrendingDown, label: "Giderler" },
  { path: "/hedef", icon: Target, label: "Hedef" },
  { path: "/debts", icon: CreditCard, label: "Borçlar" },
];

const SATIS_STOK = [
  { path: "/ikinciel", icon: Smartphone, label: "2. El Cihaz" },
  { path: "/sifir-cihaz", icon: Smartphone, label: "Sıfır Cihaz" },
  { path: "/aksesuar", icon: Headphones, label: "Aksesuar" },
  { path: "/toptanci", icon: Factory, label: "Toptancı" },
  { path: "/parca-iade", icon: Undo2, label: "Parça İade" },
];

const MUSTERI = [
  { path: "/garanti", icon: ShieldCheck, label: "Garanti" },
  { path: "/loaner", icon: PhoneCall, label: "Yedek Telefon" },
  { path: "/karalist", icon: Ban, label: "Kara Liste" },
  { path: "/geri-bildirim", icon: MessageSquareWarning, label: "Şikayet / Övgü" },
];

const MAGAZA = [
  { path: "/vitrin-ayarlari", icon: Store, label: "Vitrin Ayarları" },
  { path: "/randevu-talepleri", icon: CalendarClock, label: "Randevu Talepleri" },
  { path: "/vitrin-degerlendirme", icon: Star, label: "Değerlendirmeler" },
  { path: "/vitrin-takas", icon: Repeat, label: "Takas Teklifleri" },
  { path: "/musteri-mesajlari", icon: MessageCircle, label: "Müşteri Mesajları" },
];

const ARACLAR = [
  { path: "/maas", icon: Banknote, label: "Maaş" },
  { path: "/stats", icon: BarChart3, label: "İstatistik" },
  { path: "/ai", icon: Sparkles, label: "Yardımcı" },
  { path: "/imei", icon: ScanLine, label: "IMEI" },
  { path: "/settings", icon: Settings, label: "Ayarlar" },
];

function Grup({ label, items, pathname, navigate, rozetler }) {
  return (
    <>
      {label && <div className="sidebar-group-label">{label}</div>}
      {/* rozetler: { "/yol": sayi } — okunmamış bildirim rozeti */}
      {items.map((item) => {
        const Icon = item.icon;
        const rozet = rozetler?.[item.path];
        return (
          <button
            key={item.path}
            className={`sidebar-item ${pathname === item.path ? "active" : ""}`}
            onClick={() => navigate(item.path)}
          >
            <Icon />
            {item.label}
            {rozet > 0 && (
              <span style={{
                marginLeft: "auto", minWidth: 18, height: 18, padding: "0 5px",
                borderRadius: 999, background: "var(--red)", color: "#191b20",
                fontSize: 10.5, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{rozet}</span>
            )}
          </button>
        );
      })}
    </>
  );
}

function cikisYap() {
  if (!confirm("Çıkış yapmak istediğine emin misin?")) return;
  setToken(null);
  window.location.href = "/giris";
}

export default function Sidebar({ dukkanAdi, user }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [rozetler, setRozetler] = useState({});

  // Portalden kaydolan yeni müşteri bildirimi. Müşteriler sayfası açıldığında
  // backend "görüldü" işaretlediği için rozet kendiliğinden sıfırlanır.
  useEffect(() => {
    api.yeniUyeler()
      .then(r => setRozetler(x => ({ ...x, "/customers": r.sayi })))
      .catch(() => {});
  }, [pathname]);

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <Wrench size={20} />
        {dukkanAdi || "Telefon Servis"}
      </div>
      <Grup items={ANA} pathname={pathname} navigate={navigate} rozetler={rozetler} />
      <Grup label="Finans" items={user?.rol === "patron" ? FINANS : FINANS.filter(i => !i.patronOnly)} pathname={pathname} navigate={navigate} />
      <Grup label="Satış & Stok" items={SATIS_STOK} pathname={pathname} navigate={navigate} />
      <Grup label="Müşteri" items={MUSTERI} pathname={pathname} navigate={navigate} />
      <Grup label="Mağaza" items={MAGAZA} pathname={pathname} navigate={navigate} />
      <Grup label="Araçlar" items={ARACLAR} pathname={pathname} navigate={navigate} />
      <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid var(--divider)" }}>
        {user && (
          <div style={{ padding: "6px 12px 10px", fontSize: 12, color: "var(--hint)" }}>
            {user.ad}
          </div>
        )}
        <button className="sidebar-item" onClick={cikisYap} style={{ color: "var(--red)" }}>
          <LogOut />
          Çıkış Yap
        </button>
      </div>
    </nav>
  );
}
