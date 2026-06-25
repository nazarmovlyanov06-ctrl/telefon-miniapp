import { getInitData } from "./tg";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Init-Data": getInitData(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });
const put = (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) });
const del = (path) => request(path, { method: "DELETE" });

export const api = {
  // Auth
  me: () => get("/users/me"),

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
  deleteRepair: (id) => del(`/repairs/${id}`),

  // Musteriler
  customers: (q) => get(`/customers/${q ? "?q=" + encodeURIComponent(q) : ""}`),
  customer: (id) => get(`/customers/${id}`),
  customerRepairs: (id) => get(`/customers/${id}/repairs`),
  createCustomer: (data) => post("/customers/", data),
  updateCustomer: (id, data) => put(`/customers/${id}`, data),
  deleteCustomer: (id) => del(`/customers/${id}`),

  // Stok / Parca
  parts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/parts/${q ? "?" + q : ""}`);
  },
  createPart: (data) => post("/parts/", data),
  updatePart: (id, data) => put(`/parts/${id}`, data),
  deletePart: (id) => del(`/parts/${id}`),
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
  debts: () => get("/debts/"),
  createDebt: (data) => post("/debts/", data),
  payDebt: (id, data) => post(`/debts/${id}/pay`, data),

  // Kullaniciler
  users: () => get("/users/"),
  changeRole: (id, role) => put(`/users/${id}/role`, { role }),

  // Toptanci
  toptanciList: () => get("/toptanci/"),
  createToptanci: (data) => post("/toptanci/", data),
  updateToptanci: (id, data) => put(`/toptanci/${id}`, data),
  deleteToptanci: (id) => del(`/toptanci/${id}`),
  toptanciAlislar: (id) => get(`/toptanci/${id}/alislar`),
  createToptanciAlis: (id, data) => post(`/toptanci/${id}/alislar`, data),

  // 2. El Cihaz
  ikinciElList: () => get("/ikinciel/listesi"),
  ikinciElOzet: () => get("/ikinciel/ozet"),
  createIkinciEl: (data) => post("/ikinciel/", data),
  ikinciElMasraf: (id, data) => post(`/ikinciel/${id}/masraf`, data),
  ikinciElSat: (id, data) => post(`/ikinciel/${id}/sat`, data),

  // Garanti
  garantiList: () => get("/garantiler/"),
  createGaranti: (data) => post("/garantiler/", data),
  kapatGaranti: (id) => put(`/garantiler/${id}/kapat`, {}),

  // Kasa
  kasaBugun: () => get("/kasa/bugun"),
  kasaTarih: (tarih) => get(`/kasa/tarih/${tarih}`),
  kasaGider: (data) => post("/kasa/gider", data),

  // Gider
  giderList: () => get("/giderler/"),
  createGider: (data) => post("/giderler/", data),
  deleteGider: (id) => del(`/giderler/${id}`),

  // Loaner
  loanerList: () => get("/loaner/"),
  createLoaner: (data) => post("/loaner/", data),
  iadeLoaner: (id, data = {}) => put(`/loaner/${id}/iade`, data),

  // Aksesuar
  aksesuarList: () => get("/aksesuarlar/"),
  createAksesuar: (data) => post("/aksesuarlar/", data),
  updateAksesuar: (id, data) => put(`/aksesuarlar/${id}`, data),
  satAksesuar: (id, data) => post(`/aksesuarlar/${id}/sat`, data),

  // Hedef
  hedefBuAy: () => get("/hedef/bu-ay"),
  setHedef: (data) => post("/hedef/", data),

  // Maas
  calisanlar: () => get("/maas/calisanlar"),
  createCalisan: (data) => post("/maas/calisanlar", data),
  createAvans: (data) => post("/maas/avans", data),
  maasOzet: (yil, ay) => get(`/maas/ozet/${yil}/${ay}`),

  // Kara Liste
  karaListe: (q) => get(`/kara-liste/${q ? "?q=" + encodeURIComponent(q) : ""}`),
  createKara: (data) => post("/kara-liste/", data),
  deleteKara: (id) => del(`/kara-liste/${id}`),

  // Parca Iade
  parcaIadeList: () => get("/parca-iade/"),
  createParcaIade: (data) => post("/parca-iade/", data),
  updateParcaIadeDurum: (id, durum) => put(`/parca-iade/${id}/durum`, { durum }),

  // AI
  aiSor: (soru) => post("/ai/sor", { soru }),
};
