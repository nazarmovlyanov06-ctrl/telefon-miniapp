import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { PatternPreview } from "../components/PatternLock";

const STATUSES = [
  { key: "bekliyor", label: "⏳ Bekliyor" },
  { key: "tamirde", label: "🔧 Tamirde" },
  { key: "parca_bekleniyor", label: "📦 Parça Bekleniyor" },
  { key: "hazir", label: "✅ Hazır" },
  { key: "teslim", label: "🏠 Teslim Edildi" },
];

function fmt(n) { return (n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 }); }

function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return dt.toLocaleDateString("tr-TR") + " " + dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function RepairDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [repair, setRepair] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});
  const [teslimModal, setTeslimModal] = useState(false);
  const [teslimForm, setTeslimForm] = useState({ final_price: "", payment_type: "nakit", kasa_yazilsin: true });

  // Parçalar
  const [parcalar, setParcalar] = useState([]);
  const [partsList, setPartsList] = useState([]);
  const [parcaForm, setParcaForm] = useState({ part_id: "", quantity: 1 });
  const [parcaEkleOpen, setParcaEkleOpen] = useState(false);
  const [parcaSaving, setParcaSaving] = useState(false);
  const [parcaHata, setParcaHata] = useState("");
  const [parcaQ, setParcaQ] = useState("");
  const [showParcaOner, setShowParcaOner] = useState(false);

  // Fotoğraflar
  const [fotolar, setFotolar] = useState([]);
  const [fotoView, setFotoView] = useState(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fotoInputRef = useRef(null);

  // Fiş modal
  const [fisModal, setFisModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Ekran kilidi göster/gizle
  const [showLock, setShowLock] = useState(false);

  useEffect(() => {
    Promise.all([
      api.repair(id),
      api.repairParcalar(id).catch(() => []),
      api.repairFotolar(id).catch(() => []),
      api.parts().catch(() => []),
    ]).then(([r, p, f, parts]) => {
      setRepair(r);
      setParcalar(p);
      setFotolar(f);
      setPartsList(parts);
      setForm({
        device_model: r.device_model,
        fault_desc: r.fault_desc || "",
        estimated_price: r.estimated_price || "",
        final_price: r.final_price || "",
        payment_type: r.payment_type || "nakit",
        status: r.status,
        notes: r.notes || "",
        warranty_days: r.warranty_days || "",
      });
      if (r.final_price) setTeslimForm(f => ({ ...f, final_price: r.final_price, payment_type: r.payment_type || "nakit" }));
    }).finally(() => setLoading(false));
  }, [id]);

  async function changeStatus(status) {
    if (status === "teslim" && repair?.status !== "teslim") {
      setTeslimModal(true);
      return;
    }
    setSaving(true);
    try {
      await api.updateRepair(id, { ...form, status });
      setRepair((r) => ({ ...r, status }));
      setForm((f) => ({ ...f, status }));
    } finally { setSaving(false); }
  }

  async function teslimEt() {
    setSaving(true);
    try {
      const final = parseFloat(teslimForm.final_price) || 0;
      await api.updateRepair(id, {
        ...form, status: "teslim", final_price: final,
        payment_type: teslimForm.payment_type,
        kasa_yazilsin: teslimForm.kasa_yazilsin && final > 0,
      });
      setRepair(r => ({ ...r, status: "teslim", final_price: final, payment_type: teslimForm.payment_type }));
      setForm(f => ({ ...f, status: "teslim", final_price: final, payment_type: teslimForm.payment_type }));
      setTeslimModal(false);
    } finally { setSaving(false); }
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateRepair(id, form);
      setRepair((r) => ({ ...r, ...form }));
      setEdit(false);
    } finally { setSaving(false); }
  }

  // ── PARÇA işlemleri ──────────────────────────────────────────

  async function openParcaEkle() {
    const open = !parcaEkleOpen;
    setParcaEkleOpen(open);
    setParcaHata("");
    setParcaForm({ part_id: "", quantity: 1 });
    setParcaQ("");
    setShowParcaOner(false);
    if (open) {
      try {
        const fresh = await api.parts();
        setPartsList(fresh);
      } catch (_) {}
    }
  }

  async function addParca() {
    const partId = parseInt(parcaForm.part_id);
    if (!partId) return;
    setParcaSaving(true);
    setParcaHata("");
    try {
      const sel = partsList.find(p => p.id === partId);
      await api.addRepairParca(id, {
        part_id: partId,
        quantity: parseInt(parcaForm.quantity) || 1,
        unit_price: sel?.sale_price || 0,
      });
      // Ekleme başarılı — formu kapat
      setParcaForm({ part_id: "", quantity: 1 });
      setParcaEkleOpen(false);
      // Listeyi yenile (ayrı try — yenileme hatası eklemeyi iptal etmesin)
      try {
        const [p, parts] = await Promise.all([api.repairParcalar(id), api.parts()]);
        setParcalar(p);
        setPartsList(parts);
      } catch (_) {
        // Yenileme başarısız ama parça eklendi — sayfayı yenileyince görünür
      }
    } catch (e) {
      setParcaHata(e.message === "Failed to fetch"
        ? "Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin ve tekrar deneyin."
        : e.message || "Bir hata oluştu");
    } finally { setParcaSaving(false); }
  }

  async function removeParca(rpId) {
    if (!confirm("Bu parçayı kaldır?")) return;
    await api.deleteRepairParca(id, rpId);
    const [p, parts] = await Promise.all([api.repairParcalar(id), api.parts()]);
    setParcalar(p);
    setPartsList(parts);
  }

  // ── FOTOĞRAF işlemleri ───────────────────────────────────────

  function resizeAndUpload(file) {
    setUploadingFoto(true);
    const canvas = document.createElement("canvas");
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const base64 = canvas.toDataURL("image/jpeg", 0.75);
      try {
        await api.addRepairFoto(id, { foto: base64 });
        const f = await api.repairFotolar(id);
        setFotolar(f);
      } catch (e) { alert(e.message); }
      finally { setUploadingFoto(false); }
    };
    img.src = url;
  }

  async function deleteFoto(fotoId) {
    if (!confirm("Fotoğrafı sil?")) return;
    await api.deleteRepairFoto(id, fotoId);
    setFotolar(f => f.filter(x => x.id !== fotoId));
    setFotoView(null);
  }

  // ── WhatsApp ─────────────────────────────────────────────────

  function openWhatsApp(mesaj) {
    const phone = repair?.customer_phone?.replace(/\D/g, "");
    if (!phone) { alert("Müşteri telefon numarası kayıtlı değil"); return; }
    const num = phone.startsWith("90") ? phone : phone.startsWith("0") ? "9" + phone : "90" + phone;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(mesaj)}`, "_blank");
  }

  // ── FİŞ ──────────────────────────────────────────────────────

  function generateFis() {
    if (!repair) return "";
    const lines = [
      "📋 TAMİR FİŞİ",
      "═══════════════════",
      `Tamir No : #${repair.repair_no}`,
      `Tarih    : ${new Date(repair.created_at).toLocaleDateString("tr-TR")}`,
      "───────────────────",
      `Müşteri  : ${repair.customer_name || "—"}`,
      repair.customer_phone ? `Tel      : ${repair.customer_phone}` : null,
      "───────────────────",
      `Cihaz    : ${repair.device_model}`,
      repair.imei ? `IMEI     : ${repair.imei}` : null,
      `Arıza    : ${repair.fault_desc || "—"}`,
      repair.notes ? `Not      : ${repair.notes}` : null,
    ];
    if (parcalar.length > 0) {
      lines.push("───────────────────");
      lines.push("Kullanılan Parçalar:");
      parcalar.forEach(p => lines.push(`  • ${p.name} x${p.quantity} = ${fmt(p.quantity * p.unit_price)}₺`));
    }
    lines.push("───────────────────");
    lines.push(`Ücret    : ${repair.final_price ? fmt(repair.final_price) + "₺" : "—"}`);
    lines.push(`Ödeme    : ${repair.payment_type || "—"}`);
    if (repair.warranty_days > 0) lines.push(`Garanti  : ${repair.warranty_days} gün`);
    if (repair.delivered_at) lines.push(`Teslim   : ${new Date(repair.delivered_at).toLocaleDateString("tr-TR")}`);
    lines.push("═══════════════════");
    lines.push("✅ İyi günler dileriz!");
    return lines.filter(l => l !== null).join("\n");
  }

  async function copyFis() {
    const text = generateFis();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { alert(text); }
  }

  const parcaToplamTutar = parcalar.reduce((s, p) => s + p.quantity * p.unit_price, 0);

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (!repair) return <div className="empty">Bulunamadı</div>;

  const isHazir = repair.status === "hazir";
  const isTeslim = repair.status === "teslim";

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/repairs")}>← Geri</button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>#{repair.repair_no}</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setEdit(!edit)}>
          {edit ? "İptal" : "✏️ Düzenle"}
        </button>
      </div>

      {/* Durum butonları */}
      <div className="section-title">Durum</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {STATUSES.map((s) => (
          <button key={s.key}
            className={`tab ${(form.status || repair.status) === s.key ? "active" : ""}`}
            onClick={() => changeStatus(s.key)}
            disabled={saving}
            style={{ fontSize: 12 }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Teslim modalı */}
      {teslimModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 400 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🏠 Teslim Et</div>
            <div className="form-group">
              <label className="form-label">Son Ücret (₺)</label>
              <input className="form-input" type="number" value={teslimForm.final_price}
                onChange={e => setTeslimForm(f => ({ ...f, final_price: e.target.value }))}
                placeholder={repair.estimated_price || "0"} />
            </div>
            <div className="form-group">
              <label className="form-label">Ödeme Tipi</label>
              <select className="form-select" value={teslimForm.payment_type}
                onChange={e => setTeslimForm(f => ({ ...f, payment_type: e.target.value }))}>
                <option value="nakit">💵 Nakit</option>
                <option value="kart">💳 Kart</option>
                <option value="taksit">📅 Taksit</option>
                <option value="borc">📝 Borç</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <input type="checkbox" id="kasaYazilsin"
                checked={teslimForm.kasa_yazilsin}
                onChange={e => setTeslimForm(f => ({ ...f, kasa_yazilsin: e.target.checked }))} />
              <label htmlFor="kasaYazilsin" style={{ fontSize: 14 }}>Kasaya yaz</label>
            </div>
            {teslimForm.final_price && (
              <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
                💵 {parseFloat(teslimForm.final_price).toLocaleString("tr-TR")}₺ · {teslimForm.payment_type}
                {teslimForm.kasa_yazilsin && " · kasaya yazılacak"}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={teslimEt} disabled={saving}>
                {saving ? "..." : "✅ Teslim Et"}
              </button>
              <button className="btn btn-ghost" onClick={() => setTeslimModal(false)}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Fiş modal */}
      {fisModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16 }}
          onClick={() => setFisModal(false)}>
          <div className="card" style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🧾 Tamir Fişi</div>
            <pre style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", background: "var(--bg2)", padding: 12, borderRadius: 8, marginBottom: 12 }}>
              {generateFis()}
            </pre>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={copyFis}>
                {copied ? "✅ Kopyalandı!" : "📋 Kopyala"}
              </button>
              {repair.customer_phone && (
                <button className="btn btn-ghost" style={{ flex: 1 }}
                  onClick={() => openWhatsApp(generateFis())}>
                  💬 WhatsApp
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setFisModal(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* Fotoğraf büyük görünüm */}
      {fotoView && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
          onClick={() => setFotoView(null)}>
          <img src={fotoView.foto} alt="" style={{ maxWidth: "95%", maxHeight: "80vh", borderRadius: 8, objectFit: "contain" }} onClick={e => e.stopPropagation()} />
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); deleteFoto(fotoView.id); }}>
              🗑️ Sil
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setFotoView(null)}>Kapat</button>
          </div>
        </div>
      )}

      {edit ? (
        <div className="card">
          <div className="form-group">
            <label className="form-label">Cihaz Modeli</label>
            <input className="form-input" value={form.device_model}
              onChange={(e) => setForm({ ...form, device_model: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Arıza</label>
            <input className="form-input" value={form.fault_desc}
              onChange={(e) => setForm({ ...form, fault_desc: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="form-group">
              <label className="form-label">Tahmini Ücret</label>
              <input className="form-input" type="number" value={form.estimated_price}
                onChange={(e) => setForm({ ...form, estimated_price: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Son Ücret</label>
              <input className="form-input" type="number" value={form.final_price}
                onChange={(e) => setForm({ ...form, final_price: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Ödeme Tipi</label>
            <select className="form-select" value={form.payment_type}
              onChange={(e) => setForm({ ...form, payment_type: e.target.value })}>
              <option value="nakit">💵 Nakit</option>
              <option value="kart">💳 Kart</option>
              <option value="taksit">📅 Taksit</option>
              <option value="borc">📝 Borç</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Garanti (gün)</label>
            <input className="form-input" type="number" value={form.warranty_days}
              onChange={(e) => setForm({ ...form, warranty_days: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Not</label>
            <input className="form-input" value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Kaydediliyor..." : "💾 Kaydet"}
          </button>
        </div>
      ) : (
        <>
          {/* Temel bilgiler */}
          <div className="card">
            <Row label="Müşteri" value={repair.customer_name || "—"} />
            <div className="divider" />
            <Row label="Telefon" value={repair.customer_phone || "—"} />
            <div className="divider" />
            <Row label="Cihaz" value={repair.device_model} />
            <div className="divider" />
            <Row label="IMEI" value={repair.imei || "—"} />
            <div className="divider" />
            <Row label="Arıza" value={repair.fault_desc || "—"} />
            {repair.son_guncelleyen_adi && (
              <>
                <div className="divider" />
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, color: "var(--hint)" }}>
                  <span>✏️ Son düzenleyen</span>
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>{repair.son_guncelleyen_adi}</span>
                </div>
              </>
            )}
          </div>

          {/* Ekran kilidi */}
          {repair.screen_lock_type && (
            <div className="card" style={{ background: "rgba(99,102,241,0.08)", borderLeft: "3px solid var(--accent)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🔒</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Ekran Kilidi</div>
                    <div style={{ fontSize: 13, color: "var(--hint)" }}>
                      {repair.screen_lock_type === "pin" ? "PIN / Şifre" : "Desen"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowLock(v => !v)}
                  style={{
                    padding: "7px 14px", borderRadius: 20, border: "1.5px solid var(--accent)",
                    background: showLock ? "var(--accent)" : "transparent",
                    color: showLock ? "#fff" : "var(--accent)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {showLock ? "🙈 Gizle" : "👁 Göster"}
                </button>
              </div>

              {showLock && (
                <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                  {repair.screen_lock_type === "pin" ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 8, color: "var(--accent)", fontFamily: "monospace" }}>
                        {repair.screen_lock_value}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 4 }}>PIN Kodu</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <PatternPreview value={repair.screen_lock_value} size={120} />
                      <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 8 }}>
                        Desen: {repair.screen_lock_value?.split("-").map(n => parseInt(n) + 1).join(" → ")}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <Row label="Tahmini Ücret" value={repair.estimated_price ? `₺${fmt(repair.estimated_price)}` : "—"} />
            <div className="divider" />
            <Row label="Son Ücret" value={repair.final_price ? `₺${fmt(repair.final_price)}` : "—"} />
            <div className="divider" />
            <Row label="Ödeme" value={repair.payment_type || "—"} />
            {repair.warranty_days > 0 && <>
              <div className="divider" />
              <Row label="Garanti" value={`${repair.warranty_days} gün`} />
            </>}
          </div>

          {/* Kontrol Listesi */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "var(--hint)" }}>✅ KONTROL LİSTESİ</div>
            {[
              { key: "on_odeme", label: "Ön ödeme alındı" },
              { key: "musteri_onayi", label: "Müşteri onayı alındı" },
              { key: "eski_parca", label: "Eski parça müşteriye verildi" },
              { key: "veri_yedegi", label: "Veri yedeği alındı" },
            ].map(item => (
              <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <div
                  onClick={async () => {
                    const yeni = repair[item.key] ? 0 : 1;
                    await api.updateRepair(id, { ...form, [item.key]: yeni });
                    setRepair(r => ({ ...r, [item.key]: yeni }));
                  }}
                  style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                    border: `2px solid ${repair[item.key] ? "var(--accent)" : "var(--border)"}`,
                    background: repair[item.key] ? "var(--accent)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 13,
                  }}>
                  {repair[item.key] ? "✓" : ""}
                </div>
                <span style={{ fontSize: 13, color: repair[item.key] ? "var(--text)" : "var(--hint)" }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Tarihler */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "var(--hint)" }}>📅 TARİHLER</div>
            <DateRow icon="📝" label="Kayıt Açıldı" val={repair.created_at} done />
            <DateRow icon="🔧" label="Tamire Alındı" val={repair.tamirde_at} done={!!repair.tamirde_at} />
            <DateRow icon="✅" label="Hazır Oldu" val={repair.completed_at} done={!!repair.completed_at} />
            <DateRow icon="🏠" label="Teslim Edildi" val={repair.delivered_at} done={!!repair.delivered_at} />
          </div>

          {/* Aksiyonlar */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            {(isHazir || isTeslim) && repair.customer_phone && (
              <button className="btn btn-ghost btn-sm"
                style={{ background: "#25D366", color: "#fff", border: "none" }}
                onClick={() => openWhatsApp(
                  isHazir
                    ? `Merhaba ${repair.customer_name || ""},\n\n${repair.device_model} cihazınızın tamiri tamamlandı. Servisimizden teslim alabilirsiniz. 🔧✅`
                    : `Merhaba ${repair.customer_name || ""},\n\nTamiriniz (#${repair.repair_no}) ile ilgili bilgi almak ister misiniz?`
                )}>
                💬 WhatsApp{isHazir ? " - Hazır" : ""}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setFisModal(true)}>
              🧾 Fiş
            </button>
          </div>

          {/* Kullanılan Parçalar */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--hint)" }}>🔩 KULLANILAN PARÇALAR</div>
              <button className="btn btn-ghost btn-sm" onClick={openParcaEkle}>
                {parcaEkleOpen ? "İptal" : "+ Ekle"}
              </button>
            </div>

            {parcaEkleOpen && (() => {
              const seciliParca = partsList.find(p => p.id === parseInt(parcaForm.part_id));
              const maxAdet = seciliParca?.quantity ?? 99;
              return (
                <div style={{ background: "var(--bg2)", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <div style={{ position: "relative", marginBottom: 8 }}>
                    {(() => {
                      const secP = partsList.find(p => p.id === parseInt(parcaForm.part_id));
                      if (secP) return (
                        <div style={{ display: "flex", alignItems: "center", gap: 8,
                          background: "rgba(36,129,204,0.1)", borderRadius: 8, padding: "8px 10px",
                          border: "1.5px solid var(--accent)" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{secP.name}</div>
                            <div style={{ fontSize: 11, color: "var(--hint)" }}>
                              {secP.device_model ? `${secP.device_model} · ` : ""}{secP.quantity} stok
                            </div>
                          </div>
                          <button type="button"
                            onClick={() => { setParcaForm(f => ({ ...f, part_id: "" })); setParcaQ(""); setParcaHata(""); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", fontSize: 16 }}>✕</button>
                        </div>
                      );
                      const filtered = partsList
                        .filter(p => p.quantity > 0 && (!parcaQ ||
                          p.name.toLowerCase().includes(parcaQ.toLowerCase()) ||
                          (p.device_model || "").toLowerCase().includes(parcaQ.toLowerCase())))
                        .sort((a, b) => a.name.localeCompare(b.name, "tr"))
                        .slice(0, 8);
                      return (
                        <>
                          <input className="form-input" placeholder="🔍 Parça ara..."
                            value={parcaQ}
                            onChange={e => { setParcaQ(e.target.value); setShowParcaOner(true); }}
                            onFocus={() => setShowParcaOner(true)}
                            onBlur={() => setTimeout(() => setShowParcaOner(false), 150)}
                            autoComplete="off" />
                          {showParcaOner && (
                            <div className="ac-dropdown" style={{ zIndex: 50, maxHeight: 200, overflowY: "auto" }}>
                              {filtered.length === 0 ? (
                                <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--hint)" }}>
                                  {parcaQ ? "Parça bulunamadı" : "Aramak için yazın..."}
                                </div>
                              ) : filtered.map(p => (
                                <div key={p.id}
                                  onMouseDown={() => {
                                    setParcaForm(f => ({ ...f, part_id: String(p.id), quantity: 1 }));
                                    setParcaQ(""); setShowParcaOner(false); setParcaHata("");
                                  }}
                                  style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                                  <div style={{ fontSize: 11, color: "var(--hint)" }}>
                                    {p.device_model ? `${p.device_model} · ` : ""}
                                    {p.part_type ? `${p.part_type} · ` : ""}{p.quantity} stok
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input className="form-input" type="number" min="1" max={maxAdet}
                      style={{ width: 80, flex: "none" }}
                      value={parcaForm.quantity}
                      onChange={e => setParcaForm(f => ({ ...f, quantity: e.target.value }))}
                      placeholder="Adet" />
                    {seciliParca && (
                      <span style={{ fontSize: 12, color: "var(--hint)" }}>/ {seciliParca.quantity} stok</span>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={addParca}
                      disabled={parcaSaving || !parcaForm.part_id || parseInt(parcaForm.quantity) < 1}>
                      {parcaSaving ? "Ekleniyor..." : "Ekle"}
                    </button>
                  </div>
                  {parcaHata && (
                    <div style={{ color: "#ef4444", fontSize: 13, marginTop: 8, fontWeight: 600 }}>
                      ❌ {parcaHata}
                    </div>
                  )}
                </div>
              );
            })()}

            {parcalar.length === 0 ? (
              <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "8px 0" }}>
                Henüz parça eklenmedi
              </div>
            ) : (
              <>
                {parcalar.map(p => (
                  <div key={p.id} className="card-row" style={{ padding: "6px 0" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--hint)" }}>{p.quantity} adet × {fmt(p.unit_price)}₺</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, color: "var(--accent)" }}>{fmt(p.quantity * p.unit_price)}₺</span>
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", padding: "2px 6px" }}
                        onClick={() => removeParca(p.id)}>✕</button>
                    </div>
                  </div>
                ))}
                <div className="divider" />
                <div className="card-row" style={{ padding: "6px 0" }}>
                  <span style={{ fontSize: 12, color: "var(--hint)" }}>Toplam parça maliyeti</span>
                  <span style={{ fontWeight: 700 }}>{fmt(parcaToplamTutar)}₺</span>
                </div>
              </>
            )}
          </div>

          {/* Fotoğraflar */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--hint)" }}>📷 FOTOĞRAFLAR</div>
              <button className="btn btn-ghost btn-sm"
                onClick={() => fotoInputRef.current?.click()}
                disabled={uploadingFoto}>
                {uploadingFoto ? "Yükleniyor..." : "+ Fotoğraf"}
              </button>
            </div>
            <input ref={fotoInputRef} type="file" accept="image/*" capture="environment"
              style={{ display: "none" }}
              onChange={e => { if (e.target.files[0]) resizeAndUpload(e.target.files[0]); e.target.value = ""; }} />

            {fotolar.length === 0 ? (
              <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "8px 0" }}>
                Henüz fotoğraf eklenmedi
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {fotolar.map(f => (
                  <div key={f.id} style={{ aspectRatio: "1", borderRadius: 8, overflow: "hidden", cursor: "pointer" }}
                    onClick={() => setFotoView(f)}>
                    <img src={f.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {repair.notes && (
            <div className="card">
              <Row label="Not" value={repair.notes} />
            </div>
          )}
          {repair.customer_id && (
            <button className="btn btn-ghost" style={{ marginTop: 8 }}
              onClick={() => navigate(`/customers/${repair.customer_id}`)}>
              👤 Müşteri Detayı
            </button>
          )}
          {user?.role === "patron" && (
            <button className="btn btn-danger" style={{ marginTop: 8 }}
              onClick={async () => {
                if (confirm("Bu tamiri silmek istediğinize emin misiniz?")) {
                  await api.deleteRepair(id);
                  navigate("/repairs");
                }
              }}>
              🗑️ Sil
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="card-row" style={{ padding: "8px 0" }}>
      <span style={{ color: "var(--hint)", fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 500, maxWidth: "60%", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function DateRow({ icon, label, val, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", opacity: done ? 1 : 0.35 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: done ? "var(--accent)" : "var(--bg2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: done ? "var(--text)" : "var(--hint)" }}>
          {val ? fmtDate(val) : "—"}
        </div>
      </div>
    </div>
  );
}
