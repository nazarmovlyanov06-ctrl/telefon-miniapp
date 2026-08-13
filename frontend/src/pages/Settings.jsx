import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const ROLES = [
  { key: "patron", label: "👑 Patron" },
  { key: "teknisyen", label: "🔧 Teknisyen" },
  { key: "satis", label: "🛍️ Satış" },
  { key: "cirak", label: "🧑‍🔧 Çırak" },
];

export default function Settings({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", ad: "", sifre: "", rol: "cirak" });
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const load = () => {
    if (user?.rol === "patron") {
      api.users().then(setUsers).finally(() => setLoading(false));
      api.aktiviteFeed().then(setFeed).catch(() => {});
    } else {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  async function changeRole(u, rol) {
    await api.changeRole(u.id, rol);
    load();
  }

  async function toggleAktif(u) {
    await api.calisanAktiflik(u.id, !u.aktif);
    load();
  }

  async function sil(u) {
    if (!confirm(`${u.ad} silinsin mi?`)) return;
    await api.calisanSil(u.id);
    load();
  }

  async function ekle(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.calisanEkle(form);
      setForm({ email: "", ad: "", sifre: "", rol: "cirak" });
      setShowForm(false);
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/more")}>← Geri</button>
        <div className="page-title" style={{ margin: 0 }}>⚙️ Ayarlar</div>
      </div>

      {user?.rol !== "patron" ? (
        <div className="card" style={{ color: "var(--hint)", textAlign: "center", padding: 32 }}>
          Bu sayfayı sadece patron görebilir
        </div>
      ) : loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : (
        <>
          <div className="card-row" style={{ marginBottom: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>Çalışanlar</div>
            <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(v => !v); setErr(""); }}>
              + Yeni Çalışan
            </button>
          </div>

          {showForm && (
            <div className="card" style={{ marginBottom: 12 }}>
              <form onSubmit={ekle}>
                {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8, fontWeight: 600 }}>❌ {err}</div>}
                <div className="form-group">
                  <label className="form-label">Ad Soyad</label>
                  <input className="form-input" required value={form.ad}
                    onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">E-posta</label>
                  <input type="email" className="form-input" required value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Şifre (en az 6 karakter)</label>
                  <input type="text" className="form-input" required minLength={6} value={form.sifre}
                    onChange={e => setForm(f => ({ ...f, sifre: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Rol</label>
                  <select className="form-select" value={form.rol}
                    onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                    {ROLES.filter(r => r.key !== "patron").map(r => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn btn-primary">Ekle</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
                </div>
              </form>
            </div>
          )}

          {feed.length > 0 && (
            <>
              <div className="section-title">📋 Bugünkü Değişiklikler</div>
              {feed.map(f => (
                <div key={f.id} className="card" style={{ padding: "8px 14px", marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {f.guncelleyen || "?"} → #{f.repair_no} {f.device_model}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--hint)" }}>
                        {f.musteri_adi ? `👤 ${f.musteri_adi} · ` : ""}{f.status}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--hint)", whiteSpace: "nowrap" }}>
                      {f.updated_at ? new Date(f.updated_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {users.map((u) => (
            <div key={u.id} className="card" style={{ opacity: u.aktif ? 1 : 0.5 }}>
              <div className="card-row" style={{ marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{u.ad}</div>
                  <div style={{ fontSize: 12, color: "var(--hint)" }}>{u.email}</div>
                </div>
                <span className={`badge badge-${u.rol}`}>
                  {ROLES.find((r) => r.key === u.rol)?.label || u.rol}
                </span>
              </div>
              {u.rol !== "patron" && (
                <>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {ROLES.map((r) => (
                      <button
                        key={r.key}
                        className={`tab ${u.rol === r.key ? "active" : ""}`}
                        style={{ fontSize: 12, padding: "5px 10px" }}
                        onClick={() => changeRole(u, r.key)}
                        disabled={u.rol === r.key}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-sm" style={{ padding: "6px 14px" }} onClick={() => toggleAktif(u)}>
                      {u.aktif ? "⏸ Pasifleştir" : "▶️ Aktifleştir"}
                    </button>
                    <button className="btn btn-sm" style={{ background: "var(--danger)", color: "#fff", padding: "6px 14px" }}
                      onClick={() => sil(u)}>🗑️ Sil</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
