import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import {
  Wrench, LogOut, ShieldCheck, ShoppingBag, CircleX, Home, Send,
  CheckCircle2, CalendarClock, Repeat, CreditCard,
  MessageCircle, Check, FileClock, Package, Store,
} from "lucide-react";

function tokenKey(slug) { return `musteri_token_${slug}`; }
function fmt(n) { return (n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 }); }
function tarih(d) { return d ? new Date(d).toLocaleDateString("tr-TR") : "—"; }

const DURUM_LABEL = {
  bekliyor: "Bekliyor", tamirde: "Tamirde", parca_bekleniyor: "Parça Bekleniyor",
  hazir: "Hazır", teslim: "Teslim Edildi",
};

/** Tamir durumunu 4 adımlık çizelgeye eşler. parca_bekleniyor da "Tamirde"
 * adımında sayılır — müşteri için ikisi de "cihaz serviste" demek. */
const ADIMLAR = [
  { key: "kayit", label: "Kayıt", ic: FileClock },
  { key: "tamirde", label: "Tamirde", ic: Wrench },
  { key: "hazir", label: "Hazır", ic: CheckCircle2 },
  { key: "teslim", label: "Teslim", ic: Home },
];
const DURUM_ADIM = { bekliyor: 0, tamirde: 1, parca_bekleniyor: 1, hazir: 2, teslim: 3 };

const RANDEVU_DURUM_META = {
  yeni: { label: "Yeni", color: "var(--blue)" },
  goruldu: { label: "Görüldü", color: "var(--gold)" },
  tamire_donusturuldu: { label: "Tamire Dönüştürüldü", color: "var(--green)" },
  reddedildi: { label: "Reddedildi", color: "var(--red)" },
};
const TAKAS_DURUM_META = {
  yeni: { label: "Yeni", color: "var(--blue)" },
  teklif_verildi: { label: "Teklif Verildi", color: "var(--gold)" },
  kabul_edildi: { label: "Kabul Edildi", color: "var(--green)" },
  reddedildi: { label: "Reddedildi", color: "var(--red)" },
};

