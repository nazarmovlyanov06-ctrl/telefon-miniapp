import { useState } from "react";

// Oturum boyunca mikrofon stream'ini açık tut → tekrar izin sorulmaz
let _stream = null;

async function getMicStream() {
  if (_stream && _stream.active) return _stream;
  try {
    _stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return _stream;
  } catch {
    return null;
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

    const stream = await getMicStream();
    if (!stream) {
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
