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
  etiket_cerceve_goster: true, etiket_ayirici_cizgi_goster: false,
  etiket_logo_x_pct: 50, etiket_logo_y_pct: 15,
  etiket_logo_genislik_mm: 15, etiket_logo_yukseklik_mm: 8,
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
 * ayarlara göre opsiyonel logo ve kategori.
 *
 * `duzenlenebilir` true verilirse logo sürüklenerek taşınabilir ve iki ayrı
 * tutamaçla (sağ kenar = genişlik, alt kenar = yükseklik) ORANSIZ olarak
 * yeniden boyutlandırılabilir — Etiket Ayarları sayfasındaki canlı düzenleyici
 * bunu kullanır, gerçek yazdırma/önizlemede bu prop hiç verilmez. */
export function EtiketIcerik({ item, ayarlar = ETIKET_AYAR_VARSAYILAN, duzenlenebilir = false, onLogoTasi, onLogoBoyutlandir }) {
  const kutuRef = useRef(null);
  const kod = barkotDegeri(item);
  const logoGoster = ayarlar.etiket_logo_goster && ayarlar.logo_url;
  const kategoriGoster = ayarlar.etiket_kategori_goster !== false;
  const cerceveGoster = ayarlar.etiket_cerceve_goster !== false;
  const ayiriciGoster = !!ayarlar.etiket_ayirici_cizgi_goster;
  const genislikMm = ayarlar.etiket_genislik_mm || 40;
  const yukseklikMm = ayarlar.etiket_yukseklik_mm || 30;
  const logoXPct = ayarlar.etiket_logo_x_pct ?? 50;
  const logoYPct = ayarlar.etiket_logo_y_pct ?? 15;
  const logoGenislikMm = ayarlar.etiket_logo_genislik_mm ?? 15;
  const logoYukseklikMm = ayarlar.etiket_logo_yukseklik_mm ?? 8;
  // Metin içeriği logonun altından başlasın diye kabaca yer ayrılır — logo
  // serbestçe taşınabildiği için bu tam bir metin sarma değil, makul bir
  // varsayılan boşluk.
  const ustBosluk = logoGoster ? Math.min((logoYPct / 100) * yukseklikMm + logoYukseklikMm / 2, yukseklikMm * 0.6) : 0;

  function pxMmOrani() {
    const rect = kutuRef.current.getBoundingClientRect();
    return { x: rect.width / genislikMm, y: rect.height / yukseklikMm, rect };
  }

  function logoSurukleBasla(e) {
    if (!duzenlenebilir) return;
    e.preventDefault(); e.stopPropagation();
    const { x: oranX, y: oranY, rect } = pxMmOrani();
    function hareket(ev) {
      const xPct = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      const yPct = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
      onLogoTasi && onLogoTasi(Math.round(xPct * 10) / 10, Math.round(yPct * 10) / 10);
    }
    function birak() {
      window.removeEventListener("pointermove", hareket);
      window.removeEventListener("pointerup", birak);
    }
    window.addEventListener("pointermove", hareket);
    window.addEventListener("pointerup", birak);
  }

  function boyutlandirBasla(eksen) {
    return function (e) {
      e.preventDefault(); e.stopPropagation();
      const { x: oranX, y: oranY } = pxMmOrani();
      const baslangicX = e.clientX, baslangicY = e.clientY;
      const baslangicGenislik = logoGenislikMm, baslangicYukseklik = logoYukseklikMm;
      function hareket(ev) {
        let yeniGenislik = baslangicGenislik, yeniYukseklik = baslangicYukseklik;
        if (eksen !== "yukseklik") yeniGenislik = Math.max(3, baslangicGenislik + (ev.clientX - baslangicX) / oranX);
        if (eksen !== "genislik") yeniYukseklik = Math.max(3, baslangicYukseklik + (ev.clientY - baslangicY) / oranY);
        onLogoBoyutlandir && onLogoBoyutlandir(Math.round(yeniGenislik * 10) / 10, Math.round(yeniYukseklik * 10) / 10);
      }
      function birak() {
        window.removeEventListener("pointermove", hareket);
        window.removeEventListener("pointerup", birak);
      }
      window.addEventListener("pointermove", hareket);
      window.addEventListener("pointerup", birak);
    };
  }

  return (
    <div className="etiket-tek">
      <div ref={kutuRef} style={{
        position: "relative", background: "#fff", color: "#000", borderRadius: 10, padding: 10,
        boxSizing: "border-box", textAlign: "center", overflow: duzenlenebilir ? "visible" : "hidden",
        border: cerceveGoster ? "1.5px solid #333" : "none",
        width: `${genislikMm}mm`, minHeight: `${yukseklikMm}mm`,
      }}>
        {logoGoster && (
          <div
            onPointerDown={logoSurukleBasla}
            style={{
              position: "absolute", left: `${logoXPct}%`, top: `${logoYPct}%`,
              transform: "translate(-50%, -50%)",
              width: `${logoGenislikMm}mm`, height: `${logoYukseklikMm}mm`,
              cursor: duzenlenebilir ? "move" : "default",
              outline: duzenlenebilir ? "1px dashed #3b82f6" : "none",
            }}>
            <img src={fotoUrl(ayarlar.logo_url)} alt=""
              style={{ width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none", display: "block" }} />
            {duzenlenebilir && (
              <>
                <div onPointerDown={boyutlandirBasla("genislik")} title="Enine boyutlandır"
                  style={{ position: "absolute", right: -5, top: "50%", transform: "translateY(-50%)", width: 9, height: 22, borderRadius: 3, background: "#3b82f6", cursor: "ew-resize" }} />
                <div onPointerDown={boyutlandirBasla("yukseklik")} title="Boyuna boyutlandır"
                  style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 22, height: 9, borderRadius: 3, background: "#3b82f6", cursor: "ns-resize" }} />
              </>
            )}
          </div>
        )}
        <div style={{ paddingTop: ustBosluk ? `${ustBosluk}mm` : 0 }}>
          {kategoriGoster && item.kategori && (
            <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 0.3 }}>{item.kategori}</div>
          )}
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.ad}</div>
          {ayiriciGoster && <div style={{ borderTop: "1px solid #ccc", margin: "4px 6px" }} />}
          <div style={{ fontWeight: 800, fontSize: 16, marginTop: ayiriciGoster ? 4 : 0, marginBottom: 5 }}>{item.satis_fiyati}₺</div>
          <BarkotSVG value={kod} />
        </div>
      </div>
    </div>
  );
}
