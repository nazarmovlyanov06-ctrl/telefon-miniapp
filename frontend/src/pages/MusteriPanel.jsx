import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import {
  Wrench, User, LogOut, ShieldCheck, ShoppingBag, CircleX,
  Smartphone, Headphones, CheckCircle2,
} from "lucide-react";

function tokenKey(slug) { return `musteri_token_${slug}`; }
function fmt(n) { return (n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 }); }

const DURUM_LABEL = {
  bekliyor: "Bekliyor", tamirde: "Tamirde", parca_bekleniyor: "Parça Bekleniyor",
  hazir: "Hazır", teslim: "Teslim Edildi",
};

function GirisKayitForm({ slug, onGiris }) {
  const [tab, setTab] = useState("giris");
  const [giris, setGiris] = useState({ telefon: "", sifre: "" });
  const [kayit, setKayit] = useState({ repair_no: "", telefon: "", yeni_sifre: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function girisYap(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const r = await api.musteriGiris(slug, giris);
      localStorage.setItem(tokenKey(slug), r.token);
      onGiris();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function kayitOl(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const r = await api.musteriKayit(slug, kayit);
      localStorage.setItem(tokenKey(slug), r.token);
      onGiris();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="card">
      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={`tab ${tab === "giris" ? "active" : ""}`} onClick={() => { setTab("giris"); setErr(""); }}>Giriş Yap</button>
        <button className={`tab ${tab === "kayit" ? "active" : ""}`} onClick={() => { setTab("kayit"); setErr(""); }}>Kayıt Ol</button>
      </div>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={13} strokeWidth={2} /> {err}</div>}

      {tab === "giris" ? (
        <form onSubmit={girisYap}>
          <div className="form-group">
            <input className="form-input" required type="tel" placeholder="Telefon"
              value={giris.telefon} onChange={e => setGiris(f => ({ ...f, telefon: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input className="form-input" required type="password" placeholder="Şifre"
              value={giris.sifre} onChange={e => setGiris(f => ({ ...f, sifre: e.target.value }))} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} disabled={busy}>
            {busy ? "..." : "Giriş Yap"}
          </button>
        </form>
      ) : (
        <form onSubmit={kayitOl}>
          <div style={{ fontSize: 12.5, color: "var(--hint)", marginBottom: 10 }}>
            Kayıt olmak için daha önce yaptırdığınız bir tamirin numarasını girin.
          </div>
          <div className="form-group">
            <input className="form-input" required placeholder="Tamir No (#T...)"
              value={kayit.repair_no} onChange={e => setKayit(f => ({ ...f, repair_no: e.target.value }))} />
          </div>
          <div className="form-group">
            <input className="form-input" required type="tel" placeholder="Telefon"
              value={kayit.telefon} onChange={e => setKayit(f => ({ ...f, telefon: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input className="form-input" required type="password" placeholder="Yeni şifre (en az 6 karakter)"
              value={kayit.yeni_sifre} onChange={e => setKayit(f => ({ ...f, yeni_sifre: e.target.value }))} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} disabled={busy}>
            {busy ? "..." : "Kayıt Ol"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function MusteriPanel() {
  const { slug } = useParams();
  const [panel, setPanel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggedOut, setLoggedOut] = useState(false);

  function load() {
    const token = localStorage.getItem(tokenKey(slug));
    if (!token) { setLoading(false); return; }
    api.musteriPanelim(slug, token)
      .then(setPanel)
      .catch(() => { localStorage.removeItem(tokenKey(slug)); setPanel(null); })
      .finally(() => setLoading(false));
  }
  useEffect(load, [slug]);

  function cikisYap() {
    localStorage.removeItem(tokenKey(slug));
    setPanel(null);
    setLoggedOut(true);
  }

  const satis = panel?.satin_alinan;
  const satisVar = satis && (satis.ikinci_el.length + satis.sifir.length + satis.aksesuar.length > 0);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "30px 20px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Wrench size={32} strokeWidth={1.6} style={{ marginBottom: 8 }} />
          <div style={{ fontWeight: 800, fontSize: 19 }}>Müşteri Panelim</div>
        </div>

        {loading ? null : !panel ? (
          <GirisKayitForm slug={slug} onGiris={() => { setLoggedOut(false); setLoading(true); load(); }} />
        ) : (
          <>
            <div className="card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                <User size={16} strokeWidth={2} /> {panel.ad}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={cikisYap} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--danger)" }}>
                <LogOut size={13} strokeWidth={2} /> Çıkış
              </button>
            </div>

            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
              <Wrench size={15} strokeWidth={2} /> Tamir Geçmişim
            </div>
            {panel.tamirler.length === 0 ? (
              <div className="card" style={{ marginBottom: 20, fontSize: 13, color: "var(--hint)" }}>Henüz tamir kaydınız yok.</div>
            ) : (
              <div className="card" style={{ marginBottom: 20 }}>
                {panel.tamirler.map((t, i) => (
                  <div key={i} style={{ padding: "10px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>#{t.repair_no} — {t.device_model}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: t.status === "hazir" ? "var(--green)" : "var(--accent)" }}>
                        {DURUM_LABEL[t.status] || t.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 2 }}>{t.fault_desc || "—"}</div>
                    <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 3 }}>
                      {new Date(t.created_at).toLocaleDateString("tr-TR")}
                      {t.final_price ? ` · ${fmt(t.final_price)}₺` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
              <ShieldCheck size={15} strokeWidth={2} /> Garantilerim
            </div>
            {panel.garantiler.length === 0 ? (
              <div className="card" style={{ marginBottom: 20, fontSize: 13, color: "var(--hint)" }}>Aktif garanti kaydınız yok.</div>
            ) : (
              <div className="card" style={{ marginBottom: 20 }}>
                {panel.garantiler.map((g, i) => {
                  const kalanGun = Math.ceil((new Date(g.bitis_tarihi) - new Date()) / 86400000);
                  const gecerli = g.aktif && kalanGun >= 0;
                  return (
                    <div key={i} style={{ padding: "10px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{g.cihaz}</div>
                      <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 2 }}>{g.tamir_aciklama}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: gecerli ? "var(--green)" : "var(--hint)", marginTop: 4 }}>
                        {gecerli ? `Garantili — ${kalanGun} gün kaldı` : "Süresi doldu"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
              <ShoppingBag size={15} strokeWidth={2} /> Satın Aldıklarım
            </div>
            {!satisVar ? (
              <div className="card" style={{ fontSize: 13, color: "var(--hint)" }}>Henüz kayıtlı bir satın alma yok.</div>
            ) : (
              <div className="card">
                {satis.sifir.map((c, i) => (
                  <div key={`s${i}`} style={{ padding: "8px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span className="badge" style={{ background: "rgba(74,222,128,0.15)", color: "var(--green)", marginRight: 6 }}>Sıfır</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{c.model}</span>
                      <div style={{ fontSize: 11, color: "var(--hint)" }}>{[c.renk, c.depolama].filter(Boolean).join(" · ")}</div>
                    </div>
                    <span style={{ fontWeight: 700, color: "var(--orange)", fontSize: 13 }}>{fmt(c.satis_fiyati)}₺</span>
                  </div>
                ))}
                {satis.ikinci_el.map((c, i) => (
                  <div key={`i${i}`} style={{ padding: "8px 0", borderTop: (i > 0 || satis.sifir.length > 0) ? "1px solid var(--divider)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span className="badge" style={{ background: "rgba(157,210,255,0.15)", color: "var(--blue2)", marginRight: 6 }}>2. El</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{c.model}</span>
                      <div style={{ fontSize: 11, color: "var(--hint)" }}>{[c.renk, c.depolama].filter(Boolean).join(" · ")}</div>
                    </div>
                    <span style={{ fontWeight: 700, color: "var(--orange)", fontSize: 13 }}>{fmt(c.satis_fiyati)}₺</span>
                  </div>
                ))}
                {satis.aksesuar.map((a, i) => (
                  <div key={`a${i}`} style={{ padding: "8px 0", borderTop: (i > 0 || satis.sifir.length > 0 || satis.ikinci_el.length > 0) ? "1px solid var(--divider)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <Headphones size={12} strokeWidth={2} style={{ marginRight: 5, display: "inline", verticalAlign: -1 }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{a.ad} × {a.miktar}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: "var(--orange)", fontSize: 13 }}>{fmt(a.toplam)}₺</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link to={`/magaza/${slug}`} style={{ fontSize: 12.5, color: "var(--hint)" }}>← Mağaza sayfasına dön</Link>
        </div>
      </div>
    </div>
  );
}
