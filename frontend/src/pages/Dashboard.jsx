import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  Search, Eye, EyeOff, Wallet, TrendingDown, Phone,
  Smartphone, Package, ShieldCheck, ClipboardList,
  Headphones, CreditCard, BarChart3, Sparkles,
  TriangleAlert, Plus, Wrench, X, ArrowRight, TrendingUp,
  ChevronDown, ChevronUp, Landmark, Target, Factory, Undo2, PhoneCall,
  Ban, MessageSquareWarning, Store, CalendarClock, Star, Repeat,
  MessageCircle, Banknote, ScanLine, Users, SlidersHorizontal, Check, Bell,
} from "lucide-react";

/* ── Kalıcı tarayıcı tercihleri ──────────────────────────────────────── */

// Katlanır bölümlerin (Gecikmiş Borç / Garanti / Aranacaklar) açık-kapalı
// durumu — kalıcı silme değil, sadece görünüm tercihi. Kullanıcı "X ile
// yanlışlıkla basıp bir daha göremem" dediği için önceki kalıcı-gizleme
// yaklaşımı (dashboard_gizli_uyarilar) tamamen kaldırıldı.
const ACIK_ANAHTAR = "dashboard_acik_bolumler";
function acikBolumleriOku() {
  try {
    const v = JSON.parse(localStorage.getItem(ACIK_ANAHTAR));
    if (v && typeof v === "object") return v;
  } catch { /* ilk kullanım */ }
  return { borc: true, garanti: true, arama: true };
}

// Hızlı Erişim ızgarasında hangi modüllerin göründüğü — kullanıcıya özel,
// cihazda saklanır.
const TUM_MODULLER = [
  { icon: Smartphone, label: "2. El", path: "/ikinciel", color: "var(--purple)" },
  { icon: Package, label: "Sıfır Cihaz", path: "/sifir-cihaz", color: "var(--blue)" },
  { icon: ShieldCheck, label: "Garanti", path: "/garanti", color: "var(--green)" },
  { icon: ClipboardList, label: "Siparişler", path: "/parts?tab=orders", color: "var(--orange)" },
  { icon: Headphones, label: "Aksesuar", path: "/aksesuar", color: "var(--purple)" },
  { icon: CreditCard, label: "Borçlar", path: "/debts", color: "var(--red)" },
  { icon: BarChart3, label: "Rapor", path: "/stats", color: "var(--gold)" },
  { icon: Sparkles, label: "Yardımcı", path: "/ai", color: "var(--blue)" },
  { icon: Landmark, label: "Kasa", path: "/kasa", color: "var(--green)" },
  { icon: TrendingDown, label: "Giderler", path: "/gider", color: "var(--red)" },
  { icon: Target, label: "Hedef", path: "/hedef", color: "var(--blue)" },
  { icon: Factory, label: "Toptancı", path: "/toptanci", color: "var(--blue)" },
  { icon: Undo2, label: "Parça İade", path: "/parca-iade", color: "var(--gold)" },
  { icon: PhoneCall, label: "Yedek Telefon", path: "/loaner", color: "var(--blue)" },
  { icon: Ban, label: "Kara Liste", path: "/karalist", color: "var(--red)" },
  { icon: MessageSquareWarning, label: "Şikayet/Övgü", path: "/geri-bildirim", color: "var(--orange)" },
  { icon: Store, label: "Vitrin Ayarları", path: "/vitrin-ayarlari", color: "var(--gold)" },
  { icon: CalendarClock, label: "Randevu Talepleri", path: "/randevu-talepleri", color: "var(--blue)" },
  { icon: Star, label: "Değerlendirmeler", path: "/vitrin-degerlendirme", color: "var(--orange)" },
  { icon: Repeat, label: "Takas Teklifleri", path: "/vitrin-takas", color: "var(--blue2)" },
  { icon: MessageCircle, label: "Müşteri Mesajları", path: "/musteri-mesajlari", color: "var(--green)" },
  { icon: Banknote, label: "Maaş", path: "/maas", color: "var(--purple)" },
  { icon: ScanLine, label: "IMEI", path: "/imei", color: "var(--gray)" },
  { icon: Users, label: "Müşteriler", path: "/customers", color: "var(--blue)" },
];
const VARSAYILAN_HIZLI = ["/ikinciel", "/sifir-cihaz", "/garanti", "/parts?tab=orders", "/aksesuar", "/debts", "/stats", "/ai"];
const HIZLI_ANAHTAR = "dashboard_hizli_erisim";
function hizliErisimOku() {
  try {
    const v = JSON.parse(localStorage.getItem(HIZLI_ANAHTAR));
    if (Array.isArray(v) && v.length) return v;
  } catch { /* ilk kullanım */ }
  return VARSAYILAN_HIZLI;
}

// Ana sayfa bloklarının (durum/kasa/kazanç/uyarılar/hızlı erişim/bekleyenler/
// stok) sırası — basılı tutup titretip sürükleyerek değiştirilebilir, cihazda
// saklanır.
const BLOK_ANAHTAR = "dashboard_blok_sirasi";
const VARSAYILAN_BLOK_SIRASI = ["durum", "kasa", "kazanc", "borc", "garanti", "arama", "hizli", "bekleyenler", "stok"];
function blokSirasiOku() {
  try {
    const v = JSON.parse(localStorage.getItem(BLOK_ANAHTAR));
    if (Array.isArray(v) && v.length) {
      const eksikler = VARSAYILAN_BLOK_SIRASI.filter(k => !v.includes(k));
      return [...v.filter(k => VARSAYILAN_BLOK_SIRASI.includes(k)), ...eksikler];
    }
  } catch { /* ilk kullanım */ }
  return VARSAYILAN_BLOK_SIRASI;
}

const DURUM_RENK = {
  bekliyor: "var(--orange)",
  tamirde: "var(--blue)",
  parca_bekleniyor: "var(--purple)",
  hazir: "var(--green)",
};

