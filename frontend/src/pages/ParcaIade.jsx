import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";

const DURUM_LABEL = {
  bekliyor: "⏳ Bekliyor",
  gönderildi: "🚚 Gönderildi",
  para_iade_alindi: "✅ Para Alındı",
};
const DURUM_COLOR = {
  bekliyor: { bg: "#fef3c7", color: "#92400e" },
  gönderildi: { bg: "#dbeafe", color: "#1e40af" },
  para_iade_alindi: { bg: "#dcfce7", color: "#166534" },
};

export default function ParcaIade() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [toptancilar, setToptancilar] = useState([]);
  const [parcalar, setParcalar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ toptanci_id: "", parca: "", part_id: null, miktar: "1", sebep: "", beklenen_tutar: "" });
  const [parcaArama, setParcaArama] = useState("");
  const [parcaOneriler, setParcaOneriler] = useState([]);
  const [showParcaOner, setShowParcaOner] = useState(false);
  const [paraModal, setParaModal] = useState(null);
  const [alinanTutar, setAlinanTutar] = useState("");
  const dolarKuru = parseFloat(localStorage.getItem("son_dolar_kuru") || "0");

  useEffect(() => {
    load().then(() => {
      const partId = searchParams.get("part_id");
      const partName = searchParams.get("part_name");
      if (partId && partName) {
        const id = parseInt(partId);
        setParcaArama(partName);
        setForm(f => ({ ...f, parca: partName, part_id: id }));
        setShowForm(true);
      }
    });
  }, []);

  async function load() {
    try {
      const [l, t, p] = await Promise.all([
        api.parcaIadeList(),
        api.toptanciList(),
        api.parts(),
      ]);
      setList(l); setToptancilar(t);
      setParcalar(p.filter ? p.filter(x => x.quantity > 0) : (p || []));
    } finally { setLoading(false); }
    return true;
  }

  function handleParcaArama(val) {
    setParcaArama(val);
    setForm(f => ({ ...f, parca: val, part_id: null }));
    if (val.length >= 1) {
      const q = val.toLowerCase();
      const found = parcalar.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.device_model || "").toLowerCase().includes(q)
      ).slice(0, 8);
      setParcaOneriler(found);
      setShowParcaOner(found.length > 0);
    } else {
      setShowParcaOner(false);
    }
  }

  function secParca(p) {
    setParcaArama(p.name + (p.device_model ? ` (${p.device_model})` : ""));
    const otomatikTutar = p.purchase_price > 0 ? String(p.purchase_price * parseInt(form.miktar || 1)) : "";
    setForm(f => ({ ...f, parca: p.name, part_id: p.id, miktar: "1", beklenen_tutar: otomatikTutar }));
    setShowParcaOner(false);
  }

  const selectedParca = form.part_id ? parcalar.find(p => p.id === form.part_id) : null;

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.createParcaIade({
        ...form,
        toptanci_id: form.toptanci_id ? parseInt(form.toptanci_id) : null,
        miktar: parseInt(form.miktar),
        part_id: form.part_id || null,
        beklenen_tutar: form.beklenen_tutar ? parseFloat(form.beklenen_tutar) : 0,
      });
      setShowForm(false);
      setForm({ toptanci_id: "", parca: "", part_id: null, miktar: "1", sebep: "", beklenen_tutar: "" });
      setParcaArama("");
      setShowParcaOner(false);
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  function openParaModal(item) {
    setParaModal(item);
    setAlinanTutar(item.beklenen_tutar > 0 ? String(item.beklenen_tutar) : "");
  }

  async function submitParaAlindi() {
    if (!paraModal) return;
    await api.updateParcaIadeDurum(paraModal.id, "para_iade_alindi", alinanTutar ? parseFloat(alinanTutar) : 0);
    setParaModal(null);
    setAlinanTutar("");
    load();
  }

  async function updateDurum(id, durum) {
    if (durum === "para_iade_alindi") {
      const item = list.find(i => i.id === id);
      if (item) { openParaModal(item); return; }
    }
    await api.updateParcaIadeDurum(id, durum, 0);
    load();
  }

  const bekleyen = list.filter(i => i.durum !== "para_iade_alindi");
  const tamamlanan = list.filter(i => i.durum === "para_iade_alindi");

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0 }}>Parça İade</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setErr(""); }}>+ İade</button>
      </div>

      {bekleyen.length > 0 && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-row">
            <span style={{ color: "var(--hint)", fontSize: 13 }}>Bekleyen İade</span>
            <span style={{ fontWeight: 700, color: "var(--warn, #f59e0b)" }}>{bekleyen.length} adet</span>
          </div>
          {bekleyen.some(i => i.beklenen_tutar > 0) && (
            <div className="card-row" style={{ marginTop: 4 }}>
              <span style={{ color: "var(--hint)", fontSize: 13 }}>Beklenen Tutar</span>
              <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                ₺{bekleyen.reduce((s, i) => s + (i.beklenen_tutar || 0), 0).toLocaleString("tr-TR")}
              </span>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="card">
          <form onSubmit={submit}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600 }}>❌ {err}</div>}

            <div className="form-group" style={{ position: "relative" }}>
              <label className="form-label">Parça (Stoktan Seç) *</label>
              <input
                className="form-input" required
                value={parcaArama}
                onChange={e => handleParcaArama(e.target.value)}
                onBlur={() => setTimeout(() => setShowParcaOner(false), 150)}
                placeholder="Parça adı yaz veya ara..."
                autoComplete="off"
              />
              {showParcaOner && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden", maxHeight: 220, overflowY: "auto"
                }}>
                  {parcaOneriler.map(p => (
                    <div key={p.id} onMouseDown={() => secParca(p)}
                      style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14,
                        borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div>{p.name}</div>
                        {p.device_model && <div style={{ fontSize: 11, color: "var(--hint)" }}>{p.device_model}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: p.quantity <= 2 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
                          {p.quantity} adet
                        </div>
                        {p.purchase_price > 0 && <div style={{ fontSize: 11, color: "var(--hint)" }}>₺{p.purchase_price}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedParca && (
              <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 10 }}>
                ✅ <strong>{selectedParca.name}</strong> — Stokta: {selectedParca.quantity} adet
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Toptancı</label>
              <select className="form-select" value={form.toptanci_id} onChange={e => setForm({ ...form, toptanci_id: e.target.value })}>
                <option value="">Seç (opsiyonel)</option>
                {toptancilar.map(t => <option key={t.id} value={t.id}>{t.ad}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Adet</label>
                <input className="form-input" type="number" min="1"
                  max={selectedParca ? selectedParca.quantity : 999}
                  value={form.miktar}
                  onChange={e => setForm({ ...form, miktar: e.target.value })} />
                {selectedParca && parseInt(form.miktar) > selectedParca.quantity && (
                  <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>
                    ⚠️ Stokta sadece {selectedParca.quantity} adet var
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Beklenen İade (₺)</label>
                <input className="form-input" type="number" min="0" step="0.01"
                  value={form.beklenen_tutar}
                  onChange={e => setForm({ ...form, beklenen_tutar: e.target.value })}
                  placeholder="0" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">İade Sebebi</label>
              <input className="form-input" value={form.sebep} onChange={e => setForm({ ...form, sebep: e.target.value })} placeholder="Arızalı, yanlış gönderim..." />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary"
                disabled={form.part_id && parseInt(form.miktar) > (selectedParca?.quantity || 0)}>
                Kaydet
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setParcaArama(""); }}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {/* Para Alındı Modalı */}
      {paraModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 360 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
              💰 Para İade Alındı
            </div>
            <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 12 }}>
              {paraModal.parca} — {paraModal.toptanci_adi || "Toptancı belirtilmedi"}
            </div>
            <div className="form-group">
              <label className="form-label">Alınan Tutar (₺)</label>
              <input className="form-input" type="number" min="0" step="0.01"
                value={alinanTutar}
                onChange={e => setAlinanTutar(e.target.value)}
                placeholder={paraModal.beklenen_tutar > 0 ? String(paraModal.beklenen_tutar) : "0"} />
              {alinanTutar && dolarKuru > 0 && (
                <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 4 }}>
                  ≈ ${(parseFloat(alinanTutar) / dolarKuru).toFixed(2)} USD (1$={dolarKuru}₺)
                </div>
              )}
              <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 4 }}>
                Bu tutar kasaya otomatik girilir
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={submitParaAlindi}>✅ Onayla</button>
              <button className="btn btn-ghost" onClick={() => setParaModal(null)}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty"><div className="empty-icon">📦</div>İade kaydı yok</div>
      ) : (
        <>
          {bekleyen.map(i => (
            <div key={i.id} className="card">
              <div className="card-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{i.parca}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)" }}>
                    {i.toptanci_adi ? `📦 ${i.toptanci_adi} · ` : ""}{i.miktar} adet
                    {i.beklenen_tutar > 0 ? ` · ₺${i.beklenen_tutar.toLocaleString("tr-TR")} bekleniyor` : ""}
                  </div>
                  {i.sebep && <div style={{ fontSize: 12, color: "var(--hint)" }}>{i.sebep}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    display: "inline-block", padding: "3px 9px", borderRadius: 20,
                    fontSize: 12, fontWeight: 600,
                    background: DURUM_COLOR[i.durum]?.bg || "#f3f4f6",
                    color: DURUM_COLOR[i.durum]?.color || "#374151",
                  }}>
                    {DURUM_LABEL[i.durum] || i.durum}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {i.durum === "bekliyor" && (
                  <button className="btn btn-ghost btn-sm" onClick={() => updateDurum(i.id, "gönderildi")}>🚚 Gönderildi</button>
                )}
                {i.durum === "gönderildi" && (
                  <button className="btn btn-primary btn-sm" onClick={() => updateDurum(i.id, "para_iade_alindi")}>💰 Para Alındı</button>
                )}
              </div>
            </div>
          ))}
          {tamamlanan.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 16 }}>Tamamlananlar ({tamamlanan.length})</div>
              {tamamlanan.map(i => (
                <div key={i.id} className="card" style={{ opacity: 0.75 }}>
                  <div className="card-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>✅ {i.parca}</div>
                      <div style={{ fontSize: 12, color: "var(--hint)" }}>
                        {i.toptanci_adi ? `${i.toptanci_adi} · ` : ""}{i.miktar} adet
                        {i.beklenen_tutar > 0 ? ` · ₺${i.beklenen_tutar.toLocaleString("tr-TR")}` : ""}
                      </div>
                    </div>
                    <div style={{
                      display: "inline-block", padding: "3px 9px", borderRadius: 20,
                      fontSize: 12, fontWeight: 600,
                      background: DURUM_COLOR.para_iade_alindi.bg,
                      color: DURUM_COLOR.para_iade_alindi.color,
                    }}>
                      {DURUM_LABEL.para_iade_alindi}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
