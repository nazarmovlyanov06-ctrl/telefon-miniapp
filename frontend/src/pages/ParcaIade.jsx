import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import {
  Clock, Truck, CheckCircle2, CircleX, TriangleAlert, Banknote, Package,
  Ban, Pencil, Trash2, User, Repeat, RefreshCw,
} from "lucide-react";
import OdemeBolustur, { varsayilanOdemeSatirlari } from "../components/OdemeBolustur";

const DURUM_META = {
  bekliyor: { label: "Bekliyor", icon: Clock, bg: "rgba(246,162,74,0.15)", color: "var(--orange)" },
  gönderildi: { label: "Gönderildi", icon: Truck, bg: "rgba(94,168,255,0.15)", color: "var(--blue)" },
  para_iade_alindi: { label: "Para Alındı", icon: CheckCircle2, bg: "rgba(74,222,128,0.15)", color: "var(--green)" },
  reddedildi: { label: "Reddedildi", icon: Ban, bg: "rgba(239,68,68,0.15)", color: "var(--red)" },
  parca_degisimi: { label: "Parça Değişimi", icon: Repeat, bg: "rgba(94,168,255,0.15)", color: "var(--blue)" },
};
const SONUCLANAN_DURUMLAR = ["para_iade_alindi", "reddedildi", "parca_degisimi"];

