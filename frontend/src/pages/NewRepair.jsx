import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function NewRepair() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customer_name: "", customer_phone: "",
    device_model: "", imei: "", fault_desc: "",
    estimated_price: "", notes: "",
  });

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.device_model || !form.fault_desc) {
      setError("Cihaz modeli ve arıza açıklaması zorunlu");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.createRepair({
        ...form,
        estimated_price: form.estimated_price ? parseFloat(form.estimated_price) : null,
      });
      navigate(`/repairs/${res.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/repairs")}>← Geri</button>
        <div className="page-title" style={{ margin: 0 }}>Yeni Tamir</div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={submit}>
        <div className="section-title">Müşteri Bilgisi</div>
        <div className="card">
          <div className="form-group">
            <label className="form-label">Müşteri Adı *</label>
            <input className="form-input" placeholder="Ad Soyad" value={form.customer_name}
              onChange={(e) => set("customer_name", e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Telefon</label>
            <input className="form-input" placeholder="05xx xxx xx xx" type="tel" value={form.customer_phone}
              onChange={(e) => set("customer_phone", e.target.value)} />
          </div>
        </div>

        <div className="section-title">Cihaz Bilgisi</div>
        <div className="card">
          <div className="form-group">
            <label className="form-label">Cihaz Modeli *</label>
            <input className="form-input" placeholder="Samsung A54, iPhone 14..." value={form.device_model}
              onChange={(e) => set("device_model", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">IMEI</label>
            <input className="form-input" placeholder="15 haneli IMEI" type="number" value={form.imei}
              onChange={(e) => set("imei", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Arıza Açıklaması *</label>
            <input className="form-input" placeholder="Ekran kırık, şarj olmuyor..." value={form.fault_desc}
              onChange={(e) => set("fault_desc", e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Tahmini Ücret (₺)</label>
            <input className="form-input" placeholder="0" type="number" value={form.estimated_price}
              onChange={(e) => set("estimated_price", e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Not</label>
            <input className="form-input" placeholder="Ek bilgi..." value={form.notes}
              onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 8 }}>
          {saving ? "Kaydediliyor..." : "✅ Tamir Kaydı Oluştur"}
        </button>
      </form>
    </div>
  );
}
