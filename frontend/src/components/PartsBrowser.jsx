import { useMemo, useState } from "react";
import {
  Smartphone, BatteryCharging, Camera, Box, Volume2, Zap, Settings, Radio, Package,
  ChevronRight,
} from "lucide-react";
import BrandLogo from "./BrandLogo";

const DIGER = "Diğer";

function normKey(v) {
  return (v || DIGER).trim().toLowerCase();
}

function grupla(products, keyFn) {
  const map = new Map();
  for (const p of products) {
    const raw = keyFn(p);
    const key = normKey(raw);
    const label = (raw || DIGER).trim() || DIGER;
    const mevcut = map.get(key);
    if (mevcut) mevcut.count += 1;
    else map.set(key, { label, count: 1 });
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count);
}

function parcaTipiIkon(tip) {
  const t = (tip || "").toLowerCase();
  if (t.includes("ekran") || t.includes("cam")) return Smartphone;
  if (t.includes("batarya") || t.includes("pil") || t.includes("şarj")) return BatteryCharging;
  if (t.includes("kamera")) return Camera;
  if (t.includes("kasa") || t.includes("kapak") || t.includes("vida") || t.includes("çıta")) return Box;
  if (t.includes("hoparlör") || t.includes("ses") || t.includes("mikrofon") || t.includes("ahize") || t.includes("kulaklık")) return Volume2;
  if (t.includes("flex")) return Zap;
  if (t.includes("tuş") || t.includes("motor") || t.includes("sensör")) return Settings;
  if (t.includes("anten") || t.includes("entegre") || t.includes("şebeke")) return Radio;
  return Package;
}

function Kart({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="brand-card">
      {children}
    </button>
  );
}

/**
 * Stok listesini Marka → Model → Parça Tipi katmanlı gezdirir (VarmiStok'un
 * BrandBrowser deseni). `parts`: {device_model, part_type, ...} listesi.
 * `renderLeaf(filteredParts)`: son katmanda (parça tipi seçilince) render edilecek.
 */
export default function PartsBrowser({ parts, renderLeaf }) {
  const [marka, setMarka] = useState(null);
  const [model, setModel] = useState(null);
  const [parcaTipi, setParcaTipi] = useState(null);

  const markalar = useMemo(() => grupla(parts, p => (p.device_model || "").split(" ")[0]), [parts]);

  const modeller = useMemo(() => {
    if (!marka) return [];
    return grupla(
      parts.filter(p => normKey((p.device_model || "").split(" ")[0]) === marka.key),
      p => (p.device_model || "").split(" ").slice(1).join(" ") || p.device_model
    );
  }, [parts, marka]);

  const parcaTipleri = useMemo(() => {
    if (!marka || !model) return [];
    return grupla(
      parts.filter(p => {
        const pm = (p.device_model || "").split(" ")[0];
        const md = (p.device_model || "").split(" ").slice(1).join(" ") || p.device_model;
        return normKey(pm) === marka.key && normKey(md) === model.key;
      }),
      p => p.part_type
    );
  }, [parts, marka, model]);

  const leafParts = useMemo(() => {
    if (!marka || !model || !parcaTipi) return [];
    return parts.filter(p => {
      const pm = (p.device_model || "").split(" ")[0];
      const md = (p.device_model || "").split(" ").slice(1).join(" ") || p.device_model;
      return normKey(pm) === marka.key && normKey(md) === model.key && normKey(p.part_type) === parcaTipi.key;
    });
  }, [parts, marka, model, parcaTipi]);

  if (parts.length === 0) {
    return <div className="empty"><div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><Package size={40} stroke="var(--dim)" strokeWidth={1.5} /></div>Stokta parça yok</div>;
  }

  const crumbs = [{ label: "Markalar", onClick: () => { setMarka(null); setModel(null); setParcaTipi(null); } }];
  if (marka) crumbs.push({ label: marka.label, onClick: () => { setModel(null); setParcaTipi(null); } });
  if (marka && model) crumbs.push({ label: model.label, onClick: () => setParcaTipi(null) });
  if (marka && model && parcaTipi) crumbs.push({ label: parcaTipi.label, onClick: null });

  return (
    <div>
      {crumbs.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14, flexWrap: "wrap", fontSize: 13 }}>
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {i > 0 && <ChevronRight size={13} stroke="var(--dim)" strokeWidth={2} />}
              {c.onClick ? (
                <button type="button" onClick={c.onClick} className="btn btn-ghost btn-sm" style={{ padding: "4px 10px" }}>{c.label}</button>
              ) : (
                <span style={{ fontWeight: 700, padding: "4px 6px" }}>{c.label}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {!marka && (
        <div className="brand-grid">
          {markalar.map(m => (
            <Kart key={m.key} onClick={() => setMarka(m)}>
              <span className="brand-card-logo"><BrandLogo marka={m.label} size={34} /></span>
              <span className="brand-card-name">{m.label}</span>
              <span className="brand-card-count">{m.count} parça</span>
            </Kart>
          ))}
        </div>
      )}

      {marka && !model && (
        <div className="brand-grid">
          {modeller.map(m => (
            <Kart key={m.key} onClick={() => setModel(m)}>
              <span className="brand-card-logo"><BrandLogo marka={marka.label} size={28} /></span>
              <span className="brand-card-name">{m.label}</span>
              <span className="brand-card-count">{m.count} parça</span>
            </Kart>
          ))}
        </div>
      )}

      {marka && model && !parcaTipi && (
        <div className="brand-grid">
          {parcaTipleri.map(t => {
            const Icon = parcaTipiIkon(t.label);
            return (
              <Kart key={t.key} onClick={() => setParcaTipi(t)}>
                <span className="brand-card-logo"><Icon size={26} stroke="var(--text)" strokeWidth={1.6} /></span>
                <span className="brand-card-name">{t.label}</span>
                <span className="brand-card-count">{t.count} parça</span>
              </Kart>
            );
          })}
        </div>
      )}

      {marka && model && parcaTipi && renderLeaf(leafParts)}
    </div>
  );
}
