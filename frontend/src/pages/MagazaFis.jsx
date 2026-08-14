import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { Receipt, Wrench, CircleX, Package } from "lucide-react";

function fmt(n) { return (n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 }); }

export default function MagazaFis() {
  const { slug, repairNo: repairNoParam } = useParams();
  const [repairNo, setRepairNo] = useState(repairNoParam || "");
  const [telefon, setTelefon] = useState("");
  const [fis, setFis] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function goster(e) {
    e.preventDefault();
    if (!repairNo.trim() || !telefon.trim()) return;
    setErr(""); setLoading(true); setFis(null);
    try {
      setFis(await api.publicFis(slug, repairNo.trim().replace(/^#/, ""), telefon.trim()));
    } catch (e) { setErr("Fiş bulunamadı. Tamir no ve telefon numarasını kontrol edin."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "30px 20px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Wrench size={32} strokeWidth={1.6} style={{ marginBottom: 8 }} />
          <div style={{ fontWeight: 800, fontSize: 19 }}>Dijital Fiş</div>
        </div>

        {!fis && (
          <div className="card">
            <form onSubmit={goster}>
              {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={13} strokeWidth={2} /> {err}</div>}
              <div className="form-group">
                <input className="form-input" required placeholder="Tamir No (#T...)"
                  value={repairNo} onChange={e => setRepairNo(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input className="form-input" required type="tel" placeholder="Telefon numaranız"
                  value={telefon} onChange={e => setTelefon(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} disabled={loading}>
                {loading ? "Aranıyor..." : "Fişi Görüntüle"}
              </button>
            </form>
          </div>
        )}

        {fis && (
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Receipt size={16} strokeWidth={2} /> {fis.dukkan_ad}
            </div>
            <Row label="Tamir No" value={`#${fis.tamir.repair_no}`} />
            <Row label="Cihaz" value={fis.tamir.device_model} />
            <Row label="Arıza" value={fis.tamir.fault_desc || "—"} />
            <Row label="Durum" value={fis.tamir.status} />
            {fis.parcalar.length > 0 && (
              <>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--hint)", margin: "12px 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Package size={13} strokeWidth={2} /> KULLANILAN PARÇALAR
                </div>
                {fis.parcalar.map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                    <span>{p.name} × {p.quantity}</span>
                    <span>{fmt(p.quantity * p.unit_price)}₺</span>
                  </div>
                ))}
              </>
            )}
            <div className="divider" style={{ margin: "10px 0" }} />
            <Row label="Ücret" value={fis.tamir.final_price ? `${fmt(fis.tamir.final_price)}₺` : "—"} />
            <Row label="Ödeme" value={fis.tamir.payment_type || "—"} />
            {fis.tamir.delivered_at && <Row label="Teslim Tarihi" value={new Date(fis.tamir.delivered_at).toLocaleDateString("tr-TR")} />}
            <Link to="#" onClick={(e) => { e.preventDefault(); setFis(null); }} style={{ display: "block", textAlign: "center", marginTop: 14, fontSize: 13, color: "var(--hint)" }}>
              Başka fiş görüntüle
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="card-row" style={{ padding: "6px 0" }}>
      <span style={{ color: "var(--hint)", fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 500, maxWidth: "60%", textAlign: "right" }}>{value}</span>
    </div>
  );
}
