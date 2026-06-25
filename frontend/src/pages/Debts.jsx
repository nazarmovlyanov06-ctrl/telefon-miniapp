import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Debts() {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => api.debts().then(setDebts).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  async function pay(debt) {
    const amount = prompt(`${debt.customer_name} - Ödeme miktarı (₺)?`);
    if (!amount) return;
    await api.payDebt(debt.id, { amount: parseFloat(amount) });
    load();
  }

  const total = debts.reduce((s, d) => s + d.remaining, 0);

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/more")}>← Geri</button>
        <div className="page-title" style={{ margin: 0 }}>💰 Borçlar</div>
      </div>

      {!loading && debts.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-row">
            <span style={{ color: "var(--hint)" }}>Toplam Alacak</span>
            <span style={{ fontWeight: 800, fontSize: 20, color: "var(--danger)" }}>
              ₺{total.toLocaleString("tr-TR")}
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : debts.length === 0 ? (
        <div className="empty"><div className="empty-icon">💰</div>Açık borç yok</div>
      ) : (
        debts.map((d) => (
          <div key={d.id} className="card">
            <div className="card-row">
              <div>
                <div style={{ fontWeight: 600 }}>{d.customer_name}</div>
                <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 2 }}>
                  {d.customer_phone || "—"}
                  {d.due_date ? ` · Vade: ${new Date(d.due_date).toLocaleDateString("tr-TR")}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: "var(--danger)", fontSize: 17 }}>
                  ₺{d.remaining.toLocaleString("tr-TR")}
                </div>
                <div style={{ fontSize: 12, color: "var(--hint)" }}>
                  /{d.total_amount.toLocaleString("tr-TR")}
                </div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => pay(d)}>
              💵 Ödeme Al
            </button>
          </div>
        ))
      )}
    </div>
  );
}
