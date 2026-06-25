import { useState } from "react";
import BarcodeScanner from "./BarcodeScanner";

export default function ImeiInput({ value, onChange, placeholder, style, required }) {
  const [scanning, setScanning] = useState(false);

  function handleScan(imei) {
    onChange(imei);
    setScanning(false);
  }

  return (
    <>
      <div style={{ position: "relative" }}>
        <input
          className="form-input"
          placeholder={placeholder || "IMEI (15 hane)"}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 15))}
          required={required}
          style={{
            fontFamily: "monospace",
            letterSpacing: 2,
            paddingRight: 44,
            ...style,
          }}
        />
        <button
          type="button"
          onClick={() => setScanning(true)}
          title="Barkod okut"
          style={{
            position: "absolute", right: 6, top: "50%",
            transform: "translateY(-50%)",
            background: "var(--accent)",
            border: "none", borderRadius: 6,
            width: 32, height: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 16,
            color: "#fff",
          }}
        >
          📷
        </button>
      </div>
      {scanning && (
        <BarcodeScanner onScan={handleScan} onClose={() => setScanning(false)} />
      )}
    </>
  );
}
