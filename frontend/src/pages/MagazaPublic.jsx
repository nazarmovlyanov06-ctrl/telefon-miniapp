import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import {
  Wrench, Search, MapPin, Phone, Clock, Smartphone, CircleX,
  CheckCircle2, Send, Store,
} from "lucide-react";

const DURUM_LABEL = {
  bekliyor: "Bekliyor", tamirde: "Tamirde", parca_bekleniyor: "Parça Bekleniyor",
  hazir: "Hazır — Teslim Alabilirsiniz", teslim: "Teslim Edildi",
};

function TamirSorgu({ slug }) {
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aranmadi, setAranmadi] = useState(true);

  async function ara(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setAranmadi(false);
    try { setSonuc(await api.publicTamirDurumu(slug, q.trim())); }
    catch { setSonuc([]); }
    finally { setLoading(false); }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
        <Search size={15} strokeWidth={2} /> Tamir Durumu Sorgula
      </div>
      <form onSubmit={ara} style={{ display: "flex", gap: 8, marginBottom: sonuc || !aranmadi ? 12 : 0 }}>
        <input className="form-input" style={{ flex: 1 }} placeholder="Telefon numarası veya tamir no (#T...)"
          value={q} onChange={e => setQ(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>Sorgula</button>
      </form>
      {!aranmadi && (loading ? (
        <div style={{ fontSize: 13, color: "var(--hint)" }}>Aranıyor...</div>
      ) : sonuc.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--hint)" }}>Bu bilgiyle kayıt bulunamadı.</div>
      ) : sonuc.map((r, i) => (
        <div key={i} style={{ padding: "10px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>#{r.repair_no} — {r.device_model}</div>
          <div style={{ fontSize: 12.5, color: "var(--hint)", marginTop: 2 }}>{r.fault_desc || "—"}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: r.status === "hazir" ? "var(--green)" : "var(--accent)", marginTop: 4 }}>
            {DURUM_LABEL[r.status] || r.status}
          </div>
        </div>
      )))}
    </div>
  );
}

function CihazListesi({ slug }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.publicCihazlar(slug).then(setData).catch(() => setData({ ikinci_el: [], sifir: [] })); }, [slug]);
  if (!data) return null;
  const hepsi = [...data.sifir.map(c => ({ ...c, yeni: true })), ...data.ikinci_el.map(c => ({ ...c, yeni: false }))];
  if (hepsi.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
        <Smartphone size={15} strokeWidth={2} /> Satılık Cihazlar
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        {hepsi.map(c => (
          <div key={`${c.yeni}-${c.id}`} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <span className="badge" style={{ background: c.yeni ? "rgba(74,222,128,0.15)" : "rgba(157,210,255,0.15)", color: c.yeni ? "var(--green)" : "var(--blue2)" }}>
                {c.yeni ? "Sıfır" : "2. El"}
              </span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.model}</div>
            <div style={{ fontSize: 12, color: "var(--hint)" }}>{[c.renk, c.depolama].filter(Boolean).join(" · ") || "—"}</div>
            <div style={{ fontWeight: 800, fontSize: 16, marginTop: 6, color: "var(--orange)" }}>
              {c.satis_fiyati ? `${c.satis_fiyati.toLocaleString("tr-TR")}₺` : "Fiyat için sorunuz"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RandevuFormu({ slug }) {
  const [form, setForm] = useState({ musteri_adi: "", telefon: "", cihaz_model: "", aciklama: "" });
  const [gonderildi, setGonderildi] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function gonder(e) {
    e.preventDefault(); setErr("");
    setBusy(true);
    try {
      await api.publicRandevuTalebi(slug, form);
      setGonderildi(true);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  if (gonderildi) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 24 }}>
        <CheckCircle2 size={32} strokeWidth={1.6} stroke="var(--green)" style={{ marginBottom: 8 }} />
        <div style={{ fontWeight: 700, fontSize: 15 }}>Talebiniz alındı</div>
        <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 4 }}>Dükkân en kısa sürede sizinle iletişime geçecek.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
        <Send size={15} strokeWidth={2} /> Randevu / Tamir Talebi
      </div>
      <form onSubmit={gonder}>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={13} strokeWidth={2} /> {err}</div>}
        <div className="form-group">
          <input className="form-input" required placeholder="Adınız Soyadınız"
            value={form.musteri_adi} onChange={e => setForm(f => ({ ...f, musteri_adi: e.target.value }))} />
        </div>
        <div className="form-group">
          <input className="form-input" required type="tel" placeholder="Telefon"
            value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
        </div>
        <div className="form-group">
          <input className="form-input" placeholder="Cihaz modeli (opsiyonel)"
            value={form.cihaz_model} onChange={e => setForm(f => ({ ...f, cihaz_model: e.target.value }))} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <textarea className="form-input" rows={3} placeholder="Arıza / talep açıklaması (opsiyonel)"
            value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))}
            style={{ width: "100%", resize: "vertical" }} />
        </div>
        <button type="submit" className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} disabled={busy}>
          {busy ? "Gönderiliyor..." : "Talep Gönder"}
        </button>
      </form>
    </div>
  );
}

export default function MagazaPublic() {
  const { slug } = useParams();
  const [dukkan, setDukkan] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.publicDukkan(slug).then(setDukkan).catch(() => setErr("notfound"));
  }, [slug]);

  if (err) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 24, textAlign: "center" }}>
        <Store size={40} stroke="var(--dim)" strokeWidth={1.5} />
        <div style={{ fontWeight: 700 }}>Dükkân bulunamadı</div>
      </div>
    );
  }
  if (!dukkan) return null;

  const whatsappHref = dukkan.telefon
    ? `https://wa.me/${dukkan.telefon.replace(/\D/g, "").replace(/^0/, "90")}`
    : null;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "30px 20px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Wrench size={36} strokeWidth={1.6} style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 800, fontSize: 22 }}>{dukkan.ad}</div>
          {dukkan.vitrin_aciklama && <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 6 }}>{dukkan.vitrin_aciklama}</div>}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 12, fontSize: 12.5, color: "var(--hint)" }}>
            {dukkan.telefon && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Phone size={12} strokeWidth={2} /> {dukkan.telefon}</span>}
            {dukkan.sehir && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><MapPin size={12} strokeWidth={2} /> {[dukkan.adres, dukkan.sehir].filter(Boolean).join(", ")}</span>}
            {dukkan.calisma_saatleri && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Clock size={12} strokeWidth={2} /> {dukkan.calisma_saatleri}</span>}
          </div>
          {dukkan.hizmetler && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 12 }}>
              {dukkan.hizmetler.split(",").map(h => h.trim()).filter(Boolean).map(h => (
                <span key={h} className="badge" style={{ background: "var(--bg2)", color: "var(--text)" }}>{h}</span>
              ))}
            </div>
          )}
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ marginTop: 14, display: "inline-flex" }}>
              WhatsApp'tan Yaz
            </a>
          )}
        </div>

        <TamirSorgu slug={slug} />
        <CihazListesi slug={slug} />
        <RandevuFormu slug={slug} />
      </div>
    </div>
  );
}
