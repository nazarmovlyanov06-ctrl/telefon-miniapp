import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, setToken } from "../api";
import { Wrench, Mail, CheckCircle2 } from "lucide-react";

export default function Kayit({ onGiris }) {
  const [form, setForm] = useState({ dukkan_adi: "", ad: "", email: "", sifre: "", telefon: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [dogrulamaAktif, setDogrulamaAktif] = useState(false);
  const [asama, setAsama] = useState("form"); // form | kod-bekliyor
  const [kod, setKod] = useState("");
  const [kodDogrulandi, setKodDogrulandi] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { api.emailDogrulamaDurumu().then(r => setDogrulamaAktif(r.aktif)).catch(() => {}); }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function kodIste(e) {
    e.preventDefault(); setErr("");
    if (form.sifre.length < 6) { setErr("Şifre en az 6 karakter olmalı"); return; }
    setLoading(true);
    try {
      await api.kodGonder(form.email.trim().toLowerCase());
      setAsama("kod-bekliyor");
    } catch (e) { setErr(e.message || "Kod gönderilemedi"); }
    finally { setLoading(false); }
  }

  async function koduDogrula() {
    setErr(""); setLoading(true);
    try {
      await api.kodDogrula(form.email.trim().toLowerCase(), kod.trim());
      setKodDogrulandi(true);
    } catch (e) { setErr(e.message || "Kod hatalı"); }
    finally { setLoading(false); }
  }

  async function hesapOlustur(e) {
    e?.preventDefault(); setErr("");
    if (!dogrulamaAktif && form.sifre.length < 6) { setErr("Şifre en az 6 karakter olmalı"); return; }
    setLoading(true);
    try {
      const refKod = new URLSearchParams(window.location.search).get("ref") || undefined;
      const r = await api.kayitOl({ ...form, email: form.email.trim().toLowerCase(), referans_kod: refKod });
      setToken(r.token);
      onGiris?.();
      navigate("/");
    } catch (e) {
      setErr(e.message || "Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  }

  const anaForm = (
    <>
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
    </>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100dvh", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Wrench size={38} strokeWidth={1.6} style={{ display: "inline-block" }} />
          <div style={{ fontWeight: 700, fontSize: 20, marginTop: 8 }}>Dükkânını Kaydet</div>
          <div style={{ fontSize: 13, color: "var(--hint)" }}>Ücretsiz denemeye başla</div>
        </div>

        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{err}</div>}

        {asama === "form" && (
          <form onSubmit={dogrulamaAktif ? kodIste : hesapOlustur} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {anaForm}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "..." : dogrulamaAktif ? "Devam Et" : "Dükkânı Oluştur"}
            </button>
          </form>
        )}

        {asama === "kod-bekliyor" && !kodDogrulandi && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: "var(--hint)", display: "flex", alignItems: "center", gap: 7 }}>
              <Mail size={14} strokeWidth={2} /> {form.email} adresine 6 haneli kod gönderildi
            </div>
            <input className="form-input" placeholder="Doğrulama kodu" value={kod}
              onChange={e => setKod(e.target.value)} maxLength={6} autoFocus />
            <button className="btn btn-primary" disabled={loading || kod.length !== 6} onClick={koduDogrula}>
              {loading ? "..." : "Kodu Doğrula"}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setAsama("form")}>Geri</button>
          </div>
        )}

        {kodDogrulandi && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: "var(--success)", display: "flex", alignItems: "center", gap: 7 }}>
              <CheckCircle2 size={14} strokeWidth={2} /> E-posta doğrulandı
            </div>
            <button className="btn btn-primary" disabled={loading} onClick={hesapOlustur}>
              {loading ? "Kaydediliyor..." : "Dükkânı Oluştur"}
            </button>
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 13, color: "var(--hint)", marginTop: 12 }}>
          Zaten hesabın var mı? <Link to="/giris">Giriş Yap</Link>
        </div>
      </div>
    </div>
  );
}
