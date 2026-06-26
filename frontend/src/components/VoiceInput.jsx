import { useState } from "react";

export default function VoiceInput({ onResult, style = {} }) {
  const [listening, setListening] = useState(false);

  function start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Tarayıcınız ses girişini desteklemiyor"); return; }
    const recognition = new SR();
    recognition.lang = "tr-TR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListening(true);
    recognition.onresult = (e) => { onResult(e.results[0][0].transcript); setListening(false); };
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
        transition: "background 0.2s",
        ...style,
      }}
      title="Sesle yaz"
    >
      {listening ? "🔴" : "🎤"}
    </button>
  );
}
