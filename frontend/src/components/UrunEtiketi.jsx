import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { fotoUrl } from "../api";

// Ürünün kendi barkodu yoksa (üretici barkodu girilmemişse) id'den türetilen
// bir kod basılır — ayrıca saklanmaz, hem yazdırırken hem ararken aynı
// formülle (önek + 6 haneli id) üretilip/çözülür. Önek modüle göre değişir
// (Aksesuar: AKS, Parça: PRC, ...) — aksi halde farklı tablolardaki aynı
// id'li kayıtlar aynı barkodu üretip yanlış üründe eşleşebilirdi.
export function barkotDegeri(item, onEk = "AKS") {
  return item.barkot || `${onEk}${String(item.id).padStart(6, "0")}`;
}

// Barkot sabit bir doğal boyutta üretilir, sonra viewBox ile kapsayan
// kutunun tam boyutuna (genişlik/yükseklik bağımsız) esnetilir — bu sayede
// kutu sürükle/boyutlandır editöründe ne boyuta çekilirse çekilsin barkot
// her zaman kutuyu tam dolduruyor, asla taşmıyor.
export function BarkotSVG({ value }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, { format: "CODE128", width: 1.8, height: 40, fontSize: 11, margin: 2 });
      const w = ref.current.getAttribute("width");
      const h = ref.current.getAttribute("height");
      if (w && h) {
        ref.current.setAttribute("viewBox", `0 0 ${w} ${h}`);
        ref.current.setAttribute("preserveAspectRatio", "none");
        ref.current.removeAttribute("width");
        ref.current.removeAttribute("height");
      }
    } catch { /* barkot kütüphanesinin desteklemediği bir karakter varsa boş bırak */ }
  }, [value]);
  return <svg ref={ref} style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }} />;
}

export const ETIKET_AYAR_VARSAYILAN = {
  etiket_genislik_mm: 40, etiket_yukseklik_mm: 30,
  etiket_logo_goster: false, etiket_kategori_goster: true, logo_url: null,
  etiket_ayirici_cizgi_goster: false,
  etiket_logo_x_pct: 50, etiket_logo_y_pct: 15,
  etiket_logo_genislik_mm: 15, etiket_logo_yukseklik_mm: 8,
  etiket_metin_x_pct: 50, etiket_metin_y_pct: 42,
  etiket_metin_genislik_mm: 34, etiket_metin_yukseklik_mm: 13,
  etiket_barkot_x_pct: 50, etiket_barkot_y_pct: 80,
  etiket_barkot_genislik_mm: 28, etiket_barkot_yukseklik_mm: 7,
  etiket_tamir_genislik_mm: 70, etiket_tamir_yukseklik_mm: 50,
};

// Metin bloğunun font boyutları bu referans yüksekliğe göre ölçeklenir.
const METIN_REFERANS_MM = 13;

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

/** Etiket üzerinde sürüklenip iki ayrı tutamaçla (sağ = genişlik, alt =
 * yükseklik) ORANSIZ boyutlandırılabilen tek bir öğe kutusu — logo, metin
 * ve barkot bloklarının üçü de bunu kullanır. `duzenlenebilir` false iken
 * düz bir konumlandırılmış kutu olarak (etkileşimsiz) render edilir. */
const ORTALAMA_ESIGI = 2.5; // % — sürüklerken bu kadar yaklaşınca tam ortaya (%50) yapışır

