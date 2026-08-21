import { useEffect, useState } from "react";
import { api } from "../api";
import { Printer } from "lucide-react";
import { EtiketIcerik, etiketSayfaBoyutuAyarla } from "./UrunEtiketi";

/** Aksesuar'daki fiyat+barkot etiket sistemini başka modüllerde (Stok/parça,
 * 2.El, Sıfır Cihaz...) yeniden kullanmak için tek/toplu yazdırma modalı.
 * `items` her zaman {id, ad, satis_fiyati, kategori, barkot} şeklinde
 * eşlenmiş bir dizi olmalı — çağıran sayfa kendi alan adlarını buna çevirir.
 * `barkotOnEk` modüle özgü türetilmiş barkot öneki (AKS/PRC/...) — gerçek
 * tabloların id'leri çakışsa bile üretilen barkotlar birbirine karışmasın diye. */
export default function UrunEtiketModal({ items, baslik, barkotOnEk = "AKS", onClose }) {
  const [ayarlar, setAyarlar] = useState(null);

  useEffect(() => {
    api.etiketAyarlari().then(setAyarlar).catch(() => setAyarlar({}));
  }, []);

  if (!items || items.length === 0) return null;
  const coklu = items.length > 1;

  function yazdir() {
    etiketSayfaBoyutuAyarla(ayarlar);
    window.print();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 400, textAlign: "center" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Printer size={16} strokeWidth={2} /> {coklu ? `${baslik || "Etiket"} (${items.length})` : (baslik || "Etiket Yazdır")}
        </div>
        {!ayarlar ? (
          <div className="loading">Yükleniyor...</div>
        ) : (
          <>
            <div style={{ maxHeight: coklu ? 340 : undefined, overflowY: coklu ? "auto" : undefined, marginBottom: 12 }}>
              <div className="etiket-yazdirma-alani" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 10 }}>
                {items.map(it => <EtiketIcerik key={it.id} item={it} ayarlar={ayarlar} barkotOnEk={barkotOnEk} />)}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--hint)", marginBottom: 12 }}>
              "Yazdır"a basınca tarayıcının yazdırma penceresi açılır — orada yazıcınızı seçebilirsiniz. Etiket boyutu/logosu Ayarlar → Etiket Ayarları'ndan değiştirilebilir.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={yazdir}>
                <Printer size={14} strokeWidth={2} /> {coklu ? `${items.length} Etiket Yazdır` : "Yazdır"}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Kapat</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
