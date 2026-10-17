import pdfMake from "pdfmake/build/pdfmake";
import { app } from "@/utils/aplikasi";

// Buka PDF hasil pdfmake di tab baru dengan aman:
// - PDF dibuat lebih dulu; bila gagal (mis. gambar rusak) tampil toast, bukan tab kosong.
// - Bila popup diblokir browser, PDF diunduh sebagai berkas.
export async function bukaPdf(docDefinition: any, namaBerkas = "dokumen") {
  const nama = `${namaBerkas.replace(/[\\/:*?"<>|]+/g, "-")}.pdf`;
  let blob: Blob;
  try {
    blob = await new Promise<Blob>((ok, gagal) => {
      try {
        pdfMake.createPdf(docDefinition).getBlob(ok);
      } catch (e) {
        gagal(e);
      }
    });
  } catch (e: any) {
    console.error("Gagal membuat PDF", e);
    app.config.globalProperties.$toast?.add({
      severity: "error",
      summary: "Gagal membuat PDF",
      detail: String(e?.message ?? e).split("\n")[0],
      life: 5000,
    });
    return;
  }
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank");
  if (!tab) {
    const a = document.createElement("a");
    a.href = url;
    a.download = nama;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Hanya data URL PNG/JPEG yang isinya benar-benar PNG/JPEG yang bisa dibaca pdfmake
// (berkas BMP/WebP berlabel image/png membuat seluruh PDF gagal dibuat).
export function gambarPdfValid(dataUrl?: string | null): boolean {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl ?? "");
  if (!m) return false;
  try {
    const awal = atob(m[2].slice(0, 12));
    const png = awal.charCodeAt(0) === 0x89 && awal.slice(1, 4) === "PNG";
    const jpeg = awal.charCodeAt(0) === 0xff && awal.charCodeAt(1) === 0xd8;
    return png || jpeg;
  } catch {
    return false;
  }
}

// Ubah berkas gambar apa pun yang bisa ditampilkan browser (BMP, WebP, GIF, …) menjadi data URL PNG.
export function gambarKePng(berkas: File): Promise<string> {
  return new Promise((ok, gagal) => {
    const url = URL.createObjectURL(berkas);
    const img = new Image();
    img.onload = () => {
      const kanvas = document.createElement("canvas");
      kanvas.width = img.naturalWidth;
      kanvas.height = img.naturalHeight;
      kanvas.getContext("2d")!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      ok(kanvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      gagal(new Error("Berkas bukan gambar yang dapat dibaca"));
    };
    img.src = url;
  });
}
