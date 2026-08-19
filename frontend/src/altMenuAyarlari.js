import { TUM_MODUL_YOLLARI } from "./moduleCatalog";

// Daha sayfasındaki modüllerin sırası VE alt menüde (ekranın altındaki sabit
// çubuk) kaçının göründüğü tek bir birleşik listeyle yönetiliyor: sıradaki
// ilk N modül alt menüde sayılır. Bir modülü bu N'inci sıranın üstüne
// sürükleyince alt menüye girer, altına sürükleyince çıkar — ayrı bir
// "ekle/çıkar" aksiyonu gerekmiyor.
const SIRA_ANAHTAR = "daha_sira";
const ADET_ANAHTAR = "alt_menu_adedi";
const DEGISTI_OLAYI = "alt-menu-degisti";
export const ALT_MENU_MIN = 1;
export const ALT_MENU_MAX = 6;
const ALT_MENU_VARSAYILAN_ADET = 3;

export function siraOku() {
  let sira = [];
  try {
    const v = JSON.parse(localStorage.getItem(SIRA_ANAHTAR));
    if (Array.isArray(v)) sira = v.filter(p => TUM_MODUL_YOLLARI.includes(p));
  } catch { /* ilk kullanım */ }
  // Kataloğa sonradan eklenen (veya localStorage'da hiç olmayan) modülleri sona ekle
  const eksikler = TUM_MODUL_YOLLARI.filter(p => !sira.includes(p));
  return [...sira, ...eksikler];
}

export function altMenuAdediOku() {
  const v = parseInt(localStorage.getItem(ADET_ANAHTAR), 10);
  if (Number.isFinite(v) && v >= ALT_MENU_MIN && v <= ALT_MENU_MAX) return v;
  return ALT_MENU_VARSAYILAN_ADET;
}

export function siraYaz(sira) {
  localStorage.setItem(SIRA_ANAHTAR, JSON.stringify(sira));
  window.dispatchEvent(new Event(DEGISTI_OLAYI));
}

export function altMenuAdediYaz(adet) {
  const clamped = Math.min(Math.max(adet, ALT_MENU_MIN), ALT_MENU_MAX);
  localStorage.setItem(ADET_ANAHTAR, String(clamped));
  window.dispatchEvent(new Event(DEGISTI_OLAYI));
}

export function degisimiDinle(fn) {
  window.addEventListener("storage", fn);
  window.addEventListener(DEGISTI_OLAYI, fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener(DEGISTI_OLAYI, fn);
  };
}
