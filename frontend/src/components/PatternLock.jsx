import { useRef, useState, useCallback } from "react";

const SIZE = 240;
const COLS = 3;
const CELL = SIZE / COLS;
const DOT_R = 10;
const HIT_R = 32;

function nodePos(i) {
  return {
    x: (i % COLS) * CELL + CELL / 2,
    y: Math.floor(i / COLS) * CELL + CELL / 2,
  };
}

// Desen string "0-4-8" formatında, nodelar 0-8
export default function PatternLock({ value, onChange, readonly = false }) {
  const path = value ? value.split("-").map(Number).filter(n => !isNaN(n)) : [];
  const [drawing, setDrawing] = useState(false);
  const [live, setLive] = useState([]);       // çizim sırasında geçici path
  const [cursor, setCursor] = useState(null); // parmak/fare pozisyonu
  const [done, setDone] = useState(false);    // çizim bitti mi
  const svgRef = useRef(null);

  const displayPath = drawing ? live : path;

  function svgCoords(e) {
    const el = svgRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  function hitNode(x, y) {
    for (let i = 0; i < 9; i++) {
      const p = nodePos(i);
      if (Math.hypot(p.x - x, p.y - y) <= HIT_R) return i;
    }
    return -1;
  }

  function onStart(e) {
    if (readonly) return;
    e.preventDefault();
    const { x, y } = svgCoords(e);
    const n = hitNode(x, y);
    if (n >= 0) {
      setLive([n]);
      setCursor({ x, y });
      setDrawing(true);
      setDone(false);
    }
  }

  function onMove(e) {
    if (!drawing) return;
    e.preventDefault();
    const { x, y } = svgCoords(e);
    setCursor({ x, y });
    const n = hitNode(x, y);
    if (n >= 0 && !live.includes(n)) {
      setLive(prev => [...prev, n]);
    }
  }

  function onEnd(e) {
    if (!drawing) return;
    e.preventDefault();
    setDrawing(false);
    setDone(true);
    setCursor(null);
    if (live.length >= 4) {
      onChange(live.join("-"));
    } else {
      setLive([]);
      onChange("");
    }
  }

  function reset() {
    setLive([]);
    setDone(false);
    onChange("");
  }

  // çizim çizgileri
  function renderLines(pts) {
    if (pts.length < 2) return null;
    const lines = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = nodePos(pts[i]);
      const b = nodePos(pts[i + 1]);
      lines.push(<line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />);
    }
    // parmaktan son node'a geçici çizgi
    if (drawing && cursor && pts.length > 0) {
      const last = nodePos(pts[pts.length - 1]);
      lines.push(<line key="cur" x1={last.x} y1={last.y} x2={cursor.x} y2={cursor.y} stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" opacity={0.5} />);
    }
    return lines;
  }

  const tooShort = done && live.length < 4;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", background: "var(--bg2)", border: tooShort ? "1.5px solid #ef4444" : displayPath.length >= 4 ? "1.5px solid var(--accent)" : "1.5px solid var(--border)", touchAction: "none", userSelect: "none" }}>
        <svg
          ref={svgRef}
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          onMouseDown={onStart}
          onMouseMove={onMove}
          onMouseUp={onEnd}
          onMouseLeave={onEnd}
          onTouchStart={onStart}
          onTouchMove={onMove}
          onTouchEnd={onEnd}
          style={{ display: "block", cursor: readonly ? "default" : "crosshair" }}
        >
          {/* Bağlantı çizgileri */}
          {renderLines(displayPath)}

          {/* Noktalar */}
          {Array.from({ length: 9 }, (_, i) => {
            const { x, y } = nodePos(i);
            const active = displayPath.includes(i);
            const order = displayPath.indexOf(i);
            return (
              <g key={i}>
                {/* Dış halka */}
                <circle cx={x} cy={y} r={DOT_R + 4} fill={active ? "rgba(var(--accent-rgb,99,102,241),0.15)" : "transparent"} />
                {/* Ana nokta */}
                <circle cx={x} cy={y} r={DOT_R} fill={active ? "var(--accent)" : "var(--border)"} />
                {/* İç beyaz nokta */}
                <circle cx={x} cy={y} r={DOT_R * 0.38} fill={active ? "#fff" : "var(--bg)"} opacity={active ? 0.9 : 0.5} />
                {/* Sıra numarası */}
                {active && !readonly && (
                  <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#fff" fontWeight="700" opacity={0.9}>
                    {order + 1}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {tooShort && (
        <div style={{ color: "#ef4444", fontSize: 13, textAlign: "center" }}>
          En az 4 nokta bağla
        </div>
      )}

      {!readonly && displayPath.length >= 4 && !drawing && (
        <div style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>
          ✓ {displayPath.length} noktalı desen kaydedildi
        </div>
      )}

      {!readonly && (
        <button type="button" onClick={reset}
          style={{ fontSize: 13, color: "var(--hint)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          Sıfırla
        </button>
      )}
    </div>
  );
}

// Küçük önizleme (RepairDetail için)
export function PatternPreview({ value, size = 72 }) {
  if (!value) return null;
  const path = value.split("-").map(Number).filter(n => !isNaN(n));
  const cell = size / 3;
  const r = size * 0.055;
  const pos = (i) => ({ x: (i % 3) * cell + cell / 2, y: Math.floor(i / 3) * cell + cell / 2 });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      {path.length >= 2 && path.map((n, i) => {
        if (i === 0) return null;
        const a = pos(path[i - 1]), b = pos(n);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--accent)" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />;
      })}
      {Array.from({ length: 9 }, (_, i) => {
        const { x, y } = pos(i);
        const active = path.includes(i);
        return <circle key={i} cx={x} cy={y} r={r} fill={active ? "var(--accent)" : "var(--border)"} />;
      })}
    </svg>
  );
}
