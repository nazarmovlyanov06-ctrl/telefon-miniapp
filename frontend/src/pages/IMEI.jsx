import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function IMEI() {
  const [imei, setImei] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
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
            type="number"
            value={imei}
            onChange={(e) => setImei(e.target.value.slice(0, 15))}
            style={{ fontSize: 18, letterSpacing: 2 }}
          />
        </div>
        <button className="btn btn-primary" onClick={query} disabled={loading || imei.length !== 15}>
          {loading ? "Sorgulanıyor..." : "🔍 Sorgula"}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {result && (
        <>
          <div className="card" style={{ background: "#f0fdf4" }}>
            <div style={{ color: "#16a34a", fontWeight: 700, marginBottom: 8 }}>✅ Geçerli IMEI</div>
            <div style={{ fontSize: 13, color: "var(--hint)" }}>TAC Kodu: {result.tac}</div>
          </div>

          {result.local_repairs.length > 0 && (
            <>
              <div className="section-title">📋 Servis Geçmişi</div>
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

          {result.second_hand.length > 0 && (
            <>
              <div className="section-title">📱 2. El Geçmişi</div>
              {result.second_hand.map((s, i) => (
                <div key={i} className="card">
                  <div style={{ fontWeight: 600 }}>{s.device_model}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 4 }}>
                    {s.status} · Alış: ₺{s.buy_price}
                    {s.sale_price ? ` · Satış: ₺${s.sale_price}` : ""}
                  </div>
                </div>
              ))}
            </>
          )}

          {result.local_repairs.length === 0 && result.second_hand.length === 0 && (
            <div className="card" style={{ color: "var(--hint)", textAlign: "center", padding: 24 }}>
              Bu IMEI ile kayıt bulunamadı
            </div>
          )}

          {result.api_info && (
            <>
              <div className="section-title">🌐 Detaylı Bilgi</div>
              <div className="card">
                {Object.entries(result.api_info).slice(0, 10).map(([k, v]) => (
                  <div key={k}>
                    <div className="card-row" style={{ padding: "6px 0" }}>
                      <span style={{ color: "var(--hint)", fontSize: 13 }}>{k}</span>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{String(v)}</span>
                    </div>
                    <div className="divider" />
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
