import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  User, Pencil, CircleX, Phone, FileText, Calendar,
  Wrench, Banknote, CalendarCheck, CreditCard, Smartphone, Package,
  FileClock, CheckCircle2, Home, X, ArrowRight, KeyRound, Copy, Check, MessageCircle,
} from "lucide-react";

const STATUS_LABEL = {
  bekliyor: "Bekliyor", tamirde: "Tamirde",
  parca_bekleniyor: "Parça", hazir: "Hazır", teslim: "Teslim",
};

const TUR_LABEL = {
  tamir: { icon: Wrench, label: "Tamir", color: "var(--blue)" },
  borc: { icon: Banknote, label: "Borç", color: "var(--red)" },
  "2el_alim": { icon: Smartphone, label: "2.El Sattı", color: "var(--purple)" },
  "2el_satim": { icon: Smartphone, label: "2.El Aldı", color: "var(--green)" },
  sifir_alim: { icon: Package, label: "Sıfır Sattı", color: "var(--purple)" },
  sifir_satim: { icon: Package, label: "Sıfır Aldı", color: "var(--green)" },
};

const DATE_ICONS = { acildi: FileClock, tamirde: Wrench, hazir: CheckCircle2, teslim: Home };

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR");
}

function fmtDateTime(d) {
  if (!d) return null;
  const dt = new Date(d);
  return dt.toLocaleDateString("tr-TR") + " " + dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function OzetPencere({ baslik, ikon: Ikon, renk, children, onClose, onTumu }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: 20, maxHeight: "78vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8, color: renk }}>
            <Ikon size={16} strokeWidth={2} /> {baslik}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--hint)", cursor: "pointer", display: "flex" }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        {children}
        {onTumu && (
          <button className="btn btn-ghost btn-sm" onClick={onTumu}
            style={{ width: "100%", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            Tümünü Gör <ArrowRight size={13} strokeWidth={2.4} />
          </button>
        )}
      </div>
    </div>
  );
}

const AKSESUAR_ETIKETLERI = { kutu: "Kutu", sarj_aleti: "Şarj Aleti", kilif: "Kılıf", kulaklik: "Kulaklık" };

function EtkinlikDetayModal({ ev, onClose }) {
  const t = TUR_LABEL[ev.tur] || { icon: null, label: ev.tur, color: "var(--hint)" };
  const Ikon = t.icon || Smartphone;
  const d = ev.detay || {};
  const ozellikler = [d.renk, d.depolama, d.ram].filter(Boolean).join(" · ");
  let aksesuarlar = {};
  try { aksesuarlar = d.aksesuarlar ? JSON.parse(d.aksesuarlar) : {}; } catch { /* eski/boş veri */ }
  const gelenAksesuarlar = Object.entries(AKSESUAR_ETIKETLERI).filter(([k]) => aksesuarlar[k]).map(([, label]) => label);
  return (
    <OzetPencere baslik={d.model || ev.baslik} ikon={Ikon} renk={t.color} onClose={onClose}>
      <div style={{ fontWeight: 300, fontSize: 24, color: t.color, letterSpacing: -0.5, marginBottom: 4 }}>
        {ev.tutar ? `${Number(ev.tutar).toLocaleString("tr-TR")}₺` : "—"}
      </div>
      <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 14 }}>
        {t.label} · {fmtDateTime(ev.tarih) || fmt(ev.tarih)}
      </div>
      {ozellikler && <Row label="Özellikler" value={ozellikler} />}
      {d.imei && <><div className="divider" /><Row label="IMEI" value={d.imei} /></>}
      {d.durum_aciklama && <><div className="divider" /><Row label="Durum / Hasar" value={d.durum_aciklama} /></>}
      {gelenAksesuarlar.length > 0 && <><div className="divider" /><Row label="Gelen Aksesuarlar" value={gelenAksesuarlar.join(", ")} /></>}
      {d.kimden && <><div className="divider" /><Row label="Kimden Alındı" value={d.kimden} /></>}
      {d.satis_kanali && <><div className="divider" /><Row label="Satış Kanalı" value={d.satis_kanali} /></>}
      {d.notlar && <><div className="divider" /><Row label="Not" value={d.notlar} /></>}
    </OzetPencere>
  );
}

