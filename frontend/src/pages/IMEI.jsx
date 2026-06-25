import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

function openBTK(imei) {
  const url = "https://imei.btk.gov.tr/";
  if (window.Telegram?.WebApp?.openLink) {
    window.Telegram.WebApp.openLink(url);
  } else {
    window.open(url, "_blank");
  }
}

function copyText(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function tacBrand(tac) {
  const t = tac?.slice(0, 6) || "";
  const prefixes = {
    "352844": "Apple", "353284": "Apple", "353288": "Apple", "353523": "Apple",
    "013012": "Apple", "013017": "Apple", "353489": "Apple", "354403": "Apple",
    "356728": "Samsung", "357204": "Samsung", "359259": "Samsung", "354463": "Samsung",
    "357405": "Samsung", "352046": "Samsung", "355703": "Samsung",
    "864840": "Huawei", "869036": "Huawei", "863071": "Huawei",
    "358811": "Xiaomi", "865034": "Xiaomi", "868508": "Xiaomi",
    "353620": "Sony", "358430": "Sony",
    "352698": "LG", "359966": "LG",
    "357390": "Google", "352921": "Google",
    "353617": "Nokia", "355267": "Nokia",
    "862397": "OPPO", "869259": "OPPO",
    "866754": "vivo", "867867": "vivo",
    "868239": "Realme", "868329": "Realme",
    "352688": "Motorola", "014651": "Motorola",
    "355408": "OnePlus", "862019": "OnePlus",
  };
  for (const [prefix, brand] of Object.entries(prefixes)) {
    if (t.startsWith(prefix.slice(0, 4))) return brand;
  }
  return null;
}

function parseIMEI(imei) {
  if (!imei || imei.length !== 15) return null;
  return {
    tac: imei.slice(0, 8),
    raporlayici: imei.slice(0, 2),
    snr: imei.slice(8, 14),
    kontrol: imei.slice(14),
  };
}

export default function IMEI() {
  const [imei, setImei] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true && false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function query() {
    if (imei.length !== 15) { setError("IMEI 15 haneli olmalı"); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const r = await api.imei(imei);
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const parsed = parseIMEI(imei);
  const brand = parsed ? tacBrand(parsed.tac) : null;

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/more")}>← Geri</button>
        <div className="page-title" style={{ margin: 0 }}>📱 IMEI Sorgula</div>
      </div>

      <div className="card">
        <div className="form-group">
          <label className="form-label">IMEI Numarası (15 hane)</label>
          <input
            className="form-input"
            placeholder="Örn: 352099001761481"
            inputMode="numeric"
            value={imei}
            onChange={(e) => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
            style={{ fontSize: 18, letterSpacing: 2 }}
          />
        </div>
        {parsed && brand && (
          <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: 10 }}>
            📱 {brand} cihazı (TAC: {parsed.tac})
          </div>
        )}
        <button className="btn btn-primary" onClick={query} disabled={loading || imei.length !== 15}>
          {loading ? "Sorgulanıyor..." : "🔍 Sistemde Sorgula"}
        </button>
      </div>

      {/* BTK Resmi Sorgulama */}
      <div className="card" style={{ background: "#eff6ff", marginTop: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>🇹🇷 BTK Resmi Sorgulama</div>
        <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 10, lineHeight: 1.5 }}>
          Cihazın Türkiye'de <strong>kayıtlı mı</strong>, <strong>çalıntı mı</strong> veya <strong>yurt dışından mı</strong> geldiğini öğrenmek için BTK'nın resmi sitesini kullan.
        </div>
        {imei.length === 15 && (
          <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px 12px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "monospace", fontSize: 15, letterSpacing: 1 }}>{imei}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => copyText(imei)} style={{ padding: "4px 10px" }}>Kopyala</button>
          </div>
        )}
        <button
          className="btn btn-primary"
          style={{ background: "#1d4ed8" }}
          onClick={() => openBTK(imei)}
        >
          🌐 BTK'da Sorgula →
        </button>
        <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 8, textAlign: "center" }}>
          imei.btk.gov.tr — resmi kayıt/çalıntı sorgulama
        </div>
      </div>

      {/* BTK'da ne göreceksin */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>BTK'da Ne Görürsün?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div style={{ fontSize: 13 }}><strong>Kayıtlı</strong> — Cihaz Türkiye'de yasal yollarla satılmış, sorun yok</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18 }}>🌍</span>
            <div style={{ fontSize: 13 }}><strong>Yurt Dışından Getirilmiş</strong> — 120 gün kullanım hakkı var, kayıt yaptırılmamış</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18 }}>🚫</span>
            <div style={{ fontSize: 13 }}><strong>Çalıntı / Engelli</strong> — BTK tarafından engellenmiş, şebekeye giremez</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div style={{ fontSize: 13 }}><strong>Kayıtsız</strong> — Yurt dışından getirilmiş, kayıt yaptırılmamış</div>
          </div>
        </div>
      </div>

      {error && <div style={{ color: "var(--danger)", padding: "10px 0", fontWeight: 600 }}>{error}</div>}

      {result && (
        <>
          <div className="card" style={{ background: "#f0fdf4", marginTop: 8 }}>
            <div style={{ color: "#16a34a", fontWeight: 700, marginBottom: 6 }}>✅ Geçerli IMEI</div>
            <div style={{ fontSize: 13, color: "var(--hint)" }}>TAC: {result.tac} {brand ? `· ${brand}` : ""}</div>
          </div>

          {result.local_repairs?.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 14, margin: "12px 0 6px" }}>📋 Servis Geçmişimizde</div>
              {result.local_repairs.map((r, i) => (
                <div key={i} className="card">
                  <div style={{ fontWeight: 600 }}>#{r.repair_no} · {r.device_model}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 4 }}>
                    {r.customer_name} · {r.status} · {new Date(r.created_at).toLocaleDateString("tr-TR")}
                  </div>
                </div>
              ))}
            </>
          )}

          {result.local_repairs?.length === 0 && (
            <div className="card" style={{ color: "var(--hint)", textAlign: "center" }}>
              Bu IMEI ile daha önce tamir kaydı bulunamadı
            </div>
          )}

          {result.api_info && Object.keys(result.api_info).length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 14, margin: "12px 0 6px" }}>🌐 Cihaz Bilgisi</div>
              <div className="card">
                {Object.entries(result.api_info).slice(0, 8).map(([k, v]) => (
                  <div key={k} className="card-row" style={{ padding: "6px 0", borderBottom: "1px solid var(--bg2)" }}>
                    <span style={{ color: "var(--hint)", fontSize: 13 }}>{k}</span>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
