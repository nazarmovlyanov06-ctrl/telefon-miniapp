import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fotoUrl } from "../api";
import {
  Tag, CircleX, TriangleAlert, Trash2, Search, Filter, X, Pencil,
  Headphones, ArrowDownCircle, ArrowUpCircle, RefreshCw, Phone, Package,
  Truck, PackagePlus, Printer, ScanLine, Camera,
} from "lucide-react";
import UrunGorsel from "../components/UrunGorsel";
import OdemeBolustur, { varsayilanOdemeSatirlari } from "../components/OdemeBolustur";
import BarcodeScanner from "../components/BarcodeScanner";
import { EtiketIcerik, etiketSayfaBoyutuAyarla, ETIKET_AYAR_VARSAYILAN } from "../components/UrunEtiketi";

const DEFAULT_CATS = ["Şarj Aleti", "Kılıf", "Kırılmaz Cam", "Kulaklık", "Powerbank", "Diğer"];

const HAREKET_META = {
  giris: { label: "Stok girişi", color: "var(--success)", icon: ArrowDownCircle },
  cikis: { label: "Satış", color: "var(--danger)", icon: ArrowUpCircle },
  duzeltme: { label: "Düzeltme", color: "var(--accent)", icon: RefreshCw },
};

function AltPencere({ children, onClose, maxWidth = 420 }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth, margin: "0 auto", borderRadius: 18, maxHeight: "86vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function PencereBaslik({ children, onClose }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <span style={{ fontWeight: 700, fontSize: 16 }}>{children}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--hint)", display: "flex" }}>
        <X size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

function tarihFmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ── Ürün Detay Modalı — karta tıklayınca açılır, stok geçmişi + aksiyonlar ── */
function UrunDetayModal({ item, onClose, onSat, onDuzenle, onSil, onStokEkle, onYazdir, canDelete }) {
  const [hareketler, setHareketler] = useState(null);

  useEffect(() => {
    api.aksesuarHareketler(item.id).then(setHareketler).catch(() => setHareketler([]));
  }, [item.id]);

  const karMarji = item.alis_fiyati > 0 ? Math.round(((item.satis_fiyati - item.alis_fiyati) / item.alis_fiyati) * 100) : null;

  return (
    <AltPencere onClose={onClose}>
      <PencereBaslik onClose={onClose}>{item.ad}</PencereBaslik>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <UrunGorsel url={item.gorsel_url} yukle={f => api.aksesuarGorselYukle(item.id, f)} boyut={56} />
        <div>
          <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>{item.kategori || "Diğer"}</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: item.stok <= (item.min_stok ?? 5) ? "var(--danger)" : "var(--text)" }}>
            {item.stok} adet stokta
          </div>
          {item.toptanci_adi && (
            <div style={{ fontSize: 11.5, color: "var(--hint)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Truck size={11} strokeWidth={2} /> {item.toptanci_adi}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "8px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "var(--hint)" }}>Alış</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{item.alis_fiyati}₺</div>
        </div>
        <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "8px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "var(--hint)" }}>Satış</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{item.satis_fiyati}₺</div>
        </div>
        <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "8px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "var(--hint)" }}>Kâr Marjı</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--success)" }}>{karMarji !== null ? `%${karMarji}` : "—"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {item.stok > 0 && <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => onSat(item)}>Sat</button>}
        <button className="btn btn-ghost btn-sm" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }} onClick={() => onStokEkle(item)}>
          <PackagePlus size={13} strokeWidth={2} /> Stok Ekle
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }} onClick={() => onDuzenle(item)}>
          <Pencil size={13} strokeWidth={2} /> Düzenle
        </button>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }} onClick={() => onYazdir(item)}>
          <Printer size={13} strokeWidth={2} /> Etiket Yazdır
        </button>
        {canDelete && (
          <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", display: "flex", alignItems: "center", padding: "0 10px" }} onClick={() => onSil(item)}>
            <Trash2 size={13} strokeWidth={2} />
          </button>
        )}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Stok Hareketleri</div>
      {hareketler === null ? (
        <div style={{ fontSize: 12, color: "var(--hint)" }}>Yükleniyor...</div>
      ) : hareketler.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--hint)" }}>Henüz hareket yok</div>
      ) : hareketler.map(h => {
        const meta = HAREKET_META[h.tur] || { label: h.tur, color: "var(--hint)", icon: RefreshCw };
        const HIkon = meta.icon;
        return (
          <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: "1px solid var(--divider)" }}>
            <HIkon size={14} stroke={meta.color} strokeWidth={2} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{meta.label}</div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>{tarihFmt(h.created_at)}{h.yapan_adi ? ` · ${h.yapan_adi}` : ""}</div>
            </div>
            <div style={{ fontWeight: 700, color: h.miktar > 0 ? "var(--success)" : "var(--danger)", fontSize: 13 }}>
              {h.miktar > 0 ? `+${h.miktar}` : h.miktar}
            </div>
          </div>
        );
      })}
    </AltPencere>
  );
}

