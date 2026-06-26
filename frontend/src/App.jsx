import { useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { initTg } from "./tg";
import { api } from "./api";
import BottomNav from "./components/BottomNav";
import Dashboard from "./pages/Dashboard";
import Repairs from "./pages/Repairs";
import RepairDetail from "./pages/RepairDetail";
import NewRepair from "./pages/NewRepair";
import Customers from "./pages/Customers";
import Parts from "./pages/Parts";
import More from "./pages/More";
import IMEI from "./pages/IMEI";
import Debts from "./pages/Debts";
import Settings from "./pages/Settings";
import Toptanci from "./pages/Toptanci";
import IkinciEl from "./pages/IkinciEl";
import Garanti from "./pages/Garanti";
import Kasa from "./pages/Kasa";
import Gider from "./pages/Gider";
import Loaner from "./pages/Loaner";
import Aksesuar from "./pages/Aksesuar";
import Hedef from "./pages/Hedef";
import Maas from "./pages/Maas";
import KaraListe from "./pages/KaraListe";
import ParcaIade from "./pages/ParcaIade";
import AiChat from "./pages/AiChat";
import CustomerDetail from "./pages/CustomerDetail";
import SifirCihaz from "./pages/SifirCihaz";
import Stats from "./pages/Stats";
import Search from "./pages/Search";
import "./index.css";

// Kenar kaydırma (sol kenardan sağa → geri) + geri butonu
// Bu sayfalarda geri butonu ve paddingTop gösterilmez (kendi header'ları var)
const ROOT_PATHS = ["/", "/repairs", "/customers", "/parts", "/more", "/search", "/ai"];

function NavShell({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isRoot = ROOT_PATHS.includes(pathname);

  // Sol kenar kaydırma
  function onTouchStart(e) {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  }

  function onTouchEnd(e) {
    if (touchStartX.current === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = Math.abs(t.clientY - touchStartY.current);
    // Sol kenardan başlayan (ilk 30px), yatay, 60px+ kaydırma
    if (touchStartX.current < 30 && dx > 60 && dy < 80 && !isRoot) {
      navigate(-1);
    }
    touchStartX.current = null;
  }

  return (
    <div
      style={{ minHeight: "100dvh", position: "relative" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Geri butonu — kök sayfalarda gizli */}
      {!isRoot && (
        <button
          onClick={() => navigate(-1)}
          style={{
            position: "fixed", top: 10, left: 12, zIndex: 200,
            width: 36, height: 36, borderRadius: "50%",
            background: "var(--card)",
            border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 300, cursor: "pointer", color: "var(--text)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            lineHeight: 1,
          }}
          aria-label="Geri"
        >
          ‹
        </button>
      )}
      {/* Alt sayfalar için üst boşluk (geri buton alanı) */}
      <div style={{ paddingTop: isRoot ? 0 : 56 }}>
        {children}
      </div>
    </div>
  );
}

function AppRoutes({ user }) {
  return (
    <NavShell>
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/repairs" element={<Repairs />} />
        <Route path="/repairs/new" element={<NewRepair />} />
        <Route path="/repairs/:id" element={<RepairDetail user={user} />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/parts" element={<Parts />} />
        <Route path="/more" element={<More user={user} />} />
        <Route path="/imei" element={<IMEI />} />
        <Route path="/debts" element={<Debts />} />
        <Route path="/settings" element={<Settings user={user} />} />
        <Route path="/toptanci" element={<Toptanci />} />
        <Route path="/ikinciel" element={<IkinciEl />} />
        <Route path="/garanti" element={<Garanti />} />
        <Route path="/kasa" element={<Kasa />} />
        <Route path="/gider" element={<Gider />} />
        <Route path="/loaner" element={<Loaner />} />
        <Route path="/aksesuar" element={<Aksesuar />} />
        <Route path="/hedef" element={<Hedef />} />
        <Route path="/maas" element={<Maas />} />
        <Route path="/karalist" element={<KaraListe />} />
        <Route path="/parca-iade" element={<ParcaIade />} />
        <Route path="/ai" element={<AiChat />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/sifir-cihaz" element={<SifirCihaz />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/search" element={<Search />} />
      </Routes>
      <BottomNav />
    </NavShell>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    initTg();
    api.me()
      .then(setUser)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", flexDirection: "column", gap: 16, color: "var(--hint)"
      }}>
        <div style={{ fontSize: 48 }}>🔧</div>
        <div>Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ color: "var(--danger)", marginBottom: 8 }}>Bağlantı hatası</div>
        <div style={{ fontSize: 13, color: "var(--hint)" }}>{error}</div>
        <button className="btn btn-primary" style={{ marginTop: 16, width: "auto", padding: "10px 24px" }}
          onClick={() => window.location.reload()}>
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes user={user} />
    </BrowserRouter>
  );
}
