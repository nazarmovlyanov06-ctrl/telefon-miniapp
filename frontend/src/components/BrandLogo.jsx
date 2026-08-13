import { useState } from "react";
import { BRAND_SLUGS, BRAND_LOGO_FILES } from "../brands.js";

function brandLogoUrl(marka, renk) {
  const key = (marka || "").trim().toLowerCase();
  const slug = BRAND_SLUGS[key];
  if (slug) return `https://cdn.simpleicons.org/${slug}/${renk}`;
  const yerelDosya = BRAND_LOGO_FILES[key];
  if (yerelDosya) return yerelDosya;
  return null;
}

// Simple Icons'ta karşılığı olmayan markalar için — marka adının baş harflerinden
// üretilen, markaya özgü sabit renkte rozet. Her marka görsel olarak ayırt edilebilir.
const ROZET_RENKLERI = [
  "#ef4444", "#f59e0b", "#22c55e", "#06b6d4", "#6366f1", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#3b82f6", "#a855f7",
];
function rozetRengi(marka) {
  let h = 0;
  for (let i = 0; i < marka.length; i++) h = (h * 31 + marka.charCodeAt(i)) >>> 0;
  return ROZET_RENKLERI[h % ROZET_RENKLERI.length];
}
function markaBasHarfleri(marka) {
  return marka.split(" ").map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function BrandLogo({ marka, size = 28, renk = "e6edf3" }) {
  const url = brandLogoUrl(marka, renk);
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    const m = marka || "?";
    return (
      <span style={{
        width: size, height: size, borderRadius: "50%", background: rozetRengi(m),
        display: "grid", placeItems: "center", color: "#fff", fontWeight: 800,
        fontSize: size * 0.38, flexShrink: 0,
      }}>
        {markaBasHarfleri(m)}
      </span>
    );
  }
  return (
    <img src={url} alt={marka} width={size} height={size}
      style={{ objectFit: "contain", flexShrink: 0 }}
      onError={() => setFailed(true)} />
  );
}
