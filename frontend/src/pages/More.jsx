import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api, setToken } from "../api";
import {
  LogOut, Megaphone, X,
  SlidersHorizontal, Check, GripVertical, Minus, Plus,
} from "lucide-react";
import { TUM_MODULLER } from "../moduleCatalog";
import {
  siraOku, siraYaz, altMenuAdediOku, altMenuAdediYaz,
  ALT_MENU_MIN, ALT_MENU_MAX,
} from "../altMenuAyarlari";
import useSurukleSirala from "../useSurukleSirala";

const ROLE_LABELS = {
  patron: "Patron", teknisyen: "Teknisyen",
  satis: "Satış", cirak: "Çırak", super_admin: "Süper Admin",
};

function ModulKarti({ mod, altMenude, kilitli, titriyor, suruklenen, gecikme, refCallback, onBasBasla, onClick, bildirimSayisi }) {
  const Icon = mod.icon;
  const sinif = suruklenen === mod.path ? "dash-blok-suruklenen" : titriyor ? "dash-blok-titriyor" : "";
  return (
    <div
      ref={refCallback}
      onPointerDown={kilitli ? undefined : (e) => onBasBasla(e, mod.path)}
      className={kilitli ? "" : "dash-blok-sarmal"}
      style={{ touchAction: kilitli ? "auto" : "none" }}
    >
      <div className={sinif} style={{ animationDelay: gecikme }}>
        <div onClick={onClick}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 7, cursor: "pointer", pointerEvents: (!kilitli && titriyor) ? "none" : "auto",
          }}>
          <div style={{ position: "relative", width: 50, height: 50 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: 14,
              background: mod.color, filter: "blur(12px)", opacity: 0.3,
              transform: "translateY(5px) scale(1.06)",
            }} />
            <div style={{
              position: "relative", width: 50, height: 50, borderRadius: 14,
              background: "linear-gradient(135deg, var(--surf-hi), var(--surf-lo))",
              boxShadow: altMenude
                ? "0 0 0 1.5px var(--gold), var(--edge-lit), var(--edge-dark), var(--lift)"
                : "var(--edge-lit), var(--edge-dark), var(--lift)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={20} stroke={mod.color} strokeWidth={1.8} />
              {mod.badge && bildirimSayisi > 0 && (
                <div style={{
                  position: "absolute", top: -4, right: -4,
                  background: "var(--red)", color: "#191b20",
                  borderRadius: "50%", width: 17, height: 17,
                  fontSize: 10, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 0 2px var(--bg)",
                }}>
                  {bildirimSayisi}
                </div>
              )}
            </div>
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--title)", textAlign: "center", lineHeight: 1.2 }}>
            {mod.label}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function More({ user }) {
  const navigate = useNavigate();
  const [bildirimSayisi, setBildirimSayisi] = useState(0);
  const [duyurular, setDuyurular] = useState([]);
  const [duzenleMod, setDuzenleMod] = useState(false);
  const [altMenuAdedi, setAltMenuAdediState] = useState(altMenuAdediOku);

  const { sira, setSira, titriyor, suruklenen, refs, basBasla, disariCik } =
    useSurukleSirala(siraOku(), (yeni) => siraYaz(yeni));

  useEffect(() => {
    api.geriBildirimBekleyen().then(r => setBildirimSayisi(r.bekleyen || 0)).catch(() => {});
    api.destekDuyurularim().then(setDuyurular).catch(() => {});
  }, [user]);

  function cikisYap() {
    if (!confirm("Çıkış yapmak istediğine emin misin?")) return;
    setToken(null);
    window.location.href = "/giris";
  }

  function duyuruGordum(id) {
    api.destekDuyuruGorundu(id).catch(() => {});
    setDuyurular(d => d.filter(x => x.id !== id));
  }

  function adediDegistir(delta) {
    const yeni = Math.min(Math.max(altMenuAdedi + delta, ALT_MENU_MIN), ALT_MENU_MAX);
    setAltMenuAdediState(yeni);
    altMenuAdediYaz(yeni);
  }

  function duzenlemeyiBitir() {
    disariCik();
    setDuzenleMod(false);
  }

  const patron = user?.rol === "patron";
  const modullerHaritasi = Object.fromEntries(
    TUM_MODULLER.filter(m => patron || !m.patronOnly).map(m => [m.path, m])
  );
  const gosterilecekSira = duzenleMod ? sira : sira.slice(altMenuAdedi);

  return (
    <div className="page" style={{ paddingBottom: 90 }}>
      {duyurular.map(d => (
        <div key={d.id} className="card" style={{ marginBottom: 10, background: "rgba(99,102,241,0.1)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Megaphone size={16} stroke="var(--accent)" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>{d.mesaj}</div>
            <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 3 }}>{new Date(d.created_at).toLocaleDateString("tr-TR")}</div>
          </div>
          <button onClick={() => duyuruGordum(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex", flexShrink: 0 }}>
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      ))}
      {user && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22, padding: "4px 0" }}>
          <div style={{
            width: 46, height: 46, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--surf-hi), var(--surf-lo))",
            boxShadow: "var(--edge-lit), var(--edge-dark), var(--lift)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--gold)", fontWeight: 800, fontSize: 17, flexShrink: 0,
          }}>
            {(user.ad || "?")[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-strong)" }}>{user.ad}</div>
            <span className={`badge badge-${user.rol}`} style={{ fontSize: 11, marginTop: 2, display: "inline-block" }}>
              {ROLE_LABELS[user.rol] || user.rol}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={cikisYap}
            style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--danger)", flexShrink: 0 }}>
            <LogOut size={14} strokeWidth={2} /> Çıkış
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>Modüller</div>
        {duzenleMod ? (
          <button onClick={duzenlemeyiBitir}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--green)", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, padding: "4px 6px" }}>
            <Check size={13} strokeWidth={2.4} /> Bitti
          </button>
        ) : (
          <button onClick={() => setDuzenleMod(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, padding: "4px 6px" }}>
            <SlidersHorizontal size={12} strokeWidth={2} /> Düzenle
          </button>
        )}
      </div>

      {duzenleMod && (
        <div style={{ fontSize: 11.5, color: "var(--hint)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <GripVertical size={13} strokeWidth={2} />
          Basılı tutup sürükleyin — çizginin üstüne taşırsanız alt menüye girer
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {gosterilecekSira.map((path, i) => {
          const mod = modullerHaritasi[path];
          if (!mod) return null;
          const cizgidenSonra = duzenleMod && i === altMenuAdedi;
          return [
              cizgidenSonra && (
                <div key={`${path}-cizgi`} style={{
                  gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10,
                  margin: "4px 0", padding: "6px 0", borderTop: "1.5px dashed var(--gold)",
                }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--gold)", whiteSpace: "nowrap" }}>
                    ↑ ALT MENÜDE ({altMenuAdedi})
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                    <button onClick={() => adediDegistir(-1)} disabled={altMenuAdedi <= ALT_MENU_MIN}
                      style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--divider)", background: "transparent", color: "var(--hint)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Minus size={11} strokeWidth={2.4} />
                    </button>
                    <button onClick={() => adediDegistir(1)} disabled={altMenuAdedi >= ALT_MENU_MAX}
                      style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--divider)", background: "transparent", color: "var(--hint)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plus size={11} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
              ),
              <ModulKarti
                key={path}
                mod={mod}
                altMenude={duzenleMod && i < altMenuAdedi}
                kilitli={!duzenleMod}
                titriyor={titriyor}
                suruklenen={suruklenen}
                gecikme={titriyor && suruklenen !== path ? (i % 2 === 0 ? "0s" : "-0.15s") : undefined}
                refCallback={el => { refs.current[path] = el; }}
                onBasBasla={basBasla}
                onClick={() => !titriyor && navigate(mod.path)}
                bildirimSayisi={bildirimSayisi}
              />,
            ];
        })}
      </div>
    </div>
  );
}
