import { useState, useRef } from "react";
import { api } from "../api";

// Oturum boyunca stream'i açık tut
let _stream = null;

async function getStream() {
  if (_stream && _stream.active) return _stream;
  _stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  return _stream;
}

export default function VoiceInput({ onResult, style = {} }) {
  const [state, setState] = useState("idle"); // idle | recording | processing
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function handlePress() {
    if (state !== "idle") return;
    let stream;
    try {
      stream = await getStream();
    } catch {
      alert("Mikrofon erişimine izin verilmedi");
      return;
    }

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      if (chunksRef.current.length === 0) { setState("idle"); return; }
      setState("processing");
      const blob = new Blob(chunksRef.current, { type: mimeType });
      try {
        const b64 = await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result.split(",")[1]);
          reader.readAsDataURL(blob);
        });
        const result = await api.aiStt(b64, mimeType.split(";")[0]);
        if (result.text) onResult(result.text);
      } catch {
        // sessizce başarısız ol
      }
      setState("idle");
    };

    recorderRef.current = recorder;
    recorder.start();
    setState("recording");
  }

  function handleRelease() {
    if (state !== "recording") return;
    recorderRef.current?.stop();
  }

  const cfg = {
    idle:       { bg: "var(--bg2)", color: "var(--hint)", icon: "🎤", label: "Basılı tut, konuş" },
    recording:  { bg: "#ef4444",    color: "#fff",        icon: "🔴", label: "Bırak" },
    processing: { bg: "#f59e0b",    color: "#fff",        icon: "⌛", label: "İşleniyor..." },
  }[state];

  return (
    <button
      type="button"
      onPointerDown={handlePress}
      onPointerUp={handleRelease}
      onPointerLeave={handleRelease}
      disabled={state === "processing"}
      title={cfg.label}
      style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "none",
        cursor: state === "processing" ? "wait" : "pointer",
        flexShrink: 0,
        background: cfg.bg,
        color: cfg.color,
        fontSize: 16,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.15s",
        ...style,
      }}
    >
      {cfg.icon}
    </button>
  );
}
