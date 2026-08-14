import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { LifeBuoy, Send, Paperclip, Bot } from "lucide-react";
import DestekMesajIcerik from "../components/DestekMesajIcerik";

export default function Destek() {
  const navigate = useNavigate();
  const [mesajlar, setMesajlar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yeni, setYeni] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);
  const dosyaInputRef = useRef(null);

  function load() {
    api.destekMesajlarim().then(setMesajlar).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mesajlar]);

  async function gonder() {
    if (!yeni.trim() || busy) return;
    setBusy(true);
    try {
      await api.destekMesajGonder(yeni.trim());
      setYeni("");
      load();
    } finally { setBusy(false); }
  }

  async function dosyaSec(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await api.destekMesajDosyaGonder(file);
      load();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", height: "100dvh", padding: 0 }}>
      <div className="card-row" style={{ margin: "12px 16px 8px", flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/more")}>← Geri</button>
        <div style={{ fontWeight: 700, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}><LifeBuoy size={16} strokeWidth={2} /> Destek</div>
        <div />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 12px" }}>
        {loading ? (
          <div className="loading">Yükleniyor...</div>
        ) : mesajlar.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--hint)", padding: 40, fontSize: 14 }}>
            Sorunuz veya öneriniz mi var? Aşağıdan yazabilirsiniz.
          </div>
        ) : mesajlar.map(m => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.gonderen_rol === "dukkan" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div style={{
              maxWidth: "78%", padding: "10px 14px", borderRadius: m.gonderen_rol === "dukkan" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: m.gonderen_rol === "dukkan" ? "var(--accent)" : "var(--card)",
              color: m.gonderen_rol === "dukkan" ? "#fff" : "var(--text)", fontSize: 14, lineHeight: 1.5,
            }}>
              {m.gonderen_rol === "ai" && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, opacity: 0.75, marginBottom: 3, fontWeight: 600 }}>
                  <Bot size={11} strokeWidth={2} /> Destek Asistanı
                </div>
              )}
              <DestekMesajIcerik mesaj={m.mesaj} dosyaUrl={m.dosya_url} dosyaAdi={m.dosya_adi} dosyaTipi={m.dosya_tipi} />
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>{new Date(m.created_at).toLocaleString("tr-TR")}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ flexShrink: 0, background: "var(--bg)", padding: "10px 16px 16px", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="file" ref={dosyaInputRef} onChange={dosyaSec} style={{ display: "none" }}
            accept="image/*,.pdf,audio/*,video/*" />
          <button className="btn btn-ghost" disabled={busy} onClick={() => dosyaInputRef.current?.click()}
            style={{ borderRadius: 24, width: 44, height: 44, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Paperclip size={16} strokeWidth={2} />
          </button>
          <input className="form-input" style={{ flex: 1, borderRadius: 24 }} placeholder="Mesajınızı yazın..."
            value={yeni} onChange={e => setYeni(e.target.value)} onKeyDown={e => e.key === "Enter" && gonder()} disabled={busy} />
          <button className="btn btn-primary" style={{ borderRadius: 24, width: 44, height: 44, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            onClick={gonder} disabled={busy || !yeni.trim()}>
            <Send size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
