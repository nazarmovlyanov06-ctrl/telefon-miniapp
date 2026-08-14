import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api, setToken } from "../api";
import {
  Landmark, TrendingDown, Target, CreditCard,
  Smartphone, Headphones, Factory, Undo2,
  ShieldCheck, PhoneCall, Ban, MessageSquareWarning,
  Banknote, BarChart3, ScanLine, Settings, LogOut, LifeBuoy, Megaphone, X,
  Store, CalendarClock, Star, Repeat, MessageCircle,
} from "lucide-react";

const ITEMS = [
  // Finans
  { icon: Landmark, label: "Kasa", path: "/kasa", color: "var(--green)" },
  { icon: TrendingDown, label: "Giderler", path: "/gider", color: "var(--red)" },
  { icon: Target, label: "Hedef", path: "/hedef", color: "var(--blue)" },
  { icon: CreditCard, label: "Borçlar", path: "/debts", color: "var(--purple)" },
  // Satış & Stok
  { icon: Smartphone, label: "2. El", path: "/ikinciel", color: "var(--green)" },
  { icon: Headphones, label: "Aksesuar", path: "/aksesuar", color: "var(--orange)" },
  // Tedarik & İade
  { icon: Factory, label: "Toptancı", path: "/toptanci", color: "var(--blue)" },
  { icon: Undo2, label: "Parça İade", path: "/parca-iade", color: "var(--gold)" },
  // Müşteri
  { icon: ShieldCheck, label: "Garanti", path: "/garanti", color: "var(--green)" },
  { icon: PhoneCall, label: "Yedek Tel", path: "/loaner", color: "var(--blue)" },
  { icon: Ban, label: "Kara Liste", path: "/karalist", color: "var(--red)" },
  { icon: MessageSquareWarning, label: "Şikayet/Övgü", path: "/geri-bildirim", color: "var(--orange)", badge: true },
  // Mağaza
  { icon: Store, label: "Vitrin Ayarları", path: "/vitrin-ayarlari", color: "var(--gold)" },
  { icon: CalendarClock, label: "Randevu Talepleri", path: "/randevu-talepleri", color: "var(--blue)" },
  { icon: Star, label: "Değerlendirmeler", path: "/vitrin-degerlendirme", color: "var(--orange)" },
  { icon: Repeat, label: "Takas Teklifleri", path: "/vitrin-takas", color: "var(--blue2)" },
  { icon: MessageCircle, label: "Müşteri Mesajları", path: "/musteri-mesajlari", color: "var(--green)" },
  // Çalışan
  { icon: Banknote, label: "Maaş", path: "/maas", color: "var(--purple)" },
  // Araçlar
  { icon: BarChart3, label: "İstatistik", path: "/stats", color: "var(--gold)" },
  { icon: ScanLine, label: "IMEI", path: "/imei", color: "var(--gray)" },
  { icon: LifeBuoy, label: "Destek", path: "/destek", color: "var(--blue2)" },
  { icon: Settings, label: "Ayarlar", path: "/settings", color: "var(--gray)" },
];

const ROLE_LABELS = {
  patron: "Patron", teknisyen: "Teknisyen",
  satis: "Satış", cirak: "Çırak", super_admin: "Süper Admin",
};

export default function More({ user }) {
  const navigate = useNavigate();
  const [bildirimSayisi, setBildirimSayisi] = useState(0);
  const [duyurular, setDuyurular] = useState([]);
  const items = ITEMS;

  useEffect(() => {
    api.geriBildirimBekleyen().then(r => setBildirimSayisi(r.bekleyen || 0)).catch(() => {});
    api.destekDuyurularim().then(setDuyurular).catch(() => {});
  }, [user]);

  function cikisYap() {
    if (!confirm("Çıkış yapmak istediğine emin misin?")) return;
    setToken(null);
    window.location.href = "/giris";
  }

  function duyuruGordum(id) {
    api.destekDuyuruGorundu(id).catch(() => {});
    setDuyurular(d => d.filter(x => x.id !== id));
  }

  return (
    <div className="page" style={{ paddingBottom: 90 }}>
      {duyurular.map(d => (
        <div key={d.id} className="card" style={{ marginBottom: 10, background: "rgba(99,102,241,0.1)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Megaphone size={16} stroke="var(--accent)" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>{d.mesaj}</div>
            <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 3 }}>{new Date(d.created_at).toLocaleDateString("tr-TR")}</div>
          </div>
          <button onClick={() => duyuruGordum(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex", flexShrink: 0 }}>
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      ))}
      {user && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22, padding: "4px 0" }}>
          <div style={{
            width: 46, height: 46, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--surf-hi), var(--surf-lo))",
            boxShadow: "var(--edge-lit), var(--edge-dark), var(--lift)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--gold)", fontWeight: 800, fontSize: 17, flexShrink: 0,
          }}>
            {(user.ad || "?")[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-strong)" }}>{user.ad}</div>
            <span className={`badge badge-${user.rol}`} style={{ fontSize: 11, marginTop: 2, display: "inline-block" }}>
              {ROLE_LABELS[user.rol] || user.rol}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={cikisYap}
            style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--danger)", flexShrink: 0 }}>
            <LogOut size={14} strokeWidth={2} /> Çıkış
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {items.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.path} onClick={() => navigate(item.path)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 7, cursor: "pointer", userSelect: "none",
              }}
            >
              <div style={{ position: "relative", width: 50, height: 50 }}>
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 14,
                  background: item.color, filter: "blur(12px)", opacity: 0.3,
                  transform: "translateY(5px) scale(1.06)",
                }} />
                <div style={{
                  position: "relative", width: 50, height: 50, borderRadius: 14,
                  background: "linear-gradient(135deg, var(--surf-hi), var(--surf-lo))",
                  boxShadow: "var(--edge-lit), var(--edge-dark), var(--lift)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={20} stroke={item.color} strokeWidth={1.8} />
                  {item.badge && bildirimSayisi > 0 && (
                    <div style={{
                      position: "absolute", top: -4, right: -4,
                      background: "var(--red)", color: "#191b20",
                      borderRadius: "50%", width: 17, height: 17,
                      fontSize: 10, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 0 0 2px var(--bg)",
                    }}>
                      {bildirimSayisi}
                    </div>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--title)", textAlign: "center", lineHeight: 1.2 }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
