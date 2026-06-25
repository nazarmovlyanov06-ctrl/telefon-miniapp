import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const ONERILER = [
  "Bugün kaç tamir var?",
  "Bu ay ne kadar kazandık?",
  "Dışarıda yedek telefon var mı?",
  "Hangi parçaların stoğu düşük?",
  "Süresi dolan garanti var mı?",
];

export default function AiChat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    { role: "ai", text: "Merhaba! Ben servis asistanınım 🤖 Servis durumu, gelir, stok veya garanti hakkında sorabilirsin." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sor(soru) {
    const s = (soru || input).trim();
    if (!s || loading) return;
    setInput("");
    setMessages(m => [...m, { role: "user", text: s }]);
    setLoading(true);
    try {
      const res = await api.aiSor(s);
      setMessages(m => [...m, { role: "ai", text: res.cevap }]);
    } catch (e) {
      setMessages(m => [...m, { role: "ai", text: "❌ " + e.message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", height: "100vh", paddingBottom: 0 }}>
      <div className="card-row" style={{ marginBottom: 12, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <div style={{ fontWeight: 700, fontSize: 17 }}>🤖 AI Asistan</div>
        <div />
      </div>

      {/* Sohbet alanı */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 10,
          }}>
            {m.role === "ai" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginRight: 8, marginTop: 2 }}>🤖</div>
            )}
            <div style={{
              maxWidth: "78%",
              padding: "10px 14px",
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: m.role === "user" ? "var(--accent)" : "var(--card)",
              color: m.role === "user" ? "#fff" : "var(--text)",
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div>
            <div style={{ padding: "10px 16px", background: "var(--card)", borderRadius: "18px 18px 18px 4px", fontSize: 20 }}>
              <span style={{ animation: "pulse 1s infinite" }}>●</span>
              <span style={{ animation: "pulse 1s infinite 0.2s" }}> ●</span>
              <span style={{ animation: "pulse 1s infinite 0.4s" }}> ●</span>
            </div>
          </div>
        )}

        {/* Hızlı sorular (sadece başlangıçta) */}
        {messages.length === 1 && !loading && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 8, textAlign: "center" }}>Hızlı sorular:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {ONERILER.map(s => (
                <button key={s} className="btn btn-ghost btn-sm" style={{ fontSize: 12, borderRadius: 20 }} onClick={() => sor(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input alanı */}
      <div style={{
        flexShrink: 0,
        background: "var(--bg)",
        paddingTop: 8,
        paddingBottom: 80,
        borderTop: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="form-input"
            style={{ flex: 1, borderRadius: 24 }}
            placeholder="Sormak istediğin şeyi yaz..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sor()}
            disabled={loading}
          />
          <button
            className="btn btn-primary"
            style={{ borderRadius: 24, padding: "0 18px", flexShrink: 0 }}
            onClick={() => sor()}
            disabled={loading || !input.trim()}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