/* ── Etiket Yazdır Modalı — barkot+fiyat etiketi, window.print() ile ────── */
function EtiketYazdirModal({ item, onClose, ayarlar }) {
  function yazdir() {
    etiketSayfaBoyutuAyarla(ayarlar);
    window.print();
  }
  return (
    <AltPencere onClose={onClose} maxWidth={340}>
      <PencereBaslik onClose={onClose}>Etiket Yazdır</PencereBaslik>
      <div className="etiket-yazdirma-alani">
        <EtiketIcerik item={item} ayarlar={ayarlar} />
      </div>
      <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 10 }}>
        "Yazdır"a basınca tarayıcının yazdırma penceresi açılır — orada yazıcınızı seçebilirsiniz. Etiket boyutu/logosu Ayarlar → Etiket Ayarları'ndan değiştirilebilir.
        {!item.barkot && " Bu ürüne özel barkot girilmediği için otomatik üretilen kod kullanıldı."}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={yazdir}>
          <Printer size={14} strokeWidth={2} /> Yazdır
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Kapat</button>
      </div>
    </AltPencere>
  );
}

/* ── Toplu Etiket Yazdır — birden fazla farklı ürün seçip her birinden
   istenen adette (ör. bu üründen 10, diğerinden 2) etiket yazdırır ── */
