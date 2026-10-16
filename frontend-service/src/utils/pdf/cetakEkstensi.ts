// Cetak ekstensi tanpa kode (template cetak / laporan) dengan kop faskes standar.
// tata_letak.blok: teks ({{field}} diisi dari baris pertama), tabel (kolom dari semua baris), tanda_tangan, garis.
import pdfMake from "pdfmake/build/pdfmake";
import { customVfs } from "@/utils/customVfs";
import { convertImageToBase64 } from "@/utils/Helpers";
import { defaultHeader } from "./HeaderPrint";
import { bukaPdf } from "./bukaPdf";
import logoUrl from "@/assets/images/opensimrs-square.png";

pdfMake.vfs = customVfs.pdfMake.vfs;
pdfMake.fonts = {
  Arial: { normal: "Arial.ttf", bold: "Arial_Bold.ttf", italics: "Arial_Italic.ttf", bolditalics: "Arial_Bold_Italic.ttf" },
};

export const formatNilai = (v: any, format?: string) => {
  if (v === null || v === undefined || v === "") return "-";
  switch (format) {
    case "angka":
      return Number(v).toLocaleString("id-ID");
    case "rupiah":
      return `Rp ${Number(v).toLocaleString("id-ID")}`;
    case "tanggal":
      return new Date(Number(v) * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    case "tanggal_waktu":
      return new Date(Number(v) * 1000).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    default:
      return typeof v === "object" ? JSON.stringify(v) : String(v);
  }
};

const isiTeks = (teks: string, baris: Record<string, any>) => String(teks ?? "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, f) => formatNilai(baris?.[f]));

export async function cetakEkstensi(ekstensi: any, data: Record<string, any>[]) {
  const faskes = JSON.parse(localStorage.getItem("faskes_profile") ?? "{}");
  let logo = await convertImageToBase64(logoUrl);
  if (faskes.logo && String(faskes.logo).startsWith("data:image")) logo = faskes.logo;
  const tata = ekstensi.definisi?.tata_letak ?? {
    judul: ekstensi.nama,
    orientasi: "landscape",
    blok: [{ jenis: "tabel", kolom: ekstensi.definisi?.kolom ?? [] }],
  };
  const pertama = data[0] ?? {};
  const isi: any[] = [];
  for (const b of tata.blok ?? []) {
    if (b.jenis === "teks") isi.push({ text: isiTeks(b.isi, pertama), margin: [0, 2, 0, 2], bold: Boolean(b.tebal) });
    else if (b.jenis === "garis") isi.push({ canvas: [{ type: "line", x1: 0, y1: 4, x2: tata.orientasi === "landscape" ? 760 : 515, y2: 4, lineWidth: 0.5 }], margin: [0, 4, 0, 4] });
    else if (b.jenis === "tanda_tangan") {
      isi.push({
        columns: [{ text: "" }, { stack: [{ text: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) }, { text: b.label ?? "Petugas", margin: [0, 2, 0, 40] }, { text: "( ................................ )" }], alignment: "center", width: 200 }],
        margin: [0, 20, 0, 0],
      });
    } else if (b.jenis === "tabel") {
      const kolom = b.kolom?.length ? b.kolom : (ekstensi.definisi?.kolom ?? Object.keys(pertama).map((f) => ({ field: f, label: f })));
      isi.push({
        table: {
          headerRows: 1,
          widths: ["auto", ...kolom.map(() => "*")],
          body: [
            [{ text: "No", bold: true, fillColor: "#EAECEF" }, ...kolom.map((k: any) => ({ text: k.label ?? k.field, bold: true, fillColor: "#EAECEF" }))],
            ...data.map((r, i) => [String(i + 1), ...kolom.map((k: any) => formatNilai(r[k.field], k.format))]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 4, 0, 4],
      });
    }
  }
  const docDefinition: any = {
    pageSize: "A4",
    pageOrientation: tata.orientasi === "landscape" ? "landscape" : "portrait",
    pageMargins: [40, 150, 40, 40],
    header: defaultHeader("noSurat", tata.judul ?? ekstensi.nama, logo, faskes, {}),
    content: isi,
    footer: (hal: number, total: number) => ({ text: `${ekstensi.nama} · ${hal}/${total}`, alignment: "right", margin: [0, 10, 40, 0], fontSize: 7, color: "#79808F" }),
    defaultStyle: { font: "Arial", fontSize: 9, lineHeight: 1.1 },
  };
  await bukaPdf(docDefinition, `${ekstensi.nama}`);
}