const DURUM_LABEL = {
  bekliyor: "Bekliyor",
  tamirde: "Tamirde",
  parca_bekleniyor: "Parça",
  hazir: "Hazır",
};

function fmt(n) {
  if (!n) return "0";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return Math.round(n).toString();
}
function tl(n) { return (n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 }); }

/* ── Ortak modal kabuğu (alttan açılan sayfa) ─────────────────────────── */

function AltPencere({ children, onClose, maxWidth = 480 }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth, margin: "0 auto", borderRadius: 20, maxHeight: "82vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function PencereBaslik({ children, onClose }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <span style={{ fontWeight: 700, fontSize: 16 }}>{children}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex" }}>
        <X size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

/* ── Katlanır bölüm (svernut — kalıcı silmiyor, sadece kapatıp açıyor) ── */

function KatlanirBolum({ baslik, ikon: Ikon, renk, sayi, acik, onToggle, children }) {
  if (sayi === 0) return null;
  return (
    <div className="card" style={{ margin: 0, padding: 0, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "12px 14px" }}>
        <Ikon size={15} stroke={renk} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: renk, flex: 1 }}>{baslik} ({sayi})</span>
        {acik ? <ChevronUp size={16} stroke="var(--hint)" strokeWidth={2} /> : <ChevronDown size={16} stroke="var(--hint)" strokeWidth={2} />}
      </div>
      {acik && <div style={{ padding: "0 14px 6px" }}>{children}</div>}
    </div>
  );
}

/* ── Durum kartı önizlemesi (Bekliyor/Tamirde/Parça/Hazır) ────────────── */

