import pdfMake from "pdfmake/build/pdfmake";
import { bukaPdf, gambarPdfValid } from "@/utils/pdf/bukaPdf";
import { customVfs } from "@/utils/customVfs";
import { epochToDate, formatStringDate } from "@/utils/Helpers";
import { logoFaskes, profilFaskes } from "@/utils/tema";
import { useExpertiseLab } from "@/stores/Laboratorium/expertise";
import { utilsStore } from "@/stores/utils";

pdfMake.vfs = customVfs.pdfMake.vfs;
pdfMake.fonts = {
  Arial: {
    normal: "Arial.ttf",
    bold: "Arial_Bold.ttf",
    italics: "Arial_Italic.ttf",
    bolditalics: "Arial_Bold_Italic.ttf",
  },
};

const faskesProfile = () => {
  try {
    return JSON.parse(localStorage.getItem("faskes_profile") ?? "{}");
  } catch {
    return {};
  }
};

const JENIS_KELAMIN: Record<string, string> = { Male: "Laki-laki", Female: "Perempuan" };

// Surat Pengantar Rujukan: identitas pasien + item yang dirujuk + laboratorium tujuan (KF-5/KT-6).
// `order` = gabungan detail order lab + hasil pemeriksaan (GET order-lab & hasil-pemeriksaan).
function createSuratPengantarRujukanPdf(order: any) {
  const profil = profilFaskes.value?.name ? profilFaskes.value : faskesProfile();
  const logo = gambarPdfValid(logoFaskes()) ? logoFaskes() : gambarPdfValid(profil?.logo) ? profil.logo : null;
  const pasien = order?.patient ?? {};
  const lahir = pasien?.birthDetail ?? {};
  const umur = lahir.ageYear != null ? `${lahir.ageYear} th ${lahir.ageMonth ?? 0} bl ${lahir.ageDay ?? 0} hr` : "-";
  const LEBAR = 595 - 70;

  const alamat = typeof profil?.address === "string" ? profil.address : profil?.address?.fullAddress ?? "";
  const kop = {
    columns: [
      logo ? { image: logo, fit: [75, 60], width: 80 } : { text: "", width: 80 },
      {
        width: "*",
        alignment: "center",
        stack: [
          { text: String(profil?.name ?? "-").toUpperCase(), bold: true, fontSize: 14 },
          { text: "INSTALASI LABORATORIUM", bold: true, fontSize: 11, margin: [0, 1, 0, 1] },
          { text: alamat, fontSize: 8 },
        ],
      },
      { text: "", width: 80 },
    ],
  };

  const baris = (pasang: [string, any][]) =>
    pasang.map(([l, v]) => [{ text: l, bold: true }, { text: ":" }, { text: v == null || v === "" ? "-" : String(v) }]);
  const identitas = {
    width: "*",
    table: {
      widths: [90, 6, "*"],
      body: baris([
        ["Nama Pasien", `${pasien.title ? pasien.title + " " : ""}${pasien.name ?? "-"}`],
        ["Tgl. Lahir / Umur", `${lahir.birthDate ? formatStringDate(String(lahir.birthDate).substring(0, 10)) : "-"} / ${umur}`],
        ["Jenis Kelamin", JENIS_KELAMIN[pasien.gender] ?? pasien.gender],
        ["No. RM", order?.noRm],
        ["No. Order", order?.noOrder],
        ["Tgl. Order", order?.tglOrder ? epochToDate(Math.floor(Number(order.tglOrder) / (Number(order.tglOrder) > 1e12 ? 1000 : 1)), "date") : "-"],
      ]),
    },
    layout: { defaultBorder: false, paddingTop: () => 1, paddingBottom: () => 1, paddingLeft: () => 0, paddingRight: () => 2 },
  };

  const itemRujukan = (order?.hasilPemeriksaan ?? []).filter((h: any) => h.dirujuk);
  const body: any[] = [
    ["Pemeriksaan", "Spesimen", "Laboratorium Tujuan", "Catatan"].map((t) => ({ text: t, bold: true })),
  ];
  for (const row of itemRujukan) {
    body.push([
      { text: row.itemPemeriksaan?.name ?? "-" },
      { text: order?.spesimenUuids?.map((s: any) => s.name).join(", ") || "-" },
      { text: row.labRujukan?.name ?? "-" },
      { text: row.catatanRujukan || "-" },
    ]);
  }
  if (!itemRujukan.length) {
    body.push([{ text: "Tidak ada item yang dirujuk", colSpan: 4, alignment: "center", italics: true }, "", "", ""]);
  }

  return bukaPdf(
    {
      info: { title: `Surat Pengantar Rujukan ${order?.noOrder ?? ""}` },
      pageSize: "A4",
      pageMargins: [35, 30, 35, 45],
      defaultStyle: { font: "Arial", fontSize: 8.5 },
      footer: (halaman: number, total: number) => ({
        columns: [
          { text: `Dicetak: ${epochToDate(Math.floor(Date.now() / 1000), "dateTime")}`, fontSize: 7, color: "#667085" },
          { text: `Hal. ${halaman}/${total}`, alignment: "right", fontSize: 7, color: "#667085" },
        ],
        margin: [35, 15, 35, 0],
      }),
      content: [
        kop,
        { text: "SURAT PENGANTAR RUJUKAN PEMERIKSAAN LABORATORIUM", bold: true, fontSize: 12, alignment: "center", margin: [0, 10, 0, 8] },
        identitas,
        { margin: [0, 10, 0, 0], table: { headerRows: 1, widths: ["*", 90, 130, 100], body } },
        {
          margin: [0, 24, 0, 0],
          columns: [
            { text: "", width: "*" },
            {
              width: 190,
              alignment: "center",
              stack: [
                { text: `${epochToDate(Math.floor(Date.now() / 1000), "date")}`, fontSize: 8 },
                { text: "Petugas Laboratorium", margin: [0, 24, 0, 0] },
              ],
            },
          ],
        },
      ],
    },
    `Surat Pengantar Rujukan ${order?.noOrder ?? ""}`
  );
}

// Cetak dari uuid order (data sama dengan Expertise/Cetak Hasil): dipakai di daftar Order Lab & Hasil Pemeriksaan.
export async function cetakSuratPengantarRujukan(uuid: string) {
  const loading = utilsStore();
  const expertise = useExpertiseLab();
  loading.setLoading(true);
  try {
    const [pasien, tarif] = await Promise.all([expertise.getDetailPasien(uuid), expertise.getDetailTarif(uuid)]);
    createSuratPengantarRujukanPdf({ ...(pasien?.payload || {}), ...(tarif?.payload || {}) });
  } finally {
    loading.setLoading(false);
  }
}
