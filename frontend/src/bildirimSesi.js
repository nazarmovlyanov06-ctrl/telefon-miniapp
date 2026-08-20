// Bildirim zili sesi — Web Audio API ile sentezlenir, harici dosya gerekmez.
// Tarayıcılar AudioContext'i ilk kullanıcı etkileşiminden ÖNCE çalıştırmayı
// engeller (autoplay policy); bu yüzden hazirlaSesi() ilk tıklama/dokunmada
// bir kere çağrılıp bağlam önceden "kilidi açılmış" hale getiriliyor —
// aksi halde otomatik poll sırasında sessizce başarısız olurdu.
let ctx = null;

function baglamAl() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export function hazirlaSesi() {
  try {
    const c = baglamAl();
    if (c.state === "suspended") c.resume();
  } catch { /* Web Audio desteklenmiyor olabilir */ }
}

export function bildirimSesiCal() {
  try {
    const c = baglamAl();
    if (c.state === "suspended") c.resume();
    const now = c.currentTime;
    // İki nazik ton, yükselen dörtlü aralık — tatlı bir "ding" zili
    [
      { freq: 783.99, start: 0, dur: 0.16 },   // G5
      { freq: 1046.5, start: 0.09, dur: 0.32 }, // C6
    ].forEach(({ freq, start, dur }) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.24, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    });
  } catch { /* ses çalınamazsa sessizce geç */ }
}
