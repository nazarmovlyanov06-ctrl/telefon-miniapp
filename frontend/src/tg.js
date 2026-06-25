// Telegram WebApp yardimcilari
export const tg = window.Telegram?.WebApp;

export function initTg() {
  if (!tg) return;
  tg.ready();
  tg.expand();
}

export function getInitData() {
  // Gelistirme ortaminda mock data kullan
  if (!tg || !tg.initData) {
    return "mock_dev_mode";
  }
  return tg.initData;
}

export function getTgUser() {
  if (!tg || !tg.initDataUnsafe?.user) {
    return { id: 0, first_name: "Dev", username: "dev" };
  }
  return tg.initDataUnsafe.user;
}

export function showAlert(msg) {
  if (tg) tg.showAlert(msg);
  else alert(msg);
}

export function haptic(type = "light") {
  tg?.HapticFeedback?.impactOccurred(type);
}

export function setBackButton(onClick) {
  if (!tg) return;
  tg.BackButton.show();
  tg.BackButton.onClick(onClick);
}

export function hideBackButton() {
  tg?.BackButton?.hide();
}
