import { useState, useMemo } from "react";
import {
  Smartphone, BatteryCharging, Camera, Box, Volume2, Zap, Settings, Radio,
  FlaskConical, Flame, Cable, Hammer, ChevronDown, Search, Trash2,
} from "lucide-react";
import { PARCA_TIPI_GRUPLARI } from "../parcaTipleri.js";

const GRUP_IKON = {
  "Ekran ve Cam Grubu": Smartphone,
  "Güç ve Şarj Grubu": BatteryCharging,
  "Kamera Grubu": Camera,
  "Kasa ve Gövde Grubu": Box,
  "Ses Grubu": Volume2,
  "Flex ve Film Grubu": Zap,
  "Tuş ve Motor Grubu": Settings,
  "Entegre ve Şebeke Grubu": Radio,
  "Yapıştırıcı ve Kimyasal Grubu": FlaskConical,
  "Havya ve Isıtma Grubu": Flame,
  "Lehim ve Tel Grubu": Cable,
  "El Aletleri ve Sarf Malzemeleri": Hammer,
};

function grupIkon(grupAdi) {
  const temiz = (grupAdi || "").replace(/^\S+\s/, "").trim();
  return GRUP_IKON[temiz] || Box;
}

// Parça türü seçici — grup başlıklı chip listesi (EditableSelect deseni: kütüphaneden
// seç, yoksa "+ Yeni ekle" ile kendi türünü ekle). Özel eklenen türler `customTypes`
// üzerinden ebeveynde (localStorage) saklanır, burada sadece görüntülenir.
export default function PartTypePicker({ value, onChange, customTypes = [], onAddCustom, onRemoveCustom }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [yeni, setYeni] = useState("");

  const filteredGruplar = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return PARCA_TIPI_GRUPLARI;
    return PARCA_TIPI_GRUPLARI
      .map(g => ({ ...g, tipler: g.tipler.filter(t => t.toLowerCase().includes(query)) }))
      .filter(g => g.tipler.length > 0);
  }, [q]);

  function ekle() {
    const t = yeni.trim();
    if (!t) return;
    onAddCustom?.(t);
    onChange(t);
    setYeni("");
  }

  function secVeKapat(t) {
    onChange(t);
    setOpen(false);
    setQ("");
  }

  return (
    <div>
      <label className="form-label">Parça Türü</label>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px", borderRadius: 12, border: "1.5px solid var(--border)",
          background: "var(--bg2)", color: value ? "var(--text)" : "var(--hint)",
          fontSize: 14, fontWeight: value ? 600 : 400, cursor: "pointer", textAlign: "left",
        }}>
        {value || "— Seç —"}
        <ChevronDown size={15} strokeWidth={2} style={{ transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ marginTop: 8, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 10 }}>
          <div className="inset search-input" style={{ borderRadius: 10, display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "7px 11px" }}>
            <Search size={14} stroke="var(--hint)" strokeWidth={2} />
            <input style={{ background: "none", border: "none", outline: "none", color: "var(--text)", font: "inherit", fontSize: 13, flex: 1 }}
              placeholder="Tür ara..." value={q} onChange={e => setQ(e.target.value)} autoFocus />
          </div>

          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {filteredGruplar.map(g => {
              const Icon = grupIkon(g.grup);
              const baslik = g.grup.replace(/^\S+\s/, "");
              return (
                <div key={g.grup} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--hint)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 5 }}>
                    <Icon size={12} strokeWidth={2} /> {baslik}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {g.tipler.map(t => (
                      <button key={t} type="button" onClick={() => secVeKapat(t)}
                        style={{
                          padding: "5px 10px", borderRadius: 20, border: "none", cursor: "pointer",
                          background: value === t ? "var(--accent)" : "var(--bg2)",
                          color: value === t ? "#fff" : "var(--text)",
                          fontWeight: value === t ? 700 : 400, fontSize: 12,
                        }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {customTypes.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: "var(--hint)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 5 }}>
                  Özel Türler
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {customTypes.map(t => (
                    <span key={t} style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 20, overflow: "hidden" }}>
                      <button type="button" onClick={() => secVeKapat(t)}
                        style={{
                          padding: "5px 10px", border: "none", cursor: "pointer",
                          background: value === t ? "var(--accent)" : "var(--bg2)",
                          color: value === t ? "#fff" : "var(--text)",
                          fontWeight: value === t ? 700 : 400, fontSize: 12,
                        }}>
                        {t}
                      </button>
                      <button type="button" onClick={() => onRemoveCustom?.(t)} title="Sil"
                        style={{ background: "var(--bg2)", border: "none", cursor: "pointer", color: "var(--danger)", padding: "5px 8px", display: "flex" }}>
                        <Trash2 size={11} strokeWidth={2} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            <input className="form-input" style={{ flex: 1 }} value={yeni} onChange={e => setYeni(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), ekle())}
              placeholder="+ Yeni tür ekle..." />
            <button type="button" className="btn btn-primary btn-sm" onClick={ekle}>Ekle</button>
          </div>
        </div>
      )}
    </div>
  );
}
