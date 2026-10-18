// Cetak Rencana Kontrol / SPRI BPJS (STD-0021, pdfmake). Hanya surat terkonfirmasi VClaim (bernomor) yang dicetak;
// surat simulasi (mode mock) diberi tanda air agar tidak tertukar dengan surat resmi. Data = payload bpjs-service (camelCase).
import pdfMake from "pdfmake/build/pdfmake";
import { bukaPdf, gambarPdfValid } from "@/utils/pdf/bukaPdf";
import { customVfs } from "@/utils/customVfs";
import { convertImageToBase64 } from "@/utils/Helpers";
import { warnaTema } from "@/utils/tema";
import logoUrl from "@/assets/images/opensimrs-square.png";

pdfMake.vfs = customVfs.pdfMake.vfs;
pdfMake.fonts = {
  Arial: { normal: "Arial.ttf", bold: "Arial_Bold.ttf", italics: "Arial_Italic.ttf", bolditalics: "Arial_Bold_Italic.ttf" },
};

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const LEBAR = 595 - 100;
const SUMBER: Record<string, string> = { rawat_jalan: "Rawat Jalan", rawat_inap: "Rawat Inap", igd: "IGD" };

const profil = () => {
  try {
    return JSON.parse(localStorage.getItem("faskes_profile") ?? "{}");
  } catch {
    return {};
  }
};
const t = (v: any) => (v === undefined || v === null || v === "" ? "-" : String(v));
export const tglIndo = (iso?: string | null) => {
  if (!iso) return "-";
  const [y, m, d] = String(iso).substring(0, 10).split("-");
  return `${Number(d)} ${BULAN[Number(m) - 1] ?? m} ${y}`;
};
const hariIni = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

export interface SuratVclaimCetak {
  jenis: "rencana_kontrol" | "spri";
  noSurat: string;
  noKartu: string;
  noRm?: string | null;
  namaPasien?: string | null;
  sumber?: string | null;
  dpjp?: string | null;
  namaDokter?: string | null;
  poliTujuan?: string | null;
  noSepAsal?: string | null;
  tglRencana?: string | null;
  simulasi?: boolean;
  dibuatOleh?: string | null;
}

export async function cetakSuratVclaim(s: SuratVclaimCetak) {
  const p = profil();
  const spri = s.jenis === "spri";
  const judul = spri ? "SURAT PERINTAH RAWAT INAP (SPRI)" : "SURAT RENCANA KONTROL";
  const logo = gambarPdfValid(p?.logo) ? p.logo : await convertImageToBase64(logoUrl);
  const baris: [string, any][] = [
    ["No. Kartu BPJS", s.noKartu],
    ["Nama Pasien", s.namaPasien],
    ["No. RM", s.noRm],
    [spri ? "Tgl. Rencana Rawat Inap" : "Tgl. Rencana Kontrol", tglIndo(s.tglRencana)],
    [spri ? "Spesialis/Poli DPJP" : "Poli Tujuan", s.poliTujuan],
    ["Dokter DPJP", s.namaDokter ? `${s.namaDokter} (${t(s.dpjp)})` : s.dpjp],
    ["Asal Pelayanan", SUMBER[s.sumber ?? ""] ?? s.sumber],
    ...(!spri && s.noSepAsal ? ([["No. SEP Asal", s.noSepAsal]] as [string, any][]) : []),
  ];
  const isi: any[] = [
    {
      columns: [
        { image: logo, fit: [70, 45], width: 70 },
        {
          width: "*",
          alignment: "center",
          stack: [
            { text: p?.name ?? "-", bold: true, fontSize: 14 },
            { text: p?.address?.fullAddress ?? "", fontSize: 8, margin: [0, 2, 0, 0] },
            { text: [p?.phone, p?.email].filter(Boolean).join(" · "), fontSize: 8 },
          ],
        },
        { text: "", width: 70 },
      ],
    },
    { canvas: [{ type: "line", x1: 0, y1: 4, x2: LEBAR, y2: 4, lineWidth: 1.5, lineColor: warnaTema("300") }], margin: [0, 2, 0, 10] },
    { text: judul, bold: true, fontSize: 13, alignment: "center" },
    { text: `No. ${t(s.noSurat)}`, alignment: "center", fontSize: 11, margin: [0, 2, 0, 14] },
    {
      text: spri
        ? "Mohon pasien berikut dirawat inap sesuai rencana di bawah ini:"
        : "Pasien berikut direncanakan kontrol kembali sesuai jadwal di bawah ini:",
      margin: [0, 0, 0, 8],
    },
    {
      table: { widths: [130, "*"], body: baris.map(([l, v]) => [{ text: l, color: "#475467" }, { text: `: ${t(v)}` }]) },
      layout: "noBorders",
    },
    {
      text: "Nomor surat diterbitkan oleh BPJS Kesehatan (VClaim). Surat berlaku untuk satu kali penerbitan SEP.",
      fontSize: 8,
      color: "#475467",
      margin: [0, 14, 0, 0],
    },
    {
      columns: [
        { text: "", width: "*" },
        {
          width: 200,
          alignment: "center",
          stack: [
            { text: `${p?.address?.kabupaten?.name ?? p?.address?.city ?? ""}${p?.address ? ", " : ""}${tglIndo(hariIni())}` },
            { text: "Dokter Penanggung Jawab,", margin: [0, 2, 0, 50] },
            { text: t(s.namaDokter ?? s.dpjp), bold: true },
          ],
        },
      ],
      margin: [0, 24, 0, 0],
    },
  ];
  bukaPdf(
    {
      pageSize: "A5",
      pageOrientation: "landscape",
      pageMargins: [50, 30, 50, 30],
      defaultStyle: { font: "Arial", fontSize: 10 },
      watermark: s.simulasi ? { text: "SIMULASI", color: "#B42318", opacity: 0.12, bold: true } : undefined,
      content: isi,
    },
    `${spri ? "SPRI" : "Rencana Kontrol"} ${s.noSurat}`
  );
}
