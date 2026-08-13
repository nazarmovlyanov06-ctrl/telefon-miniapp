import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, setToken } from "../api";
import { Wrench } from "lucide-react";

export default function Login({ onGiris }) {
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function gonder(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const r = await api.girisYap(email.trim().toLowerCase(), sifre);
      setToken(r.token);
      onGiris?.();
      navigate("/");
    } catch (e) {
      setErr(e.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100dvh", padding: 24 }}>
      <form onSubmit={gonder} style={{ width: "100%", maxWidth: 340, display: "flex",
        flexDirection: "column", gap: 12 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <Wrench size={38} strokeWidth={1.6} style={{ display: "inline-block" }} />
          <div style={{ fontWeight: 700, fontSize: 20, marginTop: 8 }}>Telefon Servis</div>
          <div style={{ fontSize: 13, color: "var(--hint)" }}>Panele giriş yap</div>
        </div>
        <input className="form-input" type="email" placeholder="E-posta" required
          value={email} onChange={e => setEmail(e.target.value)} autoFocus />
        <input className="form-input" type="password" placeholder="Şifre" required
          value={sifre} onChange={e => setSifre(e.target.value)} />
        {err && <div style={{ color: "var(--danger)", fontSize: 13 }}>{err}</div>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--hint)", marginTop: 8 }}>
          Hesabın yok mu? <Link to="/kayit">Dükkânını Kaydet</Link>
        </div>
      </form>
    </div>
  );
}