function PortalSonucModal({ sonuc, customerName, dukkanSlug, onClose }) {
  const [kopyalandi, setKopyalandi] = useState(false);
  const link = dukkanSlug ? `${window.location.origin}/magaza/${dukkanSlug}/panelim` : null;
  const mesaj = [
    `Merhaba ${customerName},`, "",
    "Müşteri portalı hesap bilgileriniz:",
    `Telefon: ${sonuc.phone}`,
    `Şifre: ${sonuc.gecici_sifre}`,
    link ? `Giriş: ${link}` : null,
  ].filter(Boolean).join("\n");

  async function kopyala() {
    try { await navigator.clipboard.writeText(mesaj); setKopyalandi(true); setTimeout(() => setKopyalandi(false), 2000); }
    catch { alert(mesaj); }
  }
  function whatsapptaGonder() {
    const raw = (sonuc.phone || "").replace(/\D/g, "");
    const num = raw.startsWith("90") ? raw : raw.startsWith("0") ? "9" + raw : "90" + raw;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(mesaj)}`, "_blank");
  }

  return (
    <OzetPencere baslik={sonuc.yeni_hesap ? "Portal Hesabı Oluşturuldu" : "Şifre Sıfırlandı"} ikon={KeyRound} renk="var(--success)" onClose={onClose}>
      <div style={{ fontSize: 12.5, color: "var(--hint)", marginBottom: 12 }}>
        Bu şifre sadece burada bir kez gösteriliyor — müşteriye kendiniz iletin.
      </div>
      <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
        <Row label="Telefon" value={sonuc.phone} />
        <div className="divider" />
        <div className="card-row" style={{ padding: "8px 0" }}>
          <span style={{ color: "var(--hint)", fontSize: 13 }}>Şifre</span>
          <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 15, letterSpacing: 0.5 }}>{sonuc.gecici_sifre}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={kopyala} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {kopyalandi ? <><Check size={14} strokeWidth={2.4} /> Kopyalandı!</> : <><Copy size={14} strokeWidth={2} /> Kopyala</>}
        </button>
        <button className="btn btn-primary btn-sm" onClick={whatsapptaGonder} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <MessageCircle size={14} strokeWidth={2} /> WhatsApp'tan Gönder
        </button>
      </div>
    </OzetPencere>
  );
}

function Row({ label, value }) {
  return (
    <div className="card-row" style={{ padding: "8px 0" }}>
      <span style={{ color: "var(--hint)", fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 500, maxWidth: "60%", textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [debts, setDebts] = useState([]);
  const [gecmis, setGecmis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("ziyaretler");
  const [ozetAcik, setOzetAcik] = useState(null); // "ziyaret" | "tamir" | "harcama" | "bakiye" | null
  const [secilenEtkinlik, setSecilenEtkinlik] = useState(null); // 2.el/sıfır ziyaret detay penceresi
  const [dukkanSlug, setDukkanSlug] = useState(null);
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalSonuc, setPortalSonuc] = useState(null); // { gecici_sifre, phone, yeni_hesap }

  function ozetTumunuGor(hedefTab) {
    setOzetAcik(null);
    setTab(hedefTab);
  }

  useEffect(() => { load(); }, [id]);
  useEffect(() => { api.vitrinAyarlarim().then(r => setDukkanSlug(r.slug)).catch(() => {}); }, []);

  async function load() {
    try {
      const [c, r, d, g] = await Promise.all([
        api.customer(id),
        api.customerRepairs(id),
        api.debts(),
        api.customerGecmis(id),
      ]);
      setCustomer(c);
      setRepairs(r);
      setGecmis(g);
      setForm({ name: c.name, phone: c.phone || "", notes: c.notes || "" });
      setDebts(d.filter(db => db.customer_id === parseInt(id)));
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function portalSifreOlustur() {
    if (customer.portal_uye && !confirm("Mevcut portal şifresi geçersiz olacak ve yeni bir geçici şifre üretilecek. Devam edilsin mi?")) return;
    setPortalSaving(true);
    try {
      const r = await api.customerPortalSifre(id);
      setPortalSonuc(r);
      setCustomer(c => ({ ...c, portal_uye: true }));
    } catch (e) { alert(e.message || "İşlem başarısız"); }
    finally { setPortalSaving(false); }
  }

  async function save(e) {
    e.preventDefault(); setErr("");
    try {
      await api.updateCustomer(id, form);
      setCustomer(c => ({ ...c, ...form }));
      setEdit(false);
    } catch (e) { setErr(e.message); }
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (!customer) return <div className="empty">Müşteri bulunamadı</div>;

  const totalDebt = debts.reduce((s, d) => s + ((d.total_amount || d.amount || 0) - (d.paid_amount || d.paid || 0)), 0);
  const totalRepairs = repairs.reduce((s, r) => s + (r.final_price || r.estimated_price || 0), 0);
  const ziyaretSayisi = gecmis.length;

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <User size={17} strokeWidth={2} /> {customer.name}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setEdit(!edit)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {edit ? "İptal" : <><Pencil size={13} strokeWidth={2} /> Düzenle</>}
        </button>
      </div>

      {err && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}

      {edit ? (
        <div className="card">
          <form onSubmit={save}>
            <div className="form-group">
              <label className="form-label">Ad Soyad *</label>
              <input className="form-input" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Telefon</label>
              <input className="form-input" value={form.phone} inputMode="tel"
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Not</label>
              <input className="form-input" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(false)}>İptal</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 12 }}>
          {customer.phone && (
            <div style={{ fontSize: 14, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}>
              <Phone size={13} stroke="var(--hint)" strokeWidth={2} />
              <a href={`tel:${customer.phone}`} style={{ color: "var(--accent)" }}>{customer.phone}</a>
            </div>
          )}
          {customer.notes && (
            <div style={{ fontSize: 13, color: "var(--hint)", display: "flex", alignItems: "center", gap: 7 }}>
              <FileText size={12} strokeWidth={2} /> {customer.notes}
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 4, display: "flex", alignItems: "center", gap: 7 }}>
            <Calendar size={11} strokeWidth={2} /> Kayıt: {fmt(customer.created_at)}
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--divider)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: customer.portal_uye ? "var(--success)" : "var(--hint)", display: "flex", alignItems: "center", gap: 6 }}>
              <KeyRound size={13} strokeWidth={2} /> {customer.portal_uye ? "Müşteri Portalı: Üye" : "Müşteri Portalı: Hesap yok"}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={portalSifreOlustur} disabled={portalSaving || !customer.phone}
              title={!customer.phone ? "Portal hesabı için telefon numarası gerekli" : undefined}>
              {portalSaving ? "..." : customer.portal_uye ? "Şifreyi Sıfırla" : "Portal Hesabı Oluştur"}
            </button>
          </div>
        </div>
      )}

      {/* Özet */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
        {[
          { key: "ziyaret", val: ziyaretSayisi, label: "Ziyaret", color: "var(--accent)" },
          { key: "tamir", val: repairs.length, label: "Tamir", color: "var(--text)" },
          { key: "harcama", val: `${totalRepairs.toLocaleString("tr-TR")}₺`, label: "Harcama", color: "var(--text)" },
          { key: "bakiye", val: `${Math.abs(totalDebt).toLocaleString("tr-TR")}₺`, label: totalDebt > 0 ? "Borç" : "Bakiye", color: totalDebt > 0 ? "var(--red)" : "var(--success)" },
        ].map(s => (
          <div key={s.label} className="card" onClick={() => setOzetAcik(s.key)}
            style={{ textAlign: "center", margin: 0, padding: "10px 4px", cursor: "pointer" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sekmeler */}
      <div className="tabs" style={{ marginBottom: 10 }}>
        <button className={`tab ${tab === "ziyaretler" ? "active" : ""}`} onClick={() => setTab("ziyaretler")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CalendarCheck size={13} strokeWidth={2} /> Ziyaretler ({ziyaretSayisi})
        </button>
        <button className={`tab ${tab === "tamirler" ? "active" : ""}`} onClick={() => setTab("tamirler")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Wrench size={13} strokeWidth={2} /> Tamirler ({repairs.length})
        </button>
        <button className={`tab ${tab === "borclar" ? "active" : ""}`} onClick={() => setTab("borclar")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CreditCard size={13} strokeWidth={2} /> Borçlar ({debts.length})
        </button>
        <button className={`tab ${tab === "notlar" ? "active" : ""}`} onClick={() => setTab("notlar")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FileText size={13} strokeWidth={2} /> Notlar
        </button>
      </div>

      {/* Ziyaretler - tüm geçmiş */}
      {tab === "ziyaretler" && (
        gecmis.length === 0 ? (
          <div className="empty"><div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><CalendarCheck size={40} stroke="var(--dim)" strokeWidth={1.5} /></div>Henüz kayıt yok</div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* Dikey çizgi */}
            <div style={{
              position: "absolute", left: 15, top: 0, bottom: 0,
              width: 2, background: "var(--divider)",
            }} />
            {gecmis.map((ev, i) => {
              const t = TUR_LABEL[ev.tur] || { icon: null, label: ev.tur, color: "var(--hint)" };
              const TIcon = t.icon;
              return (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, position: "relative" }}>
                  {/* İkon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "var(--bg2)", border: `2px solid ${t.color}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, zIndex: 1,
                  }}>
                    {TIcon ? <TIcon size={14} stroke={t.color} strokeWidth={2} /> : <span style={{ color: t.color }}>•</span>}
                  </div>

                  {/* İçerik */}
                  <div
                    className="card"
                    style={{ flex: 1, margin: 0, padding: "10px 12px", cursor: (ev.repair_id || ev.detay) ? "pointer" : "default" }}
                    onClick={() => ev.repair_id ? navigate(`/repairs/${ev.repair_id}`) : ev.detay && setSecilenEtkinlik(ev)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: t.color,
                          background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4, marginRight: 6,
                        }}>{t.label}</span>
                        {ev.durum && (
                          <span style={{ fontSize: 11, color: "var(--hint)" }}>
                            {STATUS_LABEL[ev.durum] || ev.durum}
                          </span>
                        )}
                      </div>
                      {ev.tutar && (
                        <span style={{ fontWeight: 700, fontSize: 14 }}>
                          {Number(ev.tutar).toLocaleString("tr-TR")}₺
                        </span>
                      )}
                    </div>

                    <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>
                      {ev.repair_no ? `#${ev.repair_no} · ` : ""}{ev.baslik}
                    </div>
                    {ev.alt && <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 2 }}>{ev.alt}</div>}

                    {/* Tamir için alt tarihler */}
                    {ev.tur === "tamir" && (
                      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <DateChip icon={DATE_ICONS.acildi} label="Kayıt" val={ev.tarih} />
                        <DateChip icon={DATE_ICONS.tamirde} label="Tamirde" val={ev.tamirde_at} />
                        <DateChip icon={DATE_ICONS.hazir} label="Hazır" val={ev.completed_at} />
                        <DateChip icon={DATE_ICONS.teslim} label="Teslim" val={ev.delivered_at} />
                      </div>
                    )}

                    {ev.tur !== "tamir" && (
                      <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                        <Calendar size={10} strokeWidth={2} /> {fmtDateTime(ev.tarih) || fmt(ev.tarih)}
                      </div>
                    )}

                    {(ev.repair_id || ev.detay) && (
                      <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4 }}>
                        Detaya git →
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Tamirler */}
      {tab === "tamirler" && (
        repairs.length === 0 ? (
          <div className="empty"><div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><Wrench size={40} stroke="var(--dim)" strokeWidth={1.5} /></div>Tamir kaydı yok</div>
        ) : repairs.map(r => (
          <div key={r.id} className="list-item" onClick={() => navigate(`/repairs/${r.id}`)}>
            <div className="list-item-body">
              <div className="list-item-title">#{r.repair_no} · {r.device_model}</div>
              <div className="list-item-sub">{r.fault_desc || "—"}
                {r.final_price ? ` · ₺${r.final_price}` : r.estimated_price ? ` · ~₺${r.estimated_price}` : ""}
              </div>
              <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span>{fmt(r.created_at)}</span>
                {r.tamirde_at && <span>· {fmt(r.tamirde_at)}</span>}
                {r.completed_at && <span>· {fmt(r.completed_at)}</span>}
                {r.delivered_at && <span>· {fmt(r.delivered_at)}</span>}
              </div>
            </div>
            <span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span>
          </div>
        ))
      )}

      {/* Notlar */}
      {tab === "notlar" && (
        <div className="card">
          {customer.notes ? (
            <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{customer.notes}</div>
          ) : (
            <div style={{ color: "var(--hint)", textAlign: "center", padding: "20px 0" }}>
              <FileText size={30} stroke="var(--dim)" strokeWidth={1.5} style={{ marginBottom: 8 }} />
              <div>Not yok</div>
            </div>
          )}
          {!edit && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => { setEdit(true); setTab("ziyaretler"); }}>
              <Pencil size={13} strokeWidth={2} /> Not Düzenle
            </button>
          )}
        </div>
      )}

      {/* Borçlar */}
      {tab === "borclar" && (
        debts.length === 0 ? (
          <div className="empty"><div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><Banknote size={40} stroke="var(--dim)" strokeWidth={1.5} /></div>Borç kaydı yok</div>
        ) : debts.map(d => {
          const kalan = (d.total_amount || d.amount || 0) - (d.paid_amount || d.paid || 0);
          return (
            <div key={d.id} className="card">
              <div className="card-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{d.description || d.notes || "Borç"}</div>
                  {d.due_date && <div style={{ fontSize: 12, color: "var(--hint)" }}>Vade: {d.due_date}</div>}
                  <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>
                    {fmt(d.created_at)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: kalan > 0 ? "var(--red)" : "var(--success)" }}>
                    ₺{kalan.toLocaleString("tr-TR")}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--hint)" }}>
                    / ₺{(d.total_amount || d.amount || 0).toLocaleString("tr-TR")}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Özet kartları — Ziyaret/Tamir/Harcama/Bakiye tıklanınca küçük pencere */}
      {ozetAcik === "ziyaret" && (
        <OzetPencere baslik="Ziyaretler" ikon={CalendarCheck} renk="var(--accent)"
          onClose={() => setOzetAcik(null)} onTumu={() => ozetTumunuGor("ziyaretler")}>
          {gecmis.length === 0 ? (
            <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Henüz ziyaret yok</div>
          ) : gecmis.slice(0, 8).map((ev, i) => {
            const t = TUR_LABEL[ev.tur] || { label: ev.tur, color: "var(--hint)" };
            return (
              <div key={i} className="card-row" style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.baslik}</div>
                  <div style={{ fontSize: 11, color: t.color, marginTop: 2 }}>{t.label} · {fmt(ev.tarih)}</div>
                </div>
                {ev.tutar ? <span style={{ fontWeight: 700, fontSize: 13 }}>{Number(ev.tutar).toLocaleString("tr-TR")}₺</span> : null}
              </div>
            );
          })}
        </OzetPencere>
      )}

      {ozetAcik === "tamir" && (
        <OzetPencere baslik="Tamirler" ikon={Wrench} renk="var(--blue)"
          onClose={() => setOzetAcik(null)} onTumu={() => ozetTumunuGor("tamirler")}>
          {repairs.length === 0 ? (
            <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Tamir kaydı yok</div>
          ) : repairs.slice(0, 8).map((r, i) => (
            <div key={r.id} className="card-row" style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>#{r.repair_no} · {r.device_model}</div>
                <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>{fmt(r.created_at)}</div>
              </div>
              <span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span>
            </div>
          ))}
        </OzetPencere>
      )}

      {ozetAcik === "harcama" && (
        <OzetPencere baslik="Harcama Dökümü" ikon={Banknote} renk="var(--orange)"
          onClose={() => setOzetAcik(null)} onTumu={() => ozetTumunuGor("tamirler")}>
          <div style={{ fontWeight: 300, fontSize: 24, color: "var(--orange)", letterSpacing: -0.5, marginBottom: 12 }}>
            {totalRepairs.toLocaleString("tr-TR")}₺
          </div>
          {repairs.filter(r => r.final_price || r.estimated_price).length === 0 ? (
            <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Ücretli tamir yok</div>
          ) : repairs.filter(r => r.final_price || r.estimated_price).slice(0, 8).map((r, i) => (
            <div key={r.id} className="card-row" style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>#{r.repair_no} · {r.device_model}</div>
                <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>
                  {r.kullanilan_parcalar ? `${r.kullanilan_parcalar} değişimi` : (r.fault_desc || "—")}
                </div>
                <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>{fmt(r.created_at)}{!r.final_price ? " · tahmini" : ""}</div>
              </div>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{(r.final_price || r.estimated_price).toLocaleString("tr-TR")}₺</span>
            </div>
          ))}
        </OzetPencere>
      )}

      {ozetAcik === "bakiye" && (
        <OzetPencere baslik={totalDebt > 0 ? "Borçlar" : "Bakiye"} ikon={CreditCard} renk={totalDebt > 0 ? "var(--red)" : "var(--success)"}
          onClose={() => setOzetAcik(null)} onTumu={() => ozetTumunuGor("borclar")}>
          {debts.length === 0 ? (
            <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Borç kaydı yok</div>
          ) : debts.slice(0, 8).map((d, i) => {
            const kalan = (d.total_amount || d.amount || 0) - (d.paid_amount || d.paid || 0);
            return (
              <div key={d.id} className="card-row" style={{ padding: "9px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{d.description || d.notes || "Borç"}</div>
                  <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>{fmt(d.created_at)}{d.due_date ? ` · Vade: ${d.due_date}` : ""}</div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, color: kalan > 0 ? "var(--red)" : "var(--success)" }}>
                  {kalan.toLocaleString("tr-TR")}₺
                </span>
              </div>
            );
          })}
        </OzetPencere>
      )}

      {secilenEtkinlik && (
        <EtkinlikDetayModal ev={secilenEtkinlik} onClose={() => setSecilenEtkinlik(null)} />
      )}

      {portalSonuc && (
        <PortalSonucModal sonuc={portalSonuc} customerName={customer.name} dukkanSlug={dukkanSlug}
          onClose={() => setPortalSonuc(null)} />
      )}
    </div>
  );
}

function DateChip({ icon: Icon, label, val }) {
  if (!val) return (
    <span style={{
      fontSize: 10, padding: "2px 6px", borderRadius: 4,
      background: "var(--bg2)", color: "var(--hint)", opacity: 0.5,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>{Icon && <Icon size={9} strokeWidth={2} />} {label}: —</span>
  );
  return (
    <span style={{
      fontSize: 10, padding: "2px 6px", borderRadius: 4,
      background: "rgba(94,168,255,0.15)", color: "var(--blue)", fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {Icon && <Icon size={9} strokeWidth={2} />} {label}: {new Date(val).toLocaleDateString("tr-TR")}
    </span>
  );
}
