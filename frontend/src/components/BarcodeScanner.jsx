import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState([]);
  const [camIdx, setCamIdx] = useState(0);
  const controlsRef = useRef(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    BrowserMultiFormatReader.listVideoInputDevices()
      .then((devices) => {
        if (!devices.length) {
          setError("Kamera bulunamadı");
          return;
        }
        // Arka kamera önce
        const sorted = [...devices].sort((a, b) => {
          const aBack = /back|rear|environment/i.test(a.label);
          const bBack = /back|rear|environment/i.test(b.label);
          return bBack - aBack;
        });
        setCameras(sorted);
      })
      .catch(() => setError("Kamera erişimi reddedildi"));

    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!cameras.length || !videoRef.current) return;
    controlsRef.current?.stop();

    const deviceId = cameras[camIdx]?.deviceId;
    readerRef.current
      .decodeFromVideoDevice(deviceId, videoRef.current, (result, err, controls) => {
        if (!controlsRef.current) controlsRef.current = controls;
        if (result) {
          const text = result.getText().replace(/\D/g, "");
          if (text.length === 15) {
            controls.stop();
            onScan(text);
          } else if (text.length >= 14) {
            // Might be an IMEI without check digit
            controls.stop();
            onScan(text.slice(0, 15));
          }
        }
      })
      .catch(() => setError("Kamera başlatılamadı"));
  }, [cameras, camIdx]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.95)",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Başlık */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px",
        color: "#fff",
      }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>📷 IMEI Barkodu Okut</span>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.15)", border: "none",
            color: "#fff", borderRadius: 8, padding: "6px 14px",
            fontSize: 14, cursor: "pointer",
          }}
        >
          ✕ Kapat
        </button>
      </div>

      {/* Video */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <video
          ref={videoRef}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          muted
          playsInline
        />
        {/* Hedef çerçevesi */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 280, height: 100,
            border: "3px solid #22c55e",
            borderRadius: 10,
            boxShadow: "0 0 0 2000px rgba(0,0,0,0.4)",
          }}>
            {/* Köşe işaretleri */}
            {[
              { top: -3, left: -3, borderTop: "4px solid #22c55e", borderLeft: "4px solid #22c55e" },
              { top: -3, right: -3, borderTop: "4px solid #22c55e", borderRight: "4px solid #22c55e" },
              { bottom: -3, left: -3, borderBottom: "4px solid #22c55e", borderLeft: "4px solid #22c55e" },
              { bottom: -3, right: -3, borderBottom: "4px solid #22c55e", borderRight: "4px solid #22c55e" },
            ].map((s, i) => (
              <div key={i} style={{
                position: "absolute", width: 20, height: 20,
                borderRadius: 2, ...s,
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Alt panel */}
      <div style={{ padding: "16px", color: "#fff", textAlign: "center" }}>
        {error ? (
          <div style={{ color: "#f87171", marginBottom: 10 }}>{error}</div>
        ) : (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>
            Telefon kutusundaki IMEI barkodunu çerçeve içine getirin
          </div>
        )}
        {cameras.length > 1 && (
          <button
            onClick={() => setCamIdx((i) => (i + 1) % cameras.length)}
            style={{
              background: "rgba(255,255,255,0.15)", border: "none",
              color: "#fff", borderRadius: 8, padding: "8px 16px",
              fontSize: 13, cursor: "pointer",
            }}
          >
            🔄 Kamerayı Değiştir ({camIdx + 1}/{cameras.length})
          </button>
        )}
      </div>
    </div>
  );
}
