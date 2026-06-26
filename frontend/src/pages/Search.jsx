import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const TUR_RENK = {
  tamir: "#3b82f6",
  musteri: "#10b981",
  parca: "#f59e0b",
  ikinciel: "#8b5cf6",
  borc: "#ef4444",
  aksesuar: "#ec4899",
};

export default function Search() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [sonuclar, setSonuclar] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (q.trim().length < 2) { setSonuclar([]); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.ara(q.trim());
        setSonuclar(res);
      } catch { setSonuclar([]); }
      finally { setLoading(false); }
    }, 300);
  }, [q]);

  function handleClick(s) {
    navigate(s.link);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--bg)" }}>
      {/* Arama kutusu */}
      <div style={{ padding: "12px 16px", background: "var(--bg)", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => navigate(-1)}>←</button>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--hint)" }}>🔍</span>
          <input
            ref={inputRef}
            className="form-input"
            style={{ paddingLeft: 36, borderRadius: 20 }}
            placeholder="Müşteri, tamir no, model, IMEI, parça..."
            value={q}
            onChange={e => setQ(e.target.value)}
            autoComplete="off"
          />
        </div>
        {q && (
          <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => setQ("")}>✕</button>
        )}
      </div>

      {/* Sonuçlar */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
        {loading && <div style={{ textAlign: "center", color: "var(--hint)", padding: 24 }}>Aranıyor...</div>}

        {!loading && q.length >= 2 && sonuclar.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--hint)", padding: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div>"{q}" için sonuç bulunamadı</div>
          </div>
        )}

        {!loading && q.length < 2 && (
          <div style={{ textAlign: "center", color: "var(--hint)", padding: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14 }}>Müşteri adı, IMEI, tamir no,<br />model veya telefon numarası yazın</div>
          </div>
        )}

        {sonuclar.map((s, i) => (
          <div
            key={i}
            onClick={() => handleClick(s)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", marginBottom: 6,
              background: "var(--card)", borderRadius: 12,
              cursor: "pointer",
              borderLeft: `3px solid ${TUR_RENK[s.tur] || "var(--accent)"}`,
            }}
            onTouchStart={e => e.currentTarget.style.opacity = "0.7"}
            onTouchEnd={e => e.currentTarget.style.opacity = "1"}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: TUR_RENK[s.tur] + "22",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>
              {s.ikon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{s.baslik}</div>
              <div style={{ fontSize: 12, color: "var(--hint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.alt}
              </div>
            </div>
            <div style={{ fontSize: 18, color: "var(--hint)" }}>›</div>
          </div>
        ))}
      </div>
    </div>
  );
}
