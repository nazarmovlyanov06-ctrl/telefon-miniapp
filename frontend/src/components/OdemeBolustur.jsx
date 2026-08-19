import { Plus, X } from "lucide-react";

// Karma ödeme editörü: "bir kısmı nakit, bir kısmı kart, kalanı borç" gibi
// ihtiyaçlar için — satırlar sadece GERÇEKTEN alınan/ödenen kısımları temsil
// eder, toplam ile satırların farkı otomatik borç olarak kalır (backend
// odeme_yardimci.kaydet_odeme ile aynı mantık).
//
// value: [{ yontem: "nakit"|"kart", tutar: string }]
// yon: "gelir" (satış) | "gider" (alım) — sadece metin için

export function varsayilanOdemeSatirlari(toplam) {
  return [{ yontem: "nakit", tutar: toplam ? String(toplam) : "" }];
}

export default function OdemeBolustur({ toplam, value, onChange, taksitSayi, onTaksitSayiChange, yon = "gelir" }) {
  const satirlar = value && value.length ? value : varsayilanOdemeSatirlari(toplam);
  const alinan = satirlar.reduce((s, x) => s + (parseFloat(x.tutar) || 0), 0);
  const kalan = Math.round(((toplam || 0) - alinan) * 100) / 100;

  function satirGuncelle(i, patch) {
    onChange(satirlar.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function satirEkle() {
    onChange([...satirlar, { yontem: "kart", tutar: "" }]);
  }
  function satirSil(i) {
    onChange(satirlar.filter((_, idx) => idx !== i));
  }
  function hicOdemeAlinmadi() {
    onChange([{ yontem: "nakit", tutar: "" }]);
  }

  const tamamenBorc = alinan <= 0.009 && (toplam || 0) > 0;

  return (
    <div className="form-group">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <label className="form-label" style={{ margin: 0 }}>Ödeme</label>
        <button type="button" onClick={hicOdemeAlinmadi}
          style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 10, border: "1px solid",
            borderColor: tamamenBorc ? "var(--danger)" : "var(--border)",
            background: tamamenBorc ? "rgba(239,68,68,0.1)" : "transparent",
            color: tamamenBorc ? "var(--danger)" : "var(--hint)",
            cursor: "pointer", fontWeight: 600,
          }}>
          Hiç ödeme alınmadı (tamamı borç)
        </button>
      </div>
      {satirlar.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <select className="form-select" style={{ width: 92, flexShrink: 0 }} value={s.yontem}
            onChange={e => satirGuncelle(i, { yontem: e.target.value })}>
            <option value="nakit">Nakit</option>
            <option value="kart">Kart</option>
          </select>
          <input className="form-input" type="number" step="0.01" placeholder="0" value={s.tutar}
            onChange={e => satirGuncelle(i, { tutar: e.target.value })} />
          {satirlar.length > 1 && (
            <button type="button" onClick={() => satirSil(i)}
              style={{ background: "none", border: "none", color: "var(--hint)", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}>
              <X size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={satirEkle}
        style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: "2px 0", marginBottom: kalan > 0.009 ? 8 : 0 }}>
        <Plus size={13} strokeWidth={2.4} /> Ödeme Satırı Ekle
      </button>
      {kalan > 0.009 && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}>
          <div style={{ color: "var(--danger)", fontWeight: 700 }}>
            Kalan {kalan.toLocaleString("tr-TR")}₺ {yon === "gelir" ? "müşteri borcu" : "tedarikçi borcu"} olarak eklenecek
          </div>
          {onTaksitSayiChange && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 12 }}>Taksit sayısı</span>
              <input className="form-input" type="number" min="1" style={{ width: 60, padding: "4px 8px" }}
                value={taksitSayi ?? "1"} onChange={e => onTaksitSayiChange(e.target.value)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