function TopluEtiketModal({ liste, miktarlar, onToggle, onMiktarDegis, onClose, ayarlar }) {
  const seciliIdler = Object.keys(miktarlar).map(Number);
  const toplamEtiket = Object.values(miktarlar).reduce((s, m) => s + m, 0);
  function yazdir() {
    etiketSayfaBoyutuAyarla(ayarlar);
    window.print();
  }
  return (
    <AltPencere onClose={onClose} maxWidth={420}>
      <PencereBaslik onClose={onClose}>Toplu Etiket Yazdır ({seciliIdler.length} ürün)</PencereBaslik>
      <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 10 }}>Etiketi basılacak ürünleri ve her birinden kaç adet basılacağını seç.</div>
      <div style={{ maxHeight: "42vh", overflowY: "auto", marginBottom: 12 }}>
        {liste.map(a => {
          const secili = a.id in miktarlar;
          return (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", borderBottom: "1px solid var(--divider)" }}>
              <input type="checkbox" checked={secili} onChange={() => onToggle(a.id)} style={{ width: 16, height: 16, flexShrink: 0, cursor: "pointer" }} />
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: a.gorsel_url ? `url(${fotoUrl(a.gorsel_url)}) center/cover` : "var(--bg2)",
              }} />
              <div style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.ad}</div>
              {secili && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "2px 8px" }} onClick={() => onMiktarDegis(a.id, -1)}>−</button>
                  <span style={{ minWidth: 18, textAlign: "center", fontWeight: 700, fontSize: 13 }}>{miktarlar[a.id]}</span>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "2px 8px" }} onClick={() => onMiktarDegis(a.id, 1)}>+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {seciliIdler.length > 0 && (
        <div className="etiket-yazdirma-alani">
          {liste.filter(a => a.id in miktarlar).map(a =>
            Array.from({ length: miktarlar[a.id] }, (_, i) => <EtiketIcerik key={`${a.id}-${i}`} item={a} ayarlar={ayarlar} />)
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button className="btn btn-primary" disabled={toplamEtiket === 0}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          onClick={yazdir}>
          <Printer size={14} strokeWidth={2} /> {toplamEtiket} Etiket Yazdır
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Kapat</button>
      </div>
    </AltPencere>
  );
}

export default function Aksesuar({ user }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("urunler"); // urunler | gecmis
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kategoriler, setKategoriler] = useState(DEFAULT_CATS);
  const [toptancilar, setToptancilar] = useState([]);
  const [aktifKat, setAktifKat] = useState("Tümü");
  const [urunArama, setUrunArama] = useState("");
  const [showKatYonet, setShowKatYonet] = useState(false);
  const [yeniKat, setYeniKat] = useState("");
  const [formModal, setFormModal] = useState(null); // null | { mode }
  const [form, setForm] = useState({ ad: "", stok: "1", alis_fiyati: "", satis_fiyati: "", kategori: "Diğer", toptanci_id: "", min_stok: "5", barkot: "" });
  const [detayItem, setDetayItem] = useState(null);
  const [stokEkleItem, setStokEkleItem] = useState(null);
  const [stokEkleData, setStokEkleData] = useState({ miktar: "1", alis_fiyati: "", toptanci_id: "" });
  const [satForm, setSatForm] = useState(null);
  const [satData, setSatData] = useState({ miktar: "1", musteri_adi: "", musteri_telefon: "", odemeler: null, taksit_sayi: "1" });
  const [err, setErr] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [yazdirItem, setYazdirItem] = useState(null);
  const [tarayici, setTarayici] = useState(null); // null | "form" | "sepet" | "ara"
  const [barkotSatisHata, setBarkotSatisHata] = useState("");
  const [topluEtiketAcik, setTopluEtiketAcik] = useState(false);
  const [etiketMiktarlar, setEtiketMiktarlar] = useState({}); // { [aksesuar_id]: adet }
  const [etiketAyarlari, setEtiketAyarlari] = useState(ETIKET_AYAR_VARSAYILAN);
  // Barkotla Sat — art arda farklı ürün okutup tek satışta kapatma sepeti
  const [sepet, setSepet] = useState([]); // [{ aksesuar, miktar }]
  const [sepetGoster, setSepetGoster] = useState(false);
  const [sepetOdemeAcik, setSepetOdemeAcik] = useState(false);
  const [sepetOdemeData, setSepetOdemeData] = useState({ musteri_adi: "", musteri_telefon: "", odemeler: null, taksit_sayi: "1" });

  // Satış Geçmişi sekmesi
  const [satislar, setSatislar] = useState([]);
  const [satisToplam, setSatisToplam] = useState(0);
  const [satisLoading, setSatisLoading] = useState(true);
  const [satisArama, setSatisArama] = useState("");
  const [satisSirala, setSatisSirala] = useState("yeni");
  const [satisBaslangic, setSatisBaslangic] = useState("");
  const [satisBitis, setSatisBitis] = useState("");
  const [showSatisFiltre, setShowSatisFiltre] = useState(false);
  const [satisDetay, setSatisDetay] = useState(null);

  useEffect(() => {
    load(); kategorileriYukle();
    api.toptanciList().then(setToptancilar).catch(() => {});
    api.etiketAyarlari().then(setEtiketAyarlari).catch(() => {});
  }, []);
  useEffect(() => { if (tab === "gecmis") satisYukle(); }, [tab]);

  const ilkSatisYuklemeRef = useRef(true);
  useEffect(() => {
    if (tab !== "gecmis") return;
    if (ilkSatisYuklemeRef.current) { ilkSatisYuklemeRef.current = false; return; }
    const t = setTimeout(satisYukle, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satisArama, satisSirala, satisBaslangic, satisBitis]);

  async function load() {
    try { setList(await api.aksesuarList()); } finally { setLoading(false); }
  }

  async function satisYukle() {
    setSatisLoading(true);
    try {
      const r = await api.aksesuarSatisGecmisi({
        q: satisArama, sirala: satisSirala,
        tarih_baslangic: satisBaslangic || undefined, tarih_bitis: satisBitis || undefined,
      });
      setSatislar(r.liste || []);
      setSatisToplam(r.toplam || 0);
    } finally { setSatisLoading(false); }
  }

  // Kategoriler artık dükkan genelinde ortak — önceden cihaza özel
  // localStorage'daydı, bir çalışanın eklediği kategori başka çalışanda hiç
  // görünmüyordu.
  async function kategorileriYukle() {
    try {
      const r = await api.aksesuarKategorileri();
      const ozel = (r.kategoriler || []).filter(k => !DEFAULT_CATS.includes(k));
      setKategoriler([...DEFAULT_CATS, ...ozel]);
    } catch { /* varsayılan listeyle devam */ }
  }

  async function addKat() {
    const k = yeniKat.trim();
    if (k && !kategoriler.includes(k)) {
      setKategoriler(kl => [...kl, k]);
      try { await api.aksesuarKategoriEkle(k); } catch { /* zaten varsa sorun değil */ }
    }
    setYeniKat("");
  }

  async function removeKat(k) {
    setKategoriler(kl => kl.filter(c => c !== k));
    if (aktifKat === k) setAktifKat("Tümü");
    try { await api.aksesuarKategoriSil(k); } catch { /* sessizce geç */ }
  }

  function yeniUrunAc() {
    setForm({ ad: "", stok: "1", alis_fiyati: "", satis_fiyati: "", kategori: "Diğer", toptanci_id: "", min_stok: "5", barkot: "" });
    setErr("");
    setFormModal({ mode: "yeni" });
  }

  function duzenleAc(item) {
    setForm({
      ad: item.ad, stok: String(item.stok), alis_fiyati: String(item.alis_fiyati),
      satis_fiyati: String(item.satis_fiyati), kategori: item.kategori || "Diğer",
      toptanci_id: item.toptanci_id ? String(item.toptanci_id) : "", min_stok: String(item.min_stok ?? 5),
      barkot: item.barkot || "",
    });
    setErr("");
    setDetayItem(null);
    setFormModal({ mode: "duzenle", id: item.id });
  }

  async function submit(e) {
    e.preventDefault(); setErr("");
    const payload = {
      ad: form.ad, stok: parseInt(form.stok), alis_fiyati: parseFloat(form.alis_fiyati),
      satis_fiyati: parseFloat(form.satis_fiyati), kategori: form.kategori,
      toptanci_id: form.toptanci_id ? parseInt(form.toptanci_id) : null, min_stok: parseInt(form.min_stok) || 5,
      barkot: form.barkot,
    };
    try {
      if (formModal.mode === "duzenle") await api.updateAksesuar(formModal.id, payload);
      else await api.createAksesuar(payload);
      if (form.kategori && !kategoriler.includes(form.kategori)) {
        setKategoriler(kl => [...kl, form.kategori]);
        api.aksesuarKategoriEkle(form.kategori).catch(() => {});
      }
      setFormModal(null);
      load();
    } catch (e) { setErr(e.message); }
  }

  function stokEkleAc(item) {
    setDetayItem(null);
    setStokEkleData({ miktar: "1", alis_fiyati: String(item.alis_fiyati), toptanci_id: item.toptanci_id ? String(item.toptanci_id) : "" });
    setErr("");
    setStokEkleItem(item);
  }

  async function submitStokEkle(e) {
    e.preventDefault(); setErr("");
    try {
      await api.aksesuarStokEkle(stokEkleItem.id, {
        miktar: parseInt(stokEkleData.miktar),
        alis_fiyati: stokEkleData.alis_fiyati ? parseFloat(stokEkleData.alis_fiyati) : null,
        toptanci_id: stokEkleData.toptanci_id ? parseInt(stokEkleData.toptanci_id) : null,
      });
      setStokEkleItem(null);
      load();
    } catch (e) { setErr(e.message); }
  }

  function satAc(item) {
    setDetayItem(null);
    setSatData({ miktar: "1", musteri_adi: "", musteri_telefon: "", odemeler: null, taksit_sayi: "1" });
    setErr("");
    setSatForm(item);
  }

  async function barkotTarandi(kod) {
    const mod = tarayici;
    setTarayici(null);
    if (mod === "form") {
      setForm(f => ({ ...f, barkot: kod }));
      return;
    }
    if (mod === "ara") {
      // Ürün adını hatırlamayıp barkodundan bulmak için — arama kutusuna
      // yazmak yerine direkt o ürünün detayı açılır.
      setBarkotSatisHata("");
      try {
        const urun = await api.aksesuarBarkotAra(kod);
        setDetayItem(urun);
      } catch (e) {
        setBarkotSatisHata(e.message);
      }
      return;
    }
    // "sepet" modu — art arda okutulan farklı ürünler tek sepette birikir,
    // aynı ürün tekrar okutulursa adedi artar. Önceden her ürün ayrı ayrı
    // satılmak zorundaydı, 10 çeşit ürün alan bir müşteri için 10 ayrı satış
    // kaydı açılıyordu.
    setBarkotSatisHata("");
    try {
      const urun = await api.aksesuarBarkotAra(kod);
      setSepet(s => {
        const mevcut = s.find(k => k.aksesuar.id === urun.id);
        if (mevcut) return s.map(k => k.aksesuar.id === urun.id ? { ...k, miktar: k.miktar + 1 } : k);
        return [...s, { aksesuar: urun, miktar: 1 }];
      });
      setSepetGoster(true);
    } catch (e) {
      setBarkotSatisHata(e.message);
      setSepetGoster(true);
    }
  }

  function sepetMiktarDegistir(id, delta) {
    setSepet(s => s.map(k => k.aksesuar.id === id ? { ...k, miktar: Math.max(1, k.miktar + delta) } : k).filter(k => k.miktar > 0));
  }
  function sepettenSil(id) {
    setSepet(s => s.filter(k => k.aksesuar.id !== id));
  }
  function sepetiTemizle() {
    setSepet([]);
    setSepetGoster(false);
    setSepetOdemeAcik(false);
  }
  const sepetToplam = sepet.reduce((t, k) => t + k.miktar * (k.aksesuar.satis_fiyati || 0), 0);

  function sepetOdemeAc() {
    setSepetOdemeData({ musteri_adi: "", musteri_telefon: "", odemeler: null, taksit_sayi: "1" });
    setErr("");
    setSepetOdemeAcik(true);
  }

  async function submitSepetOdeme(e) {
    e.preventDefault(); setErr("");
    const odemeler = (sepetOdemeData.odemeler || varsayilanOdemeSatirlari(sepetToplam)).filter(o => parseFloat(o.tutar) > 0);
    const alinan = odemeler.reduce((s, o) => s + (parseFloat(o.tutar) || 0), 0);
    if (sepetToplam - alinan > 0.009 && !sepetOdemeData.musteri_adi.trim()) {
      setErr("Kalan tutar borç olarak yazılacaksa müşteri adı girilmeli");
      return;
    }
    try {
      await api.aksesuarTopluSat({
        kalemler: sepet.map(k => ({ aksesuar_id: k.aksesuar.id, miktar: k.miktar })),
        musteri_adi: sepetOdemeData.musteri_adi, musteri_telefon: sepetOdemeData.musteri_telefon,
        tarih: today(), odemeler, taksit_sayi: parseInt(sepetOdemeData.taksit_sayi) || 1,
      });
      sepetiTemizle();
      load();
      if (tab === "gecmis") satisYukle();
    } catch (e) { setErr(e.message); }
  }

  function etiketSecimToggle(id) {
    setEtiketMiktarlar(m => {
      if (id in m) {
        const { [id]: _cikar, ...kalan } = m;
        return kalan;
      }
      return { ...m, [id]: 1 };
    });
  }

  function etiketMiktarDegistir(id, delta) {
    setEtiketMiktarlar(m => ({ ...m, [id]: Math.max(1, (m[id] || 1) + delta) }));
  }

  async function submitSat(e) {
    e.preventDefault(); setErr("");
    const toplam = parseInt(satData.miktar || 1) * (satForm.satis_fiyati || 0);
    const odemeler = (satData.odemeler || varsayilanOdemeSatirlari(toplam)).filter(o => parseFloat(o.tutar) > 0);
    const alinan = odemeler.reduce((s, o) => s + (parseFloat(o.tutar) || 0), 0);
    if (toplam - alinan > 0.009 && !satData.musteri_adi.trim()) {
      setErr("Kalan tutar borç olarak yazılacaksa müşteri adı girilmeli");
      return;
    }
    try {
      await api.satAksesuar(satForm.id, {
        miktar: parseInt(satData.miktar), musteri_adi: satData.musteri_adi, musteri_telefon: satData.musteri_telefon,
        tarih: today(), odemeler, taksit_sayi: parseInt(satData.taksit_sayi) || 1,
      });
      setSatForm(null);
      load();
      if (tab === "gecmis") satisYukle();
    } catch (e) { setErr(e.message); }
  }

  async function deleteAksesuar(id) {
    try {
      await api.deleteAksesuar(id);
      setDeleteId(null);
      setDetayItem(null);
      load();
    } catch (e) { alert(e.message); }
  }

  const kategoriliList = aktifKat === "Tümü" ? list : list.filter(a => (a.kategori || "Diğer") === aktifKat);
  const filteredList = urunArama
    ? kategoriliList.filter(a => a.ad.toLowerCase().includes(urunArama.toLowerCase()))
    : kategoriliList;

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Geri</button>
        <h1 className="page-title" style={{ margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Aksesuar</h1>
        {tab === "urunler" && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowKatYonet(!showKatYonet)} title="Kategoriler" style={{ display: "flex", alignItems: "center", padding: "8px 10px" }}><Tag size={15} strokeWidth={2} /></button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEtiketMiktarlar({}); setTopluEtiketAcik(true); }} title="Etiket Yazdır" style={{ display: "flex", alignItems: "center", padding: "8px 10px" }}><Printer size={15} strokeWidth={2} /></button>
            <button className="btn btn-primary btn-sm" onClick={yeniUrunAc}>+ Ekle</button>
          </div>
        )}
      </div>

      {/* Sekme */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${tab === "urunler" ? "active" : ""}`} onClick={() => setTab("urunler")}>Ürünler</button>
        <button className={`tab ${tab === "gecmis" ? "active" : ""}`} onClick={() => setTab("gecmis")}>Satış Geçmişi</button>
      </div>

      {tab === "urunler" ? (
        <>
          {/* Kategori Yönetimi */}
          {showKatYonet && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Kategorileri Yönet</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {kategoriler.map(k => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg2)", borderRadius: 20, padding: "4px 10px 4px 12px", fontSize: 13 }}>
                    {k}
                    <button onClick={() => removeKat(k)} style={{ border: "none", background: "none", color: "var(--danger)", cursor: "pointer", padding: "0 2px", fontSize: 14, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="form-input" style={{ flex: 1 }} placeholder="Yeni kategori adı" value={yeniKat} onChange={e => setYeniKat(e.target.value)} onKeyDown={e => e.key === "Enter" && addKat()} />
                <button className="btn btn-primary btn-sm" onClick={addKat}>Ekle</button>
              </div>
            </div>
          )}

          {/* Arama (isimle veya barkotla) + Barkotla Sat + Sepet göstergesi */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div className="form-group" style={{ position: "relative", marginBottom: 0, flex: 1 }}>
              <input className="form-input" style={{ paddingLeft: 36, paddingRight: 40 }} value={urunArama}
                onChange={e => setUrunArama(e.target.value)} placeholder="Ürün adı ara..." />
              <Search size={15} strokeWidth={2} stroke="var(--hint)"
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <button type="button" title="Barkodla ürün bul"
                onClick={() => { setBarkotSatisHata(""); setTarayici("ara"); }}
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--hint)", padding: 6, display: "flex" }}>
                <Camera size={16} strokeWidth={2} />
              </button>
            </div>
            <button type="button" className="btn btn-primary btn-sm" style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => { setBarkotSatisHata(""); setTarayici("sepet"); }}>
              <ScanLine size={15} strokeWidth={2} /> Barkotla Sat
            </button>
          </div>
          {sepet.length > 0 && (
            <div className="card" style={{ marginBottom: 10, cursor: "pointer", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)" }}
              onClick={() => setSepetGoster(true)}>
              <div className="card-row">
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13 }}>
                  <ScanLine size={15} strokeWidth={2} stroke="var(--success)" /> Sepette {sepet.length} çeşit ürün
                </span>
                <span style={{ fontWeight: 700, color: "var(--success)" }}>{sepetToplam.toLocaleString("tr-TR")} ₺</span>
              </div>
            </div>
          )}
          {barkotSatisHata && (
            <div style={{ color: "var(--danger)", fontSize: 12.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <CircleX size={13} strokeWidth={2} /> {barkotSatisHata}
            </div>
          )}

          {/* Kategori Filtre Chipsleri */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 10, scrollbarWidth: "none" }}>
            {["Tümü", ...kategoriler].map(k => (
              <button key={k} onClick={() => setAktifKat(k)}
                style={{
                  flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none",
                  background: aktifKat === k ? "var(--accent)" : "var(--bg2)",
                  color: aktifKat === k ? "#fff" : "var(--text)",
                  fontWeight: aktifKat === k ? 700 : 400, fontSize: 13, cursor: "pointer",
                }}>
                {k}
              </button>
            ))}
          </div>

          {/* Ürün Izgarası — Stok sayfasındaki kart tarzı: büyük görsel, renkli
              fiyat rozetleri, öne çıkan stok sayısı. Kartlar tıklanabilir,
              detay penceresi açar. */}
          {filteredList.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>
              {urunArama ? "Aramayla eşleşen ürün yok" : aktifKat === "Tümü" ? "Aksesuar eklenmedi" : `${aktifKat} kategorisinde ürün yok`}
            </div>
          ) : (
            <div className="aksesuar-grid">
              {filteredList.map(a => (
                <div key={a.id} className="card" style={{ cursor: "pointer", padding: "10px 8px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
                  onClick={() => setDetayItem(a)}>
                  {a.stok <= (a.min_stok ?? 5) && (
                    <div style={{
                      alignSelf: "flex-end", marginBottom: -4, display: "flex", alignItems: "center",
                      color: "var(--danger)", background: "rgba(239,68,68,0.14)",
                      borderRadius: "50%", padding: 3,
                    }} title="Düşük stok">
                      <TriangleAlert size={9} strokeWidth={2.6} />
                    </div>
                  )}
                  <div style={{ margin: "5px 0 6px" }}>
                    <UrunGorsel url={a.gorsel_url} yukle={f => api.aksesuarGorselYukle(a.id, f)} boyut={46} />
                  </div>
                  <div style={{ fontSize: 9, color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.2 }}>{a.kategori || "Diğer"}</div>
                  <div style={{ fontWeight: 700, fontSize: 11, marginTop: 2, lineHeight: 1.25, minHeight: 28 }}>{a.ad}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: "rgba(74,222,128,0.14)", color: "var(--success)", marginTop: 5 }}>
                    {a.satis_fiyati}₺
                  </span>
                  <div style={{ marginTop: 7, paddingTop: 6, borderTop: "1px solid var(--divider)", width: "100%" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: a.stok <= (a.min_stok ?? 5) ? "var(--danger)" : "var(--text)" }}>{a.stok}</div>
                    <div style={{ fontSize: 9, color: "var(--hint)" }}>adet</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Satış Geçmişi */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-row">
              <span style={{ color: "var(--hint)" }}>Toplam ({satislar.length} satış)</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: "var(--success)" }}>{satisToplam.toLocaleString("tr-TR")} ₺</span>
            </div>
          </div>

          <div className="form-group" style={{ position: "relative", marginBottom: 10 }}>
            <input className="form-input" style={{ paddingLeft: 36 }} value={satisArama}
              onChange={e => setSatisArama(e.target.value)} placeholder="Ürün veya müşteri adı ara..." />
            <Search size={15} strokeWidth={2} stroke="var(--hint)"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <select className="form-select" style={{ flex: 1 }} value={satisSirala} onChange={e => setSatisSirala(e.target.value)}>
              <option value="yeni">En Yeni Önce</option>
              <option value="eski">En Eski Önce</option>
              <option value="tutar_yuksek">Tutar: Yüksekten Düşüğe</option>
              <option value="tutar_dusuk">Tutar: Düşükten Yükseğe</option>
            </select>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSatisFiltre(s => !s)}
              style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <Filter size={14} strokeWidth={2} /> Tarih{(satisBaslangic || satisBitis) ? " •" : ""}
            </button>
          </div>

          {showSatisFiltre && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Bu Tarihten İtibaren</label>
                  <input className="form-input" type="date" value={satisBaslangic} max={satisBitis || undefined}
                    onChange={e => setSatisBaslangic(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Bu Tarihe Kadar</label>
                  <input className="form-input" type="date" value={satisBitis} min={satisBaslangic || undefined}
                    onChange={e => setSatisBitis(e.target.value)} />
                </div>
              </div>
              {(satisBaslangic || satisBitis) && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
                  onClick={() => { setSatisBaslangic(""); setSatisBitis(""); }}>Tarihi Temizle</button>
              )}
            </div>
          )}

          {satisLoading ? (
            <div className="loading">Yükleniyor...</div>
          ) : satislar.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--hint)" }}>
              {satisArama || satisBaslangic || satisBitis ? "Aramayla eşleşen satış yok" : "Henüz satış yok"}
            </div>
          ) : satislar.map(s => (
            <div key={s.id} className="card" style={{ cursor: "pointer" }} onClick={() => setSatisDetay(s)}>
              <div className="card-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{s.urun_adi || "Silinmiş ürün"}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)" }}>
                    {s.miktar} adet{s.musteri_adi ? ` · ${s.musteri_adi}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{tarihFmt(s.created_at)}</div>
                </div>
                <div style={{ fontWeight: 700, color: "var(--success)" }}>{s.toplam.toLocaleString("tr-TR")} ₺</div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Ürün Ekle/Düzenle Modalı */}
      {formModal && (
        <AltPencere onClose={() => setFormModal(null)}>
          <PencereBaslik onClose={() => setFormModal(null)}>{formModal.mode === "duzenle" ? "Ürünü Düzenle" : "Yeni Ürün"}</PencereBaslik>
          <form onSubmit={submit}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="form-select" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>
                {kategoriler.map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Ürün Adı *</label>
              <input className="form-input" required value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} placeholder="Örn: iPhone 15 Kılıf, 65W Şarj..." />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div className="form-group">
                <label className="form-label">Stok</label>
                <input className="form-input" type="number" min="0" value={form.stok} onChange={e => setForm({ ...form, stok: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Alış (₺)</label>
                <input className="form-input" type="number" required value={form.alis_fiyati} onChange={e => setForm({ ...form, alis_fiyati: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Satış (₺)</label>
                <input className="form-input" type="number" required value={form.satis_fiyati} onChange={e => setForm({ ...form, satis_fiyati: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Toptancı (opsiyonel)</label>
              <select className="form-select" value={form.toptanci_id} onChange={e => setForm({ ...form, toptanci_id: e.target.value })}>
                <option value="">Seç (opsiyonel)</option>
                {toptancilar.map(t => <option key={t.id} value={t.id}>{t.ad}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Düşük Stok Eşiği</label>
              <input className="form-input" type="number" min="0" value={form.min_stok} onChange={e => setForm({ ...form, min_stok: e.target.value })} placeholder="5" />
              <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 4 }}>Stok bu sayının altına/eşitine düşünce "Düşük" uyarısı gösterilir</div>
            </div>
            <div className="form-group">
              <label className="form-label">Barkot (opsiyonel)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="form-input" style={{ flex: 1 }} value={form.barkot}
                  onChange={e => setForm({ ...form, barkot: e.target.value })} placeholder="Üretici barkodu varsa tarat veya yaz" />
                <button type="button" className="btn btn-ghost btn-sm" style={{ display: "flex", alignItems: "center", padding: "0 12px" }}
                  onClick={() => setTarayici("form")} title="Barkod tarat">
                  <Camera size={15} strokeWidth={2} />
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 4 }}>Boş bırakılırsa etiket basılırken otomatik bir kod üretilir</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">{formModal.mode === "duzenle" ? "Güncelle" : "Kaydet"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setFormModal(null)}>İptal</button>
            </div>
          </form>
        </AltPencere>
      )}

      {/* Ürün Detay Modalı */}
      {detayItem && (
        <UrunDetayModal item={detayItem} onClose={() => setDetayItem(null)}
          onSat={satAc} onDuzenle={duzenleAc} onStokEkle={stokEkleAc}
          onYazdir={item => { setDetayItem(null); setYazdirItem(item); }}
          onSil={item => { setDetayItem(null); setDeleteId(item.id); }}
          canDelete={user?.rol === "patron"} />
      )}

      {/* Etiket Yazdır Modalı */}
      {yazdirItem && <EtiketYazdirModal item={yazdirItem} onClose={() => setYazdirItem(null)} ayarlar={etiketAyarlari} />}

      {/* Barkod Tarayıcı — forma barkot girmek, ürün aramak veya sepete eklemek için */}
      {tarayici && (
        <BarcodeScanner mod="barkot" onScan={barkotTarandi} onClose={() => setTarayici(null)} />
      )}

      {/* Toplu Etiket Yazdır Modalı */}
      {topluEtiketAcik && (
        <TopluEtiketModal liste={list} miktarlar={etiketMiktarlar} onToggle={etiketSecimToggle} onMiktarDegis={etiketMiktarDegistir} onClose={() => setTopluEtiketAcik(false)} ayarlar={etiketAyarlari} />
      )}

      {/* Sepet — Barkotla Sat ile art arda okutulan farklı ürünlerin listesi */}
      {sepetGoster && !sepetOdemeAcik && (
        <AltPencere onClose={() => setSepetGoster(false)}>
          <PencereBaslik onClose={() => setSepetGoster(false)}>Sepet ({sepet.length} çeşit)</PencereBaslik>
          {barkotSatisHata && (
            <div style={{ color: "var(--danger)", fontSize: 12.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <CircleX size={13} strokeWidth={2} /> {barkotSatisHata}
            </div>
          )}
          {sepet.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--hint)", textAlign: "center", padding: "16px 0" }}>Sepet boş — "Barkot Tara"ya basıp ürünleri okutun</div>
          ) : sepet.map(k => (
            <div key={k.aksesuar.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--divider)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{k.aksesuar.ad}</div>
                <div style={{ fontSize: 11.5, color: "var(--hint)" }}>{k.aksesuar.satis_fiyati}₺ / adet</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "2px 8px" }} onClick={() => sepetMiktarDegistir(k.aksesuar.id, -1)}>−</button>
              <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700 }}>{k.miktar}</span>
              <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "2px 8px" }} onClick={() => sepetMiktarDegistir(k.aksesuar.id, 1)}>+</button>
              <span style={{ fontWeight: 700, minWidth: 60, textAlign: "right" }}>{(k.miktar * k.aksesuar.satis_fiyati).toLocaleString("tr-TR")}₺</span>
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", padding: "2px 6px" }} onClick={() => sepettenSil(k.aksesuar.id)}>
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </div>
          ))}
          <div className="card-row" style={{ marginTop: 10, marginBottom: 12 }}>
            <span style={{ color: "var(--hint)" }}>Toplam</span>
            <span style={{ fontWeight: 700, fontSize: 17, color: "var(--success)" }}>{sepetToplam.toLocaleString("tr-TR")} ₺</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              onClick={() => { setBarkotSatisHata(""); setTarayici("sepet"); }}>
              <ScanLine size={14} strokeWidth={2} /> Barkot Tara
            </button>
            <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={sepet.length === 0} onClick={sepetOdemeAc}>
              Satışı Tamamla
            </button>
          </div>
          {sepet.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 8, color: "var(--danger)" }} onClick={sepetiTemizle}>
              Sepeti Boşalt
            </button>
          )}
        </AltPencere>
      )}

      {/* Sepet Ödeme — tüm sepet için tek müşteri, tek ödeme bölüşümü */}
      {sepetOdemeAcik && (
        <AltPencere onClose={() => setSepetOdemeAcik(false)}>
          <PencereBaslik onClose={() => setSepetOdemeAcik(false)}>Satışı Tamamla</PencereBaslik>
          <form onSubmit={submitSepetOdeme}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}
            <div style={{ fontSize: 12.5, color: "var(--hint)", marginBottom: 10 }}>
              {sepet.map(k => `${k.aksesuar.ad} x${k.miktar}`).join(", ")}
            </div>
            <div className="form-group">
              <label className="form-label">Müşteri Adı (opsiyonel)</label>
              <input className="form-input" value={sepetOdemeData.musteri_adi} onChange={e => setSepetOdemeData({ ...sepetOdemeData, musteri_adi: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Müşteri Telefonu (opsiyonel)</label>
              <input className="form-input" type="tel" value={sepetOdemeData.musteri_telefon} onChange={e => setSepetOdemeData({ ...sepetOdemeData, musteri_telefon: e.target.value })} />
            </div>
            <div style={{ fontSize: 13, color: "var(--success)", marginBottom: 8 }}>
              Toplam: {sepetToplam.toLocaleString("tr-TR")} ₺
            </div>
            <OdemeBolustur toplam={sepetToplam} yon="gelir"
              value={sepetOdemeData.odemeler} onChange={v => setSepetOdemeData(f => ({ ...f, odemeler: v }))}
              taksitSayi={sepetOdemeData.taksit_sayi} onTaksitSayiChange={v => setSepetOdemeData(f => ({ ...f, taksit_sayi: v }))} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Satışı Kaydet</button>
              <button type="button" className="btn btn-ghost" onClick={() => setSepetOdemeAcik(false)}>Geri</button>
            </div>
          </form>
        </AltPencere>
      )}

      {/* Stok Ekle Modalı — toptancıdan yeni parti geldiğinde hızlı giriş */}
      {stokEkleItem && (
        <AltPencere onClose={() => setStokEkleItem(null)}>
          <PencereBaslik onClose={() => setStokEkleItem(null)}>Stok Ekle: {stokEkleItem.ad}</PencereBaslik>
          <form onSubmit={submitStokEkle}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}
            <div className="form-group">
              <label className="form-label">Gelen Adet *</label>
              <input className="form-input" type="number" min="1" required value={stokEkleData.miktar}
                onChange={e => setStokEkleData({ ...stokEkleData, miktar: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Toptancı</label>
              <select className="form-select" value={stokEkleData.toptanci_id} onChange={e => setStokEkleData({ ...stokEkleData, toptanci_id: e.target.value })}>
                <option value="">Seç (opsiyonel)</option>
                {toptancilar.map(t => <option key={t.id} value={t.id}>{t.ad}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Yeni Alış Fiyatı (₺) — değiştiyse güncelle</label>
              <input className="form-input" type="number" value={stokEkleData.alis_fiyati}
                onChange={e => setStokEkleData({ ...stokEkleData, alis_fiyati: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Ekle</button>
              <button type="button" className="btn btn-ghost" onClick={() => setStokEkleItem(null)}>İptal</button>
            </div>
          </form>
        </AltPencere>
      )}

      {/* Satış Formu */}
      {satForm && (
        <AltPencere onClose={() => setSatForm(null)}>
          <PencereBaslik onClose={() => setSatForm(null)}>Satış: {satForm.ad}</PencereBaslik>
          <form onSubmit={submitSat}>
            {err && <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 0", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CircleX size={14} strokeWidth={2} /> {err}</div>}
            <div className="form-group">
              <label className="form-label">Adet (max {satForm.stok})</label>
              <input className="form-input" type="number" min="1" max={satForm.stok} required value={satData.miktar} onChange={e => setSatData({ ...satData, miktar: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Müşteri Adı (opsiyonel)</label>
              <input className="form-input" value={satData.musteri_adi} onChange={e => setSatData({ ...satData, musteri_adi: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Müşteri Telefonu (opsiyonel — müşteri portalında görünmesi için)</label>
              <input className="form-input" type="tel" value={satData.musteri_telefon} onChange={e => setSatData({ ...satData, musteri_telefon: e.target.value })} />
            </div>
            <div style={{ fontSize: 13, color: "var(--success)", marginBottom: 8 }}>
              Toplam: {(parseInt(satData.miktar || 1) * (satForm.satis_fiyati || 0)).toLocaleString("tr-TR")} ₺
            </div>
            <OdemeBolustur toplam={parseInt(satData.miktar || 1) * (satForm.satis_fiyati || 0)} yon="gelir"
              value={satData.odemeler} onChange={v => setSatData(f => ({ ...f, odemeler: v }))}
              taksitSayi={satData.taksit_sayi} onTaksitSayiChange={v => setSatData(f => ({ ...f, taksit_sayi: v }))} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Sat</button>
              <button type="button" className="btn btn-ghost" onClick={() => setSatForm(null)}>İptal</button>
            </div>
          </form>
        </AltPencere>
      )}

      {/* Satış Detay Modalı */}
      {satisDetay && (
        <AltPencere onClose={() => setSatisDetay(null)} maxWidth={360}>
          <PencereBaslik onClose={() => setSatisDetay(null)}>{satisDetay.urun_adi || "Satış"}</PencereBaslik>
          <div style={{ fontWeight: 300, fontSize: 24, color: "var(--success)", letterSpacing: -0.5, marginBottom: 4 }}>
            {satisDetay.toplam.toLocaleString("tr-TR")}₺
          </div>
          <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 14 }}>{tarihFmt(satisDetay.created_at)}</div>
          <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "10px 12px", fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Package size={13} strokeWidth={2} stroke="var(--hint)" /> {satisDetay.kategori || "Diğer"} · {satisDetay.miktar} adet</div>
            {satisDetay.musteri_adi && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Headphones size={13} strokeWidth={2} stroke="var(--hint)" /> {satisDetay.musteri_adi}</div>}
            {satisDetay.musteri_telefon && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Phone size={13} strokeWidth={2} stroke="var(--hint)" /> {satisDetay.musteri_telefon}</div>}
          </div>
        </AltPencere>
      )}

      {/* Silme Onayı */}
      {deleteId && (
        <AltPencere onClose={() => setDeleteId(null)} maxWidth={340}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Ürünü sil</div>
          <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 16 }}>Bu ürün kalıcı olarak silinecek. Emin misin?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ background: "var(--danger)" }} onClick={() => deleteAksesuar(deleteId)}>Sil</button>
            <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>İptal</button>
          </div>
        </AltPencere>
      )}
    </div>
  );
}

function today() { return new Date().toISOString().split("T")[0]; }
