import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import {
  Wrench, Users, Package, Landmark, Smartphone, ShieldCheck,
  CheckCircle2, ArrowRight,
} from "lucide-react";

const OZELLIKLER = [
  { icon: Wrench, title: "Tamir Takibi", desc: "Cihaz kaydından teslime, her aşamayı anlık takip et." },
  { icon: Users, title: "Müşteri Kayıtları", desc: "Geçmiş tamirler, iletişim bilgileri tek yerde." },
  { icon: Package, title: "Stok & Parça", desc: "Marka/model bazlı stok, kritik stok uyarıları." },
  { icon: Landmark, title: "Kasa & Gider", desc: "Günlük gelir-gider, otomatik özet raporlar." },
  { icon: Smartphone, title: "2. El & Sıfır Cihaz", desc: "Alım-satım takibi, kâr/zarar hesaplama." },
  { icon: ShieldCheck, title: "Garanti Takibi", desc: "Süresi dolan garantiler otomatik hatırlatılır." },
];

const SSS = [
  { s: "Kurulum gerekiyor mu?", c: "Hayır — tarayıcıdan kayıt olup hemen kullanmaya başlarsın, ek bir program kurmana gerek yok." },
  { s: "Verilerim güvende mi?", c: "Her dükkânın verisi izole tutulur, başka bir dükkân senin verine erişemez." },
  { s: "Ücretsiz deneme var mı?", c: "Evet, kayıt olduğunda otomatik deneme süresi başlar, kart bilgisi istenmez." },
  { s: "Birden fazla çalışan ekleyebilir miyim?", c: "Evet — patron, teknisyen, satış ve çırak rolleriyle sınırsız çalışan ekleyebilirsin." },
];

export default function Landing() {
  const [planlar, setPlanlar] = useState([]);

  useEffect(() => { api.publicPlanlar().then(setPlanlar).catch(() => {}); }, []);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 800, fontSize: 17 }}>
          <Wrench size={20} strokeWidth={2} /> Telefon Servis
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/giris" className="btn btn-ghost btn-sm">Giriş Yap</Link>
          <Link to="/kayit" className="btn btn-primary btn-sm">Ücretsiz Dene</Link>
        </div>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center", padding: "60px 20px 50px" }}>
        <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.25, marginBottom: 14, color: "var(--text-strong)" }}>
          Telefon tamir dükkânınızı<br />tek panelden yönetin
        </h1>
        <p style={{ fontSize: 15, color: "var(--hint)", marginBottom: 26, lineHeight: 1.6 }}>
          Tamir takibi, stok, kasa, müşteri kayıtları ve daha fazlası — hepsi tek uygulamada.
          Kurulum yok, hemen başla.
        </p>
        <Link to="/kayit" className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 26px", fontSize: 15 }}>
          Ücretsiz Denemeye Başla <ArrowRight size={16} strokeWidth={2} />
        </Link>
      </div>

      {/* Özellikler */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px 60px" }}>
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {OZELLIKLER.map(o => (
            <div key={o.title} className="card">
              <o.icon size={22} strokeWidth={1.8} stroke="var(--orange)" />
              <div style={{ fontWeight: 700, fontSize: 15, marginTop: 10, marginBottom: 4 }}>{o.title}</div>
              <div style={{ fontSize: 13, color: "var(--hint)", lineHeight: 1.5 }}>{o.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fiyatlandırma */}
      {planlar.length > 0 && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px 60px" }}>
          <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Fiyatlandırma</h2>
          <p style={{ textAlign: "center", color: "var(--hint)", fontSize: 13, marginBottom: 28 }}>İstediğin zaman değiştir veya iptal et.</p>
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {planlar.map(p => (
              <div key={p.tur} className="card" style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{p.ad}</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
                  {p.fiyat === 0 ? "Ücretsiz" : `${p.fiyat.toLocaleString("tr-TR")}₺`}
                  {p.fiyat > 0 && <span style={{ fontSize: 13, fontWeight: 400, color: "var(--hint)" }}>/ay</span>}
                </div>
                <Link to="/kayit" className="btn btn-ghost btn-sm" style={{ marginTop: 10, display: "inline-flex" }}>Seç</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SSS */}
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 20px 60px" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 800, marginBottom: 24 }}>Sık Sorulan Sorular</h2>
        {SSS.map(s => (
          <div key={s.s} className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, display: "flex", alignItems: "center", gap: 7 }}>
              <CheckCircle2 size={14} strokeWidth={2} stroke="var(--green)" /> {s.s}
            </div>
            <div style={{ fontSize: 13, color: "var(--hint)", lineHeight: 1.5 }}>{s.c}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--divider)", padding: "30px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "var(--dim)" }}>© {new Date().getFullYear()} Telefon Servis — VarmiStok</div>
      </div>
    </div>
  );
}