function DurumOnizlemeModal({ durum, onClose }) {
  const [liste, setListe] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.repairs({ status: durum }).then(r => setListe(r.slice(0, 8))).catch(() => setListe([]));
  }, [durum]);

  return (
    <AltPencere onClose={onClose}>
      <PencereBaslik onClose={onClose}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: DURUM_RENK[durum], display: "inline-block" }} />
          {DURUM_LABEL[durum]}
        </span>
      </PencereBaslik>
      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/repairs?status=${durum}`)}
        style={{ width: "100%", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        Tümünü Gör <ArrowRight size={13} strokeWidth={2.4} />
      </button>
      {liste === null ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Bu durumda tamir yok</div>
      ) : liste.map(r => (
        <div key={r.id} className="list-item" onClick={() => navigate(`/repairs/${r.id}`)} style={{ cursor: "pointer" }}>
          <div style={{ width: 4, borderRadius: 4, alignSelf: "stretch", flexShrink: 0, background: DURUM_RENK[durum], marginRight: 4 }} />
          <div className="list-item-body">
            <div className="list-item-title">{r.customer_name || "—"} · {r.device_model}</div>
            <div className="list-item-sub">#{r.repair_no} · {r.fault_desc || "—"}</div>
          </div>
        </div>
      ))}
    </AltPencere>
  );
}

/* ── Aktif Tamir / Açık Borç (Bekleyenler kartı) önizlemesi ───────────── */

function AktifTamirModal({ onClose }) {
  const [liste, setListe] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.repairs({ status: "aktif", limit: 8 }).then(setListe).catch(() => setListe([]));
  }, []);

  return (
    <AltPencere onClose={onClose}>
      <PencereBaslik onClose={onClose}>Aktif Tamirler</PencereBaslik>
      <button className="btn btn-primary btn-sm" onClick={() => navigate("/repairs")}
        style={{ width: "100%", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        Tümünü Gör <ArrowRight size={13} strokeWidth={2.4} />
      </button>
      {liste === null ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Aktif tamir yok</div>
      ) : liste.map(r => (
        <div key={r.id} className="list-item" onClick={() => navigate(`/repairs/${r.id}`)} style={{ cursor: "pointer" }}>
          <div style={{ width: 4, borderRadius: 4, alignSelf: "stretch", flexShrink: 0, background: DURUM_RENK[r.status] || "var(--divider)", marginRight: 4 }} />
          <div className="list-item-body">
            <div className="list-item-title">{r.customer_name || "—"} · {r.device_model}</div>
            <div className="list-item-sub">#{r.repair_no} · {DURUM_LABEL[r.status] || r.status}</div>
          </div>
        </div>
      ))}
    </AltPencere>
  );
}

function AcikBorcModal({ onClose, onBorcSec }) {
  const [liste, setListe] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.debts("alacak").then(r => setListe(r.filter(d => (d.total_amount || 0) > (d.paid_amount || 0)).slice(0, 8))).catch(() => setListe([]));
  }, []);

  return (
    <AltPencere onClose={onClose}>
      <PencereBaslik onClose={onClose}>Açık Borçlar</PencereBaslik>
      <button className="btn btn-primary btn-sm" onClick={() => navigate("/debts")}
        style={{ width: "100%", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        Tümünü Gör <ArrowRight size={13} strokeWidth={2.4} />
      </button>
      {liste === null ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Açık borç yok</div>
      ) : liste.map(d => (
        <div key={d.id} className="card-row" style={{ padding: "10px 0", borderTop: "1px solid var(--divider)", cursor: "pointer" }}
          onClick={() => onBorcSec(d)}>
          <span style={{ fontSize: 13 }}>{d.customer_name || d.alacakli_adi || "—"}</span>
          <span style={{ fontWeight: 700, color: "var(--red)" }}>{tl((d.total_amount || 0) - (d.paid_amount || 0))}₺</span>
        </div>
      ))}
    </AltPencere>
  );
}

/* ── Borç detayı — ödeme al ────────────────────────────────────────────── */

function BorcDetayModal({ borc, onClose, onDegisti }) {
  const [odemeler, setOdemeler] = useState(null);
  const [odenenTutar, setOdenenTutar] = useState(borc.paid_amount || 0);
  const [tutar, setTutar] = useState("");
  const [odemeTipi, setOdemeTipi] = useState("nakit");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.debtOdemeler(borc.id).then(setOdemeler).catch(() => setOdemeler([]));
  }, [borc.id]);

  const kalan = (borc.total_amount || 0) - odenenTutar;

  async function odemeAl(e) {
    e.preventDefault();
    if (!tutar || busy) return;
    setBusy(true); setErr("");
    try {
      // Arka planda ana sayfa verisini de tazeliyoruz (borç kapandıysa "Gecikmiş
      // Borçlar" bölümünden düşsün), ama bu modal kapanana kadar gösterdiği kalan
      // tutarı KENDİ state'inden güncelliyor — dashboard prop'u yeniden yüklenene
      // kadar eski `borc` objesiyle donup kalmasın diye.
      const r = await api.payDebt(borc.id, { amount: parseFloat(tutar), payment_type: odemeTipi });
      setOdenenTutar(r.new_paid);
      setTutar("");
      const guncel = await api.debtOdemeler(borc.id);
      setOdemeler(guncel);
      onDegisti();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <AltPencere onClose={onClose}>
      <PencereBaslik onClose={onClose}>{borc.customer_name || borc.alacakli_adi || borc.musteri_adi}</PencereBaslik>

      <div style={{ fontWeight: 300, fontSize: 26, color: kalan > 0 ? "var(--red)" : "var(--green)", letterSpacing: -0.5 }}>
        {tl(kalan)}₺ <span style={{ fontSize: 13, fontWeight: 500, color: "var(--hint)" }}>kalan</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--hint)", marginTop: 4 }}>
        Toplam {tl(borc.total_amount)}₺ · Ödenen {tl(odenenTutar)}₺
        {borc.payment_type === "taksit" && borc.installment_count > 1 ? ` · ${borc.installment_count} taksit` : ""}
      </div>
      {borc.due_date && <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 2 }}>Vade: {borc.due_date}</div>}
      {borc.notes && <div style={{ fontSize: 12.5, marginTop: 8, color: "var(--text)" }}>{borc.notes}</div>}

      <div className="section-title" style={{ marginTop: 16 }}>Ödeme Geçmişi</div>
      {odemeler === null ? (
        <div style={{ fontSize: 12.5, color: "var(--hint)" }}>Yükleniyor...</div>
      ) : odemeler.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--hint)" }}>Henüz ödeme yapılmamış</div>
      ) : odemeler.map(o => (
        <div key={o.id} className="card-row" style={{ padding: "6px 0" }}>
          <span style={{ fontSize: 12.5, color: "var(--hint)" }}>
            {o.paid_at ? new Date(o.paid_at).toLocaleDateString("tr-TR") : "—"} · {o.payment_type}
          </span>
          <span style={{ fontWeight: 700, color: "var(--green)", fontSize: 13 }}>{tl(o.amount)}₺</span>
        </div>
      ))}

      {kalan > 0 && (
        <form onSubmit={odemeAl} style={{ marginTop: 14 }}>
          {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input" type="number" step="0.01" placeholder="Tutar"
              value={tutar} onChange={e => setTutar(e.target.value)} style={{ flex: 1 }} />
            <select className="form-select" value={odemeTipi} onChange={e => setOdemeTipi(e.target.value)} style={{ width: 110 }}>
              <option value="nakit">Nakit</option>
              <option value="kart">Kart</option>
              <option value="havale">Havale</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 8, width: "100%" }} disabled={busy}>
            {busy ? "..." : "Ödeme Al"}
          </button>
        </form>
      )}
      <button className="btn btn-ghost btn-sm" onClick={() => navigate("/debts")} style={{ marginTop: 10, width: "100%" }}>
        Tüm Borçlar
      </button>
    </AltPencere>
  );
}

/* ── Garanti detayı ─────────────────────────────────────────────────────── */

function GarantiDetayModal({ garanti, onClose }) {
  const navigate = useNavigate();
  const kalanGun = garanti.bitis_tarihi ? Math.ceil((new Date(garanti.bitis_tarihi) - new Date()) / 86400000) : null;

  return (
    <AltPencere onClose={onClose}>
      <PencereBaslik onClose={onClose}>{garanti.musteri_adi}</PencereBaslik>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{garanti.cihaz}</div>
      <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 4 }}>{garanti.tamir_aciklama || "—"}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        <div className="card" style={{ margin: 0, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--hint)" }}>Başlangıç</div>
          <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{garanti.baslangic_tarihi || "—"}</div>
        </div>
        <div className="card" style={{ margin: 0, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--hint)" }}>Bitiş</div>
          <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{garanti.bitis_tarihi || "—"}</div>
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: "center", padding: "10px 0", fontWeight: 700, fontSize: 14, color: kalanGun >= 0 ? "var(--green)" : "var(--hint)" }}>
        {kalanGun !== null && (kalanGun >= 0 ? `${kalanGun} gün kaldı` : "Süresi doldu")}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {garanti.telefon && (
          <a href={`tel:${garanti.telefon}`} className="btn btn-ghost btn-sm" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Phone size={13} strokeWidth={2} /> {garanti.telefon}
          </a>
        )}
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate("/garanti")} style={{ marginTop: 8, width: "100%" }}>
        Tüm Garantiler
      </button>
    </AltPencere>
  );
}

/* ── Aranacak detayı ────────────────────────────────────────────────────── */

function AranacakDetayModal({ kayit, onClose }) {
  const navigate = useNavigate();
  const ucret = kayit.final_price || kayit.estimated_price;

  return (
    <AltPencere onClose={onClose}>
      <PencereBaslik onClose={onClose}>{kayit.musteri_adi || "—"}</PencereBaslik>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{kayit.device_model}</div>
      <div style={{ fontSize: 12.5, color: "var(--hint)", marginTop: 2 }}>#{kayit.repair_no}</div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, color: "var(--hint)", marginBottom: 2 }}>Arıza</div>
        <div style={{ fontSize: 13.5 }}>{kayit.fault_desc || "—"}</div>
        {kayit.diagnosis && (
          <>
            <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 10, marginBottom: 2 }}>Yapılan İşlem</div>
            <div style={{ fontSize: 13.5 }}>{kayit.diagnosis}</div>
          </>
        )}
      </div>

      <div style={{ fontWeight: 300, fontSize: 24, color: "var(--orange)", marginTop: 12 }}>
        {ucret ? `${tl(ucret)}₺` : "Ücret girilmemiş"}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {kayit.telefon && (
          <a href={`tel:${kayit.telefon}`} className="btn btn-ghost btn-sm" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Phone size={13} strokeWidth={2} /> Ara
          </a>
        )}
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => navigate(`/repairs/${kayit.id}`)}>
          Detaylı Bak
        </button>
      </div>
    </AltPencere>
  );
}

/* ── Azalan stok önizlemesi ─────────────────────────────────────────────── */

function StokDetayModal({ liste, onClose }) {
  const navigate = useNavigate();
  return (
    <AltPencere onClose={onClose}>
      <PencereBaslik onClose={onClose}>Azalan Stok</PencereBaslik>
      <button className="btn btn-primary btn-sm" onClick={() => navigate("/parts?low_stock=true")}
        style={{ width: "100%", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        Tümünü Gör <ArrowRight size={13} strokeWidth={2.4} />
      </button>
      {liste.length === 0 ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Azalan stok yok</div>
      ) : liste.map((s, i) => (
        <div key={i} className="card-row" style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
          <span style={{ fontSize: 13 }}>{s.name}</span>
          <span style={{ fontWeight: 700, color: s.quantity === 0 ? "var(--danger)" : "var(--orange)" }}>
            {s.quantity} / min {s.min_quantity || 0}
          </span>
        </div>
      ))}
    </AltPencere>
  );
}

/* ── Bugün Gelir/Gider ve Bu Ay Kazanç ─────────────────────────────────── */

function KasaHareketModal({ tip, onClose }) {
  const [hareketler, setHareketler] = useState(null);
  const baslik = tip === "gelir" ? "Bugün Gelir" : "Bugün Gider";
  const renk = tip === "gelir" ? "var(--green)" : "var(--red)";

  useEffect(() => {
    api.kasaBugun().then(r => {
      const gelirTur = new Set(["giris", "gelir"]);
      setHareketler((r.hareketler || []).filter(h => gelirTur.has(h.tur) === (tip === "gelir")));
    }).catch(() => setHareketler([]));
  }, [tip]);

  const toplam = (hareketler || []).reduce((s, h) => s + (h.tutar || 0), 0);

  return (
    <AltPencere onClose={onClose}>
      <PencereBaslik onClose={onClose}>{baslik}</PencereBaslik>
      <div style={{ fontWeight: 300, fontSize: 26, color: renk, letterSpacing: -0.5, marginBottom: 14 }}>{tl(toplam)}₺</div>
      {hareketler === null ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Yükleniyor...</div>
      ) : hareketler.length === 0 ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
          Bugün {tip === "gelir" ? "gelir" : "gider"} kaydı yok
        </div>
      ) : hareketler.map((h, i) => (
        <div key={h.id || i} className="card-row" style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{h.aciklama || "—"}</div>
            <div style={{ fontSize: 11.5, color: "var(--hint)", marginTop: 2 }}>{h.odeme_yontemi || "—"}</div>
          </div>
          <span style={{ fontWeight: 700, color: renk }}>{tl(h.tutar)}₺</span>
        </div>
      ))}
    </AltPencere>
  );
}

function BuAyKazancModal({ kaynaklar, toplam, onClose }) {
  const navigate = useNavigate();
  return (
    <AltPencere onClose={onClose}>
      <PencereBaslik onClose={onClose}>Bu Ay Kazanç — Nereden?</PencereBaslik>
      <div style={{ fontWeight: 300, fontSize: 26, color: "var(--orange)", letterSpacing: -0.5, marginBottom: 14 }}>{tl(toplam)}₺</div>
      {kaynaklar.length === 0 ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Bu ay henüz gelir yok</div>
      ) : kaynaklar.map((k, i) => (
        <div key={k.kaynak} className="card-row" style={{ padding: "10px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
          <span style={{ fontSize: 13.5 }}>{k.label}</span>
          <span style={{ fontWeight: 700, color: "var(--orange)" }}>{tl(k.tutar)}₺</span>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => navigate("/stats")}
        style={{ width: "100%", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        Detaylı Rapor <ArrowRight size={13} strokeWidth={2.4} />
      </button>
    </AltPencere>
  );
}

/* ── Hızlı Erişim düzenleme ─────────────────────────────────────────────── */

function HizliDuzenleModal({ secili, onClose, onKaydet }) {
  const [yerel, setYerel] = useState(secili);
  function toggle(path) {
    setYerel(s => s.includes(path) ? s.filter(p => p !== path) : [...s, path]);
  }
  return (
    <AltPencere onClose={onClose}>
      <PencereBaslik onClose={onClose}>Hızlı Erişimi Düzenle</PencereBaslik>
      <div style={{ fontSize: 12.5, color: "var(--hint)", marginBottom: 12 }}>
        Ana sayfada görünecek modülleri seç.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {TUM_MODULLER.map(m => {
          const secildi = yerel.includes(m.path);
          const Ikon = m.icon;
          return (
            <button key={m.path} type="button" onClick={() => toggle(m.path)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 11px", borderRadius: 10,
                border: secildi ? "1.5px solid var(--gold)" : "1px solid var(--divider)",
                background: secildi ? "rgba(210,169,85,0.10)" : "transparent",
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              }}>
              <Ikon size={16} stroke={m.color} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: "var(--text)" }}>{m.label}</span>
              {secildi && <Check size={14} stroke="var(--gold)" strokeWidth={2.6} style={{ flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>
      <button className="btn btn-primary" style={{ marginTop: 16, width: "100%" }} onClick={() => onKaydet(yerel)}>
        Kaydet
      </button>
    </AltPencere>
  );
}

/* ── Bildirim zili paneli ──────────────────────────────────────────────── */

const BILDIRIM_TUR_META = {
  alacak_vadesi: { icon: CreditCard, color: "var(--red)" },
  tamir_teslim_bekliyor: { icon: Wrench, color: "var(--orange)" },
  randevu_talebi: { icon: CalendarClock, color: "var(--blue)" },
  takas_teklifi: { icon: Repeat, color: "var(--blue2)" },
  musteri_mesaji: { icon: MessageCircle, color: "var(--green)" },
};

function bildirimZamanFmt(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function BildirimPanelModal({ onClose, onOkundu }) {
  const [liste, setListe] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.bildirimler().then(r => {
      setListe(r.liste || []);
      api.bildirimlerOkundu().catch(() => {});
      onOkundu();
    }).catch(() => setListe([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tikla(b) {
    onClose();
    // Sadece ilgili listeye değil, doğrudan o kayda (kaydırılmış+vurgulanmış
    // ya da açılmış) gidiyor — önceden genel listeye düşüp tekrar aramak
    // gerekiyordu.
    if (b.ilgili_tip === "debt") navigate(`/debts?tab=alacak&highlight=${b.ilgili_id}`);
    else if (b.ilgili_tip === "repair") navigate(`/repairs/${b.ilgili_id}`);
    else if (b.tur === "randevu_talebi") navigate(`/randevu-talepleri?highlight=${b.ilgili_id}`);
    else if (b.tur === "takas_teklifi") navigate(`/vitrin-takas?highlight=${b.ilgili_id}`);
    else if (b.tur === "musteri_mesaji") navigate(`/musteri-mesajlari?customer_id=${b.ilgili_id}`);
  }

  return (
    <AltPencere onClose={onClose}>
      <PencereBaslik onClose={onClose}>Bildirimler</PencereBaslik>
      {liste === null ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Bildirim yok</div>
      ) : liste.map((b, i) => {
        const meta = BILDIRIM_TUR_META[b.tur] || { icon: Bell, color: "var(--hint)" };
        const Ikon = meta.icon;
        return (
          <div key={b.id} onClick={() => tikla(b)}
            style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none", cursor: "pointer" }}>
            <Ikon size={16} stroke={meta.color} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{b.baslik}</div>
              {b.mesaj && <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 2 }}>{b.mesaj}</div>}
              <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 3 }}>{bildirimZamanFmt(b.created_at)}</div>
            </div>
          </div>
        );
      })}
    </AltPencere>
  );
}

/* ── Sayfa ───────────────────────────────────────────────────────────────── */

export default function Dashboard({ user, bildirimSayisi = 0, onBildirimOkundu }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bildirimAcik, setBildirimAcik] = useState(false);
  const [priceHidden, setPriceHidden] = useState(() => localStorage.getItem("priceHidden") === "1");
  const [acikDurum, setAcikDurum] = useState(null);
  const [acikKasaTip, setAcikKasaTip] = useState(null);
  const [kazancAcik, setKazancAcik] = useState(false);
  const [acikBolum, setAcikBolum] = useState(acikBolumleriOku);
  const [secilenBorc, setSecilenBorc] = useState(null);
  const [secilenGaranti, setSecilenGaranti] = useState(null);
  const [secilenArama, setSecilenArama] = useState(null);
  const [aktifTamirAcik, setAktifTamirAcik] = useState(false);
  const [acikBorcAcik, setAcikBorcAcik] = useState(false);
  const [stokAcik, setStokAcik] = useState(false);
  const [hizliErisim, setHizliErisim] = useState(hizliErisimOku);
  const [hizliDuzenleAcik, setHizliDuzenleAcik] = useState(false);
  const navigate = useNavigate();

  // ── Basılı tut → titret → sürükleyip sırasını değiştir ────────────────
  const [blokSirasi, setBlokSirasiState] = useState(blokSirasiOku);
  const [titriyor, setTitriyor] = useState(false);
  const [suruklenenBlok, setSuruklenenBlok] = useState(null);
  const blokRefs = useRef({});
  const blokSirasiRef = useRef(blokSirasi);
  const titriyorRef = useRef(false);
  const basiliTimerRef = useRef(null);
  const basPozRef = useRef({ x: 0, y: 0 });
  const basiliAnahtarRef = useRef(null);
  const suruklemeBasladiRef = useRef(false);
  const justEnteredWiggleRef = useRef(false);

  function blokSirasiAyarla(yeni) {
    blokSirasiRef.current = yeni;
    setBlokSirasiState(yeni);
    localStorage.setItem(BLOK_ANAHTAR, JSON.stringify(yeni));
  }
  function titriyorAyarla(v) {
    titriyorRef.current = v;
    setTitriyor(v);
  }

  function blokBasBasla(e, key) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    basPozRef.current = { x: e.clientX, y: e.clientY };
    basiliAnahtarRef.current = key;
    suruklemeBasladiRef.current = false;
    clearTimeout(basiliTimerRef.current);
    if (!titriyorRef.current) {
      basiliTimerRef.current = setTimeout(() => {
        if (basiliAnahtarRef.current !== key) return;
        titriyorAyarla(true);
        suruklemeBasladiRef.current = true;
        setSuruklenenBlok(key);
        justEnteredWiggleRef.current = true;
        if (navigator.vibrate) navigator.vibrate(12);
      }, 480);
    }
  }

  useEffect(() => {
    // Sürükleme sırasında sayfa native kaydırmayı (touchAction:none) devre dışı
    // bırakıyor; ekran kenarına yaklaşınca aşağı/yukarı otomatik kaydırma bu
    // yüzden JS ile yapılıyor — yoksa listenin alt kısımlarına ulaşılamıyordu.
    const pointerYRef = { current: 0 };
    let kaydirmaFrame = null;

    function swapKontrolEt(key) {
      const sira = blokSirasiRef.current;
      const y = pointerYRef.current;
      for (const digerKey of sira) {
        if (digerKey === key) continue;
        const el = blokRefs.current[digerKey];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (y >= r.top && y <= r.bottom) {
          const i1 = sira.indexOf(key), i2 = sira.indexOf(digerKey);
          const yeni = [...sira];
          yeni.splice(i1, 1);
          yeni.splice(i2, 0, key);
          blokSirasiAyarla(yeni);
          break;
        }
      }
    }

    function kaydirmaAdimi() {
      if (!suruklemeBasladiRef.current) { kaydirmaFrame = null; return; }
      const y = pointerYRef.current;
      const h = window.innerHeight;
      const kenar = 90;
      let hiz = 0;
      if (y < kenar) hiz = -Math.ceil((kenar - y) / 3.5);
      else if (y > h - kenar) hiz = Math.ceil((kenar - (h - y)) / 3.5);
      if (hiz !== 0) {
        window.scrollBy(0, hiz);
        swapKontrolEt(basiliAnahtarRef.current);
      }
      kaydirmaFrame = requestAnimationFrame(kaydirmaAdimi);
    }

    function hareket(e) {
      const key = basiliAnahtarRef.current;
      if (!key) return;
      pointerYRef.current = e.clientY;
      const dx = e.clientX - basPozRef.current.x;
      const dy = e.clientY - basPozRef.current.y;
      if (!suruklemeBasladiRef.current) {
        if (Math.hypot(dx, dy) > 9) {
          if (titriyorRef.current) {
            // Titreme modundayken yeni bir basılı-tutma beklemeden hemen sürüklemeye geç
            suruklemeBasladiRef.current = true;
            setSuruklenenBlok(key);
            if (!kaydirmaFrame) kaydirmaFrame = requestAnimationFrame(kaydirmaAdimi);
          } else {
            // Titreme dışında hareket = sayfa kaydırma, basılı tutma sayacını iptal et
            clearTimeout(basiliTimerRef.current);
            basiliAnahtarRef.current = null;
          }
        }
        return;
      }
      swapKontrolEt(key);
    }
    function birak() {
      clearTimeout(basiliTimerRef.current);
      const surukluyorduMu = suruklemeBasladiRef.current;
      const girisMiydi = justEnteredWiggleRef.current;
      justEnteredWiggleRef.current = false;
      if (titriyorRef.current && !surukluyorduMu && !girisMiydi) {
        // Titreme modundayken hareket etmeden düz bir tıklama yapıldı — moddan çık
        titriyorAyarla(false);
      }
      setSuruklenenBlok(null);
      basiliAnahtarRef.current = null;
      suruklemeBasladiRef.current = false;
    }
    window.addEventListener("pointermove", hareket);
    window.addEventListener("pointerup", birak);
    window.addEventListener("pointercancel", birak);
    return () => {
      window.removeEventListener("pointermove", hareket);
      window.removeEventListener("pointerup", birak);
      window.removeEventListener("pointercancel", birak);
      if (kaydirmaFrame) cancelAnimationFrame(kaydirmaFrame);
    };
  }, []);

  function bolumToggle(k) {
    setAcikBolum(b => {
      const yeni = { ...b, [k]: !b[k] };
      localStorage.setItem(ACIK_ANAHTAR, JSON.stringify(yeni));
      return yeni;
    });
  }

  function hizliKaydet(secim) {
    setHizliErisim(secim);
    localStorage.setItem(HIZLI_ANAHTAR, JSON.stringify(secim));
    setHizliDuzenleAcik(false);
  }

  function togglePriceHide() {
    const next = !priceHidden;
    setPriceHidden(next);
    localStorage.setItem("priceHidden", next ? "1" : "0");
  }

  function fmtH(n) { return priceHidden ? "••••" : fmt(n); }
  function numH(n) { return priceHidden ? "••••" : tl(n); }

  function yukle() {
    return api.dashboard().then(setData).finally(() => setLoading(false));
  }

  useEffect(() => { yukle(); }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
      <Wrench size={36} stroke="var(--hint)" strokeWidth={1.6} />
      <div style={{ color: "var(--hint)", fontSize: 14 }}>Yükleniyor...</div>
    </div>
  );

  const bugun = data?.bugun || {};
  const bu_ay = data?.bu_ay || {};
  const bekleyen = data?.bekleyen || {};
  const durumlar = data?.tamir_durumlar || {};
  const uyarilar = data?.uyarilar || {};
  const aranacaklar = data?.aranacaklar || [];
  const kasa = data?.kasa_bugun || {};
  const stokListe = uyarilar.stok || [];

  const isim = user?.ad?.split(" ")[0] || "";
  const saat = new Date().getHours();
  const selam = saat < 12 ? "Günaydın" : saat < 18 ? "Merhaba" : "İyi akşamlar";

  const gosterilenModuller = hizliErisim
    .map(p => TUM_MODULLER.find(m => m.path === p))
    .filter(Boolean)
    .filter(m => user?.rol === "patron" || !m.patronOnly);

  // Sürüklenip taşınabilen her blok — boş olan bölümler (ör. borç/garanti/
  // aranacak listesi boşsa) null döner ve hiç render edilmez, böylece boş bir
  // titreşen kutu görünmez.
  function blokIcerigi(key) {
    switch (key) {
      case "durum":
        return (
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {["bekliyor", "tamirde", "parca_bekleniyor", "hazir"].map(k => (
              <div key={k} className="stat-card raised" onClick={() => !titriyor && setAcikDurum(k)}
                style={{ textAlign: "center", cursor: "pointer", padding: "12px 6px 10px" }}>
                <div className="stat-value" style={{ fontSize: 20, color: DURUM_RENK[k] }}>
                  {durumlar[k] || 0}
                </div>
                <div className="stat-label" style={{ marginTop: 4 }}>{DURUM_LABEL[k]}</div>
                <div style={{ height: 2.5, borderRadius: 2, marginTop: 8, background: DURUM_RENK[k], opacity: 0.7 }} />
              </div>
            ))}
          </div>
        );

      case "kasa":
        if (user?.rol !== "patron") return null;
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div className="card" style={{ margin: 0, cursor: "pointer" }} onClick={() => !titriyor && setAcikKasaTip("gelir")}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Wallet size={13} stroke="var(--hint)" strokeWidth={2} />
                <span style={{ fontSize: 11, color: "var(--hint)" }}>Bugün Gelir</span>
              </div>
              <div style={{ fontWeight: 300, fontSize: 20, color: "var(--green)", letterSpacing: -0.5 }}>{fmtH(kasa.gelir)}₺</div>
            </div>
            <div className="card" style={{ margin: 0, cursor: "pointer" }} onClick={() => !titriyor && setAcikKasaTip("gider")}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <TrendingDown size={13} stroke="var(--hint)" strokeWidth={2} />
                <span style={{ fontSize: 11, color: "var(--hint)" }}>Bugün Gider</span>
              </div>
              <div style={{ fontWeight: 300, fontSize: 20, color: "var(--red)", letterSpacing: -0.5 }}>{fmtH(kasa.gider)}₺</div>
            </div>
          </div>
        );

      case "kazanc":
        if (user?.rol !== "patron") return null;
        return (
          <div className="card" style={{ cursor: "pointer" }} onClick={() => !titriyor && setKazancAcik(true)}>
            <div className="card-row">
              <div>
                <div style={{ fontWeight: 300, fontSize: 22, color: "var(--orange)", letterSpacing: -0.5 }}>
                  {numH(bu_ay.gelir)}₺
                </div>
                <div style={{ fontSize: 11.5, color: "var(--hint)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                  Bu ay kazanç <TrendingUp size={11} strokeWidth={2} />
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: "var(--text)" }}>{bu_ay.tamir || 0} tamir</div>
                <div style={{ fontSize: 11.5, color: "var(--hint)", marginTop: 2 }}>{bugun.tamir_sayisi || 0} bugün açıldı</div>
              </div>
            </div>
          </div>
        );

      case "borc":
        if ((uyarilar.borc || []).length === 0) return null;
        return (
          <KatlanirBolum baslik="Gecikmiş Borçlar" ikon={CreditCard} renk="var(--red)"
            sayi={(uyarilar.borc || []).length} acik={acikBolum.borc} onToggle={() => !titriyor && bolumToggle("borc")}>
            {(uyarilar.borc || []).map((u, i) => (
              <div key={u.id} onClick={() => !titriyor && setSecilenBorc(u)}
                style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{u.musteri_adi}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--red)" }}>{numH(u.kalan)}₺</span>
              </div>
            ))}
          </KatlanirBolum>
        );

      case "garanti":
        if ((uyarilar.garanti || []).length === 0) return null;
        return (
          <KatlanirBolum baslik="Garanti Bitiyor" ikon={ShieldCheck} renk="var(--blue)"
            sayi={(uyarilar.garanti || []).length} acik={acikBolum.garanti} onToggle={() => !titriyor && bolumToggle("garanti")}>
            {(uyarilar.garanti || []).map((u, i) => (
              <div key={u.id} onClick={() => !titriyor && setSecilenGaranti(u)}
                style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{u.musteri_adi} · {u.cihaz}</span>
                <span style={{ fontSize: 11.5, color: "var(--blue)", flexShrink: 0 }}>{u.bitis_tarihi}</span>
              </div>
            ))}
          </KatlanirBolum>
        );

      case "arama":
        if (aranacaklar.length === 0) return null;
        return (
          <KatlanirBolum baslik="Aranacaklar" ikon={Phone} renk="var(--green)"
            sayi={aranacaklar.length} acik={acikBolum.arama} onToggle={() => !titriyor && bolumToggle("arama")}>
            {aranacaklar.map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                <div style={{ flex: 1, fontSize: 12.5, cursor: "pointer", color: "var(--text)" }} onClick={() => !titriyor && setSecilenArama(a)}>
                  <span style={{ fontWeight: 600 }}>{a.musteri_adi || "—"}</span> — {a.device_model}
                </div>
                {a.telefon && (
                  <a href={`tel:${a.telefon}`} onClick={e => e.stopPropagation()}
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--surf-hi), var(--surf-lo))",
                      boxShadow: "var(--edge-lit), var(--edge-dark)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      textDecoration: "none", flexShrink: 0,
                    }}>
                    <Phone size={13} stroke="var(--green)" strokeWidth={2} />
                  </a>
                )}
              </div>
            ))}
          </KatlanirBolum>
        );

      case "hizli":
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="section-title" style={{ margin: 0 }}>Hızlı Erişim</div>
              <button onClick={() => !titriyor && setHizliDuzenleAcik(true)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, padding: "4px 6px" }}>
                <SlidersHorizontal size={12} strokeWidth={2} /> Düzenle
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {gosterilenModuller.map(q => {
                const Icon = q.icon;
                return (
                  <div key={q.path} onClick={() => !titriyor && navigate(q.path)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer" }}>
                    <div style={{ position: "relative", width: 52, height: 52 }}>
                      <div style={{
                        position: "absolute", inset: 0, borderRadius: 14,
                        background: q.color, filter: "blur(13px)", opacity: 0.32,
                        transform: "translateY(5px) scale(1.06)",
                      }} />
                      <div style={{
                        position: "relative", width: 52, height: 52, borderRadius: 14,
                        background: "linear-gradient(135deg, var(--surf-hi), var(--surf-lo))",
                        boxShadow: "var(--edge-lit), var(--edge-dark), var(--lift)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={21} stroke={q.color} strokeWidth={1.8} />
                      </div>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--title)", textAlign: "center", lineHeight: 1.2 }}>
                      {q.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "bekleyenler":
        return (
          <div>
            <div className="section-title">Bekleyenler</div>
            <div className="card">
              <div className="card-row" style={{ padding: "10px 0", cursor: "pointer" }} onClick={() => !titriyor && setAktifTamirAcik(true)}>
                <span style={{ fontSize: 13.5, color: "var(--text)" }}>Aktif Tamir</span>
                <span style={{ fontWeight: 700, color: bekleyen.tamir > 0 ? "var(--orange)" : "var(--dim)" }}>{bekleyen.tamir || 0}</span>
              </div>
              <div className="divider" />
              <div className="card-row" style={{ padding: "10px 0", cursor: "pointer" }} onClick={() => !titriyor && setAcikBorcAcik(true)}>
                <span style={{ fontSize: 13.5, color: "var(--text)" }}>Açık Borç</span>
                <span style={{ fontWeight: 700, color: bekleyen.borc > 0 ? "var(--orange)" : "var(--dim)" }}>{bekleyen.borc || 0}</span>
              </div>
            </div>
          </div>
        );

      case "stok":
        if (stokListe.length === 0) return null;
        return (
          <div className="card" onClick={() => !titriyor && setStokAcik(true)} style={{ cursor: "pointer" }}>
            <div className="card-row">
              <span style={{ color: "var(--orange)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                <TriangleAlert size={15} strokeWidth={2} /> Azalan Stok
              </span>
              <span style={{ fontWeight: 700, color: "var(--orange)", fontSize: 13 }}>{stokListe.length} ürün →</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="page" style={{ paddingBottom: 90 }}>

      {/* Arama barı */}
      <div className="search-bar" onClick={() => navigate("/search")} style={{ cursor: "pointer" }}>
        <div className="inset search-input" style={{ borderRadius: 13, display: "flex", alignItems: "center", gap: 10 }}>
          <Search size={17} stroke="var(--hint)" strokeWidth={2} />
          <span style={{ color: "var(--dim)", fontSize: 14, flex: 1 }}>
            Müşteri, tamir no, model, IMEI ara...
          </span>
        </div>
      </div>

      {/* Selam + isim + fiyat gizle */}
      <div style={{ margin: "16px 0 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12.5, color: "var(--hint)" }}>{selam}{isim ? `, ${isim}` : ""}</div>
          <div style={{ fontSize: 21, fontWeight: 700, color: "var(--text-strong)" }}>Bugün</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button onClick={() => !titriyor && setBildirimAcik(true)}
            style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: "var(--hint)", padding: 6, display: "flex" }}
            title="Bildirimler">
            <Bell size={19} strokeWidth={1.8} />
            {bildirimSayisi > 0 && (
              <span style={{
                position: "absolute", top: 2, right: 2, minWidth: 15, height: 15, padding: "0 3px",
                borderRadius: 8, background: "var(--danger)", color: "#fff",
                fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {bildirimSayisi > 99 ? "99+" : bildirimSayisi}
              </span>
            )}
          </button>
          <button onClick={togglePriceHide}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", padding: 6, display: "flex" }}
            title={priceHidden ? "Fiyatları göster" : "Fiyatları gizle"}>
            {priceHidden ? <EyeOff size={19} strokeWidth={1.8} /> : <Eye size={19} strokeWidth={1.8} />}
          </button>
        </div>
      </div>

      {titriyor && (
        <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--hint)", margin: "0 0 10px", padding: "6px 10px", background: "var(--bg2)", borderRadius: 8 }}>
          Sırasını değiştirmek için tutup sürükleyin — bitirince başka bir yere dokunun
        </div>
      )}

      {blokSirasi.map((key, i) => {
        const icerik = blokIcerigi(key);
        if (icerik === null) return null;
        const suruklenen = suruklenenBlok === key;
        return (
          // Dış sarmal SABİT kalır (transform yok) — dokunma/basılı-tutma
          // izlemesi bu elemanda yapılıyor. Titreşim animasyonu içteki div'e
          // uygulanıyor, böylece dokunulan eleman sürekli transform almıyor.
          <div key={key}
            ref={el => (blokRefs.current[key] = el)}
            onPointerDown={e => blokBasBasla(e, key)}
            className="dash-blok-sarmal"
            style={{
              marginBottom: 14,
              touchAction: titriyor ? "none" : "auto",
              position: "relative",
            }}>
            <div
              className={suruklenen ? "dash-blok-suruklenen" : titriyor ? "dash-blok-titriyor" : ""}
              style={{ animationDelay: titriyor && !suruklenen ? (i % 2 === 0 ? "0s" : "-0.15s") : undefined }}>
              <div style={{ pointerEvents: titriyor ? "none" : "auto" }}>
                {icerik}
              </div>
            </div>
          </div>
        );
      })}

      <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={() => navigate("/repairs/new")}>
        <Plus size={16} strokeWidth={2.4} /> Yeni Tamir Kaydı
      </button>

      {acikDurum && <DurumOnizlemeModal durum={acikDurum} onClose={() => setAcikDurum(null)} />}
      {acikKasaTip && <KasaHareketModal tip={acikKasaTip} onClose={() => setAcikKasaTip(null)} />}
      {kazancAcik && <BuAyKazancModal kaynaklar={bu_ay.kaynaklar || []} toplam={bu_ay.gelir || 0} onClose={() => setKazancAcik(false)} />}
      {stokAcik && <StokDetayModal liste={stokListe} onClose={() => setStokAcik(false)} />}
      {aktifTamirAcik && <AktifTamirModal onClose={() => setAktifTamirAcik(false)} />}
      {acikBorcAcik && (
        <AcikBorcModal onClose={() => setAcikBorcAcik(false)}
          onBorcSec={d => { setAcikBorcAcik(false); setSecilenBorc(d); }} />
      )}
      {secilenBorc && (
        <BorcDetayModal borc={secilenBorc} onClose={() => setSecilenBorc(null)}
          onDegisti={() => { yukle(); }} />
      )}
      {secilenGaranti && <GarantiDetayModal garanti={secilenGaranti} onClose={() => setSecilenGaranti(null)} />}
      {secilenArama && <AranacakDetayModal kayit={secilenArama} onClose={() => setSecilenArama(null)} />}
      {hizliDuzenleAcik && (
        <HizliDuzenleModal secili={hizliErisim} onClose={() => setHizliDuzenleAcik(false)} onKaydet={hizliKaydet} />
      )}
      {bildirimAcik && (
        <BildirimPanelModal onClose={() => setBildirimAcik(false)}
          onOkundu={() => onBildirimOkundu && onBildirimOkundu()} />
      )}
    </div>
  );
}
