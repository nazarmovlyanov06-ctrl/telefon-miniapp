import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, setToken } from "../api";
import { Wrench } from "lucide-react";

export default function Kayit({ onGiris }) {
  const [form, setForm] = useState({ dukkan_adi: "", ad: "", email: "", sifre: "", telefon: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function gonder(e) {
    e.preventDefault();
    setErr("");
    if (form.sifre.length < 6) { setErr("Şifre en az 6 karakter olmalı"); return; }
    setLoading(true);
    try {
      const r = await api.kayitOl({ ...form, email: form.email.trim().toLowerCase() });
      setToken(r.token);
      onGiris?.();
      navigate("/");
    } catch (e) {
      setErr(e.message || "Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100dvh", padding: 24 }}>
      <form onSubmit={gonder} style={{ width: "100%", maxWidth: 360, display: "flex",
        flexDirection: "column", gap: 12 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <Wrench size={38} strokeWidth={1.6} style={{ display: "inline-block" }} />
          <div style={{ fontWeight: 700, fontSize: 20, marginTop: 8 }}>Dükkânını Kaydet</div>
          <div style={{ fontSize: 13, color: "var(--hint)" }}>Ücretsiz denemeye başla</div>
        </div>
        <input className="form-input" placeholder="Dükkân adı" required
          value={form.dukkan_adi} onChange={e => set("dukkan_adi", e.target.value)} autoFocus />
        <input className="form-input" placeholder="Adınız" required
          value={form.ad} onChange={e => set("ad", e.target.value)} />
        <input className="form-input" type="tel" placeholder="Telefon (opsiyonel)"
          value={form.telefon} onChange={e => set("telefon", e.target.value)} />
        <input className="form-input" type="email" placeholder="E-posta" required
          value={form.email} onChange={e => set("email", e.target.value)} />
        <input className="form-input" type="password" placeholder="Şifre (en az 6 karakter)" required
          value={form.sifre} onChange={e => set("sifre", e.target.value)} />
        {err && <div style={{ color: "var(--danger)", fontSize: 13 }}>{err}</div>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Kaydediliyor..." : "Dükkânı Oluştur"}
        </button>
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--hint)", marginTop: 8 }}>
          Zaten hesabın var mı? <Link to="/giris">Giriş Yap</Link>
        </div>
      </form>
    </div>
  );
}
