import { useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { api, getToken, setToken } from "./api";
import Login from "./pages/Login";
import Kayit from "./pages/Kayit";

function BekleyenEkran({ user }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", padding: 24, flexDirection: "column", gap: 16, textAlign: "center" }}>
      <div style={{ fontSize: 52 }}>⏳</div>
      <div style={{ fontWeight: 700, fontSize: 18 }}>Patron Onayı Bekleniyor</div>
      <div style={{ fontSize: 14, color: "var(--hint)", maxWidth: 300 }}>
        Hesabın henüz onaylanmadı. Patron seni onayladıktan sonra giriş yapabilirsin.
      </div>
      <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 8 }}>
        👤 {user?.ad}
      </div>
      <button className="btn" onClick={() => { setToken(null); window.location.href = "/giris"; }}>
        Çıkış Yap
      </button>
    </div>
  );
}
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
            background: "rgba(36,129,204,0.5)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
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
        <Route path="/geri-bildirim" element={<GeriBildirim user={user} />} />
      </Routes>
      <BottomNav />
    </NavShell>
  );
}

function Yukleniyor() {
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

function Korumali({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function yukle() {
    setLoading(true);
    api.me()
      .then(setUser)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!getToken()) { navigate("/giris"); return; }
    yukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!getToken()) return null;
  if (loading) return <Yukleniyor />;

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ color: "var(--danger)", marginBottom: 8 }}>Bağlantı hatası</div>
        <div style={{ fontSize: 13, color: "var(--hint)" }}>{error}</div>
        <button className="btn btn-primary" style={{ marginTop: 16, width: "auto", padding: "10px 24px" }}
          onClick={yukle}>
          Tekrar Dene
        </button>
      </div>
    );
  }

  if (user?.durum === "bekliyor") {
    return <BekleyenEkran user={user} />;
  }

  return children(user);
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/giris" element={<Login />} />
        <Route path="/kayit" element={<Kayit />} />
        <Route path="/*" element={
          <Korumali>{(user) => <AppRoutes user={user} />}</Korumali>
        } />
      </Routes>
    </BrowserRouter>
  );
}
