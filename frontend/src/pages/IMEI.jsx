import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import ImeiInput from "../components/ImeiInput";
import {
  ScanLine, Search, Landmark, Lightbulb, Copy, ClipboardList, Smartphone,
  CheckCircle2, Ban, Globe, TriangleAlert, CircleHelp, Zap,
} from "lucide-react";

const BTK_DURUM = {
  kayitli:          { icon: CheckCircle2, label: "Kayıtlı",               color: "var(--green)", aciklama: "Türkiye'de yasal yollarla satılmış, sorun yok." },
  calinitli_engelli:{ icon: Ban,          label: "Çalıntı / Engelli",     color: "var(--red)",   aciklama: "BTK tarafından engellenmiş. Bu cihazı alma!" },
  yurt_disi:        { icon: Globe,        label: "Yurt Dışından Getirilmiş", color: "var(--orange)", aciklama: "120 gün kullanım hakkı var. Kayıt yaptırılmamış." },
  kayitsiz:         { icon: TriangleAlert,label: "Kayıtsız",              color: "var(--orange)", aciklama: "Yurt dışından gelmiş, kayıt yaptırılmamış." },
  bilinmiyor:       { icon: CircleHelp,   label: "Bilinmiyor",            color: "var(--gray)",  aciklama: "Durum belirlenemedi." },
  btk_erisim_hatasi:{ icon: Zap,          label: "BTK'ya Erişilemedi",    color: "var(--gray)",  aciklama: "Lütfen BTK sitesini manuel ziyaret edin." },
};

const BILGI_KUTUSU = [
  { icon: CheckCircle2, color: "var(--green)", title: "Kayıtlı", desc: "Türkiye'de yasal satılmış, sorun yok" },
  { icon: Globe, color: "var(--orange)", title: "Yurt Dışından Getirilmiş", desc: "120 gün kullanım hakkı var" },
  { icon: Ban, color: "var(--red)", title: "Çalıntı / Engelli", desc: "Şebekeye giremez — alma!" },
  { icon: TriangleAlert, color: "var(--orange)", title: "Kayıtsız", desc: "Yurt dışından gelmiş, kayıt yaptırılmamış" },
];

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
  window.open(url, "_blank");
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
  const DurumIcon = durumInfo?.icon;

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <div className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 9 }}>
          <ScanLine size={19} strokeWidth={2} /> IMEI Sorgula
        </div>
      </div>

      {/* IMEI giriş */}
      <div className="card">
        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="form-label">IMEI Numarası (15 hane) — *#06# ile öğren</label>
          <ImeiInput
            value={imei}
            onChange={(v) => { setImei(v); setResult(null); setBtkResult(null); setError(""); }}
            placeholder="Örn: 352099001761481 veya kamerayla okut"
            style={{ fontSize: 18, letterSpacing: 2 }}
          />
        </div>
        {brand && (
          <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Smartphone size={13} strokeWidth={2} /> {brand} cihazı
          </div>
        )}
        {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="btn btn-ghost" onClick={sorgulaDB} disabled={loading || imei.length !== 15} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            {loading ? "..." : <><Search size={14} strokeWidth={2} /> Kayıtlarımız</>}
          </button>
          <button className="btn btn-primary" onClick={() => openEdevlet(imei)} disabled={imei.length !== 15} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Landmark size={14} strokeWidth={2} /> e-Devlet Sorgula
          </button>
        </div>
        {imei.length === 15 && (
          <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 8, display: "flex", alignItems: "flex-start", gap: 6 }}>
            <Lightbulb size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            e-Devlet butonuna tıklayınca IMEI panoya kopyalanır, sitede yapıştırın
          </div>
        )}
      </div>

      {/* BTK Sonucu */}
      {btkResult && durumInfo && (
        <div className="card" style={{ background: "var(--bg2)", borderLeft: `3px solid ${durumInfo.color}` }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: durumInfo.color, marginBottom: 4, display: "flex", alignItems: "center", gap: 9 }}>
            {DurumIcon && <DurumIcon size={20} strokeWidth={2} />} {durumInfo.label}
          </div>
          <div style={{ fontSize: 13, color: "var(--hint)" }}>{durumInfo.aciklama}</div>
          {btkResult.durum === "btk_erisim_hatasi" && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 6 }}>
                e-Devlet üzerinden sorgulayabilirsin:
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={copyImei} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Copy size={13} strokeWidth={2} /> Kopyala
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => openEdevlet(imei)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Landmark size={13} strokeWidth={2} /> e-Devlet →
                </button>
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
              <div style={{ fontWeight: 700, fontSize: 14, margin: "12px 0 6px", display: "flex", alignItems: "center", gap: 7 }}>
                <ClipboardList size={14} strokeWidth={2} /> Servis Geçmişimizde
              </div>
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
              <div style={{ fontWeight: 700, fontSize: 14, margin: "12px 0 6px", display: "flex", alignItems: "center", gap: 7 }}>
                <Smartphone size={14} strokeWidth={2} /> 2. El Geçmişi
              </div>
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
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}>
            <Landmark size={14} strokeWidth={2} /> e-Devlet IMEI Sorgusu Ne Gösterir?
          </div>
          {BILGI_KUTUSU.map(item => (
            <div key={item.title} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
              <item.icon size={17} stroke={item.color} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
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
