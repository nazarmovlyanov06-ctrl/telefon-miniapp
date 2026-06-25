import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const BTK_DURUM = {
  kayitli:          { label: "✅ Kayıtlı",               color: "#16a34a", bg: "#dcfce7", aciklama: "Türkiye'de yasal yollarla satılmış, sorun yok." },
  calinitli_engelli:{ label: "🚫 Çalıntı / Engelli",     color: "#dc2626", bg: "#fef2f2", aciklama: "BTK tarafından engellenmiş. Bu cihazı alma!" },
  yurt_disi:        { label: "🌍 Yurt Dışından Getirilmiş",color: "#d97706", bg: "#fff7ed", aciklama: "120 gün kullanım hakkı var. Kayıt yaptırılmamış." },
  kayitsiz:         { label: "⚠️ Kayıtsız",               color: "#d97706", bg: "#fefce8", aciklama: "Yurt dışından gelmiş, kayıt yaptırılmamış." },
  bilinmiyor:       { label: "❓ Bilinmiyor",              color: "#6b7280", bg: "#f9fafb", aciklama: "Durum belirlenemedi." },
  btk_erisim_hatasi:{ label: "⚡ BTK'ya Erişilemedi",      color: "#6b7280", bg: "#f9fafb", aciklama: "Lütfen BTK sitesini manuel ziyaret edin." },
};

function tacBrand(tac) {
  if (!tac) return null;
  const map = [
    ["35384","Apple"],["35323","Apple"],["35348","Apple"],["35352","Apple"],["01301","Apple"],["35440","Apple"],["35453","Apple"],
    ["35720","Samsung"],["35925","Samsung"],["35446","Samsung"],["35740","Samsung"],["35204","Samsung"],["35570","Samsung"],
    ["86484","Huawei"],["86903","Huawei"],["86307","Huawei"],["86906","Huawei"],
    ["35881","Xiaomi"],["86503","Xiaomi"],["86850","Xiaomi"],["86925","Xiaomi"],
    ["35362","Sony"],["35843","Sony"],
    ["35269","Nokia"],["35526","Nokia"],
    ["35739","Google"],["35292","Google"],
    ["86239","OPPO"],["86925","OPPO"],
    ["86675","vivo"],["86786","vivo"],
    ["86823","Realme"],["86832","Realme"],
    ["35268","Motorola"],["01465","Motorola"],
    ["35540","OnePlus"],["86201","OnePlus"],
    ["35769","Huawei"],["86494","Huawei"],
  ];
  for (const [prefix, brand] of map) {
    if (tac.startsWith(prefix)) return brand;
  }
  return null;
}

function openEdevlet(imei) {
  if (imei) {
    try { navigator.clipboard?.writeText(imei); } catch {}
  }
  const url = "https://www.turkiye.gov.tr/imei-sorgulama";
  if (window.Telegram?.WebApp?.openLink) {
    window.Telegram.WebApp.openLink(url);
  } else {
    window.open(url, "_blank");
  }
}

