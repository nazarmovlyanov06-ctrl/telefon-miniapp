import { useEffect, useMemo, useRef, useState } from "react";
import { api, setToken } from "../api";
import DestekMesajIcerik from "../components/DestekMesajIcerik";
import {
  ShieldAlert, Store, BarChart3, Wallet, LifeBuoy, Activity, Handshake,
  Users, Wrench, TrendingUp, CircleX, Clock, Search, Send, Trash2,
  Plus, X, ChevronUp, ChevronDown, Megaphone, Infinity as InfinityIcon, LogOut,
  Download, Paperclip, AlertTriangle,
} from "lucide-react";

const TABS = [
  { key: "dukkanlar", label: "Dükkânlar", icon: Store },
  { key: "istatistik", label: "İstatistik", icon: BarChart3 },
  { key: "mali", label: "Mali Durum", icon: Wallet },
  { key: "destek", label: "Destek", icon: LifeBuoy },
  { key: "aktivite", label: "Aktivite", icon: Activity },
  { key: "isbirligi", label: "İşbirliği", icon: Handshake },
];

const DURUM_META = {
  deneme: { label: "Deneme", color: "var(--blue)" },
  aktif: { label: "Aktif", color: "var(--green)" },
  askida: { label: "Askıda", color: "var(--orange)" },
  iptal: { label: "İptal", color: "var(--red)" },
};

const tarihFmt = (s) => s ? new Date(s).toLocaleDateString("tr-TR") : "—";
const sonGirisFmt = (s) => {
  if (!s) return "hiç girmedi";
  const gun = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  if (gun <= 0) return "bugün";
  if (gun === 1) return "dün";
  return `${gun} gün önce`;
};

function KalanRozet({ d }) {
  const meta = DURUM_META[d.abonelik_durumu] || { label: d.abonelik_durumu, color: "var(--hint)" };
  if (d.abonelik_durumu !== "aktif" && !(d.abonelik_durumu === "deneme" && d.kalan_gun !== null)) {
    return <span className="badge" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.label}</span>;
  }
  if (d.kalan_gun === null) {
    return <span className="badge" style={{ background: "rgba(74,222,128,0.15)", color: "var(--green)", display: "inline-flex", alignItems: "center", gap: 4 }}><InfinityIcon size={11} strokeWidth={2} /> Süresiz</span>;
  }
  if (d.kalan_gun <= 0) {
    return <span className="badge" style={{ background: "rgba(248,113,113,0.15)", color: "var(--red)" }}>Süresi doldu</span>;
  }
  const renk = d.kalan_gun <= 5 ? "var(--orange)" : "var(--green)";
  return <span className="badge" style={{ background: `${renk}22`, color: renk }}>{d.kalan_gun} gün kaldı</span>;
}

// ── Dükkânlar sekmesi ────────────────────────────────────────────────────