function AdimCizelgesi({ status }) {
  const aktif = DURUM_ADIM[status] ?? 0;
  // "teslim" son durum — o noktada son adım da tamamlanmış sayılır, "sırada" değil.
  const bitti = status === "teslim";
  return (
    <div className="cp-steps">
      {ADIMLAR.map((a, i) => {
        const durum = i < aktif || (i === aktif && bitti) ? "done" : i === aktif ? "current" : "";
        const Ic = a.ic;
        return (
          <div key={a.key} className={`cp-step ${durum}`}>
            <div className="cp-step-dot">
              {i < aktif ? <Check size={13} strokeWidth={3} /> : <Ic size={13} strokeWidth={2} />}
            </div>
            <div className="cp-step-label">{a.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Giriş / Kayıt ───────────────────────────────────────────── */

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
    <div style={{ maxWidth: 380, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <Wrench size={34} strokeWidth={1.6} style={{ marginBottom: 8 }} />
        <div style={{ fontWeight: 800, fontSize: 20 }}>Müşteri Panelim</div>
        <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 4 }}>
          Tamirlerinizi, garantilerinizi ve borcunuzu tek yerden takip edin
        </div>
      </div>

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

      <div style={{ textAlign: "center", marginTop: 14 }}>
        <Link to={`/magaza/${slug}`} style={{ fontSize: 12.5, color: "var(--hint)" }}>← Mağaza sayfasına dön</Link>
      </div>
    </div>
  );
}

/* ── Sekmeler ────────────────────────────────────────────────── */

function TamirKarti({ t, acik, onToggle }) {
  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <div onClick={onToggle} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>#{t.repair_no} — {t.device_model}</div>
          <div style={{ fontSize: 12.5, color: "var(--hint)", marginTop: 2 }}>{t.fault_desc || "—"}</div>
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 3 }}>
            {tarih(t.created_at)}{t.final_price ? ` · ${fmt(t.final_price)}₺` : ""}
          </div>
        </div>
        <span className="badge" style={{
          background: t.status === "hazir" ? "rgba(74,222,128,0.15)" : "rgba(94,168,255,0.15)",
          color: t.status === "hazir" ? "var(--green)" : "var(--blue)", flexShrink: 0,
        }}>
          {DURUM_LABEL[t.status] || t.status}
        </span>
      </div>
      {acik && <AdimCizelgesi status={t.status} />}
    </div>
  );
}

function PanelSekmesi({ panel, onSekme }) {
  const acikTamirler = panel.tamirler.filter(t => t.status !== "teslim");
  const toplamBorc = panel.borclar.reduce((s, b) => s + Math.max(0, (b.total_amount || 0) - (b.paid_amount || 0)), 0);
  const aktifGaranti = panel.garantiler.filter(g => g.aktif && new Date(g.bitis_tarihi) >= new Date()).length;
  const sonTamir = panel.tamirler[0];

  return (
    <>
      <div className="cp-summary-row">
        <button className="cp-summary-card" style={{ border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }} onClick={() => onSekme("tamirler")}>
          <div className="val" style={{ color: acikTamirler.length ? "var(--blue)" : "var(--text)" }}>{acikTamirler.length}</div>
          <div className="lbl">Devam eden tamir</div>
        </button>
        <button className="cp-summary-card" style={{ border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }} onClick={() => onSekme("borclar")}>
          <div className="val" style={{ color: toplamBorc > 0 ? "var(--orange)" : "var(--green)" }}>{fmt(toplamBorc)}₺</div>
          <div className="lbl">Kalan borç</div>
        </button>
        <div className="cp-summary-card">
          <div className="val" style={{ color: aktifGaranti ? "var(--green)" : "var(--text)" }}>{aktifGaranti}</div>
          <div className="lbl">Aktif garanti</div>
        </div>
      </div>

      {sonTamir && (
        <>
          <div className="cp-section-title"><Wrench size={15} strokeWidth={2} /> Son Tamiriniz</div>
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14 }}>#{sonTamir.repair_no} — {sonTamir.device_model}</div>
            <div style={{ fontSize: 12.5, color: "var(--hint)", marginTop: 2 }}>{sonTamir.fault_desc || "—"}</div>
            <AdimCizelgesi status={sonTamir.status} />
          </div>
        </>
      )}

      {panel.randevularim.length > 0 && (
        <>
          <div className="cp-section-title"><CalendarClock size={15} strokeWidth={2} /> Randevu Taleplerim</div>
          <div className="card">
            {panel.randevularim.map((r, i) => {
              const meta = RANDEVU_DURUM_META[r.durum] || { label: r.durum, color: "var(--hint)" };
              return (
                <div key={i} style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.cihaz_model || "—"}</div>
                    {r.aciklama && <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 2 }}>{r.aciklama}</div>}
                    <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 3 }}>{tarih(r.created_at)}</div>
                  </div>
                  <span className="badge" style={{ background: `${meta.color}22`, color: meta.color, flexShrink: 0 }}>{meta.label}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {panel.takaslarim.length > 0 && (
        <>
          <div className="cp-section-title"><Repeat size={15} strokeWidth={2} /> Takas Tekliflerim</div>
          <div className="card">
            {panel.takaslarim.map((t, i) => {
              const meta = TAKAS_DURUM_META[t.durum] || { label: t.durum, color: "var(--hint)" };
              return (
                <div key={i} style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.cihaz_model}</div>
                    {t.teklif_tutari && <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--orange)", marginTop: 2 }}>{fmt(t.teklif_tutari)}₺</div>}
                    <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 3 }}>{tarih(t.created_at)}</div>
                  </div>
                  <span className="badge" style={{ background: `${meta.color}22`, color: meta.color, flexShrink: 0 }}>{meta.label}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function TamirlerSekmesi({ panel }) {
  const [acik, setAcik] = useState(panel.tamirler[0]?.repair_no || null);
  return (
    <>
      <div className="cp-section-title"><Wrench size={15} strokeWidth={2} /> Tamir Geçmişim</div>
      {panel.tamirler.length === 0 ? (
        <div className="card" style={{ fontSize: 13, color: "var(--hint)" }}>Henüz tamir kaydınız yok.</div>
      ) : panel.tamirler.map(t => (
        <TamirKarti key={t.repair_no} t={t} acik={acik === t.repair_no}
          onToggle={() => setAcik(a => (a === t.repair_no ? null : t.repair_no))} />
      ))}

      <div className="cp-section-title"><ShieldCheck size={15} strokeWidth={2} /> Garantilerim</div>
      {panel.garantiler.length === 0 ? (
        <div className="card" style={{ fontSize: 13, color: "var(--hint)" }}>Aktif garanti kaydınız yok.</div>
      ) : (
        <div className="card">
          {panel.garantiler.map((g, i) => {
            const kalanGun = Math.ceil((new Date(g.bitis_tarihi) - new Date()) / 86400000);
            const gecerli = g.aktif && kalanGun >= 0;
            return (
              <div key={i} style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
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
    </>
  );
}

function UrunlerSekmesi({ panel }) {
  const s = panel.satin_alinan;
  const bos = s.ikinci_el.length + s.sifir.length + s.aksesuar.length === 0;

  return (
    <>
      <div className="cp-section-title"><ShoppingBag size={15} strokeWidth={2} /> Satın Aldıklarım</div>
      {bos ? (
        <div className="card" style={{ fontSize: 13, color: "var(--hint)" }}>Henüz kayıtlı bir satın alma yok.</div>
      ) : (
        <div className="card">
          {[
            ...s.sifir.map(c => ({ ...c, rozet: "Sıfır", bg: "rgba(74,222,128,0.15)", renk: "var(--green)", ad: c.model, tutar: c.satis_fiyati, alt: [c.renk, c.depolama].filter(Boolean).join(" · "), t: c.satis_tarihi })),
            ...s.ikinci_el.map(c => ({ ...c, rozet: "2. El", bg: "rgba(157,210,255,0.15)", renk: "var(--blue2)", ad: c.model, tutar: c.satis_fiyati, alt: [c.renk, c.depolama, c.ram].filter(Boolean).join(" · "), t: c.satis_tarihi })),
            ...s.aksesuar.map(a => ({ ...a, rozet: "Aksesuar", bg: "rgba(246,162,74,0.15)", renk: "var(--orange)", ad: `${a.ad} × ${a.miktar}`, tutar: a.toplam, alt: "", t: a.tarih })),
          ].map((u, i) => (
            <div key={i} style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <span className="badge" style={{ background: u.bg, color: u.renk, marginRight: 6 }}>{u.rozet}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{u.ad}</span>
                <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>
                  {[u.alt, tarih(u.t)].filter(Boolean).join(" · ")}
                </div>
              </div>
              <span style={{ fontWeight: 700, color: "var(--orange)", fontSize: 13.5, flexShrink: 0 }}>{fmt(u.tutar)}₺</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function BorclarSekmesi({ panel, slug }) {
  const [acik, setAcik] = useState(null);
  const [odemeler, setOdemeler] = useState({});

  async function ac(b) {
    const yeni = acik === b.id ? null : b.id;
    setAcik(yeni);
    if (yeni && !odemeler[b.id]) {
      try {
        const token = localStorage.getItem(tokenKey(slug));
        const liste = await api.musteriBorcOdemeleri(slug, b.id, token);
        setOdemeler(o => ({ ...o, [b.id]: liste }));
      } catch { setOdemeler(o => ({ ...o, [b.id]: [] })); }
    }
  }

  const toplam = panel.borclar.reduce((s, b) => s + Math.max(0, (b.total_amount || 0) - (b.paid_amount || 0)), 0);

  return (
    <>
      <div className="cp-summary-row" style={{ marginBottom: 14 }}>
        <div className="cp-summary-card">
          <div className="val" style={{ color: toplam > 0 ? "var(--orange)" : "var(--green)" }}>{fmt(toplam)}₺</div>
          <div className="lbl">Toplam kalan borç</div>
        </div>
      </div>

      <div className="cp-section-title"><CreditCard size={15} strokeWidth={2} /> Borçlarım / Taksitlerim</div>
      {panel.borclar.length === 0 ? (
        <div className="card" style={{ fontSize: 13, color: "var(--hint)" }}>Borç kaydınız yok.</div>
      ) : panel.borclar.map(b => {
        const kalan = Math.max(0, (b.total_amount || 0) - (b.paid_amount || 0));
        const kapandi = kalan === 0;
        return (
          <div key={b.id} className="card" style={{ marginBottom: 8 }}>
            <div onClick={() => ac(b)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{b.notes || "Borç kaydı"}</div>
                <div style={{ fontSize: 11.5, color: "var(--hint)", marginTop: 2 }}>
                  {b.payment_type === "taksit" ? `${b.installment_count} taksit · ` : ""}
                  {tarih(b.created_at)}
                  {b.due_date ? ` · Vade: ${b.due_date}` : ""}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--hint)", marginTop: 2 }}>
                  Toplam {fmt(b.total_amount)}₺ · Ödenen {fmt(b.paid_amount)}₺
                </div>
              </div>
              <span style={{ fontWeight: 800, fontSize: 15, color: kapandi ? "var(--green)" : "var(--orange)", flexShrink: 0 }}>
                {kapandi ? "Kapandı" : `${fmt(kalan)}₺`}
              </span>
            </div>

            {acik === b.id && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--divider)" }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--hint)", marginBottom: 6 }}>ÖDEME GEÇMİŞİ</div>
                {!odemeler[b.id] ? (
                  <div style={{ fontSize: 12.5, color: "var(--hint)" }}>Yükleniyor...</div>
                ) : odemeler[b.id].length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--hint)" }}>Henüz ödeme yapılmamış.</div>
                ) : odemeler[b.id].map((o, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}>
                    <span style={{ color: "var(--hint)" }}>{tarih(o.paid_at)} · {o.payment_type}</span>
                    <span style={{ fontWeight: 600 }}>{fmt(o.amount)}₺</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function MesajlarSekmesi({ slug, onOkundu }) {
  const [mesajlar, setMesajlar] = useState(null);
  const [metin, setMetin] = useState("");
  const [busy, setBusy] = useState(false);
  const sonRef = useRef(null);

  function yukle() {
    const token = localStorage.getItem(tokenKey(slug));
    api.musteriMesajlarim(slug, token)
      .then(m => { setMesajlar(m); onOkundu?.(); })
      .catch(() => setMesajlar([]));
  }
  useEffect(yukle, [slug]);
  useEffect(() => { sonRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mesajlar]);

  async function gonder(e) {
    e.preventDefault();
    if (!metin.trim()) return;
    setBusy(true);
    try {
      const token = localStorage.getItem(tokenKey(slug));
      await api.musteriMesajGonder(slug, metin.trim(), token);
      setMetin("");
      yukle();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="cp-section-title"><MessageCircle size={15} strokeWidth={2} /> Dükkânla Mesajlaşma</div>

      {mesajlar === null ? (
        <div className="card" style={{ fontSize: 13, color: "var(--hint)" }}>Yükleniyor...</div>
      ) : mesajlar.length === 0 ? (
        <div className="card" style={{ fontSize: 13, color: "var(--hint)", marginBottom: 12 }}>
          Henüz mesaj yok. Aşağıdan dükkâna yazabilirsiniz.
        </div>
      ) : (
        <div className="cp-chat">
          {mesajlar.map(m => (
            <div key={m.id} className={`cp-msg ${m.gonderen === "musteri" ? "ben" : "dukkan"}`}>
              {m.mesaj}
              <div className="cp-msg-time">{new Date(m.created_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          ))}
          <div ref={sonRef} />
        </div>
      )}

      <form onSubmit={gonder} style={{ display: "flex", gap: 8 }}>
        <input className="form-input" style={{ flex: 1 }} placeholder="Mesajınızı yazın..."
          value={metin} onChange={e => setMetin(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !metin.trim()}
          style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Send size={14} strokeWidth={2} /> Gönder
        </button>
      </form>
    </>
  );
}

/* ── Sayfa ───────────────────────────────────────────────────── */

export default function MusteriPanel() {
  const { slug } = useParams();
  const [panel, setPanel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sekme, setSekme] = useState("panel");
  const [okunmamis, setOkunmamis] = useState(0);

  function load() {
    const token = localStorage.getItem(tokenKey(slug));
    if (!token) { setLoading(false); return; }
    api.musteriPanelim(slug, token)
      .then(p => { setPanel(p); setOkunmamis(p.okunmamis_mesaj || 0); })
      .catch(() => { localStorage.removeItem(tokenKey(slug)); setPanel(null); })
      .finally(() => setLoading(false));
  }
  useEffect(load, [slug]);

  function cikisYap() {
    localStorage.removeItem(tokenKey(slug));
    setPanel(null);
    setSekme("panel");
  }

  if (loading) return null;
  if (!panel) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)" }}>
        <GirisKayitForm slug={slug} onGiris={() => { setLoading(true); load(); }} />
      </div>
    );
  }

  const NAV = [
    { key: "panel", label: "Panel", ic: Home },
    { key: "tamirler", label: "Tamirler", ic: Wrench },
    { key: "urunler", label: "Ürünler", ic: Package },
    { key: "borclar", label: "Borçlar", ic: CreditCard },
    { key: "mesajlar", label: "Mesajlar", ic: MessageCircle, badge: okunmamis },
  ];

  return (
    <div className="cp-root">
      <header className="cp-header">
        <div className="cp-header-inner">
          <div>
            <div className="cp-hello">Merhaba,</div>
            <div className="cp-name">{panel.ad}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={cikisYap}
            style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--danger)" }}>
            <LogOut size={13} strokeWidth={2} /> Çıkış
          </button>
        </div>
      </header>

      <div className="cp-body">
        {sekme === "panel" && <PanelSekmesi panel={panel} onSekme={setSekme} />}
        {sekme === "tamirler" && <TamirlerSekmesi panel={panel} />}
        {sekme === "urunler" && <UrunlerSekmesi panel={panel} />}
        {sekme === "borclar" && <BorclarSekmesi panel={panel} slug={slug} />}
        {sekme === "mesajlar" && <MesajlarSekmesi slug={slug} onOkundu={() => setOkunmamis(0)} />}

        <div style={{ textAlign: "center", marginTop: 22 }}>
          <Link to={`/magaza/${slug}`} style={{ fontSize: 12.5, color: "var(--hint)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Store size={13} strokeWidth={2} /> Mağaza sayfasına dön
          </Link>
        </div>
      </div>

      <nav className="cp-bottom-nav">
        {NAV.map(n => {
          const Ic = n.ic;
          return (
            <button key={n.key} className={"cp-nav-btn" + (sekme === n.key ? " active" : "")}
              onClick={() => setSekme(n.key)}>
              <Ic size={19} strokeWidth={1.9} />
              {n.label}
              {n.badge > 0 && <span className="cp-nav-badge">{n.badge}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
