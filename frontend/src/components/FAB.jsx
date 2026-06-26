import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const HIDE_ON = ["/ai", "/search"];

const ACTIONS = [
  { icon: "🔧", label: "Yeni Tamir", path: "/repairs/new" },
  { icon: "📱", label: "2.El Satış", path: "/ikinciel" },
  { icon: "👤", label: "Yeni Müşteri", path: "/customers", state: { yeni: true } },
  { icon: "📉", label: "Yeni Gider", path: "/gider", state: { yeni: true } },
  { icon: "💳", label: "Yeni Borç", path: "/debts", state: { yeni: true } },
];

export default function FAB() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (HIDE_ON.includes(pathname)) return null;

  function handleAction(action) {
    setOpen(false);
    navigate(action.path, action.state ? { state: action.state } : undefined);
  }

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 90 }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Aksiyon listesi */}
      {open && (
        <div style={{
          position: "fixed", bottom: 80, right: 16, zIndex: 100,
          display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end",
        }}>
          {ACTIONS.map((a, i) => (
            <div
              key={a.path}
              onClick={() => handleAction(a)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer",
                animation: `fadeSlideUp 0.15s ease ${i * 0.04}s both`,
              }}
            >
              <div style={{
                background: "var(--card)", color: "var(--text)",
                padding: "6px 14px", borderRadius: 20,
                fontSize: 13, fontWeight: 600,
                boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                whiteSpace: "nowrap",
              }}>
                {a.label}
              </div>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "var(--card)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                flexShrink: 0,
              }}>
                {a.icon}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ana buton */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed", bottom: 22, right: 16, zIndex: 101,
          width: 52, height: 52, borderRadius: "50%",
          background: "var(--accent)", color: "#fff",
          border: "none", cursor: "pointer",
          fontSize: 26, fontWeight: 300,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease",
        }}
      >
        +
      </button>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
