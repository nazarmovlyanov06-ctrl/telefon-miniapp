import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fotoUrl } from "../api";
import { PatternPreview } from "../components/PatternLock";
import {
  Pencil, Home, CheckCircle2, Receipt, Copy, Check, MessageCircle,
  Trash2, Lock, Eye, EyeOff, Calendar, ClipboardList,
  Wrench, Camera, User, X, CircleX, Search, FileClock, Package, QrCode,
  TriangleAlert, UserCheck, RotateCcw, PowerOff,
} from "lucide-react";

const STATUSES = [
  { key: "bekliyor", label: "Bekliyor" },
  { key: "tamirde", label: "Tamirde" },
  { key: "parca_bekleniyor", label: "Parça Bekleniyor" },
  { key: "hazir", label: "Hazır" },
  { key: "teslim", label: "Teslim Edildi" },
  { key: "iptal", label: "İptal" },
];

// Durum akışı: "bekliyor"dan doğrudan "hazır"/"teslim"e atlanamaz — önce
// "tamirde"den geçmesi gerekir. Backend de aynı kuralı zorluyor (repairs.py
// DURUM_SIRASI), burası sadece kullanıcıya erişilemeyen durumları gri
// göstermek için.
const DURUM_SIRASI = {
  bekliyor: ["tamirde", "iptal"],
  tamirde: ["parca_bekleniyor", "hazir", "iptal"],
  parca_bekleniyor: ["tamirde", "hazir", "iptal"],
  hazir: ["teslim", "tamirde", "iptal"],
  teslim: [],
  iptal: [],
};

// Cihaz teslim alma muayenesi — eski "kontrol listesi" (ön ödeme/müşteri
// onayı/eski parça verildi) tamir öncesi mantıksızdı ("henüz tamire
// girmemiş parçayı nasıl versin"). Yerine cihazın GELİŞ durumunu belgeleyen
// bu form geldi: gelen aksesuarlar + hangi fonksiyonlar çalışıyor/çalışmıyor
// + cihaz açılmıyorsa test edilemediği notu.
const FONKSIYON_LISTESI = [
  "Ekran", "Dokunmatik", "Kamera", "Ön Kamera", "Hoparlör",
  "Mikrofon", "Şarj", "Wifi / Bluetooth", "Sinyal / Şebeke", "Tuşlar",
];
const AKSESUAR_LISTESI = [
  { key: "kilif", label: "Kılıf" },
  { key: "sarj_aleti", label: "Şarj Aleti / Kablo" },
  { key: "kutu", label: "Kutu" },
  { key: "hafiza_karti", label: "Hafıza Kartı" },
  { key: "sim_kart", label: "SIM Kart" },
  { key: "kulaklik", label: "Kulaklık" },
];

const IADE_KALEMLERI = [
  { key: "cihaz", label: "Cihaz" },
  { key: "sim", label: "SIM kart" },
  { key: "hafiza_karti", label: "Hafıza kartı" },
  { key: "aksesuar", label: "Aksesuar / kılıf" },
];

// Formdaki fiyat/garanti alanları <input> onChange'de string olarak
// tutuluyor ("" dahil); bunlar backend'e olduğu gibi (string) gidince
// PostgreSQL REAL/INTEGER kolonlarına yazılamayıp istek sessizce başarısız
// oluyordu (durum butonları ve "Kaydet" hiçbir şey yapmıyormuş gibi
// görünüyordu). Göndermeden önce sayıya çevriliyor.
function sayisalTemizle(form) {
  return {
    ...form,
    estimated_price: form.estimated_price === "" || form.estimated_price == null ? null : parseFloat(form.estimated_price),
    final_price: form.final_price === "" || form.final_price == null ? null : parseFloat(form.final_price),
    warranty_days: form.warranty_days === "" || form.warranty_days == null ? 0 : parseInt(form.warranty_days),
  };
}

