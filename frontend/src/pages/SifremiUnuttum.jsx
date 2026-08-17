import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { Wrench, Mail, CircleX, CheckCircle2, LifeBuoy } from "lucide-react";

export default function SifremiUnuttum() {
  const navigate = useNavigate();
  const [aktif, setAktif] = useState(null); // null = kontrol ediliyor
  const [asama, setAsama] = useState("email"); // email | kod | bitti
  const [email, setEmail] = useState("");
  const [kod, setKod] = useState("");
  const [yeniSifre, setYeniSifre] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // SMTP ayarlı değilse self-service sıfırlama çalışamaz — kullanıcıyı boş
  // yere uğraştırmak yerine baştan destek yönlendirmesi gösteriyoruz.
  useEffect(() => {
    api.emailDogrulamaDurumu().then(r => setAktif(r.aktif)).catch(() => setAktif(false));
  }, []);

  async function kodIste(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api.sifreSifirlaKodGonder(email.trim().toLowerCase());
      setAsama("kod");
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function sifirla(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api.sifreSifirlaOnayla(email.trim().toLowerCase(), kod.trim(), yeniSifre);
      setAsama("bitti");
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 350 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <Wrench size={36} strokeWidth={1.6} style={{ display: "inline-block" }} />
          <div style={{ fontWeight: 700, fontSize: 19, marginTop: 8 }}>Şifremi Unuttum</div>
        </div>

        {err && (
          <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <CircleX size={13} strokeWidth={2} /> {err}
          </div>
        )}

        {aktif === null ? null : aktif === false ? (
          <div className="card" style={{ textAlign: "center" }}>
            <LifeBuoy size={30} strokeWidth={1.6} stroke="var(--gold)" style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>E-posta ile sıfırlama şu an kapalı</div>
            <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 6, lineHeight: 1.5 }}>
              Şifrenizi sıfırlamak için destek ile iletişime geçin; hesabınıza yeni bir
              geçici şifre tanımlanacaktır.
            </div>
          </div>
        ) : asama === "email" ? (
          <form onSubmit={kodIste} className="card">
            <div style={{ fontSize: 12.5, color: "var(--hint)", marginBottom: 10 }}>
              Hesabınızın e-posta adresini girin, size 6 haneli bir sıfırlama kodu gönderelim.
            </div>
            <input className="form-input" type="email" required placeholder="E-posta" autoFocus
              value={email} onChange={e => setEmail(e.target.value)} />
            <button type="submit" className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} disabled={busy}>
              {busy ? "Gönderiliyor..." : "Kod Gönder"}
            </button>
          </form>
        ) : asama === "kod" ? (
          <form onSubmit={sifirla} className="card">
            <div style={{ fontSize: 12.5, color: "var(--hint)", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
              <Mail size={14} strokeWidth={2} />
              Bu adres kayıtlıysa {email} adresine bir kod gönderildi.
            </div>
            <div className="form-group">
              <input className="form-input" placeholder="6 haneli kod" maxLength={6} autoFocus
                value={kod} onChange={e => setKod(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <input className="form-input" type="password" placeholder="Yeni şifre (en az 6 karakter)"
                value={yeniSifre} onChange={e => setYeniSifre(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 12, width: "100%" }}
              disabled={busy || kod.length !== 6 || yeniSifre.length < 6}>
              {busy ? "..." : "Şifreyi Değiştir"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8, width: "100%" }}
              onClick={() => { setAsama("email"); setErr(""); }}>
              Geri
            </button>
          </form>
        ) : (
          <div className="card" style={{ textAlign: "center" }}>
            <CheckCircle2 size={32} strokeWidth={1.6} stroke="var(--green)" style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, fontSize: 15 }}>Şifreniz değiştirildi</div>
            <button className="btn btn-primary" style={{ marginTop: 12, width: "100%" }}
              onClick={() => navigate("/giris")}>
              Giriş Yap
            </button>
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 13, color: "var(--hint)", marginTop: 12 }}>
          <Link to="/giris">← Girişe dön</Link>
        </div>
      </div>
    </div>
  );
}
