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

  // Borc
  debts: () => get("/debts/"),
  createDebt: (data) => post("/debts/", data),
  payDebt: (id, data) => post(`/debts/${id}/pay`, data),

  // Kullaniciler
  users: () => get("/users/"),
  changeRole: (id, role) => put(`/users/${id}/role`, { role }),
};
