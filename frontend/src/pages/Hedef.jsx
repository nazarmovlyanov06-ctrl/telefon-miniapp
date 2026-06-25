import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Hedef() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [hedefTutar, setHedefTutar] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try { setData(await api.hedefBuAy()); } finally { setLoading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      const now = new Date();
      await api.setHedef({ yil: now.getFullYear(), ay: now.getMonth() + 1, hedef_tutar: parseFloat(hedefTutar) });
      setShowForm(false);
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  const hedef = data?.hedef_tutar || 0;
  const gercek = data?.gerceklesen || 0;
  const pct = hedef > 0 ? Math.min(100, Math.round((gercek / hedef) * 100)) : 0;
  const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const now = new Date();

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Aylık Hedef</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(true)}>Düzenle</button>
      </div>

      <div className="card" style={{ textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 4 }}>{aylar[now.getMonth()]} {now.getFullYear()}</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: "var(--accent)" }}>{pct}%</div>
        <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 16 }}>hedefe ulaşıldı</div>
        <div style={{ background: "var(--bg2)", borderRadius: 20, height: 12, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "var(--success)" : "var(--accent)", borderRadius: 20, transition: "width 0.5s" }} />
        </div>
        <div className="card-row">
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{gercek.toLocaleString("tr-TR")} ₺</div>
            <div style={{ fontSize: 12, color: "var(--hint)" }}>Gerçekleşen</div>
          </div>
          <div style={{ color: "var(--hint)" }}>/</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{hedef.toLocaleString("tr-TR")} ₺</div>
            <div style={{ fontSize: 12, color: "var(--hint)" }}>Hedef</div>
          </div>
        </div>
        {hedef > 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: gercek >= hedef ? "var(--success)" : "var(--hint)" }}>
            {gercek >= hedef ? "🎉 Hedefe ulaşıldı!" : `Hedefe ${(hedef - gercek).toLocaleString("tr-TR")} ₺ kaldı`}
          </div>
        )}
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
            <div className="form-group">
              <label className="form-label">Bu Ay Hedef (₺)</label>
              <input className="form-input" type="number" required value={hedefTutar} onChange={e => setHedefTutar(e.target.value)} placeholder="Örn: 50000" />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
