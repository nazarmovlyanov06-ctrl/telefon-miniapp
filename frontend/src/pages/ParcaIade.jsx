import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import {
  Clock, Truck, CheckCircle2, CircleX, TriangleAlert, Banknote, Package,
} from "lucide-react";

const DURUM_META = {
  bekliyor: { label: "Bekliyor", icon: Clock, bg: "rgba(246,162,74,0.15)", color: "var(--orange)" },
  gönderildi: { label: "Gönderildi", icon: Truck, bg: "rgba(94,168,255,0.15)", color: "var(--blue)" },
  para_iade_alindi: { label: "Para Alındı", icon: CheckCircle2, bg: "rgba(74,222,128,0.15)", color: "var(--green)" },
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
  const [odemeYontemi, setOdemeYontemi] = useState("nakit");
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
    setOdemeYontemi("nakit");
  }

  async function submitParaAlindi() {
    if (!paraModal) return;
    await api.updateParcaIadeDurum(paraModal.id, "para_iade_alindi", alinanTutar ? parseFloat(alinanTutar) : 0, odemeYontemi);
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
            <span style={{ fontWeight: 700, color: "var(--orange)" }}>{bekleyen.length} adet</span>
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
            {err && <div style={{ color: "var(--red)", fontSize: 13, padding: "8px 0", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}

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
                <div className="ac-dropdown" style={{ maxHeight: 220, overflowY: "auto" }}>
                  {parcaOneriler.map(p => (
                    <div key={p.id} onMouseDown={() => secParca(p)}
                      style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14,
                        borderBottom: "1px solid var(--divider)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div>{p.name}</div>
                        {p.device_model && <div style={{ fontSize: 11, color: "var(--hint)" }}>{p.device_model}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: p.quantity <= 2 ? "var(--red)" : "var(--success)", fontWeight: 600 }}>
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
              <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                <CheckCircle2 size={14} stroke="var(--green)" strokeWidth={2} /> <strong>{selectedParca.name}</strong> — Stokta: {selectedParca.quantity} adet
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
                  <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                    <TriangleAlert size={11} strokeWidth={2} /> Stokta sadece {selectedParca.quantity} adet var
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
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Banknote size={16} strokeWidth={2} /> Para İade Alındı
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
            <div className="form-group">
              <label className="form-label">Ödeme Yöntemi</label>
              <select className="form-select" value={odemeYontemi} onChange={e => setOdemeYontemi(e.target.value)}>
                <option value="nakit">Nakit</option>
                <option value="kart">Kart</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={submitParaAlindi} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <CheckCircle2 size={15} strokeWidth={2} /> Onayla
              </button>
              <button className="btn btn-ghost" onClick={() => setParaModal(null)}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><Package size={40} stroke="var(--dim)" strokeWidth={1.5} /></div>
          İade kaydı yok
        </div>
      ) : (
        <>
          {bekleyen.map(i => {
            const meta = DURUM_META[i.durum] || { label: i.durum, icon: Package, bg: "var(--bg2)", color: "var(--hint)" };
            const MetaIcon = meta.icon;
            return (
              <div key={i.id} className="card">
                <div className="card-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>{i.parca}</div>
                    <div style={{ fontSize: 13, color: "var(--hint)" }}>
                      {i.toptanci_adi ? `${i.toptanci_adi} · ` : ""}{i.miktar} adet
                      {i.beklenen_tutar > 0 ? ` · ₺${i.beklenen_tutar.toLocaleString("tr-TR")} bekleniyor` : ""}
                    </div>
                    {i.sebep && <div style={{ fontSize: 12, color: "var(--hint)" }}>{i.sebep}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20,
                      fontSize: 12, fontWeight: 600,
                      background: meta.bg, color: meta.color,
                    }}>
                      <MetaIcon size={12} strokeWidth={2} /> {meta.label}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {i.durum === "bekliyor" && (
                    <button className="btn btn-ghost btn-sm" onClick={() => updateDurum(i.id, "gönderildi")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Truck size={13} strokeWidth={2} /> Gönderildi
                    </button>
                  )}
                  {i.durum === "gönderildi" && (
                    <button className="btn btn-primary btn-sm" onClick={() => updateDurum(i.id, "para_iade_alindi")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Banknote size={13} strokeWidth={2} /> Para Alındı
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {tamamlanan.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 16 }}>Tamamlananlar ({tamamlanan.length})</div>
              {tamamlanan.map(i => (
                <div key={i.id} className="card" style={{ opacity: 0.75 }}>
                  <div className="card-row">
                    <div>
                      <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle2 size={13} stroke="var(--green)" strokeWidth={2} /> {i.parca}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--hint)" }}>
                        {i.toptanci_adi ? `${i.toptanci_adi} · ` : ""}{i.miktar} adet
                        {i.beklenen_tutar > 0 ? ` · ₺${i.beklenen_tutar.toLocaleString("tr-TR")}` : ""}
                      </div>
                    </div>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20,
                      fontSize: 12, fontWeight: 600,
                      background: DURUM_META.para_iade_alindi.bg,
                      color: DURUM_META.para_iade_alindi.color,
                    }}>
                      <CheckCircle2 size={12} strokeWidth={2} /> {DURUM_META.para_iade_alindi.label}
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
