import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fotoUrl } from "../api";
import { Repeat, Phone, CheckCircle2, X } from "lucide-react";

const DURUM_META = {
  yeni: { label: "Yeni", color: "var(--blue)" },
  teklif_verildi: { label: "Teklif Verildi", color: "var(--gold)" },
  kabul_edildi: { label: "Kabul Edildi", color: "var(--green)" },
  reddedildi: { label: "Reddedildi", color: "var(--red)" },
};

export default function VitrinTakas() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teklifTutari, setTeklifTutari] = useState({});
  const [foto, setFoto] = useState(null);

  function load() { api.vitrinTakasTeklifleri().then(setList).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, []);

  async function guncelle(id, durum) {
    await api.vitrinTakasTeklifiGuncelle(id, durum, teklifTutari[id]);
    load();
  }

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/more")}>← Geri</button>
        <div className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 9 }}>
          <Repeat size={19} strokeWidth={2} /> Takas Teklifleri
        </div>
      </div>

      {foto && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setFoto(null)}>
          <img src={fotoUrl(foto)} alt="" style={{ maxWidth: "95%", maxHeight: "85vh", borderRadius: 8, objectFit: "contain" }} />
        </div>
      )}

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : list.length === 0 ? (
        <div className="empty">
          <div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><Repeat size={40} stroke="var(--dim)" strokeWidth={1.5} /></div>
          Mağaza sayfanızdan gelen takas teklifleri burada görünür
        </div>
      ) : list.map(t => {
        const meta = DURUM_META[t.durum] || { label: t.durum, color: "var(--hint)" };
        return (
          <div key={t.id} className="card" style={{ marginBottom: 8 }}>
            <div className="card-row" style={{ alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 10 }}>
                {t.foto_url && (
                  <img src={fotoUrl(t.foto_url)} alt="" onClick={() => setFoto(t.foto_url)}
                    style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", cursor: "pointer", flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontWeight: 600 }}>{t.musteri_adi}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)", display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                    <Phone size={11} strokeWidth={2} /> {t.telefon}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{t.cihaz_model}</div>
                  {t.aciklama && <div style={{ fontSize: 12.5, color: "var(--hint)", marginTop: 2 }}>{t.aciklama}</div>}
                  {t.teklif_tutari && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)", marginTop: 4 }}>{t.teklif_tutari.toLocaleString("tr-TR")}₺</div>}
                  <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>{new Date(t.created_at).toLocaleString("tr-TR")}</div>
                </div>
              </div>
              <span className="badge" style={{ background: `${meta.color}22`, color: meta.color, flexShrink: 0 }}>{meta.label}</span>
            </div>
            {(t.durum === "yeni" || t.durum === "teklif_verildi") && (
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input className="form-input" type="number" placeholder="Teklif (₺)" style={{ width: 110 }}
                  value={teklifTutari[t.id] ?? t.teklif_tutari ?? ""}
                  onChange={e => setTeklifTutari(f => ({ ...f, [t.id]: e.target.value }))} />
                <button className="btn btn-ghost btn-sm" onClick={() => guncelle(t.id, "teklif_verildi")}
                  style={{ display: "flex", alignItems: "center", gap: 5 }}>Teklif Ver</button>
                <button className="btn btn-ghost btn-sm" onClick={() => guncelle(t.id, "kabul_edildi")}
                  style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--success)" }}><CheckCircle2 size={12} strokeWidth={2} /> Kabul Et</button>
                <button className="btn btn-ghost btn-sm" onClick={() => guncelle(t.id, "reddedildi")}
                  style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--danger)" }}><X size={12} strokeWidth={2} /> Reddet</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
