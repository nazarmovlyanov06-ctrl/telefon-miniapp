import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  Search, Eye, EyeOff, Wallet, TrendingDown, Phone,
  Smartphone, Package, ShieldCheck, ClipboardList,
  Headphones, CreditCard, BarChart3, Sparkles,
  CircleAlert, TriangleAlert, Plus, Wrench, X, ArrowRight, TrendingUp,
} from "lucide-react";

// Dashboard'daki gecikmiş borç / garanti / aranacak satırlarını kalıcı gizlemek
// için — sunucuda "görüldü" alanı yok, bu yüzden tarayıcıda saklanıyor. Kayıt
// id'sine bağlı olduğundan aynı kayıt ileride tekrar uyarı üretse bile
// (ör. borç hâlâ ödenmemiş) kullanıcı bir kez gizlediğinde bir daha çıkmaz —
// listeden tamamen kaldırmak isterse ilgili sayfadan (Borçlar/Garanti) işlem yapar.
const GIZLI_ANAHTAR = "dashboard_gizli_uyarilar";
function gizlileriOku() {
  try { return JSON.parse(localStorage.getItem(GIZLI_ANAHTAR)) || {}; } catch { return {}; }
}

const QUICK = [
  { icon: Smartphone, label: "2. El", path: "/ikinciel", color: "var(--purple)" },
  { icon: Package, label: "Sıfır", path: "/sifir-cihaz", color: "var(--blue)" },
  { icon: ShieldCheck, label: "Garanti", path: "/garanti", color: "var(--green)" },
  { icon: ClipboardList, label: "Siparişler", path: "/parts?tab=orders", color: "var(--orange)" },
  { icon: Headphones, label: "Aksesuar", path: "/aksesuar", color: "var(--purple)" },
  { icon: CreditCard, label: "Borçlar", path: "/debts", color: "var(--red)" },
  { icon: BarChart3, label: "Rapor", path: "/stats", color: "var(--gold)" },
  { icon: Sparkles, label: "Yardımcı", path: "/ai", color: "var(--blue)" },
];

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

