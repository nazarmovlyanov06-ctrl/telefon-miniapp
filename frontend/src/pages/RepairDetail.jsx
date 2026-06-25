import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";

const STATUSES = [
  { key: "bekliyor", label: "⏳ Bekliyor" },
  { key: "tamirde", label: "🔧 Tamirde" },
  { key: "parca_bekleniyor", label: "📦 Parça Bekleniyor" },
  { key: "hazir", label: "✅ Hazır" },
  { key: "teslim", label: "🏠 Teslim Edildi" },
];

export default function RepairDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [repair, setRepair] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    api.repair(id).then((r) => {
      setRepair(r);
      setForm({
        device_model: r.device_model,
        fault_desc: r.fault_desc,
        estimated_price: r.estimated_price || "",
        final_price: r.final_price || "",
        payment_type: r.payment_type || "nakit",
        status: r.status,
        notes: r.notes || "",
      });
    }).finally(() => setLoading(false));
  }, [id]);

  async function changeStatus(status) {
    setSaving(true);
    try {
      await api.updateRepair(id, { ...form, status });
      setRepair((r) => ({ ...r, status }));
      setForm((f) => ({ ...f, status }));
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateRepair(id, form);
      setRepair((r) => ({ ...r, ...form }));
      setEdit(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (!repair) return <div className="empty">Bulunamadı</div>;

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/repairs")}>← Geri</button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>#{repair.repair_no}</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setEdit(!edit)}>
          {edit ? "İptal" : "✏️ Düzenle"}
        </button>
      </div>

      {/* Durum butonları */}
      <div className="section-title">Durum</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {STATUSES.map((s) => (
          <button
            key={s.key}
            className={`tab ${form.status === s.key ? "active" : ""}`}
            onClick={() => changeStatus(s.key)}
            disabled={saving}
            style={{ fontSize: 12 }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {edit ? (
        <div className="card">
          <div className="form-group">
            <label className="form-label">Cihaz Modeli</label>
            <input className="form-input" value={form.device_model}
              onChange={(e) => setForm({ ...form, device_model: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Arıza</label>
            <input className="form-input" value={form.fault_desc}
              onChange={(e) => setForm({ ...form, fault_desc: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="form-group">
              <label className="form-label">Tahmini Ücret</label>
              <input className="form-input" type="number" value={form.estimated_price}
                onChange={(e) => setForm({ ...form, estimated_price: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Son Ücret</label>
              <input className="form-input" type="number" value={form.final_price}
                onChange={(e) => setForm({ ...form, final_price: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Ödeme Tipi</label>
            <select className="form-select" value={form.payment_type}
              onChange={(e) => setForm({ ...form, payment_type: e.target.value })}>
              <option value="nakit">💵 Nakit</option>
              <option value="kart">💳 Kart</option>
              <option value="taksit">📅 Taksit</option>
              <option value="borc">📝 Borç</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Not</label>
            <input className="form-input" value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Kaydediliyor..." : "💾 Kaydet"}
          </button>
        </div>
      ) : (
        <>
          <div className="card">
            <Row label="Müşteri" value={repair.customer_name || "—"} />
            <div className="divider" />
            <Row label="Telefon" value={repair.customer_phone || "—"} />
            <div className="divider" />
            <Row label="Cihaz" value={repair.device_model} />
            <div className="divider" />
            <Row label="IMEI" value={repair.imei || "—"} />
            <div className="divider" />
            <Row label="Arıza" value={repair.fault_desc} />
          </div>
          <div className="card">
            <Row label="Tahmini Ücret" value={repair.estimated_price ? `₺${repair.estimated_price}` : "—"} />
            <div className="divider" />
            <Row label="Son Ücret" value={repair.final_price ? `₺${repair.final_price}` : "—"} />
            <div className="divider" />
            <Row label="Ödeme" value={repair.payment_type || "—"} />
          </div>
          {repair.notes && (
            <div className="card">
              <Row label="Not" value={repair.notes} />
            </div>
          )}
          {repair.customer_id && (
            <button className="btn btn-ghost" style={{ marginTop: 8 }}
              onClick={() => navigate(`/customers/${repair.customer_id}`)}>
              👤 Müşteri Detayı
            </button>
          )}
          {user?.role === "patron" && (
            <button className="btn btn-danger" style={{ marginTop: 8 }}
              onClick={async () => {
                if (confirm("Bu tamiri silmek istediğinize emin misiniz?")) {
                  await api.deleteRepair(id);
                  navigate("/repairs");
                }
              }}>
              🗑️ Sil
            </button>
          )}
        </>
      )}
    </div>
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
