import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Kasa() {
  const navigate = useNavigate();
  const [tarih, setTarih] = useState(today());
  const [ozet, setOzet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showGider, setShowGider] = useState(false);
  const [giderForm, setGiderForm] = useState({ tutar: "", aciklama: "", odeme_yontemi: "nakit" });
  const [err, setErr] = useState("");
  const [showDuzelt, setShowDuzelt] = useState(false);
  const [duzeltForm, setDuzeltForm] = useState({ tur: "giris", tutar: "", aciklama: "Manuel düzeltme", odeme_yontemi: "nakit" });
  const tapRef = useRef(0);
  const tapTimer = useRef(null);

  useEffect(() => { load(tarih); }, [tarih]);

  async function load(t) {
    setLoading(true);
    try {
      const data = t === today() ? await api.kasaBugun() : await api.kasaTarih(t);
      setOzet(data);
    } finally { setLoading(false); }
  }

  function handleTitleTap() {
    tapRef.current += 1;
    clearTimeout(tapTimer.current);
    if (tapRef.current >= 3) {
      setShowDuzelt(v => !v);
      tapRef.current = 0;
    } else {
      tapTimer.current = setTimeout(() => { tapRef.current = 0; }, 1200);
    }
  }

  async function submitDuzelt(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.kasaDuzelt({ ...duzeltForm, tutar: parseFloat(duzeltForm.tutar), tarih });
      setShowDuzelt(false);
      setDuzeltForm({ tur: "giris", tutar: "", aciklama: "Manuel düzeltme", odeme_yontemi: "nakit" });
      load(tarih);
    } catch (e) { setErr(e.message); }
  }

  async function submitGider(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.kasaGider({ ...giderForm, tutar: parseFloat(giderForm.tutar), tarih });
      setShowGider(false);
      setGiderForm({ tutar: "", aciklama: "", odeme_yontemi: "nakit" });
      load(tarih);
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0, cursor: "default", userSelect: "none" }}
          onClick={handleTitleTap}>Günlük Kasa</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowGider(true)}>- Gider</button>
      </div>

      <div className="form-group">
        <input className="form-input" type="date" value={tarih} onChange={e => setTarih(e.target.value)} />
      </div>

      {showDuzelt && (
        <div className="card" style={{ marginBottom: 10, border: "2px solid var(--warn, #f59e0b)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--warn, #f59e0b)", marginBottom: 10 }}>🔧 Manuel Düzeltme</div>
          <form onSubmit={submitDuzelt}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "4px 0", fontWeight: 600 }}>❌ {err}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[{ v: "giris", l: "Gelir Ekle" }, { v: "cikis", l: "Gider Ekle" }].map(t => (
                <button key={t.v} type="button"
                  onClick={() => setDuzeltForm(f => ({ ...f, tur: t.v }))}
                  style={{
                    padding: "9px 0", borderRadius: 10, border: "1.5px solid",
                    borderColor: duzeltForm.tur === t.v ? (t.v === "giris" ? "var(--success)" : "var(--danger)") : "var(--border)",
                    background: duzeltForm.tur === t.v ? (t.v === "giris" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)") : "var(--bg2)",
                    color: duzeltForm.tur === t.v ? (t.v === "giris" ? "var(--success)" : "var(--danger)") : "var(--text)",
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}>{t.l}</button>
              ))}
            </div>
            <div className="form-group" style={{ marginTop: 10 }}>
              <label className="form-label">Tutar (₺)</label>
              <input className="form-input" type="number" required min="0.01" step="0.01"
                value={duzeltForm.tutar} onChange={e => setDuzeltForm(f => ({ ...f, tutar: e.target.value }))} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Açıklama</label>
              <input className="form-input" value={duzeltForm.aciklama}
                onChange={e => setDuzeltForm(f => ({ ...f, aciklama: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Ödeme Yöntemi</label>
              <select className="form-select" value={duzeltForm.odeme_yontemi}
                onChange={e => setDuzeltForm(f => ({ ...f, odeme_yontemi: e.target.value }))}>
                <option value="nakit">Nakit</option>
                <option value="kart">Kart</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowDuzelt(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div style={{ textAlign: "center", color: "var(--hint)", padding: 20 }}>Yükleniyor...</div> : ozet && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div className="card" style={{ margin: 0 }}>
              <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 4 }}>💵 Nakit</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: "var(--success)" }}>{(ozet.nakit || 0).toLocaleString("tr-TR")} ₺</div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 4 }}>💳 Kart</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: "var(--accent)" }}>{(ozet.kart || 0).toLocaleString("tr-TR")} ₺</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div className="card" style={{ margin: 0 }}>
              <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 4 }}>📤 Toplam Çıkış</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: "var(--danger)" }}>{(ozet.toplam_cikis || 0).toLocaleString("tr-TR")} ₺</div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 4 }}>💰 Net</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: (ozet.net || 0) >= 0 ? "var(--success)" : "var(--danger)" }}>
                {(ozet.net || 0).toLocaleString("tr-TR")} ₺
              </div>
            </div>
          </div>

          {ozet.hareketler && ozet.hareketler.length > 0 && (
            <div>
              <div className="page-title" style={{ fontSize: 15, marginTop: 4, marginBottom: 8 }}>Hareketler</div>
              {ozet.hareketler.map((h) => (
                <div key={h.id} className="card">
                  <div className="card-row">
                    <span>{h.aciklama || h.kaynak || (h.tur === "giris" ? "Gelir" : "Gider")}</span>
                    <span style={{ fontWeight: 600, color: h.tur === "giris" ? "var(--success)" : "var(--danger)" }}>
                      {h.tur === "giris" ? "+" : "-"}{(h.tutar || 0).toLocaleString("tr-TR")} ₺
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--hint)" }}>{h.odeme_yontemi}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showGider && (
        <div className="card" style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 24px)", maxWidth: 456, zIndex: 100 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Gider Ekle</div>
          <form onSubmit={submitGider}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}
            <div className="form-group">
              <label className="form-label">Tutar (₺)</label>
              <input className="form-input" type="number" required value={giderForm.tutar} onChange={e => setGiderForm({ ...giderForm, tutar: e.target.value })} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Açıklama</label>
              <input className="form-input" value={giderForm.aciklama} onChange={e => setGiderForm({ ...giderForm, aciklama: e.target.value })} placeholder="Kira, elektrik..." />
            </div>
            <div className="form-group">
              <label className="form-label">Ödeme Yöntemi</label>
              <select className="form-select" value={giderForm.odeme_yontemi} onChange={e => setGiderForm({ ...giderForm, odeme_yontemi: e.target.value })}>
                <option value="nakit">Nakit</option>
                <option value="kart">Kart</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowGider(false)}>İptal</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
