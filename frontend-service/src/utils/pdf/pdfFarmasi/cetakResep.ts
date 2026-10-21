import pdfMake from "pdfmake/build/pdfmake";
import { customVfs } from "@/utils/customVfs";
import { epochToDate, formatStringDate } from "@/utils/Helpers";

pdfMake.vfs = customVfs.pdfMake.vfs;
pdfMake.fonts = {
  Arial: {
    normal: "Arial.ttf",
    bold: "Arial_Bold.ttf",
    italics: "Arial_Italic.ttf",
    bolditalics: "Arial_Bold_Italic.ttf",
  },
};

const JENIS_PELAYANAN: Record<string, string> = {
  rj: "Rawat Jalan",
  ri: "Rawat Inap",
  igd: "IGD",
  aps: "APS",
  otc: "OTC",
};

const faskesProfile = () => {
  try {
    return JSON.parse(localStorage.getItem("faskes_profile") ?? "{}");
  } catch {
    return {};
  }
};

const tanggal = (epoch: string | number | undefined) => (epoch ? epochToDate(Number(epoch), "date") : "-");
const tanggalLahir = (iso: string | undefined) => (iso ? formatStringDate(iso.substring(0, 10)) : "-");

const garis = (lebar: number) => ({
  canvas: [{ type: "line", x1: 0, y1: 0, x2: lebar, y2: 0, lineWidth: 0.7 }],
  margin: [0, 3, 0, 3],
});

// Catatan: respons farmasi sudah diubah ke camelCase oleh interceptor axios (utils/Api.ts)

// E-Tiket: satu label (8 x 5 cm) per item obat, untuk ditempel di kemasan
export function createETiketPdf(items: any[]) {
  const profil = faskesProfile();
  const LEBAR = 227 - 16;
  const content = items.flatMap((item, i) => [
    {
      stack: [
        { text: item.namaFaskes || profil?.name || "-", bold: true, fontSize: 9, alignment: "center" },
        { text: profil?.phone ?? "", fontSize: 6, alignment: "center" },
        garis(LEBAR),
        {
          columns: [
            { text: `No. ${item.noResep ?? "-"}`, fontSize: 6 },
            { text: tanggal(item.date), fontSize: 6, alignment: "right" },
          ],
        },
        { text: item.namaPasien ?? "-", bold: true, fontSize: 8, margin: [0, 2, 0, 0] },
        { text: `Tgl. lahir ${tanggalLahir(item.tanggalLahir)}${item.noRm ? ` · RM ${item.noRm}` : ""}`, fontSize: 6 },
        { text: item.aturanPakai ?? "-", bold: true, fontSize: 10, alignment: "center", margin: [0, 4, 0, 1] },
        { text: item.caraPakai ?? "", fontSize: 7, alignment: "center" },
        garis(LEBAR),
        { text: `${item.namaObat ?? "-"} — ${item.jumlahObat ?? "-"} ${item.satuan ?? ""}`, fontSize: 7 },
        item.catatan ? { text: item.catatan, italics: true, fontSize: 6 } : {},
      ],
      pageBreak: i < items.length - 1 ? "after" : undefined,
    },
  ]);

  pdfMake
    .createPdf({
      pageSize: { width: 227, height: 142 },
      pageMargins: [8, 6, 8, 6],
      defaultStyle: { font: "Arial" },
      content,
    } as any)
    .open();
}

