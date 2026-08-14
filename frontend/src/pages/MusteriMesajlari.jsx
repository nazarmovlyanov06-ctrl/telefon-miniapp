import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { MessageCircle, Phone, Send, User } from "lucide-react";

function tarih(d) {
  return new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function MusteriMesajlari() {
  const navigate = useNavigate();
  const [konusmalar, setKonusmalar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [secili, setSecili] = useState(null);
  const [mesajlar, setMesajlar] = useState(null);
  const [metin, setMetin] = useState("");
  const [busy, setBusy] = useState(false);
  const sonRef = useRef(null);

  function listeYukle() {
    api.vitrinMusteriMesajlari().then(setKonusmalar).finally(() => setLoading(false));
  }
  useEffect(listeYukle, []);
  useEffect(() => { sonRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mesajlar]);

  function ac(k) {
    setSecili(k);
    setMesajlar(null);
    api.vitrinMusteriMesajGecmisi(k.customer_id)
      .then(m => { setMesajlar(m); listeYukle(); })
      .catch(() => setMesajlar([]));
  }

  async function gonder(e) {
    e.preventDefault();
    if (!metin.trim()) return;
    setBusy(true);
    try {
      await api.vitrinMusteriMesajYanitla(secili.customer_id, metin.trim());
      setMetin("");
      const m = await api.vitrinMusteriMesajGecmisi(secili.customer_id);
      setMesajlar(m);
      listeYukle();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => (secili ? setSecili(null) : navigate("/more"))}>← Geri</button>
        <div className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 9 }}>
          <MessageCircle size={19} strokeWidth={2} />
          {secili ? secili.musteri_adi : "Müşteri Mesajları"}
        </div>
      </div>

      {!secili ? (
        loading ? (
          <div className="loading">Yükleniyor...</div>
        ) : konusmalar.length === 0 ? (
          <div className="empty">
            <div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}>
              <MessageCircle size={40} stroke="var(--dim)" strokeWidth={1.5} />
            </div>
            Müşteri panelinden gelen mesajlar burada görünür
          </div>
        ) : konusmalar.map(k => (
          <div key={k.customer_id} className="card" style={{ marginBottom: 8, cursor: "pointer" }} onClick={() => ac(k)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
                  <User size={14} strokeWidth={2} /> {k.musteri_adi}
                </div>
                {k.telefon && (
                  <div style={{ fontSize: 12.5, color: "var(--hint)", display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                    <Phone size={11} strokeWidth={2} /> {k.telefon}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 3 }}>{tarih(k.son_mesaj_at)}</div>
              </div>
              {k.okunmamis > 0 && (
                <span className="badge" style={{ background: "var(--red)", color: "#191b20", flexShrink: 0 }}>{k.okunmamis} yeni</span>
              )}
            </div>
          </div>
        ))
      ) : (
        <>
          {mesajlar === null ? (
            <div className="loading">Yükleniyor...</div>
          ) : (
            <div className="cp-chat">
              {mesajlar.map(m => (
                <div key={m.id} className={`cp-msg ${m.gonderen === "dukkan" ? "ben" : "dukkan"}`}>
                  {m.mesaj}
                  <div className="cp-msg-time">{tarih(m.created_at)}</div>
                </div>
              ))}
              <div ref={sonRef} />
            </div>
          )}

          <form onSubmit={gonder} style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input className="form-input" style={{ flex: 1 }} placeholder="Yanıtınızı yazın..."
              value={metin} onChange={e => setMetin(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !metin.trim()}
              style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Send size={14} strokeWidth={2} /> Gönder
            </button>
          </form>
        </>
      )}
    </div>
  );
}
