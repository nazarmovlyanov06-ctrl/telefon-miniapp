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
import GeriBildirim from "./pages/GeriBildirim";
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
          className="back-btn-pulse"
          onClick={() => navigate(-1)}
          style={{
            position: "fixed", bottom: 85, right: 16, zIndex: 200,
            width: 40, height: 40, borderRadius: "50%",
            background: "var(--btn)",
            border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 700, cursor: "pointer", color: "var(--btn-text)",
            lineHeight: 1,
          }}
          aria-label="Geri"
        >
          ‹
        </button>
      )}
      <div style={{ paddingTop: 0 }}>
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
        <Route path="/parts" element={<Parts user={user} />} />
        <Route path="/more" element={<More user={user} />} />
        <Route path="/imei" element={<IMEI />} />
        <Route path="/debts" element={<Debts />} />
        <Route path="/settings" element={<Settings user={user} />} />
        <Route path="/toptanci" element={<Toptanci />} />
        <Route path="/ikinciel" element={<IkinciEl user={user} />} />
        <Route path="/garanti" element={<Garanti />} />
        <Route path="/kasa" element={<Kasa />} />
        <Route path="/gider" element={<Gider />} />
        <Route path="/loaner" element={<Loaner />} />
        <Route path="/aksesuar" element={<Aksesuar user={user} />} />
        <Route path="/hedef" element={<Hedef />} />
        <Route path="/maas" element={<Maas />} />
        <Route path="/karalist" element={<KaraListe />} />
        <Route path="/parca-iade" element={<ParcaIade />} />
        <Route path="/ai" element={<AiChat />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/sifir-cihaz" element={<SifirCihaz user={user} />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/search" element={<Search />} />
        <Route path="/geri-bildirim" element={<GeriBildirim />} />
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
