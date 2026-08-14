import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { CalendarClock, Phone, CheckCircle2, X, Eye } from "lucide-react";

const DURUM_META = {
  yeni: { label: "Yeni", color: "var(--blue)" },
  goruldu: { label: "Görüldü", color: "var(--gold)" },
  tamire_donusturuldu: { label: "Tamire Dönüştürüldü", color: "var(--green)" },
  reddedildi: { label: "Reddedildi", color: "var(--red)" },
};

export default function RandevuTalepleri() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() { api.vitrinRandevuTalepleri().then(setList).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, []);

  async function durumDegistir(id, durum) {
    await api.vitrinRandevuDurumGuncelle(id, durum);
    load();
  }

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/more")}>← Geri</button>
        <div className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 9 }}>
          <CalendarClock size={19} strokeWidth={2} /> Randevu Talepleri
        </div>
      </div>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : list.length === 0 ? (
        <div className="empty">
          <div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><CalendarClock size={40} stroke="var(--dim)" strokeWidth={1.5} /></div>
          Mağaza sayfanızdan gelen talepler burada görünür
        </div>
      ) : list.map(t => {
        const meta = DURUM_META[t.durum] || { label: t.durum, color: "var(--hint)" };
        return (
          <div key={t.id} className="card" style={{ marginBottom: 8 }}>
            <div className="card-row" style={{ alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.musteri_adi}</div>
                <div style={{ fontSize: 13, color: "var(--hint)", display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                  <Phone size={11} strokeWidth={2} /> {t.telefon}
                </div>
                {t.cihaz_model && <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 2 }}>{t.cihaz_model}</div>}
                {t.aciklama && <div style={{ fontSize: 13, marginTop: 4 }}>{t.aciklama}</div>}
                <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>{new Date(t.created_at).toLocaleString("tr-TR")}</div>
              </div>
              <span className="badge" style={{ background: `${meta.color}22`, color: meta.color, flexShrink: 0 }}>{meta.label}</span>
            </div>
            {t.durum === "yeni" && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => durumDegistir(t.id, "goruldu")}
                  style={{ display: "flex", alignItems: "center", gap: 5 }}><Eye size={12} strokeWidth={2} /> Görüldü</button>
                <button className="btn btn-ghost btn-sm" onClick={() => durumDegistir(t.id, "tamire_donusturuldu")}
                  style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--success)" }}><CheckCircle2 size={12} strokeWidth={2} /> Tamire Dönüştür</button>
                <button className="btn btn-ghost btn-sm" onClick={() => durumDegistir(t.id, "reddedildi")}
                  style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--danger)" }}><X size={12} strokeWidth={2} /> Reddet</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
