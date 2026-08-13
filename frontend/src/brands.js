// Telefon parça toptancılığında en sık geçen markalar — ürün eklerken öneri olarak çıkar.
export const MARKALAR = [
  "Samsung", "Apple", "Xiaomi", "Oppo", "Vivo", "Huawei", "Honor", "Realme",
  "OnePlus", "Tecno", "Infinix", "Itel", "Motorola", "Google", "Sony", "Asus",
  "Nokia", "HTC", "TCL", "ZTE", "Nubia", "RedMagic", "Meizu", "Nothing",
  "Fairphone", "Blackview", "Doogee", "Ulefone", "General Mobile", "Reeder",
  "Casper", "Omix",
];

// Marka -> Simple Icons slug (cdn.simpleicons.org üzerinden ücretsiz/telifsiz logo).
// Her slug tek tek CDN'e karşı doğrulandı (200 dönenler burada).
export const BRAND_SLUGS = {
  samsung: "samsung", apple: "apple", xiaomi: "xiaomi", oppo: "oppo", vivo: "vivo",
  huawei: "huawei", honor: "honor", oneplus: "oneplus", motorola: "motorola",
  google: "google", sony: "sony", asus: "asus", nokia: "nokia", htc: "htc",
  meizu: "meizu", fairphone: "fairphone", lenovo: "lenovo", lg: "lg",
};

// Simple Icons'ta karşılığı olmayan markalar için Wikimedia Commons'tan indirilip
// /public/logos altına konmuş gerçek marka logoları (public'ten servis edilir, /logos/... yolu).
export const BRAND_LOGO_FILES = {
  realme: "/logos/realme.svg",
  tecno: "/logos/tecno.svg",
  infinix: "/logos/infinix.svg",
  itel: "/logos/itel.svg",
  tcl: "/logos/tcl.svg",
  zte: "/logos/zte.svg",
  nubia: "/logos/nubia.svg",
  nothing: "/logos/nothing.svg",
  "general mobile": "/logos/generalmobile.png",
  doogee: "/logos/doogee.png",
  casper: "/logos/casper.png",
};
