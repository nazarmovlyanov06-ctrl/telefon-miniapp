import { FileText } from "lucide-react";
import { fotoUrl } from "../api";

// Destek mesajı içeriği — metin ve/veya ekli dosya (resim önizleme, pdf/ses/video linki).
export default function DestekMesajIcerik({ mesaj, dosyaUrl, dosyaAdi, dosyaTipi }) {
  return (
    <>
      {mesaj && <div style={{ fontSize: 13 }}>{mesaj}</div>}
      {dosyaUrl && dosyaTipi === "image" && (
        <img src={fotoUrl(dosyaUrl)} alt={dosyaAdi || "ek"} style={{ maxWidth: 200, borderRadius: 8, marginTop: mesaj ? 6 : 0, display: "block" }} />
      )}
      {dosyaUrl && dosyaTipi === "pdf" && (
        <a href={fotoUrl(dosyaUrl)} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 6, marginTop: mesaj ? 6 : 0, color: "inherit", textDecoration: "underline", fontSize: 12.5 }}>
          <FileText size={13} strokeWidth={2} /> {dosyaAdi || "PDF"}
        </a>
      )}
      {dosyaUrl && dosyaTipi === "audio" && (
        <audio src={fotoUrl(dosyaUrl)} controls style={{ marginTop: mesaj ? 6 : 0, maxWidth: 220, height: 32 }} />
      )}
      {dosyaUrl && dosyaTipi === "video" && (
        <video src={fotoUrl(dosyaUrl)} controls style={{ marginTop: mesaj ? 6 : 0, maxWidth: 220, borderRadius: 8 }} />
      )}
    </>
  );
}
