import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  BarChart3, Users, Wrench, Smartphone, Package, Cog, Headphones,
  Star, Frown, Ban,
} from "lucide-react";

const DURUM_LABEL = {
  bekliyor: "Bekliyor",
  tamirde: "Tamirde",
  parca_bekleniyor: "Parça",
  hazir: "Hazır",
  teslim: "Teslim",
};

const DURUM_RENK = {
  bekliyor: "var(--orange)",
  tamirde: "var(--blue)",
  parca_bekleniyor: "var(--purple)",
  hazir: "var(--green)",
  teslim: "var(--gray)",
};

function fmt(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return Math.round(n).toLocaleString("tr-TR");
}

const AY_KISA = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export default function Stats() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [skor, setSkor] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.stats().then(setData).catch(() => {}).finally(() => setLoading(false));
    api.geriBildirimSkor().then(setSkor).catch(() => {});
  }, []);

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (!data) return <div className="empty">Veri yüklenemedi</div>;

  const maxGelir = Math.max(...data.son7gun.map(g => g.gelir), 1);
  const maxAy = Math.max(...data.son6ay.map(a => a.gelir), 1);
  const maxAriza = Math.max(...data.ariza_top.map(a => a.c), 1);
  const maxMusteri = Math.max(...data.musteri_top.map(m => m.toplam), 1);
  const s = data.sayilar || {};

  return (
    <div className="page" style={{ paddingBottom: 90 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 size={17} strokeWidth={2} /> İstatistikler
        </div>
      </div>

      {/* Genel sayılar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 4 }}>
        <StatCard label="Müşteri" value={s.musteri || 0} icon={Users} color="var(--blue)" />
        <StatCard label="Toplam Tamir" value={s.tamir_toplam || 0} icon={Wrench} color="var(--orange)" />
        <StatCard label="2.El Stok" value={s.ikinciel_stok || 0} icon={Smartphone} color="var(--green)" />
        <StatCard label="Sıfır Stok" value={s.sifir_stok || 0} icon={Package} color="var(--purple)" />
        <StatCard label="Parça Çeşit" value={s.parca_cesit || 0} icon={Cog} color="var(--red)" />
        <StatCard label="Aksesuar" value={s.aksesuar_cesit || 0} icon={Headphones} color="var(--gold)" />
      </div>

      {/* Tamir Durum Dağılımı */}
      <div className="section-title" style={{ marginTop: 16 }}>Tamir Durumu</div>
      <div className="card">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(data.tamir_durum).map(([k, v]) => (
            <div key={k} style={{
              flex: 1, minWidth: 55, display: "flex", flexDirection: "column", alignItems: "center",
              background: "var(--bg2)", borderRadius: 10, padding: "10px 6px",
              borderBottom: `3px solid ${DURUM_RENK[k] || "var(--accent)"}`,
            }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: DURUM_RENK[k] || "var(--text)" }}>{v}</div>
              <div style={{ fontSize: 10, color: "var(--hint)", textAlign: "center", marginTop: 2 }}>{DURUM_LABEL[k] || k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Son 7 Gün */}
      <div className="section-title">Son 7 Gün Kasa</div>
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 110, paddingBottom: 24, position: "relative" }}>
          {data.son7gun.map((g, i) => {
            const h = Math.max(g.gelir > 0 ? (g.gelir / maxGelir) * 80 : 0, 0);
            const gId = Math.max(g.gider > 0 ? (g.gider / maxGelir) * 80 : 0, 0);
            const gun = g.gun.slice(8) + "/" + g.gun.slice(5, 7);
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "100%" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 2, width: "100%" }}>
                  {h > 0 && (
                    <div style={{ flex: 1, height: h, background: "var(--accent)", borderRadius: "3px 3px 0 0" }} />
                  )}
                  {gId > 0 && (
                    <div style={{ flex: 1, height: gId, background: "var(--red)", borderRadius: "3px 3px 0 0", opacity: 0.7 }} />
                  )}
                  {h === 0 && gId === 0 && (
                    <div style={{ flex: 1, height: 3, background: "var(--bg2)", borderRadius: 3 }} />
                  )}
                </div>
                {g.gelir > 0 && (
                  <div style={{ fontSize: 9, color: "var(--hint)", fontWeight: 600 }}>{fmt(g.gelir)}</div>
                )}
                <div style={{ fontSize: 9, color: "var(--hint)", position: "absolute", bottom: 0 }}>{gun}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 4, justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--hint)" }}>
            <div style={{ width: 10, height: 10, background: "var(--accent)", borderRadius: 2 }} /> Gelir
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--hint)" }}>
            <div style={{ width: 10, height: 10, background: "var(--red)", borderRadius: 2, opacity: 0.7 }} /> Gider
          </div>
        </div>
      </div>

      {/* Son 6 Ay */}
      <div className="section-title">Son 6 Ay Gelir</div>
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, paddingBottom: 24, position: "relative" }}>
          {data.son6ay.map((a, i) => {
            const h = Math.max(a.gelir > 0 ? (a.gelir / maxAy) * 70 : 0, 0);
            const gId = Math.max(a.gider > 0 ? (a.gider / maxAy) * 70 : 0, 0);
            const ay = parseInt(a.ay.slice(5));
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "100%" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 2, width: "100%" }}>
                  {h > 0 && <div style={{ flex: 1, height: h, background: "var(--green)", borderRadius: "3px 3px 0 0" }} />}
                  {gId > 0 && <div style={{ flex: 1, height: gId, background: "var(--red)", borderRadius: "3px 3px 0 0", opacity: 0.7 }} />}
                  {h === 0 && gId === 0 && <div style={{ flex: 1, height: 3, background: "var(--bg2)", borderRadius: 3 }} />}
                </div>
                {a.gelir > 0 && <div style={{ fontSize: 9, color: "var(--hint)", fontWeight: 600 }}>{fmt(a.gelir)}</div>}
                <div style={{ fontSize: 9, color: "var(--hint)", position: "absolute", bottom: 0 }}>{AY_KISA[ay]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* En çok yapılan arızalar */}
      {data.ariza_top.length > 0 && (
        <>
          <div className="section-title">En Çok Gelen Arızalar</div>
          <div className="card">
            {data.ariza_top.map((a, i) => (
              <div key={i} style={{ marginBottom: i < data.ariza_top.length - 1 ? 12 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                  <span style={{ flex: 1, marginRight: 8 }}>{a.fault_desc}</span>
                  <span style={{ color: "var(--hint)", fontWeight: 700, flexShrink: 0 }}>{a.c} tamir</span>
                </div>
                <div style={{ height: 6, background: "var(--bg2)", borderRadius: 4 }}>
                  <div style={{
                    height: "100%",
                    width: `${(a.c / maxAriza) * 100}%`,
                    background: "var(--accent)",
                    borderRadius: 4,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Çalışan Skoru */}
      {skor.length > 0 && (
        <>
          <div className="section-title">Çalışan Skoru</div>
          <div className="card">
            {skor.map((s, i) => {
              const top = Math.max((s.ovgu_sayisi || 0) + (s.sikayet_sayisi || 0), 1);
              return (
                <div key={s.id} style={{ marginBottom: i < skor.length - 1 ? 12 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <div style={{ display: "flex", gap: 10 }}>
                      <span style={{ color: "var(--success)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        <Star size={12} strokeWidth={2} /> {s.ovgu_sayisi || 0}
                      </span>
                      <span style={{ color: "var(--danger)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        <Frown size={12} strokeWidth={2} /> {s.sikayet_sayisi || 0}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", height: 6, borderRadius: 4, overflow: "hidden", background: "var(--bg2)" }}>
                    {(s.ovgu_sayisi || 0) > 0 && (
                      <div style={{ width: `${(s.ovgu_sayisi / top) * 100}%`, background: "var(--success)" }} />
                    )}
                    {(s.sikayet_sayisi || 0) > 0 && (
                      <div style={{ width: `${(s.sikayet_sayisi / top) * 100}%`, background: "var(--danger)" }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Parça iadesini en çok reddeden toptancılar */}
      {data.toptanci_red?.length > 0 && (
        <>
          <div className="section-title">Parça İademizi En Çok Reddeden Toptancılar</div>
          <div className="card">
            {data.toptanci_red.map((t, i) => (
              <div key={i} style={{ marginBottom: i < data.toptanci_red.length - 1 ? 12 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                  <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                    <Ban size={12} stroke="var(--danger)" strokeWidth={2} /> {t.toptanci_adi}
                  </span>
                  <span style={{ color: "var(--danger)", fontWeight: 700, flexShrink: 0 }}>
                    {t.red_sayisi}/{t.sonuclanan} (%{t.red_orani})
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--bg2)", borderRadius: 4 }}>
                  <div style={{
                    height: "100%",
                    width: `${t.red_orani}%`,
                    background: "var(--danger)",
                    borderRadius: 4,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* En çok harcayan müşteriler */}
      {data.musteri_top.length > 0 && (
        <>
          <div className="section-title">En Çok Harcayan Müşteriler</div>
          <div className="card">
            {data.musteri_top.map((m, i) => (
              <div key={i} style={{ marginBottom: i < data.musteri_top.length - 1 ? 12 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, color: "var(--hint)", marginRight: 6 }}>#{i + 1}</span>
                    {m.name}
                  </span>
                  <span style={{ color: "var(--gold)", fontWeight: 700 }}>{fmt(m.toplam)}₺</span>
                </div>
                <div style={{ height: 6, background: "var(--bg2)", borderRadius: 4 }}>
                  <div style={{
                    height: "100%",
                    width: `${(m.toplam / maxMusteri) * 100}%`,
                    background: "var(--gold)",
                    borderRadius: 4,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="card" style={{ padding: "12px 10px", textAlign: "center", marginBottom: 0 }}>
      <Icon size={20} stroke={color} strokeWidth={1.8} style={{ marginBottom: 4 }} />
      <div style={{ fontWeight: 800, fontSize: 20, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>{label}</div>
    </div>
  );
}
