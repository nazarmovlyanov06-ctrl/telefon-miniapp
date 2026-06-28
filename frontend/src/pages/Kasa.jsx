import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const PERIYOT = [
  { key: "bugun", label: "Bugün" },
  { key: "hafta", label: "Bu Hafta" },
  { key: "ay", label: "Bu Ay" },
];

const KAYNAK_EMOJI = {
  tamir: "🔧",
  "2el_satis": "📱",
  sifir_satis: "📦",
  aksesuar: "🎧",
  parca_iade: "↩️",
  diger: "💼",
};

function fmt(n) {
  if (!n) return "0";
  return Math.round(n).toLocaleString("tr-TR");
}

export default function Kasa() {
  const navigate = useNavigate();
  const [periyot, setPeriyot] = useState("bugun");
  const [ozet, setOzet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showGider, setShowGider] = useState(false);
  const [giderForm, setGiderForm] = useState({ tutar: "", aciklama: "", odeme_yontemi: "nakit" });
  const [showDuzelt, setShowDuzelt] = useState(false);
  const [duzeltForm, setDuzeltForm] = useState({ tur: "giris", tutar: "", aciklama: "Manuel düzeltme", odeme_yontemi: "nakit" });
  const [err, setErr] = useState("");
  const tapRef = useRef(0);
  const tapTimer = useRef(null);

  useEffect(() => { load(); }, [periyot]);

  async function load() {
    setLoading(true);
    try { setOzet(await api.kasaOzet(periyot)); }
    finally { setLoading(false); }
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

  async function submitGider(e) {
    e.preventDefault(); setErr("");
    try {
      await api.kasaGider({ ...giderForm, tutar: parseFloat(giderForm.tutar) });
      setShowGider(false);
      setGiderForm({ tutar: "", aciklama: "", odeme_yontemi: "nakit" });
      load();
    } catch (e) { setErr(e.message); }
  }

  async function submitDuzelt(e) {
    e.preventDefault(); setErr("");
    try {
      await api.kasaDuzelt({ ...duzeltForm, tutar: parseFloat(duzeltForm.tutar) });
      setShowDuzelt(false);
      setDuzeltForm({ tur: "giris", tutar: "", aciklama: "Manuel düzeltme", odeme_yontemi: "nakit" });
      load();
    } catch (e) { setErr(e.message); }
  }

  const maxGelir = ozet ? Math.max(...(ozet.gelir_kaynaklar || []).map(g => g.tutar), 1) : 1;
  const periyotLabel = { bugun: "bugün", hafta: "bu hafta", ay: "bu ay" };

  return (
    <div className="page" style={{ paddingBottom: 90 }}>
      {/* Başlık */}
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0, cursor: "default", userSelect: "none" }}
          onClick={handleTitleTap}>Kasa</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowGider(true); setErr(""); }}>− Gider</button>
      </div>

      {/* Periyot seçici */}
      <div style={{ display: "flex", background: "var(--bg2)", borderRadius: 12, padding: 3, gap: 3, marginBottom: 16 }}>
        {PERIYOT.map(p => (
          <button key={p.key} onClick={() => setPeriyot(p.key)}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 13, transition: "all 0.15s",
              background: periyot === p.key ? "var(--bg)" : "transparent",
              color: periyot === p.key ? "var(--text)" : "var(--hint)",
              boxShadow: periyot === p.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>{p.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "var(--hint)", padding: 48 }}>Yükleniyor...</div>
      ) : ozet && (
        <>
          {/* Gelir / Gider kartları */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div className="card" style={{ margin: 0 }}>
              <div style={{ fontSize: 11, color: "var(--hint)", marginBottom: 4 }}>Toplam Gelir</div>
              <div style={{ fontWeight: 700, fontSize: 20, color: "var(--success)" }}>{fmt(ozet.gelir)} ₺</div>
              <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 3 }}>
                💵 {fmt(ozet.gelir_nakit)} · 💳 {fmt(ozet.gelir_kart)}
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div style={{ fontSize: 11, color: "var(--hint)", marginBottom: 4 }}>Toplam Gider</div>
              <div style={{ fontWeight: 700, fontSize: 20, color: "var(--danger)" }}>{fmt(ozet.gider)} ₺</div>
              <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 3 }}>
                💵 {fmt(ozet.gider_nakit)} · 💳 {fmt(ozet.gider_kart)}
              </div>
            </div>
          </div>

          {/* Net kasa */}
          <div style={{
            background: (ozet.net || 0) >= 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${(ozet.net || 0) >= 0 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: 12, padding: "14px 16px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 8,
          }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--hint)", fontWeight: 600 }}>Net Kasa</div>
              <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>{periyotLabel[periyot]}</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 24, color: (ozet.net || 0) >= 0 ? "var(--success)" : "var(--danger)" }}>
              {(ozet.net || 0) >= 0 ? "+" : ""}{fmt(ozet.net)} ₺
            </div>
          </div>

          {/* Alacak / Dükkan Borcu */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div className="card" style={{ margin: 0, cursor: "pointer", borderLeft: "3px solid var(--success)" }}
              onClick={() => navigate("/debts?tab=alacak")}>
              <div style={{ fontSize: 11, color: "var(--success)", marginBottom: 4, fontWeight: 600 }}>Alacaklarımız</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: "var(--success)" }}>{fmt(ozet.alacak_toplam)} ₺</div>
              <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 3 }}>{ozet.alacak_sayi} müşteri →</div>
            </div>
            <div className="card" style={{ margin: 0, cursor: "pointer", borderLeft: "3px solid var(--danger)" }}
              onClick={() => navigate("/debts?tab=dukkan_borcu")}>
              <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 4, fontWeight: 600 }}>Dükkan Borçları</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: "var(--danger)" }}>{fmt(ozet.dukkan_borcu)} ₺</div>
              <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 3 }}>{ozet.dukkan_sayi} alacaklı →</div>
            </div>
          </div>

          {/* Mali durum özeti */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Mali Durum Özeti</div>
            {[
              { label: `Net kasa (${periyotLabel[periyot]})`, val: ozet.net, positive: (ozet.net || 0) >= 0 },
              { label: "Alacaklarımız (+)", val: ozet.alacak_toplam, positive: true },
              { label: "Dükkan borçları (−)", val: ozet.dukkan_borcu, positive: false },
            ].map((r, i) => (
              <div key={i} className="card-row" style={{
                padding: "7px 0",
                borderBottom: i < 2 ? "1px solid var(--bg2)" : "none",
              }}>
                <span style={{ fontSize: 13, color: "var(--hint)" }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: r.positive ? "var(--success)" : "var(--danger)" }}>
                  {r.positive ? "+" : "−"}{fmt(Math.abs(r.val || 0))} ₺
                </span>
              </div>
            ))}
            <div style={{ borderTop: "2px solid var(--bg2)", marginTop: 6, paddingTop: 8 }} className="card-row">
              <span style={{ fontWeight: 700, fontSize: 14 }}>Toplam</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: (ozet.mali_durum || 0) >= 0 ? "var(--success)" : "var(--danger)" }}>
                {(ozet.mali_durum || 0) >= 0 ? "+" : ""}{fmt(ozet.mali_durum)} ₺
              </span>
            </div>
          </div>

          {/* Gelir kaynakları */}
          {ozet.gelir_kaynaklar?.length > 0 && (
            <>
              <div className="section-title">Gelir Kaynakları</div>
              <div className="card" style={{ marginBottom: 14 }}>
                {ozet.gelir_kaynaklar.map((g) => (
                  <div key={g.kaynak}>
                    <div className="card-row" style={{ padding: "6px 0" }}>
                      <span style={{ fontSize: 13 }}>{KAYNAK_EMOJI[g.kaynak] || "💼"} {g.label}</span>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--success)" }}>{fmt(g.tutar)} ₺</span>
                    </div>
                    <div style={{ height: 5, background: "var(--bg2)", borderRadius: 3, margin: "0 0 6px", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 3, background: "var(--accent)",
                        width: `${Math.round((g.tutar / maxGelir) * 100)}%`,
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Son hareketler */}
          {ozet.hareketler?.length > 0 && (
            <>
              <div className="section-title">Son Hareketler</div>
              {ozet.hareketler.map(h => {
                const isGelir = h.tur === "giris" || h.tur === "gelir";
                return (
                  <div key={h.id} className="card" style={{ marginBottom: 6 }}>
                    <div className="card-row">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {h.aciklama || h.kaynak || (isGelir ? "Gelir" : "Gider")}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>
                          {h.odeme_yontemi === "kart" ? "💳" : "💵"} {h.odeme_yontemi} · {h.tarih}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: isGelir ? "var(--success)" : "var(--danger)" }}>
                          {isGelir ? "+" : "−"}{fmt(h.tutar)} ₺
                        </div>
                        <div style={{
                          display: "inline-block", marginTop: 2, fontSize: 10, fontWeight: 600,
                          padding: "1px 7px", borderRadius: 20,
                          background: isGelir ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                          color: isGelir ? "var(--success)" : "var(--danger)",
                        }}>
                          {isGelir ? "Gelir" : "Gider"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {/* Gider Ekle Formu */}
      {showGider && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 24px)", maxWidth: 456, zIndex: 100 }}>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Gider Ekle</div>
            <form onSubmit={submitGider}>
              {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "6px 0", fontWeight: 600 }}>❌ {err}</div>}
              <div className="form-group">
                <label className="form-label">Tutar (₺)</label>
                <input className="form-input" type="number" required min="0.01" step="0.01"
                  value={giderForm.tutar} onChange={e => setGiderForm({ ...giderForm, tutar: e.target.value })} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Açıklama</label>
                <input className="form-input" value={giderForm.aciklama}
                  onChange={e => setGiderForm({ ...giderForm, aciklama: e.target.value })} placeholder="Kira, elektrik..." />
              </div>
              <div className="form-group">
                <label className="form-label">Ödeme Yöntemi</label>
                <select className="form-select" value={giderForm.odeme_yontemi}
                  onChange={e => setGiderForm({ ...giderForm, odeme_yontemi: e.target.value })}>
                  <option value="nakit">Nakit</option>
                  <option value="kart">Kart</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="btn btn-primary">Kaydet</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowGider(false); setErr(""); }}>İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manuel Düzeltme (patron, triple tap) */}
      {showDuzelt && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 24px)", maxWidth: 456, zIndex: 100 }}>
          <div className="card" style={{ border: "2px solid var(--warn, #f59e0b)" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--warn, #f59e0b)", marginBottom: 10 }}>🔧 Manuel Düzeltme</div>
            <form onSubmit={submitDuzelt}>
              {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "4px 0", fontWeight: 600 }}>❌ {err}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
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
              <div className="form-group">
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
                <button type="button" className="btn btn-ghost" onClick={() => { setShowDuzelt(false); setErr(""); }}>İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