// E-Resep (atau salinannya) ukuran A5
export function createEResepPdf(resep: any, salinan = false) {
  const profil = faskesProfile();
  const LEBAR = 420 - 50;

  const baris = (label: string, nilai: string) => ({
    columns: [
      { text: label, width: 80 },
      { text: `: ${nilai}`, width: "*" },
    ],
    margin: [0, 1, 0, 1],
  });

  const obat = (resep.obat ?? []).map((item: any, i: number) => {
    const aturan = item.aturanPakai?.name ?? (item.aturanPakai ? `${item.aturanPakai.frekuensi}x, ${item.aturanPakai.periode} ${item.aturanPakai.periodeUnit}` : "");
    const signa = [aturan, item.caraPakai?.caraPakai].filter(Boolean).join(", ") || "-";
    const judul = item.isCompound
      ? `Racikan ${item.bentukRacikan?.namaBentukRacikan ?? ""} No. ${item.medicationQty ?? "-"}`
      : `${item.itemMedis?.name ?? "-"} No. ${item.medicationQty ?? "-"} ${item.itemMedis?.satuanPenggunaan?.name ?? ""}`;
    const komposisi = item.isCompound
      ? (item.racikan ?? []).map((r: any) => ({
          text: `• ${r.itemMedis?.name ?? "-"} ${r.medicationQty ?? ""} ${r.itemMedis?.satuanPenggunaan?.name ?? ""}`,
          margin: [28, 0, 0, 0],
        }))
      : [];
    return {
      stack: [
        { columns: [{ text: "R/", bold: true, width: 20 }, { text: judul, bold: true }] },
        ...komposisi,
        { text: `S. ${signa}`, margin: [20, 1, 0, 0] },
        item.prescriptionNotes ? { text: `Catatan: ${item.prescriptionNotes}`, italics: true, margin: [20, 0, 0, 0] } : {},
        // substitusi apoteker: obat asal resep dokter, alasan, dan persetujuan dokter
        ...(item.substitusi ?? []).map((s: any) => ({
          text: `Substitusi dari ${s.namaObatAsal ?? "-"} (${s.kategoriAlasanLabel ?? ""}: ${s.alasan ?? "-"}; ${s.petugas ?? "-"}${
            s.persetujuanDokter ? `; disetujui ${s.dokterPenyetuju ?? "dokter"}` : ""
          })`,
          italics: true,
          fontSize: 8,
          margin: [20, 0, 0, 0],
        })),
      ],
      margin: [0, i === 0 ? 0 : 6, 0, 0],
    };
  });

  pdfMake
    .createPdf({
      pageSize: "A5",
      pageMargins: [25, 20, 25, 25],
      defaultStyle: { font: "Arial", fontSize: 9 },
      content: [
        { text: resep.faskes?.name || profil?.name || "-", bold: true, fontSize: 14, alignment: "center" },
        { text: profil?.address?.fullAddress ?? "", alignment: "center", margin: [0, 2, 0, 0] },
        { text: profil?.phone ?? "", alignment: "center" },
        garis(LEBAR),
        { text: salinan ? "SALINAN RESEP" : "RESEP", bold: true, fontSize: 12, alignment: "center", margin: [0, 4, 0, 6] },
        baris("No. Resep", resep.noResep ?? "-"),
        baris("Tanggal", tanggal(resep.orderDate)),
        baris("Dokter", resep.dokterOrder ?? "-"),
        baris("Pelayanan", JENIS_PELAYANAN[resep.jenisPelayanan?.toLowerCase?.()] ?? resep.jenisPelayanan ?? "-"),
        baris("Pasien", resep.patient?.name ?? "-"),
        baris("No. RM", resep.noRm ?? "-"),
        baris("Tgl. Lahir", tanggalLahir(resep.patient?.birthDetail?.birthDate)),
        garis(LEBAR),
        ...obat,
        garis(LEBAR),
        salinan
          ? {
              columns: [
                { text: "p.c.c", italics: true, width: "*" },
                {
                  width: 150,
                  alignment: "center",
                  stack: [{ text: "Apoteker" }, { text: " ", margin: [0, 25, 0, 0] }, { text: "(.................................)" }],
                },
              ],
              margin: [0, 8, 0, 0],
            }
          : {
              columns: [
                { text: "", width: "*" },
                {
                  width: 150,
                  alignment: "center",
                  stack: [{ text: "Dokter" }, { text: " ", margin: [0, 25, 0, 0] }, { text: resep.dokterOrder ?? "" }],
                },
              ],
              margin: [0, 8, 0, 0],
            },
      ],
    } as any)
    .open();
}