function DurumOnizlemeModal({ durum, onClose }) {
  const [liste, setListe] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.repairs({ status: durum }).then(r => setListe(r.slice(0, 8))).catch(() => setListe([]));
  }, [durum]);

  function tumunuGor() {
    navigate(`/repairs?status=${durum}`);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "20px 20px 0 0", maxHeight: "78vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: DURUM_RENK[durum] }} />
            <span style={{ fontWeight: 700, fontSize: 16 }}>{DURUM_LABEL[durum]}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex" }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <button className="btn btn-primary btn-sm" onClick={tumunuGor}
          style={{ width: "100%", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          Tümünü Gör <ArrowRight size={13} strokeWidth={2.4} />
        </button>

        {liste === null ? (
          <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Yükleniyor...</div>
        ) : liste.length === 0 ? (
          <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Bu durumda tamir yok</div>
        ) : (
          <>
            {liste.map(r => (
              <div key={r.id} className="list-item" onClick={() => navigate(`/repairs/${r.id}`)}
                style={{ cursor: "pointer" }}>
                <div style={{
                  width: 4, borderRadius: 4, alignSelf: "stretch", flexShrink: 0,
                  background: DURUM_RENK[durum], marginRight: 4,
                }} />
                <div className="list-item-body">
                  <div className="list-item-title">{r.customer_name || "—"} · {r.device_model}</div>
                  <div className="list-item-sub">#{r.repair_no} · {r.fault_desc || "—"}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function GizleButonu(props) {
  return (
    <button onClick={e => { e.stopPropagation(); props.onGizle(); }}
      title="Gizle"
      style={{
        background: "none", border: "none", cursor: "pointer", color: "var(--hint)",
        display: "flex", flexShrink: 0, padding: 4, position: "relative", zIndex: 1,
      }}>
      <X size={14} strokeWidth={2} />
    </button>
  );
}

function KasaHareketModal({ tip, onClose }) {
  const [hareketler, setHareketler] = useState(null);
  const baslik = tip === "gelir" ? "Bugün Gelir" : "Bugün Gider";
  const renk = tip === "gelir" ? "var(--green)" : "var(--red)";

  useEffect(() => {
    api.kasaBugun().then(r => {
      const gelirTur = new Set(["giris", "gelir"]);
      const filtreli = (r.hareketler || []).filter(h => gelirTur.has(h.tur) === (tip === "gelir"));
      setHareketler(filtreli);
    }).catch(() => setHareketler([]));
  }, [tip]);

  const toplam = (hareketler || []).reduce((s, h) => s + (h.tutar || 0), 0);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "20px 20px 0 0", maxHeight: "78vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{baslik}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex" }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div style={{ fontWeight: 300, fontSize: 26, color: renk, letterSpacing: -0.5, marginBottom: 14 }}>
          {toplam.toLocaleString("tr-TR")}₺
        </div>

        {hareketler === null ? (
          <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Yükleniyor...</div>
        ) : hareketler.length === 0 ? (
          <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
            Bugün {tip === "gelir" ? "gelir" : "gider"} kaydı yok
          </div>
        ) : (
          hareketler.map((h, i) => (
            <div key={h.id || i} className="card-row" style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{h.aciklama || "—"}</div>
                <div style={{ fontSize: 11.5, color: "var(--hint)", marginTop: 2 }}>{h.odeme_yontemi || "—"}</div>
              </div>
              <span style={{ fontWeight: 700, color: renk }}>{(h.tutar || 0).toLocaleString("tr-TR")}₺</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BuAyKazancModal({ kaynaklar, toplam, onClose }) {
  const navigate = useNavigate();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "20px 20px 0 0", maxHeight: "78vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Bu Ay Kazanç — Nereden?</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex" }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div style={{ fontWeight: 300, fontSize: 26, color: "var(--orange)", letterSpacing: -0.5, marginBottom: 14 }}>
          {toplam.toLocaleString("tr-TR")}₺
        </div>

        {kaynaklar.length === 0 ? (
          <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Bu ay henüz gelir yok</div>
        ) : (
          kaynaklar.map((k, i) => (
            <div key={k.kaynak} className="card-row" style={{ padding: "10px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
              <span style={{ fontSize: 13.5 }}>{k.label}</span>
              <span style={{ fontWeight: 700, color: "var(--orange)" }}>{k.tutar.toLocaleString("tr-TR")}₺</span>
            </div>
          ))
        )}

        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/stats")}
          style={{ width: "100%", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          Detaylı Rapor <ArrowRight size={13} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

export default function Dashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [priceHidden, setPriceHidden] = useState(() => localStorage.getItem("priceHidden") === "1");
  const [acikDurum, setAcikDurum] = useState(null);
  const [acikKasaTip, setAcikKasaTip] = useState(null);
  const [kazancAcik, setKazancAcik] = useState(false);
  const [gizliler, setGizliler] = useState(gizlileriOku);
  const navigate = useNavigate();

  function gizle(tip, id) {
    setGizliler(g => {
      const yeni = { ...g, [`${tip}_${id}`]: true };
      localStorage.setItem(GIZLI_ANAHTAR, JSON.stringify(yeni));
      return yeni;
    });
  }

  function togglePriceHide() {
    const next = !priceHidden;
    setPriceHidden(next);
    localStorage.setItem("priceHidden", next ? "1" : "0");
  }

  function fmtH(n) { return priceHidden ? "••••" : fmt(n); }
  function numH(n) { return priceHidden ? "••••" : (n || 0).toLocaleString("tr-TR"); }

  useEffect(() => {
    api.dashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
      <Wrench size={36} stroke="var(--hint)" strokeWidth={1.6} />
      <div style={{ color: "var(--hint)", fontSize: 14 }}>Yükleniyor...</div>
    </div>
  );

  const bugun = data?.bugun || {};
  const bu_ay = data?.bu_ay || {};
  const bekleyen = data?.bekleyen || {};
  const stok_uyari = data?.stok_uyari || 0;
  const durumlar = data?.tamir_durumlar || {};
  const uyarilar = data?.uyarilar || {};
  const aranacaklar = data?.aranacaklar || [];
  const kasa = data?.kasa_bugun || {};

  const isim = user?.ad?.split(" ")[0] || "";
  const saat = new Date().getHours();
  const selam = saat < 12 ? "Günaydın" : saat < 18 ? "Merhaba" : "İyi akşamlar";

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
        <button onClick={togglePriceHide}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", padding: 6, display: "flex" }}
          title={priceHidden ? "Fiyatları göster" : "Fiyatları gizle"}>
          {priceHidden ? <EyeOff size={19} strokeWidth={1.8} /> : <Eye size={19} strokeWidth={1.8} />}
        </button>
      </div>

      {/* Tamir durum sayıları */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {["bekliyor", "tamirde", "parca_bekleniyor", "hazir"].map(k => (
          <div key={k} className="stat-card raised" onClick={() => setAcikDurum(k)}
            style={{ textAlign: "center", cursor: "pointer", padding: "12px 6px 10px" }}>
            <div className="stat-value" style={{ fontSize: 20, color: DURUM_RENK[k] }}>
              {durumlar[k] || 0}
            </div>
            <div className="stat-label" style={{ marginTop: 4 }}>{DURUM_LABEL[k]}</div>
            <div style={{
              height: 2.5, borderRadius: 2, marginTop: 8,
              background: DURUM_RENK[k], opacity: 0.7,
            }} />
          </div>
        ))}
      </div>

      {/* Bugün kasa */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "12px 0 14px" }}>
        <div className="card" style={{ margin: 0, cursor: "pointer" }} onClick={() => setAcikKasaTip("gelir")}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Wallet size={13} stroke="var(--hint)" strokeWidth={2} />
            <span style={{ fontSize: 11, color: "var(--hint)" }}>Bugün Gelir</span>
          </div>
          <div style={{ fontWeight: 300, fontSize: 20, color: "var(--green)", letterSpacing: -0.5 }}>{fmtH(kasa.gelir)}₺</div>
        </div>
        <div className="card" style={{ margin: 0, cursor: "pointer" }} onClick={() => setAcikKasaTip("gider")}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <TrendingDown size={13} stroke="var(--hint)" strokeWidth={2} />
            <span style={{ fontSize: 11, color: "var(--hint)" }}>Bugün Gider</span>
          </div>
          <div style={{ fontWeight: 300, fontSize: 20, color: "var(--red)", letterSpacing: -0.5 }}>{fmtH(kasa.gider)}₺</div>
        </div>
      </div>

      {/* Bu ay */}
      <div className="card" style={{ cursor: "pointer" }} onClick={() => setKazancAcik(true)}>
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

      {/* Uyarılar */}
      {(() => {
        const borclar = (uyarilar.borc || []).filter(u => !gizliler[`borc_${u.id}`]);
        const garantiler = (uyarilar.garanti || []).filter(u => !gizliler[`garanti_${u.id}`]);
        if (borclar.length + garantiler.length === 0) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "14px 0" }}>
            {borclar.map(u => (
              <div key={"b" + u.id} className="card" onClick={() => navigate("/debts")}
                style={{ margin: 0, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                <CreditCard size={16} stroke="var(--red)" strokeWidth={2} style={{ flexShrink: 0, position: "relative", zIndex: 1 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--red)", position: "relative", zIndex: 1, flex: 1 }}>
                  {u.musteri_adi} — {numH(u.kalan)}₺ gecikmiş borç
                </span>
                <GizleButonu onGizle={() => gizle("borc", u.id)} />
              </div>
            ))}
            {garantiler.map(u => (
              <div key={"g" + u.id} className="card" onClick={() => navigate("/garanti")}
                style={{ margin: 0, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                <ShieldCheck size={16} stroke="var(--blue)" strokeWidth={2} style={{ flexShrink: 0, position: "relative", zIndex: 1 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--blue)", position: "relative", zIndex: 1, flex: 1 }}>
                  {u.musteri_adi} — {u.cihaz} garanti bitiyor ({u.bitis_tarihi})
                </span>
                <GizleButonu onGizle={() => gizle("garanti", u.id)} />
              </div>
            ))}
          </div>
        );
      })()}

      {/* Aranacaklar */}
      {(() => {
        const gorunur = aranacaklar.filter(a => !gizliler[`arama_${a.id}`]);
        if (gorunur.length === 0) return null;
        return (
          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12.5, color: "var(--green)", marginBottom: 10 }}>
              <Phone size={14} strokeWidth={2} /> Aranacaklar ({gorunur.length})
            </div>
            {gorunur.slice(0, 3).map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                <div style={{ flex: 1, fontSize: 13, cursor: "pointer", color: "var(--text)" }} onClick={() => navigate(`/repairs/${a.id}`)}>
                  <span style={{ fontWeight: 600 }}>{a.musteri_adi || "—"}</span> — {a.device_model}
                </div>
                {a.telefon && (
                  <a href={`tel:${a.telefon}`} onClick={e => e.stopPropagation()}
                    style={{
                      width: 30, height: 30, borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--surf-hi), var(--surf-lo))",
                      boxShadow: "var(--edge-lit), var(--edge-dark)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      textDecoration: "none", flexShrink: 0,
                    }}>
                    <Phone size={14} stroke="var(--green)" strokeWidth={2} />
                  </a>
                )}
                <GizleButonu onGizle={() => gizle("arama", a.id)} />
              </div>
            ))}
          </div>
        );
      })()}

      {/* Hızlı Erişim */}
      <div className="section-title">Hızlı Erişim</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        {QUICK.map(q => {
          const Icon = q.icon;
          return (
            <div key={q.path} onClick={() => navigate(q.path)}
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

      {/* Bekleyenler */}
      <div className="section-title">Bekleyenler</div>
      <div className="card">
        {[
          { label: "Aktif Tamir", value: bekleyen.tamir, path: "/repairs" },
          { label: "Açık Borç", value: bekleyen.borc, path: "/debts" },
        ].map((item, i) => (
          <div key={i}>
            <div className="card-row" style={{ padding: "10px 0", cursor: "pointer" }}
              onClick={() => navigate(item.path)}>
              <span style={{ fontSize: 13.5, color: "var(--text)" }}>{item.label}</span>
              <span style={{ fontWeight: 700, color: item.value > 0 ? "var(--orange)" : "var(--dim)" }}>
                {item.value || 0}
              </span>
            </div>
            {i < 1 && <div className="divider" />}
          </div>
        ))}
      </div>

      {stok_uyari > 0 && (
        <div className="card" onClick={() => navigate("/parts?low_stock=true")}
          style={{ marginTop: 14, cursor: "pointer" }}>
          <div className="card-row">
            <span style={{ color: "var(--orange)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <TriangleAlert size={15} strokeWidth={2} /> Azalan Stok
            </span>
            <span style={{ fontWeight: 700, color: "var(--orange)", fontSize: 13 }}>{stok_uyari} ürün →</span>
          </div>
        </div>
      )}

      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => navigate("/repairs/new")}>
        <Plus size={16} strokeWidth={2.4} /> Yeni Tamir Kaydı
      </button>

      {acikDurum && <DurumOnizlemeModal durum={acikDurum} onClose={() => setAcikDurum(null)} />}
      {acikKasaTip && <KasaHareketModal tip={acikKasaTip} onClose={() => setAcikKasaTip(null)} />}
      {kazancAcik && (
        <BuAyKazancModal kaynaklar={bu_ay.kaynaklar || []} toplam={bu_ay.gelir || 0} onClose={() => setKazancAcik(false)} />
      )}
    </div>
  );
}
