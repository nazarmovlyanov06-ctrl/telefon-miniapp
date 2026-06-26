import { useState } from "react";

// Uygulama ömrü boyunca bir kez izin alındı mı?
let _micReady = false;

async function ensureMicPermission() {
  if (_micReady) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop()); // hemen bırak
    _micReady = true;
    return true;
  } catch {
    return false;
  }
}

export default function VoiceInput({ onResult, style = {} }) {
  const [listening, setListening] = useState(false);

  async function start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Tarayıcınız ses girişini desteklemiyor");
      return;
    }

    const ok = await ensureMicPermission();
    if (!ok) {
      alert("Mikrofon erişimine izin verilmedi");
      return;
    }

    setListening(true);
    const recognition = new SR();
    recognition.lang = "tr-TR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      onResult(e.results[0][0].transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={listening}
      style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "none", cursor: "pointer", flexShrink: 0,
        background: listening ? "#ef4444" : "var(--bg2)",
        color: listening ? "#fff" : "var(--hint)",
        fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
        animation: listening ? "pulse 0.8s infinite" : "none",
        transition: "background 0.2s",
        ...style,
      }}
      title="Sesle yaz"
    >
      {listening ? "🔴" : "🎤"}
    </button>
  );
}
