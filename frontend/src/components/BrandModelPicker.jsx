import { useState, useMemo } from "react";
import { MARKALAR } from "../brands.js";
import { MODEL_KUTUPHANESI } from "../modelKutuphanesi.js";
import BrandLogo from "./BrandLogo.jsx";

// Marka seçimi (logolu chip grid) + o markaya ait doğrulanmış model kütüphanesinden
// öneri çıkaran serbest metin model alanı. Kütüphanede olmayan markalarda/modellerde
// serbest metin girişi hep açık kalır — kütüphane zorunluluk değil, öneri kaynağıdır.
export default function BrandModelPicker({ brand, model, onBrand, onModel, modelPlaceholder }) {
  const [modelFocus, setModelFocus] = useState(false);

  const brandKey = (brand || "").trim().toLowerCase();
  const modeller = MODEL_KUTUPHANESI[brandKey] || [];

  const oneriler = useMemo(() => {
    const q = (model || "").trim().toLowerCase();
    if (q.length < 1) return modeller.slice(0, 8);
    return modeller.filter(m => m.arama.includes(q)).slice(0, 8);
  }, [modeller, model]);

  return (
    <div>
      <div className="form-group" style={{ margin: "0 0 8px" }}>
        <label className="form-label">Marka</label>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
          {MARKALAR.map(m => (
            <button key={m} type="button"
              onClick={() => onBrand(brand === m ? "" : m)}
              style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px 5px 6px", borderRadius: 20, border: "2px solid",
                borderColor: brand === m ? "var(--accent)" : "var(--border)",
                background: brand === m ? "var(--accent)" : "transparent",
                color: brand === m ? "#fff" : "var(--text)",
                fontWeight: 600, fontSize: 12, cursor: "pointer",
              }}>
              <BrandLogo marka={m} size={18} />
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group" style={{ margin: 0, position: "relative" }}>
        <label className="form-label">Model</label>
        <input className="form-input" value={model || ""}
          onChange={e => onModel(e.target.value)}
          onFocus={() => setModelFocus(true)}
          onBlur={() => setTimeout(() => setModelFocus(false), 150)}
          placeholder={modelPlaceholder || (brand ? `${brand} sonrası model...` : "13 Pro Max, A54...")}
          autoComplete="off" />
        {modelFocus && oneriler.length > 0 && (
          <div className="ac-dropdown" style={{ zIndex: 60, maxHeight: 220, overflowY: "auto" }}>
            {oneriler.map((m, i) => (
              <div key={i} onMouseDown={() => onModel(m.deger)}
                style={{ padding: "9px 13px", cursor: "pointer", fontSize: 13,
                  borderBottom: i < oneriler.length - 1 ? "1px solid var(--border)" : "none" }}>
                {m.etiket}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