export default function IMEI() {
  const navigate = useNavigate();
  const [imei, setImei] = useState("");
  const [result, setResult] = useState(null);
  const [btkResult, setBtkResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [btkLoading, setBtkLoading] = useState(false);
  const [error, setError] = useState("");

  const brand = imei.length >= 6 ? tacBrand(imei.slice(0, 5)) : null;

  async function sorgulaDB() {
    if (imei.length !== 15) { setError("IMEI 15 haneli olmalı"); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      setResult(await api.imei(imei));
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  async function sorgulaBTK() {
    if (imei.length !== 15) { setError("IMEI 15 haneli olmalı"); return; }
    setBtkLoading(true); setError(""); setBtkResult(null);
    try {
      const r = await api.imeiBtk(imei);
      setBtkResult(r);
    } catch (e) {
      setBtkResult({ durum: "btk_erisim_hatasi" });
    } finally { setBtkLoading(false); }
  }

  function copyImei() {
    navigator.clipboard?.writeText(imei);
  }

  const durumInfo = btkResult ? (BTK_DURUM[btkResult.durum] || BTK_DURUM.bilinmiyor) : null;

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <div className="page-title" style={{ margin: 0 }}>📱 IMEI Sorgula</div>
      </div>

      {/* IMEI giriş */}
      <div className="card">
        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="form-label">IMEI Numarası (15 hane) — *#06# ile öğren</label>
          <input
            className="form-input"
            placeholder="Örn: 352099001761481"
            inputMode="numeric"
            value={imei}
            onChange={(e) => {
              setImei(e.target.value.replace(/\D/g, "").slice(0, 15));
              setResult(null); setBtkResult(null); setError("");
            }}
            style={{ fontSize: 20, letterSpacing: 3, fontFamily: "monospace" }}
          />
        </div>
        {brand && <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: 8 }}>📱 {brand} cihazı</div>}
        {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="btn btn-ghost" onClick={sorgulaDB} disabled={loading || imei.length !== 15}>
            {loading ? "..." : "🔍 Kayıtlarımız"}
          </button>
          <button className="btn btn-primary" onClick={() => openEdevlet(imei)} disabled={imei.length !== 15}>
            🇹🇷 e-Devlet Sorgula
          </button>
        </div>
        {imei.length === 15 && (
          <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 8 }}>
            💡 e-Devlet butonuna tıklayınca IMEI panoya kopyalanır, sitede yapıştırın
          </div>
        )}
      </div>

      {/* BTK Sonucu */}
      {btkResult && durumInfo && (
        <div className="card" style={{ background: durumInfo.bg, border: `2px solid ${durumInfo.color}20` }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: durumInfo.color, marginBottom: 4 }}>
            {durumInfo.label}
          </div>
          <div style={{ fontSize: 13, color: "var(--hint)" }}>{durumInfo.aciklama}</div>
          {btkResult.durum === "btk_erisim_hatasi" && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 6 }}>
                e-Devlet üzerinden sorgulayabilirsin:
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={copyImei}>📋 Kopyala</button>
                <button className="btn btn-primary btn-sm" onClick={() => openEdevlet(imei)}>🇹🇷 e-Devlet →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sistemimizdeki kayıtlar */}
      {result && (
        <>
          {result.local_repairs?.length > 0 ? (
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
          ) : (
            <div className="card" style={{ color: "var(--hint)", textAlign: "center" }}>
              Kayıtlarımızda bu IMEI ile tamir bulunamadı
            </div>
          )}

          {result.second_hand?.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 14, margin: "12px 0 6px" }}>📱 2. El Geçmişi</div>
              {result.second_hand.map((s, i) => (
                <div key={i} className="card">
                  <div className="card-row">
                    <span style={{ fontWeight: 600 }}>{s.model}</span>
                    <span className={`badge ${s.durum === "stokta" ? "badge-tamirde" : "badge-teslim"}`}>{s.durum}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* Bilgi kutusu - BTK ne gösterir */}
      {!btkResult && !result && (
        <div className="card" style={{ marginTop: 4 }}>
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>🇹🇷 e-Devlet IMEI Sorgusu Ne Gösterir?</div>
          {[
            { icon: "✅", title: "Kayıtlı", desc: "Türkiye'de yasal satılmış, sorun yok" },
            { icon: "🌍", title: "Yurt Dışından Getirilmiş", desc: "120 gün kullanım hakkı var" },
            { icon: "🚫", title: "Çalıntı / Engelli", desc: "Şebekeye giremez — alma!" },
            { icon: "⚠️", title: "Kayıtsız", desc: "Yurt dışından gelmiş, kayıt yaptırılmamış" },
          ].map(item => (
            <div key={item.title} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18, lineHeight: 1.3 }}>{item.icon}</span>
              <div style={{ fontSize: 13 }}>
                <strong>{item.title}</strong> — {item.desc}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
