import {
  Wrench, Users, Package, Landmark, TrendingDown, Target, CreditCard,
  Smartphone, Headphones, Factory, Undo2, ShieldCheck, PhoneCall, Ban,
  MessageSquareWarning, Store, CalendarClock, Star, Repeat, MessageCircle,
  Banknote, BarChart3, ScanLine, Settings, LifeBuoy,
} from "lucide-react";

// Alt menü + Daha sayfasında gösterilebilecek TÜM modüller — Ana Sayfa ve
// Daha sabit oldukları için burada yok. Sıra/alt-menü üyeliği kullanıcı
// tarafından değiştirilebilir (bkz. altMenuAyarlari.js).
export const TUM_MODULLER = [
  { icon: Wrench, label: "Tamirler", path: "/repairs", color: "var(--orange)" },
  { icon: Users, label: "Müşteriler", path: "/customers", color: "var(--blue)" },
  { icon: Package, label: "Stok", path: "/parts", color: "var(--purple)" },
  { icon: Landmark, label: "Kasa", path: "/kasa", color: "var(--green)", patronOnly: true },
  { icon: TrendingDown, label: "Giderler", path: "/gider", color: "var(--red)" },
  { icon: Target, label: "Hedef", path: "/hedef", color: "var(--blue)" },
  { icon: CreditCard, label: "Borçlar", path: "/debts", color: "var(--purple)" },
  { icon: Smartphone, label: "2. El", path: "/ikinciel", color: "var(--green)" },
  { icon: Headphones, label: "Aksesuar", path: "/aksesuar", color: "var(--orange)" },
  { icon: Factory, label: "Toptancı", path: "/toptanci", color: "var(--blue)" },
  { icon: Undo2, label: "Parça İade", path: "/parca-iade", color: "var(--gold)" },
  { icon: ShieldCheck, label: "Garanti", path: "/garanti", color: "var(--green)" },
  { icon: PhoneCall, label: "Yedek Tel", path: "/loaner", color: "var(--blue)" },
  { icon: Ban, label: "Kara Liste", path: "/karalist", color: "var(--red)" },
  { icon: MessageSquareWarning, label: "Şikayet/Övgü", path: "/geri-bildirim", color: "var(--orange)", badge: true },
  { icon: Store, label: "Vitrin Ayarları", path: "/vitrin-ayarlari", color: "var(--gold)" },
  { icon: CalendarClock, label: "Randevu Talepleri", path: "/randevu-talepleri", color: "var(--blue)" },
  { icon: Star, label: "Değerlendirmeler", path: "/vitrin-degerlendirme", color: "var(--orange)" },
  { icon: Repeat, label: "Takas Teklifleri", path: "/vitrin-takas", color: "var(--blue2)" },
  { icon: MessageCircle, label: "Müşteri Mesajları", path: "/musteri-mesajlari", color: "var(--green)" },
  { icon: Banknote, label: "Maaş", path: "/maas", color: "var(--purple)" },
  { icon: BarChart3, label: "İstatistik", path: "/stats", color: "var(--gold)" },
  { icon: ScanLine, label: "IMEI", path: "/imei", color: "var(--gray)" },
  { icon: LifeBuoy, label: "Destek", path: "/destek", color: "var(--blue2)" },
  { icon: Settings, label: "Ayarlar", path: "/settings", color: "var(--gray)" },
];

export const TUM_MODUL_YOLLARI = TUM_MODULLER.map(m => m.path);
