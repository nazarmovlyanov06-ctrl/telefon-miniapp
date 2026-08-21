import { fotoUrl } from "../api";
import { BarkotSVG } from "./UrunEtiketi";

const KILIT_ETIKET = { pin: "PIN", pattern: "Desen" };

function Satir({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 4, fontSize: 9.5, lineHeight: 1.35, marginBottom: 1.5 }}>
      <span style={{ color: "#666", flexShrink: 0 }}>{label}:</span>
      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function tarihFormat(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("tr-TR"); } catch { return ""; }
}

/** Tamir teslim-alma stikeri — cihazın arkasına yapıştırılıp teknisyene
 * verilmeden önce müşteri/arıza/kilit bilgisini taşır. Aksesuar etiketinden
 * farklı olarak sabit (sürüklenemez) satır listesi düzeninde; boyutu
 * (genislikMm/yukseklikMm) dükkanın Etiket Ayarları'ndan gelir. */
export function TamirEtiketi({ repair, ayarlar = {} }) {
  const genislikMm = ayarlar.etiket_tamir_genislik_mm || 70;
  const yukseklikMm = ayarlar.etiket_tamir_yukseklik_mm || 50;
  const logoGoster = ayarlar.etiket_logo_goster && ayarlar.logo_url;
  const kilitDeger = repair.screen_lock_type
    ? `${KILIT_ETIKET[repair.screen_lock_type] || repair.screen_lock_type}${repair.screen_lock_value ? ` · ${repair.screen_lock_value}` : ""}`
    : "";
  const kod = repair.repair_no || `TMR${String(repair.id).padStart(6, "0")}`;

  return (
    <div className="etiket-tek">
      <div style={{
        position: "relative", background: "#fff", color: "#000", padding: "6px 8px",
        boxSizing: "border-box", overflow: "hidden", display: "flex", flexDirection: "column",
        width: `${genislikMm}mm`, height: `${yukseklikMm}mm`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          {logoGoster && <img src={fotoUrl(ayarlar.logo_url)} alt="" style={{ width: 16, height: 16, objectFit: "contain", flexShrink: 0 }} />}
          <div style={{ fontWeight: 800, fontSize: 11 }}>{kod}</div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Satir label="Müşteri" value={repair.customer_name} />
          <Satir label="Telefon" value={repair.customer_phone} />
          <Satir label="Cihaz" value={repair.device_model} />
          <Satir label="Arıza" value={repair.fault_desc} />
          <Satir label="Ekran Kilidi" value={kilitDeger} />
          <Satir label="Geliş" value={tarihFormat(repair.created_at)} />
          <Satir label="Tahmini Teslim" value={tarihFormat(repair.tahmini_teslim_tarihi)} />
        </div>
        <div style={{ marginTop: 2, width: "100%", height: "9mm" }}>
          <BarkotSVG value={kod} />
        </div>
      </div>
    </div>
  );
}
