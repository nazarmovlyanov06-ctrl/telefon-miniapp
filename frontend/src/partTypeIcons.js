import {
  Smartphone, BatteryCharging, Camera, Box, Volume2, Zap, Settings, Radio,
  FlaskConical, Flame, Cable, Hammer, Package,
} from "lucide-react";

// Parça türüne göre temsili ikon — emoji yerine (uygulama genelinde emoji
// yok kararı korunuyor), ama satırda markanın tekrarı yerine o parçaya
// özgü bir görsel ipucu vermek için kullanılıyor.
export function partTypeIcon(tip) {
  const t = (tip || "").toLowerCase();
  if (t.includes("ekran") || t.includes("cam")) return Smartphone;
  if (t.includes("batarya") || t.includes("pil") || t.includes("şarj")) return BatteryCharging;
  if (t.includes("kamera")) return Camera;
  if (t.includes("kasa") || t.includes("kapak") || t.includes("vida") || t.includes("çıta") || t.includes("tepsi")) return Box;
  if (t.includes("hoparlör") || t.includes("ses") || t.includes("mikrofon") || t.includes("ahize") || t.includes("kulaklık") || t.includes("buzzer")) return Volume2;
  if (t.includes("flex")) return Zap;
  if (t.includes("tuş") || t.includes("motor") || t.includes("sensör") || t.includes("parmak izi")) return Settings;
  if (t.includes("anten") || t.includes("entegre") || t.includes("şebeke") || t.includes("wi-fi")) return Radio;
  if (t.includes("yapıştırıcı") || t.includes("bant") || t.includes("sıvı") || t.includes("macun")) return FlaskConical;
  if (t.includes("havya") || t.includes("ısıtma") || t.includes("rezistans")) return Flame;
  if (t.includes("lehim") || t.includes("tel")) return Cable;
  if (t.includes("tornavida") || t.includes("cımbız") || t.includes("alet") || t.includes("vakum")) return Hammer;
  return Package;
}
