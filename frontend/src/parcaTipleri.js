// Standart telefon yedek parça tipleri — toptancı serbest metin yazmak yerine bu listeden
// seçer (EditableSelect: sabit liste + "+ Yeni ekle…" ile ihtiyaç halinde özel tip de eklenebilir).
export const PARCA_TIPI_GRUPLARI = [
  {
    grup: "📱 Ekran ve Cam Grubu",
    tipler: ["Komple Ekran", "Dokunmatik Cam", "Ön Cam", "Arka Cam", "Ekran Çıtası"],
  },
  {
    grup: "🔋 Güç ve Şarj Grubu",
    tipler: ["Şarj Bordu", "Şarj Soketi", "Batarya (Pil)", "Batarya Yapıştırıcısı"],
  },
  {
    grup: "📸 Kamera Grubu",
    tipler: ["Ön Kamera", "Arka Kamera", "Kamera Camı", "Kamera Lensi", "Kamera Kasası (Çerçevesi)"],
  },
  {
    grup: "🔩 Kasa ve Gövde Grubu",
    tipler: ["Çıta", "Arka Kapak", "Sim Kart Tepsisi", "Sim Okuyucu Yuvası", "İç Vida Seti"],
  },
  {
    grup: "🔊 Ses Grubu",
    tipler: ["Ahize (İç kulaklık)", "Buzzer (Hoparlör)", "Kulaklık Soketi", "Mikrofon"],
  },
  {
    grup: "⚡ Flex ve Film Grubu",
    tipler: ["Anakart Flexi", "Ekran Flexi", "Power Tuşu Flexi", "Ses Tuşu Flexi", "Şarj Flexi"],
  },
  {
    grup: "⚙️ Tuş ve Motor Grubu",
    tipler: ["Power Tuşu", "Ses Tuşu", "Parmak İzi Sensörü", "Titreşim Motoru"],
  },
  {
    grup: "📶 Entegre ve Şebeke Grubu",
    tipler: ["Şebeke Anteni", "Wi-Fi Anteni", "Power Entegresi", "Şarj Entegresi", "Ses Entegresi"],
  },
  {
    grup: "🧪 Yapıştırıcı ve Kimyasal Grubu",
    tipler: [
      "Sıvı Yapıştırıcı (B-7000 / T-7000 vb.)", "Çift Taraflı Bant", "Isıya Dayanıklı Bant (Kapton bant)",
      "Temizleme Sıvısı (İzopropil alkol / tiner)", "Termal Macun",
    ],
  },
  {
    grup: "🔌 Havya ve Isıtma Grubu",
    tipler: ["İstasyonlu Havya", "Kalem Havya", "Sıcak Hava Üfleme Cihazı", "Yedek Havya Ucu", "Rezistans"],
  },
  {
    grup: "🧵 Lehim ve Tel Grubu",
    tipler: ["Tüp / Tel Lehim", "Krem / Pasta Lehim", "Lehim Pastası (Flux)", "Lehim Emme Teli"],
  },
  {
    grup: "🛠️ El Aletleri ve Sarf Malzemeleri",
    tipler: [
      "Tornavida Çeşitleri", "Cımbız Seti", "Pena ve Açma Aparatı", "Ekran Sökme Vakumu",
      "Büyüteç ve Mikroskop", "Ölçü Aleti (Multimetre)",
    ],
  },
];

export const PARCA_TIPLERI = [
  ...PARCA_TIPI_GRUPLARI.flatMap((g) => g.tipler),
  "Diğer",
];