const DATE_ICONS = {
  acildi: FileClock,
  tamirde: Wrench,
  hazir: CheckCircle2,
  teslim: Home,
};

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
  const [teslimForm, setTeslimForm] = useState({
    final_price: "", payment_type: "nakit", kasa_yazilsin: true,
    teslim_alan_ad: "", teslim_alan_tel: "",
  });

  // İptal — iade edilen kalemler + kime iade edildiği
  const [iptalModal, setIptalModal] = useState(false);
  const [iptalForm, setIptalForm] = useState({ kalemler: {}, kime_ad: "", kime_tel: "", aciklama: "" });
  const [iptalSaving, setIptalSaving] = useState(false);
  const [iptalHata, setIptalHata] = useState("");

  // Muayene onaylanmadan "Tamirde"ye geçilemez — uyarı için
  const [kontrolUyari, setKontrolUyari] = useState(false);
  const kontrolRef = useRef(null);
  // Cihaz teslim alma muayenesi
  const [intake, setIntake] = useState({ kapali: false, notu: "", fonksiyonlar: {}, aksesuarlar: {} });
  const [intakeSaving, setIntakeSaving] = useState(false);

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

  // Dijital fiş / QR
  const [qrModal, setQrModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [dukkanSlug, setDukkanSlug] = useState(null);

  // Ekran kilidi göster/gizle
  const [showLock, setShowLock] = useState(false);

  // Durum değişikliği "geri al" bildirimi — yanlışlıkla tıklanan durum
  // butonu anında kaydedildiği için kullanıcı geri çıkınca fark edip
  // düzeltmesi zor oluyordu; birkaç saniye geri alma şansı veriyoruz.
  const [geriAlToast, setGeriAlToast] = useState(null);
  const geriAlTimerRef = useRef(null);

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
      // asyncpg jsonb kolonlarını ham JSON metni olarak döndürür, parse gerekiyor.
      let fonksiyonlar = {}, aksesuarlar = {};
      try { fonksiyonlar = r.intake_fonksiyonlar ? JSON.parse(r.intake_fonksiyonlar) : {}; } catch { /* eski/boş veri */ }
      try { aksesuarlar = r.intake_aksesuarlar ? JSON.parse(r.intake_aksesuarlar) : {}; } catch { /* eski/boş veri */ }
      setIntake({ kapali: !!r.intake_kapali, notu: r.intake_notu || "", fonksiyonlar, aksesuarlar });
    }).finally(() => setLoading(false));
    api.vitrinAyarlarim().then(r => setDukkanSlug(r.slug)).catch(() => {});
  }, [id]);

  async function changeStatus(status) {
    const onceki = repair?.status;
    if (onceki === status) return;
    if (!DURUM_SIRASI[onceki]?.includes(status)) return; // buton zaten disabled ama garanti olsun

    if (status === "teslim") {
      setTeslimModal(true);
      return;
    }
    if (status === "iptal") {
      setIptalForm({ kalemler: {}, kime_ad: "", kime_tel: "", aciklama: "" });
      setIptalHata("");
      setIptalModal(true);
      return;
    }
    if (onceki === "bekliyor" && status === "tamirde" && !repair.intake_onaylandi) {
      setKontrolUyari(true);
      kontrolRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setKontrolUyari(false), 1800);
      return;
    }

    setSaving(true);
    try {
      await api.updateRepairStatus(id, status);
      setRepair((r) => ({ ...r, status }));
      setForm((f) => ({ ...f, status }));
      clearTimeout(geriAlTimerRef.current);
      setGeriAlToast({ onceki, yeni: status });
      geriAlTimerRef.current = setTimeout(() => setGeriAlToast(null), 5000);
    } catch (e) {
      alert(e.message || "Durum değiştirilemedi");
    } finally { setSaving(false); }
  }

  async function iptalOnayla() {
    if (!iptalForm.kime_ad.trim()) {
      setIptalHata("Cihazın kime iade edildiğini girin");
      return;
    }
    setIptalSaving(true);
    setIptalHata("");
    try {
      await api.updateRepairStatus(id, "iptal", { iade: iptalForm });
      setRepair(r => ({ ...r, status: "iptal" }));
      setForm(f => ({ ...f, status: "iptal" }));
      setIptalModal(false);
      clearTimeout(geriAlTimerRef.current);
      setGeriAlToast({ onceki: repair.status, yeni: "iptal" });
      geriAlTimerRef.current = setTimeout(() => setGeriAlToast(null), 5000);
    } catch (e) {
      setIptalHata(e.message || "İptal edilemedi");
    } finally { setIptalSaving(false); }
  }

  async function durumGeriAl() {
    if (!geriAlToast) return;
    const { onceki } = geriAlToast;
    clearTimeout(geriAlTimerRef.current);
    setGeriAlToast(null);
    setSaving(true);
    try {
      await api.updateRepairStatus(id, onceki, { zorla: true });
      setRepair((r) => ({ ...r, status: onceki }));
      setForm((f) => ({ ...f, status: onceki }));
    } catch (e) {
      alert(e.message || "Geri alınamadı");
    } finally { setSaving(false); }
  }

  async function intakeGuncelle(partial) {
    const yeni = { ...intake, ...partial };
    setIntake(yeni);
    setIntakeSaving(true);
    try {
      await api.updateRepairIntake(id, partial);
    } catch (e) {
      alert(e.message || "Güncellenemedi");
      setIntake(intake); // başarısızsa eski haline geri al
    } finally { setIntakeSaving(false); }
  }

  function fonksiyonAyarla(ad, deger) {
    const guncelDeger = intake.fonksiyonlar[ad] === deger ? null : deger; // aynı değere tekrar basınca temizle
    const fonksiyonlar = { ...intake.fonksiyonlar, [ad]: guncelDeger };
    intakeGuncelle({ fonksiyonlar });
  }

  function aksesuarToggle(anahtar) {
    const aksesuarlar = { ...intake.aksesuarlar, [anahtar]: !intake.aksesuarlar[anahtar] };
    intakeGuncelle({ aksesuarlar });
  }

  async function intakeOnayla() {
    setIntakeSaving(true);
    try {
      await api.onaylaRepairIntake(id);
      setRepair(r => ({ ...r, intake_onaylandi: true }));
    } catch (e) {
      alert(e.message || "Onaylanamadı");
    } finally { setIntakeSaving(false); }
  }

  function teslimAlanAyniKisi() {
    setTeslimForm(f => ({ ...f, teslim_alan_ad: repair.customer_name || "", teslim_alan_tel: repair.customer_phone || "" }));
  }

  async function teslimEt() {
    setSaving(true);
    try {
      const final = parseFloat(teslimForm.final_price) || 0;
      await api.updateRepair(id, sayisalTemizle({
        ...form, status: "teslim", final_price: final,
        payment_type: teslimForm.payment_type,
        kasa_yazilsin: teslimForm.kasa_yazilsin && final > 0,
        teslim_alan_ad: teslimForm.teslim_alan_ad || repair.customer_name || null,
        teslim_alan_tel: teslimForm.teslim_alan_tel || repair.customer_phone || null,
      }));
      setRepair(r => ({ ...r, status: "teslim", final_price: final, payment_type: teslimForm.payment_type }));
      setForm(f => ({ ...f, status: "teslim", final_price: final, payment_type: teslimForm.payment_type }));
      setTeslimModal(false);
    } catch (e) {
      alert(e.message || "Teslim işlemi başarısız");
    } finally { setSaving(false); }
  }

  async function save() {
    setSaving(true);
    try {
      const payload = sayisalTemizle(form);
      await api.updateRepair(id, payload);
      setRepair((r) => ({ ...r, ...payload }));
      setEdit(false);
    } catch (e) {
      alert(e.message || "Kaydedilemedi");
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
      setParcaQ("");
      setParcaEkleOpen(false);
      // Parcaları yenile
      api.repairParcalar(id).then(setParcalar).catch(() => {});
      // Stok listesini ayrı yenile (hata olursa parcaları etkilemesin)
      api.parts().then(setPartsList).catch(() => {});
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

  // ── FİŞ (müşteriye giden düz metin — uygulama arayüzü değil) ──

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
  // asyncpg jsonb kolonunu ham JSON metni olarak döndürür, parse gerekiyor.
  let durumDetay = null;
  if (repair.durum_detay) {
    try { durumDetay = JSON.parse(repair.durum_detay); } catch { durumDetay = null; }
  }

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/repairs")}>← Geri</button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>#{repair.repair_no}</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setEdit(!edit)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {edit ? "İptal" : <><Pencil size={13} strokeWidth={2} /> Düzenle</>}
        </button>
      </div>

      {/* Durum butonları — mevcut durumdan doğrudan erişilemeyenler gri/pasif */}
      <div className="section-title">Durum</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {STATUSES.map((s) => {
          const aktifDurum = form.status || repair.status;
          const buDurum = s.key === aktifDurum;
          const erisilebilir = buDurum || (DURUM_SIRASI[aktifDurum] || []).includes(s.key);
          return (
            <button key={s.key}
              className={`tab ${buDurum ? "active" : ""}`}
              onClick={() => changeStatus(s.key)}
              disabled={saving || !erisilebilir}
              title={!erisilebilir ? `'${STATUSES.find(x => x.key === aktifDurum)?.label}' durumundan doğrudan geçilemez` : undefined}
              style={{ fontSize: 12, opacity: erisilebilir ? 1 : 0.35, cursor: erisilebilir ? "pointer" : "not-allowed" }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Durum değişikliği geri alma bildirimi */}
      {geriAlToast && (
        <div style={{
          position: "fixed", left: 16, right: 16, bottom: 84, zIndex: 250,
          maxWidth: 448, margin: "0 auto",
          background: "linear-gradient(135deg, var(--surf-hi), var(--surf-lo))",
          boxShadow: "var(--edge-lit), var(--edge-dark), var(--lift)",
          borderRadius: 12, padding: "10px 12px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 12.5, flex: 1, color: "var(--text)" }}>
            Durum <b>{STATUSES.find(s => s.key === geriAlToast.yeni)?.label}</b> yapıldı
          </span>
          <button onClick={durumGeriAl} disabled={saving}
            style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 700, fontSize: 12.5, cursor: "pointer", flexShrink: 0 }}>
            Geri Al
          </button>
          <button onClick={() => { clearTimeout(geriAlTimerRef.current); setGeriAlToast(null); }}
            style={{ background: "none", border: "none", color: "var(--hint)", cursor: "pointer", display: "flex", flexShrink: 0 }}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Teslim modalı */}
      {teslimModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 400, maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Home size={16} strokeWidth={2} /> Teslim Et
            </div>
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
                <option value="nakit">Nakit</option>
                <option value="kart">Kart</option>
                <option value="taksit">Taksit</option>
                <option value="borc">Borç</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <input type="checkbox" id="kasaYazilsin"
                checked={teslimForm.kasa_yazilsin}
                onChange={e => setTeslimForm(f => ({ ...f, kasa_yazilsin: e.target.checked }))} />
              <label htmlFor="kasaYazilsin" style={{ fontSize: 14 }}>Kasaya yaz</label>
            </div>

            <div className="form-group">
              <label className="form-label">Kime Teslim Edildi</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={teslimAlanAyniKisi}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <UserCheck size={13} strokeWidth={2} /> Aynı Kişi ({repair.customer_name || "—"})
                </button>
                <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => setTeslimForm(f => ({ ...f, teslim_alan_ad: "", teslim_alan_tel: "" }))}
                  style={{ flex: 1 }}>
                  Farklı Kişi
                </button>
              </div>
              <input className="form-input" placeholder="Teslim alan kişi — ad soyad" style={{ marginBottom: 8 }}
                value={teslimForm.teslim_alan_ad}
                onChange={e => setTeslimForm(f => ({ ...f, teslim_alan_ad: e.target.value }))} />
              <input className="form-input" placeholder="Telefon (opsiyonel)" type="tel"
                value={teslimForm.teslim_alan_tel}
                onChange={e => setTeslimForm(f => ({ ...f, teslim_alan_tel: e.target.value }))} />
            </div>

            {teslimForm.final_price && (
              <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
                {parseFloat(teslimForm.final_price).toLocaleString("tr-TR")}₺ · {teslimForm.payment_type}
                {teslimForm.kasa_yazilsin && " · kasaya yazılacak"}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={teslimEt} disabled={saving} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {saving ? "..." : <><CheckCircle2 size={15} strokeWidth={2} /> Teslim Et</>}
              </button>
              <button className="btn btn-ghost" onClick={() => setTeslimModal(false)}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* İptal modalı — iade edilen kalemler + kime iade edildiği */}
      {iptalModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, display: "flex", alignItems: "center", gap: 8, color: "var(--danger)" }}>
              <CircleX size={16} strokeWidth={2} /> Tamiri İptal Et
            </div>
            <div style={{ fontSize: 12.5, color: "var(--hint)", marginBottom: 14 }}>
              Müşteriye iade edilen eşyaları işaretleyin ve cihazın kime teslim edildiğini girin.
            </div>

            <div className="form-group">
              <label className="form-label">İade Edilen Eşyalar</label>
              {IADE_KALEMLERI.map(k => {
                const secili = !!iptalForm.kalemler[k.key];
                return (
                  <div key={k.key} onClick={() => setIptalForm(f => ({ ...f, kalemler: { ...f.kalemler, [k.key]: !secili } }))}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer" }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${secili ? "var(--danger)" : "var(--divider)"}`,
                      background: secili ? "var(--danger)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#191b20",
                    }}>
                      {secili ? <Check size={14} strokeWidth={3} /> : null}
                    </div>
                    <span style={{ fontSize: 13.5 }}>{k.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="form-group">
              <label className="form-label">Kime İade Edildi *</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => setIptalForm(f => ({ ...f, kime_ad: repair.customer_name || "", kime_tel: repair.customer_phone || "" }))}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <UserCheck size={13} strokeWidth={2} /> Aynı Kişi ({repair.customer_name || "—"})
                </button>
                <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => setIptalForm(f => ({ ...f, kime_ad: "", kime_tel: "" }))} style={{ flex: 1 }}>
                  Farklı Kişi
                </button>
              </div>
              <input className="form-input" placeholder="Ad Soyad" style={{ marginBottom: 8 }}
                value={iptalForm.kime_ad}
                onChange={e => setIptalForm(f => ({ ...f, kime_ad: e.target.value }))} />
              <input className="form-input" placeholder="Telefon (opsiyonel)" type="tel"
                value={iptalForm.kime_tel}
                onChange={e => setIptalForm(f => ({ ...f, kime_tel: e.target.value }))} />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Açıklama (opsiyonel)</label>
              <input className="form-input" placeholder="İptal sebebi vb."
                value={iptalForm.aciklama}
                onChange={e => setIptalForm(f => ({ ...f, aciklama: e.target.value }))} />
            </div>

            {iptalHata && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{iptalHata}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-danger" onClick={iptalOnayla} disabled={iptalSaving}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {iptalSaving ? "..." : <><CircleX size={15} strokeWidth={2} /> İptal Et</>}
              </button>
              <button className="btn btn-ghost" onClick={() => setIptalModal(false)}>Vazgeç</button>
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
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Receipt size={16} strokeWidth={2} /> Tamir Fişi
            </div>
            <pre style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", background: "var(--bg2)", padding: 12, borderRadius: 8, marginBottom: 12 }}>
              {generateFis()}
            </pre>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={copyFis}>
                {copied ? <><Check size={14} strokeWidth={2.4} /> Kopyalandı!</> : <><Copy size={14} strokeWidth={2} /> Kopyala</>}
              </button>
              {repair.customer_phone && (
                <button className="btn btn-ghost" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  onClick={() => openWhatsApp(generateFis())}>
                  <MessageCircle size={14} strokeWidth={2} /> WhatsApp
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setFisModal(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* Dijital fiş / QR modal */}
      {qrModal && dukkanSlug && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16 }}
          onClick={() => setQrModal(false)}>
          <div className="card" style={{ width: "100%", maxWidth: 380, textAlign: "center" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <QrCode size={16} strokeWidth={2} /> Dijital Fiş
            </div>
            <div style={{ fontSize: 12.5, color: "var(--hint)", marginBottom: 12 }}>
              Müşteri bu kodu okutup telefon numarasını girerek tamir fişini görüntüleyebilir.
            </div>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`${window.location.origin}/magaza/${dukkanSlug}/fis/${repair.repair_no}`)}`}
              alt="QR" width={220} height={220} style={{ borderRadius: 8, marginBottom: 12, background: "#fff", padding: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}/magaza/${dukkanSlug}/fis/${repair.repair_no}`);
                    setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000);
                  } catch {}
                }}>
                {linkCopied ? <><Check size={14} strokeWidth={2.4} /> Kopyalandı!</> : <><Copy size={14} strokeWidth={2} /> Linki Kopyala</>}
              </button>
              <button className="btn btn-ghost" onClick={() => setQrModal(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* Fotoğraf büyük görünüm */}
      {fotoView && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
          onClick={() => setFotoView(null)}>
          <img src={fotoUrl(fotoView.foto)} alt="" style={{ maxWidth: "95%", maxHeight: "80vh", borderRadius: 8, objectFit: "contain" }} onClick={e => e.stopPropagation()} />
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); deleteFoto(fotoView.id); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Trash2 size={13} strokeWidth={2} /> Sil
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
              <option value="nakit">Nakit</option>
              <option value="kart">Kart</option>
              <option value="taksit">Taksit</option>
              <option value="borc">Borç</option>
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
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      ) : (
        <>
          {/* İptal / teslim ek bilgisi */}
          {durumDetay && (repair.status === "iptal" || isTeslim) && (
            <div className="card" style={{
              borderLeft: `3px solid ${repair.status === "iptal" ? "var(--danger)" : "var(--green)"}`,
              background: repair.status === "iptal" ? "rgba(248,113,113,0.06)" : "rgba(74,222,128,0.06)",
            }}>
              {repair.status === "iptal" ? (
                <>
                  <Row label="Kime İade Edildi" value={durumDetay.iade_kime_ad || "—"} />
                  {durumDetay.iade_kime_tel && <><div className="divider" /><Row label="Telefon" value={durumDetay.iade_kime_tel} /></>}
                  {durumDetay.iade_kalemler && Object.values(durumDetay.iade_kalemler).some(Boolean) && (
                    <>
                      <div className="divider" />
                      <Row label="İade Edilenler" value={
                        IADE_KALEMLERI.filter(k => durumDetay.iade_kalemler[k.key]).map(k => k.label).join(", ") || "—"
                      } />
                    </>
                  )}
                  {durumDetay.aciklama && <><div className="divider" /><Row label="Açıklama" value={durumDetay.aciklama} /></>}
                </>
              ) : (
                <Row label="Kime Teslim Edildi" value={durumDetay.teslim_alan_ad || repair.customer_name || "—"} />
              )}
            </div>
          )}

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
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Pencil size={11} strokeWidth={2} /> Son düzenleyen</span>
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>{repair.son_guncelleyen_adi}</span>
                </div>
              </>
            )}
          </div>

          {/* Ekran kilidi */}
          {repair.screen_lock_type && (
            <div className="card" style={{ background: "rgba(94,168,255,0.08)", borderLeft: "3px solid var(--blue)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Lock size={22} stroke="var(--blue)" strokeWidth={1.8} />
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
                    padding: "7px 14px", borderRadius: 20, border: "1.5px solid var(--blue)",
                    background: showLock ? "var(--blue)" : "transparent",
                    color: showLock ? "#191b20" : "var(--blue)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {showLock ? <><EyeOff size={14} strokeWidth={2} /> Gizle</> : <><Eye size={14} strokeWidth={2} /> Göster</>}
                </button>
              </div>

              {showLock && (
                <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                  {repair.screen_lock_type === "pin" ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 8, color: "var(--blue)", fontFamily: "monospace" }}>
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

          {/* Cihaz Teslim Alma Muayenesi — sadece "Bekliyor" durumunda ve
              onaylanmadan önce değiştirilebilir; "Tamirde"ye geçmeden önce
              onaylanması zorunlu, onaylanınca kilitlenir. */}
          <div ref={kontrolRef} tabIndex={-1}
            className={"card" + (kontrolUyari ? " alan-hata" : "")}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: "var(--hint)", display: "flex", alignItems: "center", gap: 7 }}>
              <ClipboardList size={14} strokeWidth={2} /> CİHAZ MUAYENESİ
              {repair.intake_onaylandi && (
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--green)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Lock size={11} strokeWidth={2} /> Onaylandı
                </span>
              )}
            </div>
            {!repair.intake_onaylandi && repair.status === "bekliyor" && (
              <div style={{ fontSize: 11.5, color: "var(--hint)", marginBottom: 10 }}>
                Cihazın geliş durumunu kaydedip onaylayın — "Tamirde"ye geçmeden önce zorunlu.
              </div>
            )}
            {kontrolUyari && (
              <div style={{ fontSize: 12.5, color: "var(--danger)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <TriangleAlert size={13} strokeWidth={2} /> Tamire almadan önce cihaz muayenesini tamamlayıp onaylayın
              </div>
            )}

            {(() => {
              const kilitli = repair.intake_onaylandi || repair.status !== "bekliyor";
              return (
                <div style={{ opacity: kilitli ? 0.8 : 1 }}>
                  <div onClick={() => !kilitli && intakeGuncelle({ kapali: !intake.kapali })}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 11px", borderRadius: 10, marginBottom: 10,
                      border: `1.5px solid ${intake.kapali ? "var(--orange)" : "var(--divider)"}`,
                      background: intake.kapali ? "rgba(246,162,74,0.08)" : "transparent",
                      cursor: kilitli ? "default" : "pointer",
                    }}>
                    <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, color: intake.kapali ? "var(--orange)" : "var(--text)" }}>
                      <PowerOff size={14} strokeWidth={2} /> Cihaz açılmıyor / test edilemiyor
                    </span>
                    <div style={{
                      width: 40, height: 23, borderRadius: 12, flexShrink: 0,
                      background: intake.kapali ? "var(--orange)" : "var(--border)",
                      position: "relative", transition: "background 0.2s",
                    }}>
                      <div style={{
                        position: "absolute", top: 2.5, left: intake.kapali ? 19 : 2.5,
                        width: 18, height: 18, borderRadius: "50%", background: "#fff",
                        transition: "left 0.2s",
                      }} />
                    </div>
                  </div>

                  {!intake.kapali && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--hint)", marginBottom: 6 }}>FONKSİYONLAR</div>
                      {FONKSIYON_LISTESI.map(ad => {
                        const durum = intake.fonksiyonlar[ad];
                        return (
                          <div key={ad} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
                            <span style={{ fontSize: 13, color: "var(--text)" }}>{ad}</span>
                            <div style={{ display: "flex", gap: 5 }}>
                              <button type="button" disabled={kilitli} onClick={() => fonksiyonAyarla(ad, "calisiyor")}
                                style={{
                                  width: 28, height: 28, borderRadius: 8, border: "none", cursor: kilitli ? "default" : "pointer",
                                  background: durum === "calisiyor" ? "var(--green)" : "var(--bg2)",
                                  color: durum === "calisiyor" ? "#191b20" : "var(--hint)",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                <Check size={14} strokeWidth={2.6} />
                              </button>
                              <button type="button" disabled={kilitli} onClick={() => fonksiyonAyarla(ad, "calismiyor")}
                                style={{
                                  width: 28, height: 28, borderRadius: 8, border: "none", cursor: kilitli ? "default" : "pointer",
                                  background: durum === "calismiyor" ? "var(--danger)" : "var(--bg2)",
                                  color: durum === "calismiyor" ? "#191b20" : "var(--hint)",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                <X size={14} strokeWidth={2.6} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--hint)", marginBottom: 6 }}>GELEN AKSESUARLAR</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {AKSESUAR_LISTESI.map(a => {
                        const secili = !!intake.aksesuarlar[a.key];
                        return (
                          <button key={a.key} type="button" disabled={kilitli} onClick={() => aksesuarToggle(a.key)}
                            style={{
                              padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                              cursor: kilitli ? "default" : "pointer",
                              border: `1px solid ${secili ? "var(--blue)" : "var(--divider)"}`,
                              background: secili ? "rgba(94,168,255,0.12)" : "transparent",
                              color: secili ? "var(--blue)" : "var(--hint)",
                            }}>
                            {a.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: kilitli ? 0 : 10 }}>
                    <label className="form-label">Not</label>
                    <input className="form-input" placeholder="Ör. arka kapak çatlak, ekranda çizik var..."
                      value={intake.notu} disabled={kilitli}
                      onChange={e => setIntake(i => ({ ...i, notu: e.target.value }))}
                      onBlur={() => !kilitli && intakeGuncelle({ notu: intake.notu })} />
                  </div>

                  {!kilitli && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={intakeOnayla} disabled={intakeSaving}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <CheckCircle2 size={14} strokeWidth={2} /> {intakeSaving ? "..." : "Muayeneyi Onayla"}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Tarihler */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "var(--hint)", display: "flex", alignItems: "center", gap: 7 }}>
              <Calendar size={14} strokeWidth={2} /> TARİHLER
            </div>
            <DateRow icon={DATE_ICONS.acildi} label="Kayıt Açıldı" val={repair.created_at} done />
            <DateRow icon={DATE_ICONS.tamirde} label="Tamire Alındı" val={repair.tamirde_at} done={!!repair.tamirde_at} />
            <DateRow icon={DATE_ICONS.hazir} label="Hazır Oldu" val={repair.completed_at} done={!!repair.completed_at} />
            <DateRow icon={DATE_ICONS.teslim} label="Teslim Edildi" val={repair.delivered_at} done={!!repair.delivered_at} />
          </div>

          {/* Aksiyonlar */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            {(isHazir || isTeslim) && repair.customer_phone && (
              <button className="btn btn-ghost btn-sm"
                style={{ background: "#25D366", color: "#fff", border: "none", display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => openWhatsApp(
                  isHazir
                    ? `Merhaba ${repair.customer_name || ""},\n\n${repair.device_model} cihazınızın tamiri tamamlandı. Servisimizden teslim alabilirsiniz. ✅`
                    : `Merhaba ${repair.customer_name || ""},\n\nTamiriniz (#${repair.repair_no}) ile ilgili bilgi almak ister misiniz?`
                )}>
                <MessageCircle size={13} strokeWidth={2} /> WhatsApp{isHazir ? " - Hazır" : ""}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setFisModal(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Receipt size={13} strokeWidth={2} /> Fiş
            </button>
            {dukkanSlug && (
              <button className="btn btn-ghost btn-sm" onClick={() => setQrModal(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <QrCode size={13} strokeWidth={2} /> Dijital Fiş / QR
              </button>
            )}
          </div>

          {/* Kullanılan Parçalar */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--hint)", display: "flex", alignItems: "center", gap: 7 }}>
                <Package size={14} strokeWidth={2} /> KULLANILAN PARÇALAR
              </div>
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
                          background: "rgba(94,168,255,0.1)", borderRadius: 8, padding: "8px 10px",
                          border: "1.5px solid var(--blue)" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{secP.name}</div>
                            <div style={{ fontSize: 11, color: "var(--hint)" }}>
                              {secP.device_model ? `${secP.device_model} · ` : ""}{secP.quantity} stok
                            </div>
                          </div>
                          <button type="button"
                            onClick={() => { setParcaForm(f => ({ ...f, part_id: "" })); setParcaQ(""); setParcaHata(""); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex" }}>
                            <X size={15} strokeWidth={2} />
                          </button>
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
                          <div className="inset" style={{ borderRadius: 10, display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
                            <Search size={14} stroke="var(--hint)" strokeWidth={2} />
                            <input style={{ background: "none", border: "none", outline: "none", color: "var(--text)", font: "inherit", fontSize: 14, flex: 1 }}
                              placeholder="Parça ara..."
                              value={parcaQ}
                              onChange={e => { setParcaQ(e.target.value); setShowParcaOner(true); }}
                              onFocus={() => setShowParcaOner(true)}
                              onBlur={() => setTimeout(() => setShowParcaOner(false), 150)}
                              autoComplete="off" />
                          </div>
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
                                  style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--divider)" }}>
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
                    <div style={{ color: "var(--red)", fontSize: 13, marginTop: 8, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <CircleX size={14} strokeWidth={2} /> {parcaHata}
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
                      <span style={{ fontWeight: 700, color: "var(--blue)" }}>{fmt(p.quantity * p.unit_price)}₺</span>
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)", padding: "2px 6px", display: "flex" }}
                        onClick={() => removeParca(p.id)}><X size={14} strokeWidth={2} /></button>
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
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--hint)", display: "flex", alignItems: "center", gap: 7 }}>
                <Camera size={14} strokeWidth={2} /> FOTOĞRAFLAR
              </div>
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
                    <img src={fotoUrl(f.foto)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
            <button className="btn btn-ghost" style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
              onClick={() => navigate(`/customers/${repair.customer_id}`)}>
              <User size={15} strokeWidth={2} /> Müşteri Detayı
            </button>
          )}
          {user?.rol === "patron" && (
            <button className="btn btn-danger" style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
              onClick={async () => {
                if (confirm("Bu tamiri silmek istediğinize emin misiniz?")) {
                  await api.deleteRepair(id);
                  navigate("/repairs");
                }
              }}>
              <Trash2 size={14} strokeWidth={2} /> Sil
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

function DateRow({ icon: Icon, label, val, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", opacity: done ? 1 : 0.35 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: done ? "var(--blue)" : "var(--bg2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon size={15} stroke={done ? "#191b20" : "var(--hint)"} strokeWidth={2} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: done ? "var(--text)" : "var(--hint)" }}>
          {val ? fmtDate(val) : "—"}
        </div>
      </div>
    </div>
  );
}