export default function ParcaIade({ user }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [toptancilar, setToptancilar] = useState([]);
  const [parcalar, setParcalar] = useState([]);
  const [tumParcalar, setTumParcalar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ toptanci_id: "", parca: "", part_id: null, miktar: "1", sebep: "", beklenen_tutar: "" });
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [parcaArama, setParcaArama] = useState("");
  const [parcaOneriler, setParcaOneriler] = useState([]);
  const [showParcaOner, setShowParcaOner] = useState(false);
  const [paraModal, setParaModal] = useState(null);
  const [alinanTutar, setAlinanTutar] = useState("");
  const [odemeYontemi, setOdemeYontemi] = useState("nakit");
  const [degisimModal, setDegisimModal] = useState(null);
  const [degisimForm, setDegisimForm] = useState({
    alinan_part_id: null, alinan_parca_adi: "", alinan_device_model: "", alinan_part_type: "",
    alinan_miktar: "1", alinan_fiyat: "", odemeler: null, taksit_sayi: "1",
  });
  const [degisimArama, setDegisimArama] = useState("");
  const [degisimOneriler, setDegisimOneriler] = useState([]);
  const [showDegisimOner, setShowDegisimOner] = useState(false);
  const [degisimDolarMode, setDegisimDolarMode] = useState(false);
  const [degisimDolarMiktar, setDegisimDolarMiktar] = useState("");
  const [dollarRate, setDollarRate] = useState(() => {
    const cached = parseFloat(localStorage.getItem("son_dolar_kuru") || "");
    return cached > 0 ? cached : null;
  });
  const [kurLoading, setKurLoading] = useState(false);
  const dolarKuru = dollarRate || 0;

  async function fetchDollarRate() {
    setKurLoading(true);
    try {
      const r = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json");
      const data = await r.json();
      const rate = Math.round(data.usd.try * 100) / 100;
      setDollarRate(rate);
      localStorage.setItem("son_dolar_kuru", String(rate));
    } catch (e) {
      setErr("Dolar kuru alınamadı");
    } finally {
      setKurLoading(false);
    }
  }

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
      setTumParcalar(p || []);
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

  function duzenle(item) {
    setEditId(item.id);
    setForm({
      toptanci_id: item.toptanci_id || "", parca: item.parca, part_id: item.part_id,
      miktar: String(item.miktar), sebep: item.sebep || "", beklenen_tutar: item.beklenen_tutar ? String(item.beklenen_tutar) : "",
    });
    setParcaArama(item.parca);
    setShowForm(true);
    setErr("");
  }

  function formuKapat() {
    setShowForm(false);
    setEditId(null);
    setForm({ toptanci_id: "", parca: "", part_id: null, miktar: "1", sebep: "", beklenen_tutar: "" });
    setParcaArama("");
    setShowParcaOner(false);
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const payload = {
      ...form,
      toptanci_id: form.toptanci_id ? parseInt(form.toptanci_id) : null,
      miktar: parseInt(form.miktar),
      part_id: form.part_id || null,
      beklenen_tutar: form.beklenen_tutar ? parseFloat(form.beklenen_tutar) : 0,
    };
    try {
      if (editId) await api.updateParcaIade(editId, payload);
      else await api.createParcaIade(payload);
      formuKapat();
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function sil(id) {
    try {
      await api.deleteParcaIade(id);
      setDeleteId(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  function openParaModal(item) {
    setParaModal(item);
    setAlinanTutar(item.beklenen_tutar > 0 ? String(item.beklenen_tutar) : "");
    setOdemeYontemi("nakit");
  }

  async function submitParaAlindi() {
    if (!paraModal) return;
    await api.updateParcaIadeDurum(paraModal.id, "para_iade_alindi", {
      alinan_tutar: alinanTutar ? parseFloat(alinanTutar) : 0, odeme_yontemi: odemeYontemi,
    });
    setParaModal(null);
    setAlinanTutar("");
    load();
  }

  function openDegisimModal(item) {
    setErr("");
    setDegisimModal(item);
    setDegisimForm({
      alinan_part_id: null, alinan_parca_adi: "", alinan_device_model: "", alinan_part_type: "",
      alinan_miktar: String(item.miktar || 1), alinan_fiyat: "", odemeler: null, taksit_sayi: "1",
    });
    setDegisimArama("");
    setShowDegisimOner(false);
    setDegisimDolarMode(false);
    setDegisimDolarMiktar("");
  }

  function handleDegisimArama(val) {
    setDegisimArama(val);
    setDegisimForm(f => ({ ...f, alinan_parca_adi: val, alinan_part_id: null }));
    if (val.length >= 1) {
      const q = val.toLowerCase();
      const found = tumParcalar.filter(p =>
        p.name.toLowerCase().includes(q) || (p.device_model || "").toLowerCase().includes(q)
      ).slice(0, 8);
      setDegisimOneriler(found);
      setShowDegisimOner(found.length > 0);
    } else {
      setShowDegisimOner(false);
    }
  }

  function secDegisimParca(p) {
    setDegisimArama(p.name + (p.device_model ? ` (${p.device_model})` : ""));
    setDegisimForm(f => ({
      ...f, alinan_parca_adi: p.name, alinan_part_id: p.id,
      alinan_fiyat: p.purchase_price > 0 ? String(p.purchase_price) : f.alinan_fiyat,
    }));
    setShowDegisimOner(false);
  }

  // Fark: gönderdiğimiz parçanın değeri (beklenen_tutar) ile aldığımızın
  // değeri (birim fiyat × miktar) karşılaştırılır — yön elle seçilmiyor.
  const degisimAlinanDeger = (parseFloat(degisimForm.alinan_fiyat) || 0) * (parseInt(degisimForm.alinan_miktar) || 0);
  const degisimGonderilenDeger = degisimModal?.beklenen_tutar || 0;
  const degisimFark = Math.round((degisimAlinanDeger - degisimGonderilenDeger) * 100) / 100;

  async function submitDegisim() {
    if (!degisimModal) return;
    if (degisimDolarMode && degisimDolarMiktar && !degisimForm.alinan_fiyat) {
      setErr("Kur alınmadan dolar tutarı TL'ye çevrilemedi — önce \"Kur al\"a basın");
      return;
    }
    const farkVar = Math.abs(degisimFark) > 0.009;
    await api.updateParcaIadeDurum(degisimModal.id, "parca_degisimi", {
      alinan_part_id: degisimForm.alinan_part_id,
      alinan_parca_adi: degisimForm.alinan_part_id ? null : degisimForm.alinan_parca_adi,
      alinan_device_model: degisimForm.alinan_device_model || null,
      alinan_part_type: degisimForm.alinan_part_type || null,
      alinan_miktar: parseInt(degisimForm.alinan_miktar) || 1,
      alinan_fiyat: parseFloat(degisimForm.alinan_fiyat) || 0,
      odemeler: farkVar ? (degisimForm.odemeler || varsayilanOdemeSatirlari(Math.abs(degisimFark))).filter(o => parseFloat(o.tutar) > 0) : [],
      taksit_sayi: parseInt(degisimForm.taksit_sayi) || 1,
    });
    setDegisimModal(null);
    load();
  }

  async function updateDurum(id, durum) {
    if (durum === "para_iade_alindi") {
      const item = list.find(i => i.id === id);
      if (item) { openParaModal(item); return; }
    }
    if (durum === "parca_degisimi") {
      const item = list.find(i => i.id === id);
      if (item) { openDegisimModal(item); return; }
    }
    if (durum === "reddedildi" && !confirm("Toptancı iadeyi reddetti mi? Bu paraya bağlıysa açılmış borç kaydı silinecek.")) return;
    await api.updateParcaIadeDurum(id, durum, {});
    load();
  }

  const bekleyen = list.filter(i => !SONUCLANAN_DURUMLAR.includes(i.durum));
  const tamamlanan = list.filter(i => SONUCLANAN_DURUMLAR.includes(i.durum));

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

            {editId && (
              <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Pencil size={12} strokeWidth={2} /> Düzenleniyor — parça/adet değiştirilemez (stok hareketiyle bağlı)
              </div>
            )}
            <div className="form-group" style={{ position: "relative" }}>
              <label className="form-label">Parça (Stoktan Seç) *</label>
              <input
                className="form-input" required disabled={!!editId}
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
                <input className="form-input" type="number" min="1" disabled={!!editId}
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
                disabled={!editId && form.part_id && parseInt(form.miktar) > (selectedParca?.quantity || 0)}>
                {editId ? "Güncelle" : "Kaydet"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={formuKapat}>İptal</button>
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

      {/* Parça Değişimi Modalı */}
      {degisimModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 380, maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Repeat size={16} strokeWidth={2} /> Parça Değişimi
            </div>
            {err && <div style={{ color: "var(--red)", fontSize: 13, padding: "0 0 8px", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}
            <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 4 }}>
              {degisimModal.parca} — {degisimModal.toptanci_adi || "Toptancı belirtilmedi"}
            </div>
            {degisimModal.beklenen_tutar > 0 && (
              <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 12 }}>
                Gönderdiğimiz parçanın değeri: <strong>₺{degisimModal.beklenen_tutar.toLocaleString("tr-TR")}</strong>
              </div>
            )}

            <div className="form-group" style={{ position: "relative" }}>
              <label className="form-label">Yerine Gelen Parça</label>
              <input className="form-input"
                value={degisimArama}
                onChange={e => handleDegisimArama(e.target.value)}
                onBlur={() => setTimeout(() => setShowDegisimOner(false), 150)}
                placeholder="Parça adı yaz veya ara..."
                autoComplete="off"
              />
              {showDegisimOner && (
                <div className="ac-dropdown" style={{ maxHeight: 200, overflowY: "auto" }}>
                  {degisimOneriler.map(p => (
                    <div key={p.id} onMouseDown={() => secDegisimParca(p)}
                      style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14,
                        borderBottom: "1px solid var(--divider)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div>{p.name}</div>
                        {p.device_model && <div style={{ fontSize: 11, color: "var(--hint)" }}>{p.device_model}</div>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--hint)" }}>{p.quantity} adet</div>
                    </div>
                  ))}
                </div>
              )}
              {degisimForm.alinan_part_id ? (
                <div style={{ fontSize: 11, color: "var(--success)", marginTop: 4 }}>Stoktaki parça — miktar eklenecek</div>
              ) : degisimArama && (
                <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4 }}>Stokta yok — yeni parça olarak eklenecek</div>
              )}
            </div>

            {!degisimForm.alinan_part_id && degisimArama && (
              <div className="form-group">
                <label className="form-label">Cihaz Modeli (opsiyonel)</label>
                <input className="form-input" value={degisimForm.alinan_device_model}
                  onChange={e => setDegisimForm(f => ({ ...f, alinan_device_model: e.target.value }))} placeholder="Ör: iPhone 13" />
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Gelen Miktar</label>
                <input className="form-input" type="number" min="1" value={degisimForm.alinan_miktar}
                  onChange={e => setDegisimForm(f => ({ ...f, alinan_miktar: e.target.value }))} />
              </div>
              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span className="form-label" style={{ margin: 0 }}>
                    {degisimDolarMode ? "Dolar ($)" : "Gelen Parça Fiyatı (₺)"}
                  </span>
                  <button type="button"
                    onClick={() => { setDegisimDolarMode(m => !m); setDegisimDolarMiktar(""); setDegisimForm(f => ({ ...f, alinan_fiyat: "" })); }}
                    style={{ marginLeft: "auto", fontSize: 10, padding: "2px 7px", borderRadius: 10, border: "none",
                      background: degisimDolarMode ? "var(--accent)" : "var(--bg2)", color: degisimDolarMode ? "#fff" : "var(--hint)",
                      cursor: "pointer", fontWeight: 700 }}>
                    $
                  </button>
                </div>
                {degisimDolarMode ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <input className="form-input" type="number" step="0.01"
                      value={degisimDolarMiktar} placeholder="0.00"
                      onChange={e => {
                        setDegisimDolarMiktar(e.target.value);
                        const tl = dollarRate ? String(Math.round(parseFloat(e.target.value || 0) * dollarRate)) : "";
                        setDegisimForm(f => ({ ...f, alinan_fiyat: tl }));
                      }} />
                    {dollarRate && <span style={{ fontSize: 11, color: "var(--hint)", alignSelf: "center", whiteSpace: "nowrap" }}>≈{degisimForm.alinan_fiyat}₺</span>}
                  </div>
                ) : (
                  <input className="form-input" type="number" min="0" step="0.01" value={degisimForm.alinan_fiyat}
                    onChange={e => setDegisimForm(f => ({ ...f, alinan_fiyat: e.target.value }))} placeholder="0" />
                )}
                {degisimDolarMode && !dollarRate && (
                  <button type="button" onClick={fetchDollarRate} disabled={kurLoading}
                    style={{ marginTop: 4, fontSize: 11, padding: "3px 10px", borderRadius: 10,
                      border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--hint)" }}>
                    {kurLoading ? "..." : <><RefreshCw size={11} strokeWidth={2} /> Kur al</>}
                  </button>
                )}
              </div>
            </div>

            {degisimForm.alinan_fiyat && (
              <div style={{
                background: Math.abs(degisimFark) <= 0.009 ? "var(--bg2)" : "rgba(94,168,255,0.08)",
                border: Math.abs(degisimFark) <= 0.009 ? "none" : "1px solid rgba(94,168,255,0.25)",
                borderRadius: 8, padding: "8px 12px", fontSize: 12.5, marginBottom: 10,
              }}>
                {Math.abs(degisimFark) <= 0.009 ? (
                  <span style={{ color: "var(--hint)" }}>Fark yok — değerler eşit</span>
                ) : degisimFark > 0 ? (
                  <span><strong style={{ color: "var(--danger)" }}>₺{degisimFark.toLocaleString("tr-TR")}</strong> fazlasını biz öderiz (gelen parça daha değerli)</span>
                ) : (
                  <span><strong style={{ color: "var(--success)" }}>₺{Math.abs(degisimFark).toLocaleString("tr-TR")}</strong> toptancı bize öder/borçlu kalır (gönderdiğimiz daha değerliydi)</span>
                )}
              </div>
            )}

            {Math.abs(degisimFark) > 0.009 && (
              <OdemeBolustur toplam={Math.abs(degisimFark)} yon={degisimFark > 0 ? "gider" : "gelir"}
                value={degisimForm.odemeler} onChange={v => setDegisimForm(f => ({ ...f, odemeler: v }))}
                taksitSayi={degisimForm.taksit_sayi} onTaksitSayiChange={v => setDegisimForm(f => ({ ...f, taksit_sayi: v }))} />
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={submitDegisim} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <CheckCircle2 size={15} strokeWidth={2} /> Onayla
              </button>
              <button className="btn btn-ghost" onClick={() => setDegisimModal(null)}>İptal</button>
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
                    {(i.olusturan_adi || i.son_degistiren_adi) && (
                      <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                        <User size={10} strokeWidth={2} />
                        {i.durum === "bekliyor"
                          ? (i.olusturan_adi ? `Ekleyen: ${i.olusturan_adi}` : null)
                          : (i.son_degistiren_adi ? `Son işlem: ${i.son_degistiren_adi}` : (i.olusturan_adi ? `Ekleyen: ${i.olusturan_adi}` : null))}
                      </div>
                    )}
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
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {i.durum === "bekliyor" && (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => updateDurum(i.id, "gönderildi")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Truck size={13} strokeWidth={2} /> Gönderildi
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => duzenle(i)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Pencil size={13} strokeWidth={2} /> Düzenle
                      </button>
                    </>
                  )}
                  {i.durum === "gönderildi" && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => updateDurum(i.id, "para_iade_alindi")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Banknote size={13} strokeWidth={2} /> Para Alındı
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => updateDurum(i.id, "parca_degisimi")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Repeat size={13} strokeWidth={2} /> Parça Değişimi
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => updateDurum(i.id, "reddedildi")}
                        style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--red)" }}>
                        <Ban size={13} strokeWidth={2} /> Reddedildi
                      </button>
                    </>
                  )}
                  {user?.rol === "patron" && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(i.id)}
                      style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--hint)", marginLeft: "auto" }}>
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {tamamlanan.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 16 }}>Sonuçlananlar ({tamamlanan.length})</div>
              {tamamlanan.map(i => {
                const meta = DURUM_META[i.durum] || DURUM_META.para_iade_alindi;
                const MetaIcon = meta.icon;
                return (
                  <div key={i.id} className="card" style={{ opacity: 0.75 }}>
                    <div className="card-row">
                      <div>
                        <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <MetaIcon size={13} stroke={meta.color} strokeWidth={2} /> {i.parca}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--hint)" }}>
                          {i.toptanci_adi ? `${i.toptanci_adi} · ` : ""}{i.miktar} adet
                          {i.beklenen_tutar > 0 ? ` · ₺${i.beklenen_tutar.toLocaleString("tr-TR")}` : ""}
                        </div>
                        {i.son_degistiren_adi && (
                          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                            <User size={10} strokeWidth={2} /> {i.son_degistiren_adi}
                          </div>
                        )}
                      </div>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20,
                        fontSize: 12, fontWeight: 600,
                        background: meta.bg, color: meta.color,
                      }}>
                        <MetaIcon size={12} strokeWidth={2} /> {meta.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {deleteId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 340 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>İade kaydını sil</div>
            <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 16 }}>
              Bu kayıt silinecek, stoktan düşülen miktar varsa geri eklenecek. Emin misin?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ background: "var(--danger)" }} onClick={() => sil(deleteId)}>Sil</button>
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
