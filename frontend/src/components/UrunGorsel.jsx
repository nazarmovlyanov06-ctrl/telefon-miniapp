import { useRef, useState } from "react";
import { fotoUrl } from "../api";
import { Camera } from "lucide-react";

/** Vitrinde gösterilecek ürün fotoğrafı — küçük önizleme + tıklayınca yükleme.
 * Kart içinde satır tıklamasını tetiklememesi için tüm olaylar durduruluyor. */
export default function UrunGorsel({ url, yukle, boyut = 46 }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [gecerliUrl, setGecerliUrl] = useState(url);

  async function sec(file) {
    setBusy(true);
    try {
      const r = await yukle(file);
      setGecerliUrl(r.url);
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div
        onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
        title={gecerliUrl ? "Fotoğrafı değiştir" : "Vitrin için fotoğraf ekle"}
        style={{
          width: boyut, height: boyut, borderRadius: 9, flexShrink: 0, cursor: "pointer",
          background: gecerliUrl ? `url(${fotoUrl(gecerliUrl)}) center/cover` : "var(--bg2)",
          border: `1px solid ${gecerliUrl ? "var(--divider)" : "var(--hint)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: busy ? 0.5 : 1,
        }}
      >
        {!gecerliUrl && <Camera size={16} stroke="var(--hint)" strokeWidth={1.8} />}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onClick={e => e.stopPropagation()}
        onChange={e => { if (e.target.files[0]) sec(e.target.files[0]); e.target.value = ""; }} />
    </>
  );
}
