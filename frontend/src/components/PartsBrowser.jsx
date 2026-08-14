import { useMemo, useState } from "react";
import { ChevronRight, Package } from "lucide-react";
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

function Kart({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="brand-card">
      {children}
    </button>
  );
}

/**
 * Stok listesini Marka → Model katmanlı gezdirir (VarmiStok'un BrandBrowser
 * deseni, sadeleştirilmiş — parça tipi ayrı bir tıklama gerektirmiyor,
 * modele girince parçalar direkt listelenir, tür her satırda etiket olarak görünür).
 * `parts`: {device_model, part_type, ...} listesi.
 * `renderLeaf(filteredParts)`: model seçilince render edilecek.
 */
export default function PartsBrowser({ parts, renderLeaf }) {
  const [marka, setMarka] = useState(null);
  const [model, setModel] = useState(null);

  const markalar = useMemo(() => grupla(parts, p => (p.device_model || "").split(" ")[0]), [parts]);

  const modeller = useMemo(() => {
    if (!marka) return [];
    return grupla(
      parts.filter(p => normKey((p.device_model || "").split(" ")[0]) === marka.key),
      p => (p.device_model || "").split(" ").slice(1).join(" ") || p.device_model
    );
  }, [parts, marka]);

  const leafParts = useMemo(() => {
    if (!marka || !model) return [];
    return parts.filter(p => {
      const pm = (p.device_model || "").split(" ")[0];
      const md = (p.device_model || "").split(" ").slice(1).join(" ") || p.device_model;
      return normKey(pm) === marka.key && normKey(md) === model.key;
    });
  }, [parts, marka, model]);

  if (parts.length === 0) {
    return <div className="empty"><div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><Package size={40} stroke="var(--dim)" strokeWidth={1.5} /></div>Stokta parça yok</div>;
  }

  const crumbs = [{ label: "Markalar", onClick: () => { setMarka(null); setModel(null); } }];
  if (marka) crumbs.push({ label: marka.label, onClick: () => setModel(null) });
  if (marka && model) crumbs.push({ label: model.label, onClick: null });

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

      {marka && model && renderLeaf(leafParts)}
    </div>
  );
}