function TenantYonet({ dukkan, planlar, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [kesinTarih, setKesinTarih] = useState("");
  const [plan, setPlan] = useState(dukkan.plan || "deneme");
  const [gecici, setGecici] = useState(null);

  async function sifreSifirla() {
    if (!confirm(`"${dukkan.ad}" dükkanının patron şifresi sıfırlanacak ve yeni bir geçici şifre üretilecek. Mevcut şifresiyle artık giremeyecek.\n\nDevam edilsin mi?`)) return;
    setBusy(true); setErr("");
    try {
      const r = await api.adminSifreSifirla(dukkan.id);
      setGecici(r);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function islem(fn) {
    setBusy(true); setErr("");
    try { await fn(); onChanged(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end" }}
      onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{dukkan.ad}</div>
            <div style={{ fontSize: 12, color: "var(--hint)" }}>{dukkan.patron_ad || "—"} · {dukkan.patron_email || "—"}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={15} strokeWidth={2} /></button>
        </div>

        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <KalanRozet d={dukkan} />
          <span style={{ fontSize: 12, color: "var(--hint)" }}>Bitiş: {dukkan.abonelik_bitis ? tarihFmt(dukkan.abonelik_bitis) : "—"}</span>
        </div>

        <div className="section-title">Şifre</div>
        {gecici ? (
          <div style={{ background: "var(--bg2)", borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 4 }}>
              Yeni geçici şifre — bu ekranı kapatınca bir daha gösterilmez, şimdi kopyalayın:
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "var(--gold)", wordBreak: "break-all" }}>
              {gecici.gecici_sifre}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--hint)", marginTop: 4 }}>{gecici.email}</div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}
              onClick={() => navigator.clipboard?.writeText(gecici.gecici_sifre)}>Kopyala</button>
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <button disabled={busy} className="btn btn-ghost btn-sm" onClick={sifreSifirla}>
              Şifre Sıfırla
            </button>
            <div style={{ fontSize: 11.5, color: "var(--hint)", marginTop: 4 }}>
              Patron şifresini unuttuysa geçici bir şifre üretir.
            </div>
          </div>
        )}

        <div className="section-title">Süre Uzat</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {[7, 30, 365].map(g => (
            <button key={g} disabled={busy} className="btn btn-ghost btn-sm"
              onClick={() => islem(() => api.adminSureUzat(dukkan.id, { gun: g }))}>+{g} gün</button>
          ))}
          <button disabled={busy} className="btn btn-ghost btn-sm"
            onClick={() => islem(() => api.adminSureUzat(dukkan.id, { suresiz: true }))}>
            <InfinityIcon size={13} strokeWidth={2} /> Süresiz
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input className="form-input" type="date" value={kesinTarih} onChange={e => setKesinTarih(e.target.value)} style={{ flex: 1 }} />
          <button disabled={busy || !kesinTarih} className="btn btn-primary btn-sm"
            onClick={() => islem(() => api.adminSureUzat(dukkan.id, { tarih: `${kesinTarih}T23:59:59` }))}>
            Kesin Tarih Ata
          </button>
        </div>

        <div className="section-title">Abonelik Durumu</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {Object.entries(DURUM_META).map(([key, m]) => (
            <button key={key} disabled={busy || dukkan.abonelik_durumu === key}
              onClick={() => islem(() => api.adminSetAbonelik(dukkan.id, key))}
              className="btn btn-ghost btn-sm"
              style={{ opacity: dukkan.abonelik_durumu === key ? 0.4 : 1, color: m.color }}>
              {m.label}
            </button>
          ))}
        </div>

        {planlar && planlar.length > 0 && (
          <>
            <div className="section-title">Plan</div>
            <div style={{ display: "flex", gap: 8 }}>
              <select className="form-select" value={plan} onChange={e => setPlan(e.target.value)} style={{ flex: 1 }}>
                {planlar.map(p => <option key={p.tur} value={p.tur}>{p.ad} — {p.fiyat.toLocaleString("tr-TR")}₺/ay</option>)}
              </select>
              <button className="btn btn-primary btn-sm" disabled={busy || plan === dukkan.plan}
                onClick={() => islem(() => api.adminSetPlan(dukkan.id, plan))}>Kaydet</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DuyuruYaz({ aliciSayisi, onGonder, onClose }) {
  const [mesaj, setMesaj] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function gonder() {
    if (!mesaj.trim()) return;
    setBusy(true); setErr("");
    try { await onGonder(mesaj.trim()); onClose(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end" }}
      onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "20px 20px 0 0" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Megaphone size={16} strokeWidth={2} />
          <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Duyuru Gönder</div>
          <span style={{ fontSize: 12, color: "var(--hint)" }}>{aliciSayisi} alıcı</span>
        </div>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <textarea className="form-input" rows={4} maxLength={1000} value={mesaj}
          onChange={e => setMesaj(e.target.value)} placeholder="Duyuru metni..."
          style={{ width: "100%", resize: "vertical", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" disabled={busy || !mesaj.trim()} onClick={gonder}>Gönder</button>
          <button className="btn btn-ghost" onClick={onClose}>İptal</button>
        </div>
      </div>
    </div>
  );
}

function SilinecekDukkanlarPaneli({ onChanged }) {
  const [liste, setListe] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busyId, setBusyId] = useState(null);

  function yukle() {
    api.adminSilinecekDukkanlar().then(setListe).catch(() => {}).finally(() => setYukleniyor(false));
  }
  useEffect(() => { yukle(); }, []);

  async function iptalEt(d) {
    setBusyId(d.id);
    try { await api.adminSilmeIptal(d.id); yukle(); onChanged(); }
    catch (e) { alert(e.message); }
    finally { setBusyId(null); }
  }

  async function kaliciSil(d) {
    const girilen = prompt(`"${d.ad}" dükkanına ait TÜM veriler (müşteri, tamir, stok, kullanıcı — her şey) kalıcı olarak silinecek. Bu işlem GERİ ALINAMAZ.\n\nOnaylamak için dükkan adını aynen yazın:`);
    if (girilen === null) return;
    if (girilen.trim() !== d.ad) { alert("Girilen ad eşleşmedi, işlem iptal edildi."); return; }
    setBusyId(d.id);
    try { await api.adminKaliciSil(d.id, girilen.trim()); yukle(); onChanged(); }
    catch (e) { alert(e.message); }
    finally { setBusyId(null); }
  }

  if (yukleniyor || liste.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 14, borderLeft: "3px solid var(--danger)" }}>
      <div style={{ fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 7, color: "var(--danger)" }}>
        <AlertTriangle size={15} strokeWidth={2} /> Silme Talebi Olan Dükkânlar ({liste.length})
      </div>
      {liste.map(d => (
        <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--divider)" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{d.ad}</div>
            <div style={{ fontSize: 11.5, color: "var(--hint)" }}>
              Talep: {tarihFmt(d.silme_talep_tarihi)} · Kalıcı silme: {tarihFmt(d.kalici_silme_tarihi)}
              {!d.silinebilir && " · bekleme süresi dolmadı"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" disabled={busyId === d.id} onClick={() => iptalEt(d)}>İptal Et</button>
            <button className="btn btn-sm" style={{ background: "var(--danger)", color: "#fff" }}
              disabled={!d.silinebilir || busyId === d.id} onClick={() => kaliciSil(d)}>Kalıcı Sil</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SortTh({ label, col, sort, setSort }) {
  const active = sort.col === col;
  return (
    <th className="sortable" onClick={() => setSort(s => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }))}>
      <span className="th-inner">{label}{active && (sort.dir === "asc" ? <ChevronUp size={12} strokeWidth={2.4} /> : <ChevronDown size={12} strokeWidth={2.4} />)}</span>
    </th>
  );
}

function DukkanlarTab({ ozet, onOzetChanged }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sadeceYaklasan, setSadeceYaklasan] = useState(false);
  const [detay, setDetay] = useState(null);
  const [secililer, setSecililer] = useState([]);
  const [duyuruAcik, setDuyuruAcik] = useState(false);
  const [topluBusy, setTopluBusy] = useState(false);
  const [sort, setSort] = useState({ col: "created_at", dir: "desc" });
  const [planlar, setPlanlar] = useState([]);

  useEffect(() => { load(); api.adminPlanlar().then(setPlanlar).catch(() => {}); }, []);

  async function load() {
    setLoading(true);
    try { setList(await api.adminDukkanlar()); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  const filtered = useMemo(() => {
    let out = [...list];
    if (sadeceYaklasan) out = out.filter(d => d.kalan_gun !== null && d.kalan_gun <= 5 && d.abonelik_durumu === "aktif");
    if (q.trim()) {
      const query = q.trim().toLowerCase();
      out = out.filter(d => d.ad.toLowerCase().includes(query) || (d.patron_ad || "").toLowerCase().includes(query) || (d.patron_email || "").toLowerCase().includes(query));
    }
    const { col, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      let av = a[col], bv = b[col];
      if (col === "created_at" || col === "son_giris") { av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0; }
      else { av = (av ?? "").toString().toLowerCase(); bv = (bv ?? "").toString().toLowerCase(); }
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return out;
  }, [list, q, sadeceYaklasan, sort]);

  const aktifSayisi = list.filter(d => d.abonelik_durumu === "aktif").length;
  const birHaftaOnce = Date.now() - 7 * 86400000;
  const buHaftaYeni = list.filter(d => new Date(d.created_at).getTime() >= birHaftaOnce).length;

  function toggleSec(id) {
    setSecililer(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  async function topluSureUzat(gun) {
    setTopluBusy(true);
    try {
      await api.adminTopluSureUzat(secililer, gun);
      setSecililer([]);
      load();
    } catch (e) { alert(e.message); }
    finally { setTopluBusy(false); }
  }

  async function duyuruGonder(mesaj) {
    await api.adminDuyuruGonder(secililer, mesaj);
    setSecililer([]);
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (err) return <div style={{ color: "var(--danger)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>;

  return (
    <>
      <SilinecekDukkanlarPaneli onChanged={load} />
      <div className="stats-grid" style={{ marginBottom: 14 }}>
        <div className="stat-card"><div style={{ fontSize: 24, fontWeight: 800 }}>{list.length}</div><div className="stat-label">Toplam Dükkân</div></div>
        <div className="stat-card"><div style={{ fontSize: 24, fontWeight: 800, color: "var(--green)" }}>{aktifSayisi}</div><div className="stat-label">Aktif</div></div>
        <div className="stat-card"><div style={{ fontSize: 24, fontWeight: 800, color: "var(--blue)" }}>{buHaftaYeni}</div><div className="stat-label">Bu Hafta Yeni</div></div>
        <div className="stat-card"><div style={{ fontSize: 24, fontWeight: 800, color: "var(--orange)" }}>{ozet?.abonelik_yaklasan ?? 0}</div><div className="stat-label">Süresi Yaklaşan</div></div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div className="inset search-input" style={{ borderRadius: 12, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", maxWidth: 280 }}>
          <Search size={14} stroke="var(--hint)" strokeWidth={2} />
          <input style={{ background: "none", border: "none", outline: "none", color: "var(--text)", font: "inherit", fontSize: 13, flex: 1 }}
            placeholder="Dükkân, patron ara..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--hint)" }}>
          <input type="checkbox" checked={sadeceYaklasan} onChange={e => setSadeceYaklasan(e.target.checked)} />
          Sadece süresi yaklaşan/dolmuş
        </label>
      </div>

      {secililer.length > 0 && (
        <div className="card" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10, padding: "10px 14px" }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{secililer.length} seçili</span>
          <button className="btn btn-ghost btn-sm" disabled={topluBusy} onClick={() => topluSureUzat(7)}>+7 gün (toplu)</button>
          <button className="btn btn-ghost btn-sm" disabled={topluBusy} onClick={() => topluSureUzat(30)}>+30 gün (toplu)</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setDuyuruAcik(true)} style={{ display: "flex", alignItems: "center", gap: 5 }}><Megaphone size={12} strokeWidth={2} /> Duyuru Gönder</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSecililer([])}>Seçimi Temizle</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty"><div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><Store size={40} stroke="var(--dim)" strokeWidth={1.5} /></div>Kayıt yok</div>
      ) : (
        <>
          <div className="mobile-list">
            {filtered.map(d => (
              <div key={d.id} className="card" style={{ marginBottom: 8 }}>
                <div className="card-row" style={{ alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <input type="checkbox" checked={secililer.includes(d.id)} onChange={() => toggleSec(d.id)} style={{ marginTop: 4 }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{d.ad}</div>
                      <div style={{ fontSize: 12, color: "var(--hint)" }}>{d.patron_ad || "—"} · {d.patron_email || "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 3, display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Users size={10} strokeWidth={2} /> {d.kullanici_sayisi}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Wrench size={10} strokeWidth={2} /> {d.tamir_sayisi}</span>
                        <span>{sonGirisFmt(d.son_giris)}</span>
                      </div>
                    </div>
                  </div>
                  <KalanRozet d={d} />
                </div>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setDetay(d)}>Yönet</button>
              </div>
            ))}
          </div>

          <div className="desktop-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox"
                      checked={filtered.length > 0 && filtered.every(d => secililer.includes(d.id))}
                      onChange={e => setSecililer(e.target.checked ? filtered.map(d => d.id) : [])} />
                  </th>
                  <SortTh label="Dükkân" col="ad" sort={sort} setSort={setSort} />
                  <th>Patron</th>
                  <SortTh label="Kayıt" col="created_at" sort={sort} setSort={setSort} />
                  <SortTh label="Son Giriş" col="son_giris" sort={sort} setSort={setSort} />
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id}>
                    <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={secililer.includes(d.id)} onChange={() => toggleSec(d.id)} /></td>
                    <td style={{ fontWeight: 600 }}>{d.ad}</td>
                    <td>
                      <div>{d.patron_ad || "—"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--hint)" }}>{d.patron_email || ""}</div>
                    </td>
                    <td>{tarihFmt(d.created_at)}</td>
                    <td style={{ color: (!d.son_giris || (Date.now() - new Date(d.son_giris).getTime()) > 14 * 86400000) ? "var(--orange)" : "inherit" }}>
                      {sonGirisFmt(d.son_giris)}
                    </td>
                    <td><KalanRozet d={d} /></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => setDetay(d)}>Yönet</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {detay && (
        <TenantYonet dukkan={detay} planlar={planlar} onClose={() => setDetay(null)}
          onChanged={() => { setDetay(null); load(); onOzetChanged(); }} />
      )}
      {duyuruAcik && (
        <DuyuruYaz aliciSayisi={secililer.length} onGonder={duyuruGonder} onClose={() => setDuyuruAcik(false)} />
      )}
    </>
  );
}

// ── İstatistik sekmesi ───────────────────────────────────────────────────

function BuyumeGrafigi({ haftalar }) {
  if (!haftalar || haftalar.length === 0) return null;
  const W = 640, H = 180, PAD_L = 8, PAD_R = 8, PAD_T = 10, PAD_B = 22;
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const n = haftalar.length;
  const maxYeni = Math.max(1, ...haftalar.map(h => h.yeni));
  const maxKum = Math.max(1, ...haftalar.map(h => h.kumulatif));
  const barW = (plotW / n) * 0.5;
  const xFor = (i) => PAD_L + (plotW / n) * (i + 0.5);
  const yBar = (v) => PAD_T + plotH - (v / maxYeni) * plotH;
  const yLine = (v) => PAD_T + plotH - (v / maxKum) * plotH;
  const cizgi = haftalar.map((h, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yLine(h.kumulatif)}`).join(" ");

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Dükkân Büyümesi</div>
      <div style={{ fontSize: 11.5, color: "var(--hint)", marginBottom: 10 }}>Barlar: haftalık yeni kayıt · Çizgi: kümülatif toplam</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {haftalar.map((h, i) => (
          <rect key={i} x={xFor(i) - barW / 2} y={yBar(h.yeni)} width={barW} height={plotH - (yBar(h.yeni) - PAD_T)} fill="var(--blue)" opacity="0.55" rx="2" />
        ))}
        <path d={cizgi} fill="none" stroke="var(--gold)" strokeWidth="2" />
        {haftalar.map((h, i) => (
          <circle key={i} cx={xFor(i)} cy={yLine(h.kumulatif)} r="2.5" fill="var(--gold)" />
        ))}
        {haftalar.map((h, i) => (
          i % 2 === 0 && <text key={i} x={xFor(i)} y={H - 4} fontSize="9" fill="var(--hint)" textAnchor="middle">
            {new Date(h.bas).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}
          </text>
        ))}
      </svg>
    </div>
  );
}

function IstatistikTab() {
  const [stat, setStat] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { api.adminIstatistik().then(setStat).catch(e => setErr(e.message)); }, []);

  if (err) return <div style={{ color: "var(--danger)", fontSize: 13 }}>{err}</div>;
  if (!stat) return <div className="loading">Yükleniyor...</div>;

  const CARDS = [
    { label: "Toplam Dükkân", value: stat.toplam_dukkan, icon: Store, color: "var(--blue)" },
    { label: "Aktif Abonelik", value: stat.aktif_dukkan, icon: TrendingUp, color: "var(--green)" },
    { label: "Deneme Sürümü", value: stat.deneme_dukkan, icon: Clock, color: "var(--gold)" },
    { label: "Askıda", value: stat.askida_dukkan, icon: ShieldAlert, color: "var(--orange)" },
    { label: "Aktif Kullanıcı", value: stat.toplam_kullanici, icon: Users, color: "var(--purple)" },
    { label: "Toplam Tamir", value: stat.toplam_tamir, icon: Wrench, color: "var(--blue2)" },
  ];

  return (
    <>
      <BuyumeGrafigi haftalar={stat.haftalik_buyume} />
      <div className="stats-grid">
        {CARDS.map(c => (
          <div key={c.label} className="stat-card">
            <c.icon size={18} stroke={c.color} strokeWidth={2} />
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{c.value ?? 0}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Mali Durum sekmesi ───────────────────────────────────────────────────

const GIDER_TURLERI = [
  { value: "reklam", label: "Reklam" },
  { value: "gelistirme", label: "Geliştirme" },
  { value: "sunucu", label: "Sunucu" },
  { value: "diger", label: "Diğer" },
];

function PlanFiyatlari() {
  const [planlar, setPlanlar] = useState([]);
  const [duzenle, setDuzenle] = useState(false);
  const [taslak, setTaslak] = useState({});

  function load() { api.adminPlanlar().then(p => { setPlanlar(p); setTaslak(Object.fromEntries(p.map(x => [x.tur, x.fiyat]))); }); }
  useEffect(() => { load(); }, []);

  async function kaydet() {
    for (const p of planlar) {
      if (taslak[p.tur] !== p.fiyat) await api.adminPlanFiyatGuncelle(p.tur, parseFloat(taslak[p.tur]));
    }
    setDuzenle(false);
    load();
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: duzenle ? 10 : 0 }}>
        <div className="section-title" style={{ margin: 0 }}>Plan Fiyatları</div>
        <button className="btn btn-ghost btn-sm" onClick={() => duzenle ? kaydet() : setDuzenle(true)}>{duzenle ? "Kaydet" : "Düzenle"}</button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: duzenle ? 0 : 10 }}>
        {planlar.map(p => (
          <div key={p.tur} style={{ fontSize: 13 }}>
            <span style={{ color: "var(--hint)" }}>{p.ad}: </span>
            {duzenle ? (
              <input className="form-input" type="number" style={{ width: 90, display: "inline-block" }}
                value={taslak[p.tur] ?? p.fiyat} onChange={e => setTaslak(t => ({ ...t, [p.tur]: e.target.value }))} />
            ) : (
              <span style={{ fontWeight: 700 }}>{p.fiyat.toLocaleString("tr-TR")}₺</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MaliDurumTab() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ tur: "sunucu", tutar: "", aciklama: "", tarih: new Date().toISOString().slice(0, 10) });
  const [formErr, setFormErr] = useState("");
  const [exporting, setExporting] = useState(false);

  function load() { api.adminMaliDurum().then(setData).catch(e => setErr(e.message)); }
  useEffect(() => { load(); }, []);

  async function disaAktar() {
    setExporting(true);
    try { await api.adminMaliDurumExport(); } catch (e) { alert(e.message); } finally { setExporting(false); }
  }

  async function ekle(e) {
    e.preventDefault(); setFormErr("");
    try {
      await api.adminGiderEkle({ ...form, tutar: parseFloat(form.tutar) });
      setForm(f => ({ ...f, tutar: "", aciklama: "" }));
      load();
    } catch (e) { setFormErr(e.message); }
  }

  async function sil(id) {
    if (!confirm("Bu gider silinsin mi?")) return;
    await api.adminGiderSil(id);
    load();
  }

  if (err) return <div style={{ color: "var(--danger)", fontSize: 13 }}>{err}</div>;
  if (!data) return <div className="loading">Yükleniyor...</div>;

  return (
    <>
      <div className="stats-grid" style={{ marginBottom: 14 }}>
        <div className="stat-card"><div style={{ fontSize: 24, fontWeight: 800, color: "var(--green)" }}>{data.aktif_dukkan_sayisi}</div><div className="stat-label">Aktif Abone</div></div>
        <div className="stat-card"><div style={{ fontSize: 24, fontWeight: 800, color: "var(--blue)" }}>{data.tahmini_aylik_gelir.toLocaleString("tr-TR")}₺</div><div className="stat-label">Tahmini Aylık Gelir</div></div>
        <div className="stat-card"><div style={{ fontSize: 24, fontWeight: 800, color: "var(--red)" }}>{data.toplam_gider.toLocaleString("tr-TR")}₺</div><div className="stat-label">Toplam Gider</div></div>
        <div className="stat-card"><div style={{ fontSize: 24, fontWeight: 800, color: data.net >= 0 ? "var(--green)" : "var(--red)" }}>{data.net.toLocaleString("tr-TR")}₺</div><div className="stat-label">Net</div></div>
      </div>

      <PlanFiyatlari />

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 0, marginBottom: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>Yeni Gider Ekle</div>
          <button className="btn btn-ghost btn-sm" disabled={exporting} onClick={disaAktar} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Download size={12} strokeWidth={2} /> Excel
          </button>
        </div>
        <form onSubmit={ekle}>
          {formErr && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{formErr}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <select className="form-select" value={form.tur} onChange={e => setForm(f => ({ ...f, tur: e.target.value }))}>
              {GIDER_TURLERI.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input className="form-input" type="number" step="0.01" required placeholder="Tutar (₺)"
              value={form.tutar} onChange={e => setForm(f => ({ ...f, tutar: e.target.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <input className="form-input" type="date" value={form.tarih} onChange={e => setForm(f => ({ ...f, tarih: e.target.value }))} />
            <input className="form-input" placeholder="Açıklama (opsiyonel)" value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}><Plus size={13} strokeWidth={2.4} /> Ekle</button>
        </form>
      </div>

      {data.giderler.length === 0 ? (
        <div className="empty">Henüz gider yok</div>
      ) : data.giderler.map(g => (
        <div key={g.id} className="list-item">
          <div className="list-item-body">
            <div className="list-item-title">{GIDER_TURLERI.find(t => t.value === g.tur)?.label || g.tur}{g.aciklama ? ` — ${g.aciklama}` : ""}</div>
            <div className="list-item-sub">{g.tarih}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 700, color: "var(--red)" }}>{g.tutar.toLocaleString("tr-TR")}₺</span>
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => sil(g.id)}><Trash2 size={13} strokeWidth={2} /></button>
          </div>
        </div>
      ))}
    </>
  );
}

// ── Destek sekmesi ───────────────────────────────────────────────────────

function DestekTab() {
  const [konusmalar, setKonusmalar] = useState([]);
  const [secili, setSecili] = useState(null);
  const [mesajlar, setMesajlar] = useState([]);
  const [yeniMesaj, setYeniMesaj] = useState("");
  const [busy, setBusy] = useState(false);
  const dosyaInputRef = useRef(null);

  function loadKonusmalar() { api.adminDestekKonusmalari().then(setKonusmalar).catch(() => {}); }
  useEffect(() => { loadKonusmalar(); }, []);

  async function ac(k) {
    setSecili(k);
    const data = await api.adminDestekGecmisi(k.dukkan_id);
    setMesajlar(data);
    loadKonusmalar();
  }

  async function gonder() {
    if (!yeniMesaj.trim() || !secili) return;
    setBusy(true);
    try {
      await api.adminDestekYanitla(secili.dukkan_id, yeniMesaj.trim());
      setYeniMesaj("");
      const data = await api.adminDestekGecmisi(secili.dukkan_id);
      setMesajlar(data);
    } finally { setBusy(false); }
  }

  async function dosyaSec(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !secili) return;
    setBusy(true);
    try {
      await api.adminDestekDosyaYanitla(secili.dukkan_id, file);
      const data = await api.adminDestekGecmisi(secili.dukkan_id);
      setMesajlar(data);
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: secili ? "260px 1fr" : "1fr", gap: 12 }}>
      <div>
        {konusmalar.length === 0 ? (
          <div className="empty" style={{ padding: 24 }}>Henüz destek mesajı yok</div>
        ) : konusmalar.map(k => (
          <div key={k.dukkan_id} className="list-item" onClick={() => ac(k)}
            style={{ background: secili?.dukkan_id === k.dukkan_id ? "var(--bg2)" : undefined, cursor: "pointer" }}>
            <div className="list-item-body">
              <div className="list-item-title">{k.dukkan_ad}</div>
              <div className="list-item-sub">{k.son_mesaj || "—"}</div>
            </div>
            {k.okunmamis > 0 && (
              <span style={{ background: "var(--red)", color: "#191b20", borderRadius: "50%", width: 20, height: 20, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {k.okunmamis}
              </span>
            )}
          </div>
        ))}
      </div>

      {secili && (
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 400 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>{secili.dukkan_ad}</div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {mesajlar.map(m => (
              <div key={m.id} style={{
                alignSelf: m.gonderen_rol === "platform" ? "flex-end" : "flex-start",
                maxWidth: "78%", padding: "8px 12px", borderRadius: 12,
                background: m.gonderen_rol === "platform" ? "var(--accent)" : "var(--bg2)",
                color: m.gonderen_rol === "platform" ? "#fff" : "var(--text)",
              }}>
                <DestekMesajIcerik mesaj={m.mesaj} dosyaUrl={m.dosya_url} dosyaAdi={m.dosya_adi} dosyaTipi={m.dosya_tipi} />
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}>{new Date(m.created_at).toLocaleString("tr-TR")}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="file" ref={dosyaInputRef} onChange={dosyaSec} style={{ display: "none" }}
              accept="image/*,.pdf,audio/*,video/*" />
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => dosyaInputRef.current?.click()}
              style={{ display: "flex", alignItems: "center", padding: "0 10px" }}>
              <Paperclip size={14} strokeWidth={2} />
            </button>
            <input className="form-input" style={{ flex: 1 }} placeholder="Yanıt yaz..." value={yeniMesaj}
              onChange={e => setYeniMesaj(e.target.value)} onKeyDown={e => e.key === "Enter" && gonder()} />
            <button className="btn btn-primary btn-sm" disabled={busy || !yeniMesaj.trim()} onClick={gonder}><Send size={14} strokeWidth={2} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aktivite sekmesi ─────────────────────────────────────────────────────

const AKSIYON_ETIKET = {
  durum: "Durum değişti", sure_uzat: "Süre uzatıldı", destek_yanit: "Destek yanıtlandı", duyuru: "Duyuru gönderildi",
};

function AktiviteTab() {
  const [kayitlar, setKayitlar] = useState(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { api.adminAudit().then(setKayitlar).catch(() => setKayitlar([])); }, []);

  async function disaAktar() {
    setExporting(true);
    try { await api.adminAuditExport(); } catch (e) { alert(e.message); } finally { setExporting(false); }
  }

  if (!kayitlar) return <div className="loading">Yükleniyor...</div>;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button className="btn btn-ghost btn-sm" disabled={exporting} onClick={disaAktar} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Download size={12} strokeWidth={2} /> Excel
        </button>
      </div>
      {kayitlar.length === 0 ? <div className="empty">Henüz aktivite yok</div> : (
      <>
      <div className="mobile-list">
        {kayitlar.map(k => (
          <div key={k.id} className="list-item">
            <div className="list-item-body">
              <div className="list-item-title">{k.dukkan_ad || "—"} — {AKSIYON_ETIKET[k.aksiyon] || k.aksiyon}</div>
              <div className="list-item-sub">{k.detay || ""}</div>
            </div>
            <div style={{ fontSize: 11, color: "var(--hint)", whiteSpace: "nowrap" }}>{new Date(k.created_at).toLocaleString("tr-TR")}</div>
          </div>
        ))}
      </div>
      <div className="desktop-table-wrap">
        <table className="data-table">
          <thead><tr><th>Tarih</th><th>Dükkân</th><th>İşlem</th><th>Detay</th></tr></thead>
          <tbody>
            {kayitlar.map(k => (
              <tr key={k.id}>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(k.created_at).toLocaleString("tr-TR")}</td>
                <td style={{ fontWeight: 600 }}>{k.dukkan_ad || "—"}</td>
                <td>{AKSIYON_ETIKET[k.aksiyon] || k.aksiyon}</td>
                <td style={{ color: "var(--hint)" }}>{k.detay || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </>
  );
}

// ── İşbirliği sekmesi ────────────────────────────────────────────────────

function IsbirligiTab() {
  const [liste, setListe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ kod: "", sahip_adi: "", aciklama: "", indirim_yuzdesi: "0", komisyon_yuzdesi: "0" });
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");

  function load() { api.adminReferansKodlari().then(setListe).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, []);

  async function ekle(e) {
    e.preventDefault(); setErr("");
    try {
      await api.adminReferansKoduEkle({
        ...form,
        indirim_yuzdesi: parseInt(form.indirim_yuzdesi) || 0,
        komisyon_yuzdesi: parseInt(form.komisyon_yuzdesi) || 0,
      });
      setForm({ kod: "", sahip_adi: "", aciklama: "", indirim_yuzdesi: "0", komisyon_yuzdesi: "0" });
      setShowForm(false);
      load();
    } catch (e) { setErr(e.message); }
  }

  async function aktiflikDegistir(id) { await api.adminReferansKoduAktiflik(id); load(); }
  async function sil(id) { if (!confirm("Bu kod silinsin mi?")) return; await api.adminReferansKoduSil(id); load(); }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <>
      <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 14, lineHeight: 1.5 }}>
        Kayıt linkine <code>?ref=kod</code> eklenerek paylaşılan referans kodları — dükkân o linkten
        kayıt olduğunda kodu otomatik alır. Kayıt sayısı burada, tıklama sayısı için Faz 4'te
        tanıtım sitesine bağlanacak.
      </div>

      <button className="btn btn-primary btn-sm" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}
        onClick={() => setShowForm(v => !v)}><Plus size={13} strokeWidth={2.4} /> Yeni Referans Kodu</button>

      {showForm && (
        <div className="card" style={{ marginBottom: 14 }}>
          <form onSubmit={ekle}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <input className="form-input" placeholder="Kod (örn: ahmet10)" required value={form.kod}
                onChange={e => setForm(f => ({ ...f, kod: e.target.value }))} />
              <input className="form-input" placeholder="Sahibi" required value={form.sahip_adi}
                onChange={e => setForm(f => ({ ...f, sahip_adi: e.target.value }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <input className="form-input" type="number" placeholder="İndirim %" value={form.indirim_yuzdesi}
                onChange={e => setForm(f => ({ ...f, indirim_yuzdesi: e.target.value }))} />
              <input className="form-input" type="number" placeholder="Komisyon %" value={form.komisyon_yuzdesi}
                onChange={e => setForm(f => ({ ...f, komisyon_yuzdesi: e.target.value }))} />
            </div>
            <input className="form-input" placeholder="Not (opsiyonel)" value={form.aciklama}
              onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} style={{ marginBottom: 10 }} />
            <button type="submit" className="btn btn-primary btn-sm">Ekle</button>
          </form>
        </div>
      )}

      {liste.length === 0 ? (
        <div className="empty"><div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><Handshake size={40} stroke="var(--dim)" strokeWidth={1.5} /></div>Henüz referans kodu yok</div>
      ) : liste.map(k => (
        <div key={k.id} className="list-item">
          <div className="list-item-body">
            <div className="list-item-title">{k.kod} — {k.sahip_adi}</div>
            <div className="list-item-sub">İndirim %{k.indirim_yuzdesi} · Komisyon %{k.komisyon_yuzdesi} · {k.kayit} kayıt{k.aciklama ? ` · ${k.aciklama}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="badge" style={{ background: k.aktif ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)", color: k.aktif ? "var(--green)" : "var(--red)" }}>
              {k.aktif ? "Aktif" : "Pasif"}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => aktiflikDegistir(k.id)}>{k.aktif ? "Pasifleştir" : "Aktifleştir"}</button>
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => sil(k.id)}><Trash2 size={13} strokeWidth={2} /></button>
          </div>
        </div>
      ))}
    </>
  );
}

// ── Ana sayfa ────────────────────────────────────────────────────────────

function cikisYap() {
  if (!confirm("Çıkış yapmak istediğine emin misin?")) return;
  setToken(null);
  window.location.href = "/giris";
}

export default function SuperAdmin() {
  const [tab, setTab] = useState("dukkanlar");
  const [ozet, setOzet] = useState(null);

  function loadOzet() { api.adminOzet().then(setOzet).catch(() => {}); }
  useEffect(() => {
    loadOzet();
    const id = setInterval(loadOzet, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
        borderBottom: "1px solid var(--divider)", position: "sticky", top: 0,
        background: "var(--bg)", zIndex: 50,
      }}>
        <ShieldAlert size={20} strokeWidth={2} stroke="var(--orange)" />
        <div style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>Süper Admin Paneli</div>
        <button className="btn btn-ghost btn-sm" onClick={cikisYap}
          style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--danger)" }}>
          <LogOut size={14} strokeWidth={2} /> Çıkış
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px 60px" }}>

      {ozet && (ozet.abonelik_yaklasan > 0 || ozet.destek_okunmamis > 0) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {ozet.abonelik_yaklasan > 0 && (
            <button onClick={() => setTab("dukkanlar")}
              style={{ padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "rgba(246,162,74,0.15)", color: "var(--orange)" }}>
              {ozet.abonelik_yaklasan} abonelik süresi yaklaşıyor/doldu
            </button>
          )}
          {ozet.destek_okunmamis > 0 && (
            <button onClick={() => setTab("destek")}
              style={{ padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}>
              {ozet.destek_okunmamis} okunmamış destek mesajı
            </button>
          )}
        </div>
      )}

      <div className="tabs" style={{ marginBottom: 14 }}>
        {TABS.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dukkanlar" && <DukkanlarTab ozet={ozet} onOzetChanged={loadOzet} />}
      {tab === "istatistik" && <IstatistikTab />}
      {tab === "mali" && <MaliDurumTab />}
      {tab === "destek" && <DestekTab />}
      {tab === "aktivite" && <AktiviteTab />}
      {tab === "isbirligi" && <IsbirligiTab />}
      </div>
    </div>
  );
}
