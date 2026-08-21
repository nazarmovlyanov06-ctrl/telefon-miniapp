import { useEffect, useState } from "react";
import { api } from "../api";
import { Printer } from "lucide-react";
import { TamirEtiketi } from "./TamirEtiketi";
import { etiketSayfaBoyutuAyarla } from "./UrunEtiketi";

/** Tek veya toplu tamir stikeri yazdırma modalı — hem RepairDetail'deki tek
 * tamir "Etiket Yazdır" butonundan, hem Repairs listesindeki tekli/toplu
 * yazdırmadan kullanılır. `repairs` her zaman bir dizi (tek olsa da). */
export default function TamirEtiketModal({ repairs, onClose }) {
  const [ayarlar, setAyarlar] = useState(null);

  useEffect(() => {
    api.etiketAyarlari().then(setAyarlar).catch(() => setAyarlar({}));
  }, []);

  if (!repairs || repairs.length === 0) return null;
  const coklu = repairs.length > 1;

  function yazdir() {
    etiketSayfaBoyutuAyarla({
      etiket_genislik_mm: ayarlar.etiket_tamir_genislik_mm,
      etiket_yukseklik_mm: ayarlar.etiket_tamir_yukseklik_mm,
    });
    window.print();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 400, textAlign: "center" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Printer size={16} strokeWidth={2} /> {coklu ? `Toplu Tamir Stikeri (${repairs.length})` : "Tamir Stikeri"}
        </div>
        {!ayarlar ? (
          <div className="loading">Yükleniyor...</div>
        ) : (
          <>
            <div style={{ maxHeight: coklu ? 340 : undefined, overflowY: coklu ? "auto" : undefined, marginBottom: 12 }}>
              <div className="etiket-yazdirma-alani" style={{ display: "flex", flexDirection: coklu ? "column" : "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
                {repairs.map(r => <TamirEtiketi key={r.id} repair={r} ayarlar={ayarlar} />)}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--hint)", marginBottom: 12 }}>
              "Yazdır"a basınca tarayıcının yazdırma penceresi açılır — orada yazıcınızı seçebilirsiniz. Stiker boyutu/logosu Ayarlar → Etiket Ayarları'ndan değiştirilebilir.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={yazdir}>
                <Printer size={14} strokeWidth={2} /> {coklu ? `${repairs.length} Etiket Yazdır` : "Yazdır"}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Kapat</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
