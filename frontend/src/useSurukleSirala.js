import { useCallback, useEffect, useRef, useState } from "react";

// Dashboard.jsx'teki basılı-tut → titret → sürükle deseninin genel amaçlı
// hali — herhangi bir anahtar dizisini (grid ya da tek sütun fark etmez,
// 2 boyutlu dikdörtgen çakışmasına bakıyor) yeniden sıralamak için.
export default function useSurukleSirala(baslangicSira, onSiraDegisti) {
  const [sira, setSiraState] = useState(baslangicSira);
  const [titriyor, setTitriyor] = useState(false);
  const [suruklenen, setSuruklenen] = useState(null);
  const refs = useRef({});
  const siraRef = useRef(baslangicSira);
  const titriyorRef = useRef(false);
  const basiliTimerRef = useRef(null);
  const basPozRef = useRef({ x: 0, y: 0 });
  const basiliAnahtarRef = useRef(null);
  const suruklemeBasladiRef = useRef(false);
  const justEnteredRef = useRef(null);

  useEffect(() => { siraRef.current = sira; }, [sira]);

  useEffect(() => {
    siraRef.current = baslangicSira;
    setSiraState(baslangicSira);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(baslangicSira)]);

  function siraAyarla(yeni) {
    siraRef.current = yeni;
    setSiraState(yeni);
    onSiraDegisti?.(yeni);
  }
  function titriyorAyarla(v) { titriyorRef.current = v; setTitriyor(v); }

  const basBasla = useCallback((e, key) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    basPozRef.current = { x: e.clientX, y: e.clientY };
    basiliAnahtarRef.current = key;
    suruklemeBasladiRef.current = false;
    clearTimeout(basiliTimerRef.current);
    if (!titriyorRef.current) {
      basiliTimerRef.current = setTimeout(() => {
        if (basiliAnahtarRef.current !== key) return;
        titriyorAyarla(true);
        suruklemeBasladiRef.current = true;
        setSuruklenen(key);
        justEnteredRef.current = key;
        if (navigator.vibrate) navigator.vibrate(12);
      }, 480);
    }
  }, []);

  useEffect(() => {
    function hareket(e) {
      const key = basiliAnahtarRef.current;
      if (!key) return;
      const dx = e.clientX - basPozRef.current.x;
      const dy = e.clientY - basPozRef.current.y;
      if (!suruklemeBasladiRef.current) {
        if (Math.hypot(dx, dy) > 9) {
          if (titriyorRef.current) {
            suruklemeBasladiRef.current = true;
            setSuruklenen(key);
          } else {
            clearTimeout(basiliTimerRef.current);
            basiliAnahtarRef.current = null;
          }
        }
        return;
      }
      const dizi = siraRef.current;
      for (const digerKey of dizi) {
        if (digerKey === key) continue;
        const el = refs.current[digerKey];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          const i1 = dizi.indexOf(key), i2 = dizi.indexOf(digerKey);
          const yeni = [...dizi];
          yeni.splice(i1, 1);
          yeni.splice(i2, 0, key);
          siraAyarla(yeni);
          break;
        }
      }
    }
    function birak() {
      clearTimeout(basiliTimerRef.current);
      const surukluyorduMu = suruklemeBasladiRef.current;
      const girisMiydi = justEnteredRef.current === basiliAnahtarRef.current;
      justEnteredRef.current = null;
      if (titriyorRef.current && !surukluyorduMu && !girisMiydi) {
        titriyorAyarla(false);
      }
      setSuruklenen(null);
      basiliAnahtarRef.current = null;
      suruklemeBasladiRef.current = false;
    }
    window.addEventListener("pointermove", hareket);
    window.addEventListener("pointerup", birak);
    window.addEventListener("pointercancel", birak);
    return () => {
      window.removeEventListener("pointermove", hareket);
      window.removeEventListener("pointerup", birak);
      window.removeEventListener("pointercancel", birak);
    };
  }, []);

  return {
    sira, setSira: siraAyarla, titriyor, suruklenen, refs, basBasla,
    disariCik: () => titriyorAyarla(false),
  };
}
