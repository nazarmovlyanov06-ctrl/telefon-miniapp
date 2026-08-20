import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { fotoUrl } from "../api";

// Ürünün kendi barkodu yoksa (üretici barkodu girilmemişse) id'den türetilen
// bir kod basılır — ayrıca saklanmaz, hem yazdırırken hem ararken aynı
// formülle (AKS + 6 haneli id) üretilip/çözülür.
export function barkotDegeri(item) {
  return item.barkot || `AKS${String(item.id).padStart(6, "0")}`;
}

export function BarkotSVG({ value }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, { format: "CODE128", width: 1.6, height: 42, fontSize: 12, margin: 4 });
    } catch { /* barkot kütüphanesinin desteklemediği bir karakter varsa boş bırak */ }
  }, [value]);
  return <svg ref={ref} />;
}

export const ETIKET_AYAR_VARSAYILAN = {
  etiket_genislik_mm: 40, etiket_yukseklik_mm: 30,
  etiket_logo_goster: false, etiket_kategori_goster: true, logo_url: null,
};

// Yazdırmadan hemen önce çağrılır — @page boyutu dükkanın Etiket Ayarları'nda
// seçtiği ölçüye göre anlık olarak enjekte edilir (statik CSS'te @page sabit
// olduğu için farklı dükkanların farklı etiket boyutu seçebilmesi başka
// türlü mümkün değildi).
export function etiketSayfaBoyutuAyarla(ayarlar) {
  const genislik = ayarlar?.etiket_genislik_mm || 40;
  const yukseklik = ayarlar?.etiket_yukseklik_mm || 30;
  let stil = document.getElementById("dinamik-etiket-boyutu");
  if (!stil) {
    stil = document.createElement("style");
    stil.id = "dinamik-etiket-boyutu";
    document.head.appendChild(stil);
  }
  stil.textContent = `@media print { @page { size: ${genislik}mm ${yukseklik}mm; margin: 0; } }`;
}

/** Basılacak/önizlenecek tek bir etiketin içeriği — ürün adı, fiyat, barkot,
 * ayarlara göre opsiyonel logo ve kategori. */
export function EtiketIcerik({ item, ayarlar = ETIKET_AYAR_VARSAYILAN }) {
  const kod = barkotDegeri(item);
  const logoGoster = ayarlar.etiket_logo_goster && ayarlar.logo_url;
  const kategoriGoster = ayarlar.etiket_kategori_goster !== false;
  return (
    <div className="etiket-tek">
      <div style={{
        background: "#fff", color: "#000", borderRadius: 10, padding: 10,
        textAlign: "center", border: "1px solid var(--divider)",
        width: `${ayarlar.etiket_genislik_mm || 40}mm`,
      }}>
        {logoGoster && (
          <img src={fotoUrl(ayarlar.logo_url)} alt="" style={{ height: 22, maxWidth: "70%", objectFit: "contain", marginBottom: 4 }} />
        )}
        {kategoriGoster && item.kategori && (
          <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 0.3 }}>{item.kategori}</div>
        )}
        <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.ad}</div>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 5 }}>{item.satis_fiyati}₺</div>
        <BarkotSVG value={kod} />
      </div>
    </div>
  );
}