function SurukleBoyutKutu({
  kutuRef, genislikMmToplam, yukseklikMmToplam,
  xPct, yPct, genislikMm, yukseklikMm,
  duzenlenebilir, onTasi, onBoyutlandir, onOrtaHizala,
  minGenislik = 5, minYukseklik = 3, children,
}) {
  function oranAl() {
    const rect = kutuRef.current.getBoundingClientRect();
    return { x: rect.width / genislikMmToplam, y: rect.height / yukseklikMmToplam, rect };
  }

  function surukleBasla(e) {
    if (!duzenlenebilir) return;
    e.preventDefault(); e.stopPropagation();
    const { rect } = oranAl();
    function hareket(ev) {
      let xp = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      let yp = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
      const xOrtada = Math.abs(xp - 50) < ORTALAMA_ESIGI;
      const yOrtada = Math.abs(yp - 50) < ORTALAMA_ESIGI;
      if (xOrtada) xp = 50;
      if (yOrtada) yp = 50;
      onOrtaHizala && onOrtaHizala(xOrtada, yOrtada);
      onTasi && onTasi(Math.round(xp * 10) / 10, Math.round(yp * 10) / 10);
    }
    function birak() {
      window.removeEventListener("pointermove", hareket);
      window.removeEventListener("pointerup", birak);
      onOrtaHizala && onOrtaHizala(false, false);
    }
    window.addEventListener("pointermove", hareket);
    window.addEventListener("pointerup", birak);
  }

  function boyutlandirBasla(eksen) {
    return function (e) {
      e.preventDefault(); e.stopPropagation();
      const { x: oranX, y: oranY } = oranAl();
      const baslangicX = e.clientX, baslangicY = e.clientY;
      const baslangicGenislik = genislikMm, baslangicYukseklik = yukseklikMm;
      function hareket(ev) {
        let yeniGenislik = baslangicGenislik, yeniYukseklik = baslangicYukseklik;
        if (eksen !== "yukseklik") yeniGenislik = Math.max(minGenislik, baslangicGenislik + (ev.clientX - baslangicX) / oranX);
        if (eksen !== "genislik") yeniYukseklik = Math.max(minYukseklik, baslangicYukseklik + (ev.clientY - baslangicY) / oranY);
        onBoyutlandir && onBoyutlandir(Math.round(yeniGenislik * 10) / 10, Math.round(yeniYukseklik * 10) / 10);
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
    <div
      onPointerDown={surukleBasla}
      style={{
        position: "absolute", left: `${xPct}%`, top: `${yPct}%`,
        transform: "translate(-50%, -50%)",
        width: `${genislikMm}mm`, height: `${yukseklikMm}mm`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: duzenlenebilir ? "move" : "default",
        outline: duzenlenebilir ? "1px dashed #3b82f6" : "none",
        touchAction: duzenlenebilir ? "none" : "auto",
        userSelect: "none", WebkitUserSelect: "none",
      }}>
      {children}
      {duzenlenebilir && (
        <>
          {/* Tutamaçlar dokunmatik ekranda kolay yakalansın diye görünenden
              büyük bir dokunma alanına sahip — görünür nokta 14px, gerçek
              hedef alanı ~34px. */}
          <div onPointerDown={boyutlandirBasla("genislik")} title="Enine boyutlandır"
            style={{
              position: "absolute", right: -17, top: "50%", transform: "translateY(-50%)",
              width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "ew-resize", touchAction: "none",
            }}>
            <div style={{ width: 14, height: 26, borderRadius: 4, background: "#3b82f6", boxShadow: "0 0 0 2px #fff" }} />
          </div>
          <div onPointerDown={boyutlandirBasla("yukseklik")} title="Boyuna boyutlandır"
            style={{
              position: "absolute", bottom: -17, left: "50%", transform: "translateX(-50%)",
              width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "ns-resize", touchAction: "none",
            }}>
            <div style={{ width: 26, height: 14, borderRadius: 4, background: "#3b82f6", boxShadow: "0 0 0 2px #fff" }} />
          </div>
        </>
      )}
    </div>
  );
}

/** Basılacak/önizlenecek tek bir etiketin içeriği — ürün adı, fiyat, barkot,
 * ayarlara göre opsiyonel logo ve kategori.
 *
 * `duzenlenebilir` true verilirse logo, metin bloğu ve barkot bloğunun
 * üçü de bağımsız olarak sürüklenip iki ayrı tutamaçla (genişlik/yükseklik)
 * ORANSIZ yeniden boyutlandırılabilir — Etiket Ayarları sayfasındaki canlı
 * düzenleyici bunu kullanır, gerçek yazdırma/önizlemede bu prop hiç verilmez. */
export function EtiketIcerik({
  item, ayarlar = ETIKET_AYAR_VARSAYILAN, duzenlenebilir = false, barkotOnEk = "AKS",
  onLogoTasi, onLogoBoyutlandir, onMetinTasi, onMetinBoyutlandir, onBarkotTasi, onBarkotBoyutlandir,
}) {
  const kutuRef = useRef(null);
  const [merkezX, setMerkezX] = useState(false);
  const [merkezY, setMerkezY] = useState(false);
  function ortaHizala(x, y) { setMerkezX(x); setMerkezY(y); }
  const kod = barkotDegeri(item, barkotOnEk);
  const logoGoster = ayarlar.etiket_logo_goster && ayarlar.logo_url;
  const kategoriGoster = ayarlar.etiket_kategori_goster !== false;
  const ayiriciGoster = !!ayarlar.etiket_ayirici_cizgi_goster;
  const genislikMm = ayarlar.etiket_genislik_mm || 40;
  const yukseklikMm = ayarlar.etiket_yukseklik_mm || 30;

  const logoXPct = ayarlar.etiket_logo_x_pct ?? 50;
  const logoYPct = ayarlar.etiket_logo_y_pct ?? 15;
  const logoGenislikMm = ayarlar.etiket_logo_genislik_mm ?? 15;
  const logoYukseklikMm = ayarlar.etiket_logo_yukseklik_mm ?? 8;

  const metinXPct = ayarlar.etiket_metin_x_pct ?? 50;
  const metinYPct = ayarlar.etiket_metin_y_pct ?? 42;
  const metinGenislikMm = ayarlar.etiket_metin_genislik_mm ?? 34;
  const metinYukseklikMm = ayarlar.etiket_metin_yukseklik_mm ?? 13;
  const metinOlcek = Math.max(0.4, Math.min(3, metinYukseklikMm / METIN_REFERANS_MM));

  const barkotXPct = ayarlar.etiket_barkot_x_pct ?? 50;
  const barkotYPct = ayarlar.etiket_barkot_y_pct ?? 80;
  const barkotGenislikMm = ayarlar.etiket_barkot_genislik_mm ?? 34;
  const barkotYukseklikMm = ayarlar.etiket_barkot_yukseklik_mm ?? 10;

  return (
    <div className="etiket-tek">
      <div ref={kutuRef} style={{
        position: "relative", background: "#fff", color: "#000",
        boxSizing: "border-box", overflow: duzenlenebilir ? "visible" : "hidden",
        width: `${genislikMm}mm`, height: `${yukseklikMm}mm`,
      }}>
        {logoGoster && (
          <SurukleBoyutKutu kutuRef={kutuRef} genislikMmToplam={genislikMm} yukseklikMmToplam={yukseklikMm}
            xPct={logoXPct} yPct={logoYPct} genislikMm={logoGenislikMm} yukseklikMm={logoYukseklikMm}
            duzenlenebilir={duzenlenebilir} onTasi={onLogoTasi} onBoyutlandir={onLogoBoyutlandir} onOrtaHizala={ortaHizala}>
            <img src={fotoUrl(ayarlar.logo_url)} alt="" draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none", display: "block" }} />
          </SurukleBoyutKutu>
        )}

        <SurukleBoyutKutu kutuRef={kutuRef} genislikMmToplam={genislikMm} yukseklikMmToplam={yukseklikMm}
          xPct={metinXPct} yPct={metinYPct} genislikMm={metinGenislikMm} yukseklikMm={metinYukseklikMm}
          duzenlenebilir={duzenlenebilir} onTasi={onMetinTasi} onBoyutlandir={onMetinBoyutlandir} onOrtaHizala={ortaHizala}
          minGenislik={10} minYukseklik={5}>
          <div style={{ width: "100%", textAlign: "center", overflow: "hidden", pointerEvents: "none" }}>
            {kategoriGoster && item.kategori && (
              <div style={{ fontSize: 8 * metinOlcek, color: "#666", textTransform: "uppercase", letterSpacing: 0.3, lineHeight: 1.2 }}>{item.kategori}</div>
            )}
            <div style={{ fontWeight: 700, fontSize: 11.5 * metinOlcek, lineHeight: 1.2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.ad}</div>
            {item.satis_fiyati != null && (
              <>
                {ayiriciGoster && <div style={{ borderTop: "1px solid #ccc", margin: `${3 * metinOlcek}px 6px` }} />}
                <div style={{ fontWeight: 800, fontSize: 14.5 * metinOlcek, lineHeight: 1.2, marginTop: ayiriciGoster ? 2 : 0 }}>{item.satis_fiyati}₺</div>
              </>
            )}
            {/* Fiyat yerine 2.El/Sıfır Cihaz'ın garanti/fatura türü gibi ek
                bilgisi — örn. "Garantili" veya "MF"/"AF". */}
            {item.satis_fiyati == null && item.ekstra && (
              <div style={{ fontWeight: 700, fontSize: 9.5 * metinOlcek, lineHeight: 1.2, marginTop: 2, letterSpacing: 0.2 }}>{item.ekstra}</div>
            )}
          </div>
        </SurukleBoyutKutu>

        <SurukleBoyutKutu kutuRef={kutuRef} genislikMmToplam={genislikMm} yukseklikMmToplam={yukseklikMm}
          xPct={barkotXPct} yPct={barkotYPct} genislikMm={barkotGenislikMm} yukseklikMm={barkotYukseklikMm}
          duzenlenebilir={duzenlenebilir} onTasi={onBarkotTasi} onBoyutlandir={onBarkotBoyutlandir} onOrtaHizala={ortaHizala}
          minGenislik={10} minYukseklik={5}>
          <BarkotSVG value={kod} />
        </SurukleBoyutKutu>

        {duzenlenebilir && merkezX && (
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#ef4444", pointerEvents: "none" }} />
        )}
        {duzenlenebilir && merkezY && (
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "#ef4444", pointerEvents: "none" }} />
        )}
      </div>
    </div>
  );
}
