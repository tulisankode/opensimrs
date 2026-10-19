// Ringkasan PDF Dashboard Eksekutif untuk rapat (STD-0034). Data berasal dari POST /dashboard/eksekutif/ekspor
// (izin Dashboard › Eksekutif › EKSPOR PDF), hanya agregat tanpa identitas pasien.
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

export const KELOMPOK_EKSEKUTIF: Record<string, string> = {
  layanan: "Layanan",
  keuangan: "Keuangan",
  mutu: "Mutu",
  sdm: "SDM",
};

const LABEL_STATUS: Record<string, string> = { hijau: "Sesuai target", kuning: "Perlu perhatian", merah: "Di luar target" };
const WARNA_STATUS: Record<string, string> = { hijau: "#0E7840", kuning: "#B7791F", merah: "#A33E35" };

export const formatNilaiIndikator = (nilai: number | null | undefined, satuan: string) => {
  if (nilai === null || nilai === undefined) return "-";
  if (satuan === "Rp") return `Rp ${Math.round(nilai).toLocaleString("id-ID")}`;
  const teks = Number(nilai).toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return ["%", "‰"].includes(satuan) ? `${teks}${satuan}` : `${teks} ${satuan}`;
};

export const formatTarget = (target: any, satuan: string) => {
  if (!target) return "Belum diatur";
  const { min, maks } = target;
  if (min !== null && maks !== null) return `${formatNilaiIndikator(min, satuan)} – ${formatNilaiIndikator(maks, satuan)}`;
  if (min !== null) return `≥ ${formatNilaiIndikator(min, satuan)}`;
  return `≤ ${formatNilaiIndikator(maks, satuan)}`;
};

const tanggalId = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

export async function cetakDashboardEksekutif(data: any) {
  const faskesProfil = JSON.parse(localStorage.getItem("faskes_profile") ?? "{}");
  let logo = await convertImageToBase64(logoUrl);
  if (faskesProfil.logo && String(faskesProfil.logo).startsWith("data:image")) logo = faskesProfil.logo;
  const periode = data.periode ?? {};
  const namaFaskes = (data.faskes ?? []).map((f: any) => f.name).join(", ");
  const diperbarui = new Date((data.diperbaruiPada ?? 0) * 1000).toLocaleString("id-ID");

  const isi: any[] = [
    {
      table: {
        widths: [110, "*"],
        body: [
          ["Periode", `${tanggalId(periode.mulai)} s.d. ${tanggalId(periode.selesai)} (${periode.hari} hari, ${periode.zonaWaktu})`],
          ["Pembanding", `${tanggalId(periode.pembanding?.mulai)} s.d. ${tanggalId(periode.pembanding?.selesai)}`],
          ["Faskes", namaFaskes || "-"],
          ["Data diambil", diperbarui],
          ["Dicetak oleh", data.dicetakOleh ?? "-"],
        ],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 8],
    },
  ];

  for (const [kelompok, judul] of Object.entries(KELOMPOK_EKSEKUTIF)) {
    const daftar = (data.indikator ?? []).filter((i: any) => i.kelompok === kelompok);
    if (!daftar.length) continue;
    isi.push({ text: judul, bold: true, fontSize: 11, margin: [0, 8, 0, 4] });
    isi.push({
      table: {
        headerRows: 1,
        widths: ["*", 80, 90, 70, 55, 120],
        body: [
          ["Indikator", "Nilai", "Target", "Status", "vs lalu", "Keterangan"].map((t) => ({ text: t, bold: true, fillColor: "#EAECEF" })),
          ...daftar.map((i: any) => [
            i.nama,
            { text: i.statusData === "tersedia" ? formatNilaiIndikator(i.nilai, i.satuan) : "-", alignment: "right" },
            data.targetBerlaku ? formatTarget(i.target, i.satuan) : "Hanya untuk satu faskes",
            i.statusTarget ? { text: LABEL_STATUS[i.statusTarget], color: WARNA_STATUS[i.statusTarget], bold: true } : "-",
            { text: i.perubahanPersen === null || i.perubahanPersen === undefined ? "-" : `${i.perubahanPersen > 0 ? "+" : ""}${i.perubahanPersen.toLocaleString("id-ID")}%`, alignment: "right" },
            { text: i.periode?.posisiSaatIni ? `Posisi saat ini${i.keterangan ? `; ${i.keterangan}` : ""}` : i.keterangan ?? "", fontSize: 7, color: "#555" },
          ]),
        ],
      },
      layout: "lightHorizontalLines",
    });
  }

  if (data.belumTersedia?.length) {
    isi.push({ text: "Indikator belum tersedia", bold: true, fontSize: 11, margin: [0, 10, 0, 4] });
    isi.push({ ul: data.belumTersedia.map((b: any) => ({ text: [{ text: `${b.nama}: `, bold: true }, b.alasan], fontSize: 8 })) });
  }

  isi.push({
    text: "Rumus indikator rawat inap mengikuti Barber-Johnson (Depkes RI 2005). Semua angka adalah agregat tanpa identitas pasien. "
      + "Indikator bertanda posisi saat ini tidak bergantung periode.",
    fontSize: 7,
    italics: true,
    color: "#555",
    margin: [0, 12, 0, 0],
  });

  const docDefinition: any = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [40, 150, 40, 40],
    header: defaultHeader("noSurat", "Ringkasan Dashboard Eksekutif", logo, faskesProfil, {}),
    content: isi,
    footer: (hal: number, total: number) => ({ text: `Ringkasan Dashboard Eksekutif · ${hal}/${total}`, alignment: "right", margin: [0, 10, 40, 0], fontSize: 7, color: "#79808F" }),
    defaultStyle: { font: "Arial", fontSize: 9, lineHeight: 1.1 },
  };
  await bukaPdf(docDefinition, `Dashboard Eksekutif ${periode.mulai} sd ${periode.selesai}`);
}
