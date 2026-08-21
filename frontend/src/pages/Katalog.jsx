import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, fotoUrl } from "../api";
import { Smartphone, Package, HardDrive, Cpu, LayoutGrid, X } from "lucide-react";

// Müşteriye elden gösterilecek katalog — sadece marka/model/renk/hafıza/RAM
// ve varsa liste fiyatı görünür. Alış fiyatı bu ekranda hiçbir yerde yok:
// backend /katalog uç noktaları o alanı zaten hiç döndürmüyor, burada da
// ayrıca gizlemeye çalışmıyoruz — veri sızma riski en baştan yok.
export default function Katalog() {
  const navigate = useNavigate();
  const [kaynakTab, setKaynakTab] = useState("ikinciel"); // ikinciel | sifir
  const [ikinciEl, setIkinciEl] = useState([]);
  const [sifir, setSifir] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyukFoto, setBuyukFoto] = useState(null);

  useEffect(() => {
    Promise.all([api.ikinciElKatalog(), api.sifirKatalog()])
      .then(([a, b]) => { setIkinciEl(a); setSifir(b); })
      .finally(() => setLoading(false));
  }, []);

  const liste = kaynakTab === "ikinciel" ? ikinciEl : sifir;

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 9, flex: 1 }}>
          <LayoutGrid size={18} strokeWidth={2} /> Katalog
        </h1>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={`tab ${kaynakTab === "ikinciel" ? "active" : ""}`} onClick={() => setKaynakTab("ikinciel")}
          style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Smartphone size={13} strokeWidth={2} /> 2. El
        </button>
        <button className={`tab ${kaynakTab === "sifir" ? "active" : ""}`} onClick={() => setKaynakTab("sifir")}
          style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Package size={13} strokeWidth={2} /> Sıfır Cihaz
        </button>
      </div>

      {liste.length === 0 ? (
        <div className="empty">
          <div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}>
            <LayoutGrid size={40} stroke="var(--dim)" strokeWidth={1.5} />
          </div>
          Stokta gösterilecek cihaz yok
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {liste.map(c => (
            <div key={c.id} className="card" style={{ padding: 0, overflow: "hidden", margin: 0 }}>
              <div style={{
                position: "relative", aspectRatio: "1 / 1", cursor: c.gorsel_url ? "pointer" : "default",
                background: c.gorsel_url ? `url(${fotoUrl(c.gorsel_url)}) center/cover` : "var(--bg2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }} onClick={() => c.gorsel_url && setBuyukFoto(c.gorsel_url)}>
                {!c.gorsel_url && <Smartphone size={32} stroke="var(--hint)" strokeWidth={1.5} />}
              </div>
              <div style={{ padding: "10px 12px 12px" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.model}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                  {c.renk && <Chip>{c.renk}</Chip>}
                  {c.depolama && <Chip icon={HardDrive}>{c.depolama}</Chip>}
                  {c.ram && <Chip icon={Cpu}>{c.ram}</Chip>}
                </div>
                <div style={{ marginTop: 8, fontWeight: 700, fontSize: 15, color: c.liste_fiyati ? "var(--accent)" : "var(--hint)" }}>
                  {c.liste_fiyati ? c.liste_fiyati.toLocaleString("tr-TR") + " ₺" : "Fiyat için sorunuz"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {buyukFoto && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setBuyukFoto(null)}>
          <button className="btn btn-ghost btn-sm" style={{ position: "absolute", top: 16, right: 16, color: "#fff" }}
            onClick={() => setBuyukFoto(null)}><X size={20} strokeWidth={2} /></button>
          <img src={fotoUrl(buyukFoto)} alt="" style={{ maxWidth: "95%", maxHeight: "85vh", borderRadius: 8, objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}

function Chip({ children, icon: Icon }) {
  return (
    <span style={{
      fontSize: 11, padding: "2px 8px", borderRadius: 6,
      background: "var(--bg2)", color: "var(--hint)", fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {Icon && <Icon size={11} strokeWidth={2} />}
      {children}
    </span>
  );
}
