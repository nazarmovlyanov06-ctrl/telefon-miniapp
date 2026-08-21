const BASE = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "telefon_servis_token";

// /uploads/... gibi göreli dosya yollarını API origin'iyle birleştirir —
// prod'da frontend+API aynı origin, local dev'de VITE_API_URL prod'u işaret eder.
export function fotoUrl(path) {
  if (!path) return path;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  return `${BASE}${path}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    setToken(null);
    window.location.href = "/giris";
    throw new Error("Oturum sona erdi");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });
const put = (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) });
const patch = (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) });
const del = (path) => request(path, { method: "DELETE" });

async function uploadFile(path, file) {
  const token = getToken();
  const form = new FormData();
  form.append("dosya", file);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// Karma alan+dosya formları (ör. takas teklifi) için — kimlik doğrulaması olmadan da çalışır.
async function postForm(path, fields) {
  const token = getToken();
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== null) form.append(k, v); });
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// Müşteri portalı token'ı ile — shop staff token'ından ayrı, localStorage'da
// ayrı bir anahtarda tutulur (MusteriPanel.jsx yönetir), burada parametre olarak geçilir.
async function getWithToken(path, token) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function postWithToken(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// Excel/PDF gibi ikili dosya indirmeleri — request()'in JSON parse'ını atlar.
async function downloadFile(path, filename) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  // Auth
  me: () => get("/auth/me"),
  girisYap: (email, sifre) => post("/auth/giris", { email, sifre }),
  kayitOl: (data) => post("/auth/kayit", data),

  // Dashboard
  dashboard: () => get("/reports/dashboard"),
  repairsByStatus: () => get("/reports/repairs-by-status"),
  monthly: (y, m) => get(`/reports/monthly?year=${y}&month=${m}`),

  // Tamirler
  repairs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/repairs/${q ? "?" + q : ""}`);
  },
  repair: (id) => get(`/repairs/${id}`),
  createRepair: (data) => post("/repairs/", data),
  updateRepair: (id, data) => put(`/repairs/${id}`, data),
  updateRepairStatus: (id, status, extra = {}) => patch(`/repairs/${id}/status`, { status, ...extra }),
  updateRepairIntake: (id, data) => patch(`/repairs/${id}/intake`, data),
  onaylaRepairIntake: (id) => post(`/repairs/${id}/intake/onayla`, {}),
  kilitAcRepairIntake: (id) => post(`/repairs/${id}/intake/kilit-ac`, {}),
  updateRepairParcaBilgisi: (id, data) => patch(`/repairs/${id}/parca-bilgisi`, data),
  deleteRepair: (id) => del(`/repairs/${id}`),

  // Musteriler
  customers: (q) => get(`/customers/${q ? "?q=" + encodeURIComponent(q) : ""}`),
  customer: (id) => get(`/customers/${id}`),
  customerRepairs: (id) => get(`/customers/${id}/repairs`),
  customerIkinciEl: (id) => get(`/customers/${id}/ikinciel`),
  customerGecmis: (id) => get(`/customers/${id}/gecmis`),
  createCustomer: (data) => post("/customers/", data),
  updateCustomer: (id, data) => put(`/customers/${id}`, data),
  deleteCustomer: (id) => del(`/customers/${id}`),
  customerPortalSifre: (id) => post(`/customers/${id}/portal-sifre`, {}),

  // Stok / Parca
  parts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/parts/${q ? "?" + q : ""}`);
  },
  createPart: (data) => post("/parts/", data),
  updatePart: (id, data) => put(`/parts/${id}`, data),
  deletePart: (id) => del(`/parts/${id}`),
  kullanPart: (id, data) => post(`/parts/${id}/kullan`, data),
  stokEkle: (id, data) => post(`/parts/${id}/stok-ekle`, data),
  partHareketler: (id) => get(`/parts/${id}/hareketler`),
  tumHareketler: () => get(`/parts/hareketler/tumu`),
  orders: () => get("/parts/orders/"),
  createOrder: (data) => post("/parts/orders/", data),
  markArrived: (id) => put(`/parts/orders/${id}/arrive`, {}),

  // Alisveris
  shopping: () => get("/shopping/"),
  addShoppingItem: (data) => post("/shopping/", data),
  markBought: (id, data) => put(`/shopping/${id}/bought`, data),
  deleteShoppingItem: (id) => del(`/shopping/${id}`),

  // IMEI
  imei: (imei) => get(`/imei/${imei}`),
  imeiBtk: (imei) => get(`/imei/btk/${imei}`),

  // Borc
  debts: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
    const s = q.toString();
    return get(`/debts/${s ? "?" + s : ""}`);
  },
  debtsGecmis: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
    const s = q.toString();
    return get(`/debts/gecmis${s ? "?" + s : ""}`);
  },
  createDebt: (data) => post("/debts/", data),
  updateDebt: (id, data) => put(`/debts/${id}`, data),
  deleteDebt: (id) => del(`/debts/${id}`),
  payDebt: (id, data) => post(`/debts/${id}/pay`, data),
  debtOdemeler: (id) => get(`/debts/${id}/odemeler`),
  deleteDebtOdeme: (debtId, paymentId) => del(`/debts/${debtId}/odemeler/${paymentId}`),

  // Kullaniciler (calisanlar)
  users: () => get("/users/"),
  changeRole: (id, role) => put(`/users/${id}/role`, { role }),
  calisanEkle: (data) => post("/users/davet", data),
  calisanSil: (id) => del(`/users/${id}`),
  calisanAktiflik: (id, aktif) => put(`/users/${id}/aktiflik`, { aktif }),

  // Toptanci
  toptanciList: () => get("/toptanci/"),
  createToptanci: (data) => post("/toptanci/", data),
  updateToptanci: (id, data) => put(`/toptanci/${id}`, data),
  deleteToptanci: (id) => del(`/toptanci/${id}`),
  toptanciAlislar: (id) => get(`/toptanci/${id}/alislar`),
  createToptanciAlis: (id, data) => post(`/toptanci/${id}/alislar`, data),

  // 2. El Cihaz
  ikinciElList: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/ikinciel/listesi${q ? "?" + q : ""}`);
  },
  ikinciElOzet: () => get("/ikinciel/ozet"),
  createIkinciEl: (data) => post("/ikinciel/", data),
  deleteIkinciEl: (id) => del(`/ikinciel/${id}`),
  updateIkinciEl: (id, data) => put(`/ikinciel/${id}`, data),
  ikinciElFotolar: (id) => get(`/ikinciel/${id}/fotograflar`),
  addIkinciElFoto: (id, data) => post(`/ikinciel/${id}/fotograflar`, data),
  deleteIkinciElFoto: (id, fotoId) => del(`/ikinciel/${id}/fotograflar/${fotoId}`),
  ikinciElMasraf: (id, data) => post(`/ikinciel/${id}/masraf`, data),
  ikinciElMasraflar: (id) => get(`/ikinciel/${id}/masraflar`),
  ikinciElSat: (id, data) => post(`/ikinciel/${id}/sat`, data),
  ikinciElSatilanlar: () => get("/ikinciel/satilanlar"),
  ikinciElIMEI: (son4) => get(`/ikinciel/imei-gecmis/${son4}`),
  ikinciElIMEITam: (imei) => get(`/ikinciel/imei-tam/${encodeURIComponent(imei)}`),
  ikinciElKatalog: () => get("/ikinciel/katalog"),
  sifirIMEITam: (imei) => get(`/sifir-cihaz/imei-tam/${encodeURIComponent(imei)}`),

  // Sıfır Cihaz
  sifirList: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/sifir-cihaz/listesi${q ? "?" + q : ""}`);
  },
  sifirOzet: () => get("/sifir-cihaz/ozet"),
  createSifir: (data) => post("/sifir-cihaz/", data),
  deleteSifir: (id) => del(`/sifir-cihaz/${id}`),
  sifirSat: (id, data) => post(`/sifir-cihaz/${id}/sat`, data),
  sifirSatilanlar: () => get("/sifir-cihaz/satilanlar"),
  sifirKatalog: () => get("/sifir-cihaz/katalog"),
  sifirListeFiyatGuncelle: (id, liste_fiyati) => put(`/sifir-cihaz/${id}/liste-fiyat`, { liste_fiyati }),

  // Garanti
  garantiList: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/garantiler/${q ? "?" + q : ""}`);
  },
  createGaranti: (data) => post("/garantiler/", data),
  kapatGaranti: (id) => put(`/garantiler/${id}/kapat`, {}),

  // Kasa
  kasaOzet: (periyot = "bugun", baslangic, bitis) => get(
    `/kasa/ozet?periyot=${periyot}` +
    (periyot === "ozel" && baslangic && bitis ? `&baslangic=${baslangic}&bitis=${bitis}` : "")
  ),
  kasaBugun: () => get("/kasa/bugun"),
  kasaTarih: (tarih) => get(`/kasa/tarih/${tarih}`),
  kasaGider: (data) => post("/kasa/gider", data),
  kasaDuzelt: (data) => post("/kasa/duzelt", data),

  // Gider
  giderList: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
    return get(`/giderler/${q ? "?" + q : ""}`);
  },
  createGider: (data) => post("/giderler/", data),
  deleteGider: (id) => del(`/giderler/${id}`),
  giderKategorileri: () => get("/giderler/kategoriler"),
  giderKategoriEkle: (ad) => post("/giderler/kategoriler", { ad }),

  // Loaner
  loanerList: () => get("/loaner/"),
  loanerGecmis: () => get("/loaner/gecmis"),
  createLoaner: (data) => post("/loaner/", data),
  iadeLoaner: (id, data = {}) => put(`/loaner/${id}/iade`, data),
  loanerHasar: (id, data) => post(`/loaner/${id}/hasar`, data),
  loanerFotolar: (id) => get(`/loaner/${id}/fotolar`),
  addLoanerFoto: (id, data) => post(`/loaner/${id}/fotolar`, data),

  // Aksesuar
  aksesuarList: () => get("/aksesuarlar/"),
  createAksesuar: (data) => post("/aksesuarlar/", data),
  updateAksesuar: (id, data) => put(`/aksesuarlar/${id}`, data),
  deleteAksesuar: (id) => del(`/aksesuarlar/${id}`),
  satAksesuar: (id, data) => post(`/aksesuarlar/${id}/sat`, data),
  aksesuarKategorileri: () => get("/aksesuarlar/kategoriler"),
  aksesuarKategoriEkle: (ad) => post("/aksesuarlar/kategoriler", { ad }),
  aksesuarKategoriSil: (ad) => del(`/aksesuarlar/kategoriler?ad=${encodeURIComponent(ad)}`),
  aksesuarHareketler: (id) => get(`/aksesuarlar/${id}/hareketler`),
  aksesuarStokEkle: (id, data) => post(`/aksesuarlar/${id}/stok-ekle`, data),
  aksesuarBarkotAra: (kod) => get(`/aksesuarlar/barkot/${encodeURIComponent(kod)}`),
  aksesuarTopluSat: (data) => post("/aksesuarlar/toplu-sat", data),

  // Etiket ayarları (barkot etiketi — logo, boyut)
  etiketAyarlari: () => get("/vitrin/etiket-ayarlari"),
  etiketAyarlariGuncelle: (data) => put("/vitrin/etiket-ayarlari", data),
  aksesuarSatisGecmisi: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
    const s = q.toString();
    return get(`/aksesuarlar/satislar${s ? "?" + s : ""}`);
  },

  // Hedef
  hedefBuAy: () => get("/hedef/bu-ay"),
  setHedef: (data) => post("/hedef/", data),

  // Maas
  calisanlar: () => get("/maas/calisanlar"),
  createCalisan: (data) => post("/maas/calisanlar", data),
  createAvans: (data) => post("/maas/avans", data),
  maasOzet: (yil, ay) => get(`/maas/ozet/${yil}/${ay}`),
  calisanAvanslar: (id) => get(`/maas/avanslar/${id}`),
  maasOde: (id, data) => post(`/maas/ode/${id}`, data),

  // Kara Liste
  karaListe: (q) => get(`/kara-liste/${q ? "?q=" + encodeURIComponent(q) : ""}`),
  createKara: (data) => post("/kara-liste/", data),
  updateKara: (id, data) => put(`/kara-liste/${id}`, data),
  deleteKara: (id) => del(`/kara-liste/${id}`),

  // Parca Iade
  parcaIadeList: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
    return get(`/parca-iade/${q ? "?" + q : ""}`);
  },
  createParcaIade: (data) => post("/parca-iade/", data),
  updateParcaIade: (id, data) => put(`/parca-iade/${id}`, data),
  deleteParcaIade: (id) => del(`/parca-iade/${id}`),
  updateParcaIadeDurum: (id, durum, extra) => put(`/parca-iade/${id}/durum`, { durum, ...extra }),

  // Çalışan Bildirim (Şikayet/Övgü)
  geriBildirimCalisanlar: () => get("/geri-bildirim/calisanlar"),
  geriBildirimList: () => get("/geri-bildirim/"),
  geriBildirimSkor: () => get("/geri-bildirim/skor"),
  geriBildirimBekleyen: () => get("/geri-bildirim/bildirim"),
  createGeriBildirim: (data) => post("/geri-bildirim/", data),
  geriBildirimGoruldu: () => post("/geri-bildirim/goruldu", {}),

  // Evrensel Arama
  ara: (q) => get(`/arama/?q=${encodeURIComponent(q)}`),

  // Şablonlar
  sablonlar: () => get("/sablonlar/"),
  createSablon: (data) => post("/sablonlar/", data),
  updateSablon: (id, data) => put(`/sablonlar/${id}`, data),
  deleteSablon: (id) => del(`/sablonlar/${id}`),
  sablon_kullan: (id) => post(`/sablonlar/${id}/kullan`, {}),

  // Model/Arıza Önerileri
  repairModeller: () => get("/repairs/modeller"),
  repairArizaOneri: () => get("/repairs/ariza-onceriler"),

  // Tamir Parçaları
  repairParcalar: (id) => get(`/repairs/${id}/parcalar`),
  addRepairParca: (id, data) => post(`/repairs/${id}/parcalar`, data),
  deleteRepairParca: (id, rpId) => del(`/repairs/${id}/parcalar/${rpId}`),

  // Tamir Fotoğrafları
  repairFotolar: (id) => get(`/repairs/${id}/fotolar`),
  addRepairFoto: (id, data) => post(`/repairs/${id}/fotolar`, data),
  deleteRepairFoto: (id, fotoId) => del(`/repairs/${id}/fotolar/${fotoId}`),

  // İstatistik
  stats: () => get("/reports/genel"),
  aktiviteFeed: () => get("/reports/feed"),

  // AI
  aiSor: (soru) => post("/ai/sor", { soru }),
  aiStt: (audio, mime) => post("/ai/stt", { audio, mime }),
  aiTamirAyikla: (text) => post("/ai/tamir-ayikla", { text }),

  // Super Admin
  adminDukkanlar: () => get("/admin/dukkanlar"),
  adminSetAbonelik: (id, durum) => patch(`/admin/dukkanlar/${id}/abonelik`, { durum }),
  adminSureUzat: (id, body) => post(`/admin/dukkanlar/${id}/sure`, body),
  adminTopluSureUzat: (dukkan_ids, gun) => post("/admin/dukkanlar/toplu-sure", { dukkan_ids, gun }),
  adminIstatistik: () => get("/admin/istatistik"),
  adminOzet: () => get("/admin/ozet"),
  adminMaliDurum: () => get("/admin/mali-durum"),
  adminGiderEkle: (body) => post("/admin/giderler", body),
  adminGiderSil: (id) => del(`/admin/giderler/${id}`),
  adminDestekKonusmalari: () => get("/admin/destek"),
  adminDestekGecmisi: (dukkanId) => get(`/admin/destek/${dukkanId}`),
  adminDestekYanitla: (dukkanId, mesaj) => post(`/admin/destek/${dukkanId}`, { mesaj }),
  adminDestekDosyaYanitla: (dukkanId, file) => uploadFile(`/admin/destek/${dukkanId}/dosya`, file),
  adminAudit: () => get("/admin/audit"),
  adminAuditExport: () => downloadFile("/admin/audit/export", "aktivite.xlsx"),
  adminDuyuruGonder: (dukkan_ids, mesaj) => post("/admin/duyuru-gonder", { dukkan_ids, mesaj }),
  adminDuyurular: () => get("/admin/duyurular"),
  adminSilinecekDukkanlar: () => get("/admin/silinecek-dukkanlar"),
  adminSilmeIptal: (id) => post(`/admin/dukkanlar/${id}/silme-iptal`, {}),
  adminKaliciSil: (id, onay_adi) => post(`/admin/dukkanlar/${id}/kalici-sil`, { onay_adi }),
  adminPlanlar: () => get("/admin/planlar"),
  adminPlanFiyatGuncelle: (tur, fiyat) => put(`/admin/planlar/${tur}`, { fiyat }),
  adminSetPlan: (id, plan) => put(`/admin/dukkanlar/${id}/plan`, { plan }),
  adminMaliDurumExport: () => downloadFile("/admin/mali-durum/export", "mali-durum.xlsx"),
  adminReferansKodlari: () => get("/admin/referans-kodlari"),
  adminReferansKoduEkle: (body) => post("/admin/referans-kodlari", body),
  adminReferansKoduAktiflik: (id) => put(`/admin/referans-kodlari/${id}/aktif`, {}),
  adminReferansKoduSil: (id) => del(`/admin/referans-kodlari/${id}`),

  // Destek (dükkan tarafı)
  destekMesajlarim: () => get("/destek/mesajlarim"),
  destekMesajGonder: (mesaj) => post("/destek/mesajlarim", { mesaj }),
  destekMesajDosyaGonder: (file) => uploadFile("/destek/mesajlarim/dosya", file),
  destekDuyurularim: () => get("/destek/duyurularim"),
  destekDuyuruGorundu: (id) => post(`/destek/duyurularim/${id}/gorundu`, {}),
  destekHesapSilmeTalebi: () => post("/destek/hesap-silme-talebi", {}),
  destekHesapSilmeTalebiIptal: () => post("/destek/hesap-silme-talebi/iptal", {}),
  destekHesapDurumu: () => get("/destek/hesap-durumu"),

  // Vitrin (dükkan ayarları + randevu talepleri)
  vitrinAyarlarim: () => get("/vitrin/ayarlarim"),
  vitrinAyarlariGuncelle: (body) => put("/vitrin/ayarlarim", body),
  vitrinLogoYukle: (file) => uploadFile("/vitrin/logo", file),
  vitrinKapakYukle: (file) => uploadFile("/vitrin/kapak", file),
  vitrinGaleri: () => get("/vitrin/galeri"),
  vitrinGaleriEkle: (file) => uploadFile("/vitrin/galeri", file),
  vitrinGaleriSil: (id) => del(`/vitrin/galeri/${id}`),

  // Ürün görselleri (vitrinde gösterilir)
  ikinciElGorselYukle: (id, file) => uploadFile(`/ikinciel/${id}/gorsel`, file),
  sifirCihazGorselYukle: (id, file) => uploadFile(`/sifir-cihaz/${id}/gorsel`, file),
  aksesuarGorselYukle: (id, file) => uploadFile(`/aksesuarlar/${id}/gorsel`, file),

  // Portalden kaydolan yeni müşteriler (bildirim)
  yeniUyeler: () => get("/customers/yeni-uyeler"),
  yeniUyeleriGordum: () => post("/customers/yeni-uyeleri-gordum", {}),

  // Bildirim zili — alacak vadesi/tamir teslim (günlük), randevu/takas/müşteri mesajı (anlık)
  bildirimSayisi: () => get("/bildirimler/sayim"),
  bildirimler: () => get("/bildirimler/"),
  bildirimlerOkundu: () => post("/bildirimler/okundu", {}),
  vitrinRandevuTalepleri: () => get("/vitrin/randevu-talepleri"),
  vitrinRandevuDurumGuncelle: (id, durum) => put(`/vitrin/randevu-talepleri/${id}/durum`, { durum }),
  vitrinDegerlendirmeler: () => get("/vitrin/degerlendirmeler"),
  vitrinDegerlendirmeOnay: (id, onaylandi) => put(`/vitrin/degerlendirmeler/${id}/onay`, { onaylandi }),
  vitrinDegerlendirmeSil: (id) => del(`/vitrin/degerlendirmeler/${id}`),
  vitrinTakasTeklifleri: () => get("/vitrin/takas-teklifleri"),
  vitrinTakasTeklifiGuncelle: (id, durum, teklif_tutari) => put(`/vitrin/takas-teklifleri/${id}`, { durum, teklif_tutari }),

  // Public (kayıtsız erişim — Landing + Mağaza portalı)
  publicPlanlar: () => get("/public/planlar"),
  publicDukkan: (slug) => get(`/public/dukkan/${slug}`),
  publicTamirDurumu: (slug, q) => get(`/public/dukkan/${slug}/tamir-durumu?q=${encodeURIComponent(q)}`),
  publicCihazlar: (slug) => get(`/public/dukkan/${slug}/cihazlar`),
  publicRandevuTalebi: (slug, body) => post(`/public/dukkan/${slug}/randevu`, body),
  publicGarantiDurumu: (slug, q) => get(`/public/dukkan/${slug}/garanti-durumu?q=${encodeURIComponent(q)}`),
  publicFis: (slug, repairNo, telefon) => get(`/public/dukkan/${slug}/fis/${repairNo}?telefon=${encodeURIComponent(telefon)}`),
  publicFiyatSorgu: (slug, model) => get(`/public/dukkan/${slug}/fiyat-sorgu?model=${encodeURIComponent(model)}`),
  publicDegerlendirmeEkle: (slug, body) => post(`/public/dukkan/${slug}/degerlendirme`, body),
  publicDegerlendirmeler: (slug) => get(`/public/dukkan/${slug}/degerlendirmeler`),
  publicTakasTeklifi: (slug, fields) => postForm(`/public/dukkan/${slug}/takas-teklifi`, fields),

  // Müşteri portalı
  musteriKayit: (slug, body) => post(`/public/dukkan/${slug}/musteri/kayit`, body),
  musteriAcikKayit: (slug, body) => post(`/public/dukkan/${slug}/musteri/kayit-ol`, body),
  musteriGiris: (slug, body) => post(`/public/dukkan/${slug}/musteri/giris`, body),
  musteriPanelim: (slug, token) => getWithToken(`/public/dukkan/${slug}/musteri/panelim`, token),
  musteriBorcOdemeleri: (slug, borcId, token) => getWithToken(`/public/dukkan/${slug}/musteri/borc/${borcId}/odemeler`, token),
  musteriMesajlarim: (slug, token) => getWithToken(`/public/dukkan/${slug}/musteri/mesajlarim`, token),
  musteriMesajGonder: (slug, mesaj, token) => postWithToken(`/public/dukkan/${slug}/musteri/mesajlarim`, { mesaj }, token),

  // Müşteri mesajları (dükkan tarafı)
  vitrinMusteriMesajlari: () => get("/vitrin/musteri-mesajlari"),
  vitrinMusteriMesajGecmisi: (customerId) => get(`/vitrin/musteri-mesajlari/${customerId}`),
  vitrinMusteriMesajYanitla: (customerId, mesaj) => post(`/vitrin/musteri-mesajlari/${customerId}`, { mesaj }),

  // E-posta doğrulama (kayıt)
  emailDogrulamaDurumu: () => get("/auth/email-dogrulama-durumu"),
  kodGonder: (email) => post("/auth/kod-gonder", { email }),
  kodDogrula: (email, kod) => post("/auth/kod-dogrula", { email, kod }),

  // Şifre sıfırlama (e-posta kodu ile)
  sifreSifirlaKodGonder: (email) => post("/auth/sifre-sifirla/kod-gonder", { email }),
  sifreSifirlaOnayla: (email, kod, yeni_sifre) => post("/auth/sifre-sifirla/onayla", { email, kod, yeni_sifre }),
  adminSifreSifirla: (dukkanId) => post(`/admin/dukkanlar/${dukkanId}/sifre-sifirla`, {}),
};
