import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Star, CheckCircle2, Trash2 } from "lucide-react";

export default function VitrinDegerlendirme() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() { api.vitrinDegerlendirmeler().then(setList).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, []);

  async function onayla(id, onaylandi) {
    await api.vitrinDegerlendirmeOnay(id, onaylandi);
    load();
  }

  async function sil(id) {
    if (!confirm("Bu değerlendirmeyi sil?")) return;
    await api.vitrinDegerlendirmeSil(id);
    load();
  }

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/more")}>← Geri</button>
        <div className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 9 }}>
          <Star size={19} strokeWidth={2} /> Değerlendirmeler
        </div>
      </div>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : list.length === 0 ? (
        <div className="empty">
          <div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><Star size={40} stroke="var(--dim)" strokeWidth={1.5} /></div>
          Mağaza sayfanızdan gelen değerlendirmeler burada görünür
        </div>
      ) : list.map(d => (
        <div key={d.id} className="card" style={{ marginBottom: 8 }}>
          <div className="card-row" style={{ alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                {[1, 2, 3, 4, 5].map(p => (
                  <Star key={p} size={13} strokeWidth={1.6} fill={p <= d.puan ? "var(--orange)" : "none"} stroke={p <= d.puan ? "var(--orange)" : "var(--hint)"} />
                ))}
              </div>
              <div style={{ fontWeight: 600 }}>{d.musteri_adi}</div>
              {d.yorum && <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 2 }}>{d.yorum}</div>}
              {d.repair_no && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>#{d.repair_no}</div>}
              <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{new Date(d.created_at).toLocaleString("tr-TR")}</div>
            </div>
            <span className="badge" style={{ background: d.onaylandi ? "rgba(74,222,128,0.15)" : "rgba(157,210,255,0.15)", color: d.onaylandi ? "var(--green)" : "var(--blue2)", flexShrink: 0 }}>
              {d.onaylandi ? "Yayında" : "Onay Bekliyor"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {!d.onaylandi && (
              <button className="btn btn-ghost btn-sm" onClick={() => onayla(d.id, true)}
                style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--success)" }}><CheckCircle2 size={12} strokeWidth={2} /> Yayınla</button>
            )}
            {d.onaylandi && (
              <button className="btn btn-ghost btn-sm" onClick={() => onayla(d.id, false)}
                style={{ display: "flex", alignItems: "center", gap: 5 }}>Yayından Kaldır</button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => sil(d.id)}
              style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--danger)" }}><Trash2 size={12} strokeWidth={2} /> Sil</button>
          </div>
        </div>
      ))}
    </div>
  );
}
