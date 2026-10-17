import pdfMake from "pdfmake/build/pdfmake";
import { bukaPdf, gambarPdfValid } from "@/utils/pdf/bukaPdf";
import { customVfs } from "@/utils/customVfs";
import { epochToDate, formatStringDate } from "@/utils/Helpers";
import { logoFaskes, profilFaskes, warnaTema } from "@/utils/tema";

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

const tanggalEpoch = (value: unknown, format: "date" | "dateTime" = "dateTime") => {
  const n = Number(value);
  if (!n) return "-";
  return epochToDate(n > 1e12 ? Math.floor(n / 1000) : n, format);
};

const namaDokter = (practitioner: any) => {
  const p = practitioner?.pegawai ?? {};
  return [p.firstTitle, p.name ?? p.nama, p.lastTitle].filter(Boolean).join(" ") || "-";
};

const JENIS_KELAMIN: Record<string, string> = { Male: "Laki-laki", Female: "Perempuan" };

// Catatan expertise berasal dari editor teks kaya (HTML) → teks biasa untuk PDF
const htmlKeTeks = (html: string) =>
  String(html ?? "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li)\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// ── Flag hasil (H/L/CH/CL/TN) ─────────────────────────────────────────────
// Flag dari backend dipakai bila ada; selain itu dihitung dari teks nilai rujukan ("12,0 - 15,0 g/dL", "< 200", "> 40",
// "Non Reaktif"). Kritis bila menyimpang > 50% dari batas.
const keAngka = (v: unknown) => {
  const t = String(v ?? "").trim().replace(/\s/g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};
export function hitungFlag(hasil: unknown, rujukan: unknown): string {
  const r = String(rujukan ?? "").trim();
  const h = String(hasil ?? "").trim();
  if (!r || !h) return "";
  const n = keAngka(h);
  const rentang = /(-?\d+(?:[.,]\d+)?)\s*[-–]\s*(-?\d+(?:[.,]\d+)?)/.exec(r);
  const batas = /^(<|>|≤|≥)=?\s*(-?\d+(?:[.,]\d+)?)/.exec(r);
  if (n != null && rentang) {
    const bawah = Number(rentang[1].replace(",", "."));
    const atas = Number(rentang[2].replace(",", "."));
    if (n < bawah) return n < bawah * 0.5 ? "CL" : "L";
    if (n > atas) return n > atas * 1.5 ? "CH" : "H";
    return "";
  }
  if (n != null && batas) {
    const b = Number(batas[2].replace(",", "."));
    if ((batas[1] === "<" || batas[1] === "≤") && n > b) return n > b * 1.5 ? "CH" : "H";
    if ((batas[1] === ">" || batas[1] === "≥") && n < b) return n < b * 0.5 ? "CL" : "L";
    return "";
  }
  // Hasil kualitatif: berbeda dari nilai normal → Tidak Normal
  if (n == null && !/\d/.test(r)) return h.toLowerCase() === r.toLowerCase() ? "" : "TN";
  return "";
}
const WARNA_FLAG: Record<string, string> = { CH: "#D92D20", CL: "#D92D20", H: "#DC6803", L: "#DC6803", TN: "#DC6803" };
const escRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Hasil pemeriksaan laboratorium (A4). `order` = gabungan detail order lab + hasil (GET order-lab & hasil-pemeriksaan).
export function createHasilLabPdf(order: any) {
  const profil = profilFaskes.value?.name ? profilFaskes.value : faskesProfile();
  const logo = gambarPdfValid(logoFaskes()) ? logoFaskes() : gambarPdfValid(profil?.logo) ? profil.logo : null;
  const pasien = order?.patient ?? {};
  const lahir = pasien?.birthDetail ?? {};
  const umur = lahir.ageYear != null ? `${lahir.ageYear} th ${lahir.ageMonth ?? 0} bl ${lahir.ageDay ?? 0} hr` : "-";
  const LEBAR = 595 - 70;

  // ── Kop: logo faskes kiri, identitas faskes di tengah ──
  const alamat = typeof profil?.address === "string" ? profil.address : profil?.address?.fullAddress ?? "";
  const kontak = [profil?.phone ? `Telp. ${profil.phone}` : "", profil?.email ? `Email: ${profil.email}` : ""].filter(Boolean).join(", ");
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
          { text: kontak, fontSize: 8 },
        ],
      },
      { text: "", width: 80 },
    ],
  };

  // ── Identitas pasien & order ──
  const baris = (pasang: [string, any][]) =>
    pasang.map(([l, v]) => [{ text: l, bold: true }, { text: ":" }, { text: v == null || v === "" ? "-" : String(v) }]);
  const alamatPasien = [pasien?.address?.fullAddress, pasien?.address?.districtData?.name, pasien?.address?.cityData?.name]
    .filter(Boolean)
    .join(", ");
  const kiri = baris([
    ["Nama Pasien", `${pasien.title ? pasien.title + " " : ""}${pasien.name ?? "-"}`],
    ["Tgl. Lahir / Umur", `${lahir.birthDate ? formatStringDate(String(lahir.birthDate).substring(0, 10)) : "-"} / ${umur}`],
    ["Jenis Kelamin", JENIS_KELAMIN[pasien.gender] ?? pasien.gender],
    ["No. RM", order?.noRm],
    ["Dokter Pengirim", namaDokter(order?.dokterPengirim)],
    ["Diagnosa", order?.diagnosis],
    ["Alamat", alamatPasien],
  ]);
  const kanan = baris([
    ["No. Order", order?.noOrder],
    ["No. Registrasi", order?.noreg],
    ["Tgl. Order", tanggalEpoch(order?.tglOrder)],
    ["Tgl. Validasi", tanggalEpoch(order?.waktuValidasi)],
    ["Tgl. Selesai", tanggalEpoch(order?.waktuSelsai ?? order?.waktuExpertise)],
    ["Ruang Pengirim", [order?.lokasi?.name, order?.pelayanan ? String(order.pelayanan).toUpperCase() : ""].filter(Boolean).join(" / ")],
    ["Penjamin", order?.paymentMethod == 1 ? "UMUM / TUNAI" : "ASURANSI"],
    ["CITO / Puasa", `${order?.cito ? "Ya" : "Tidak"} / ${order?.statusPuasa ? "Ya" : "Tidak"}`],
  ]);
  const tabelIdentitas = (body: any[], lebarLabel: number) => ({
    width: "*",
    table: { widths: [lebarLabel, 6, "*"], body },
    layout: { defaultBorder: false, paddingTop: () => 1, paddingBottom: () => 1, paddingLeft: () => 0, paddingRight: () => 2 },
  });

  // ── Hasil: dikelompokkan per kategori → kelompok (panel) ──
  const hasil = [...(order?.hasilPemeriksaan ?? [])].sort(
    (a: any, b: any) =>
      (a.kategoriUrut ?? 999) - (b.kategoriUrut ?? 999) ||
      String(a.kategori ?? "~").localeCompare(String(b.kategori ?? "~")) ||
      String(a.kelompok ?? "~").localeCompare(String(b.kelompok ?? "~")) ||
      (a.itemPemeriksaan?.noUrut ?? 999) - (b.itemPemeriksaan?.noUrut ?? 999)
  );
  const body: any[] = [
    ["Pemeriksaan", "Hasil", "Flag", "Nilai Rujukan", "Satuan", "Metode"].map((t, i) => ({
      text: t,
      bold: true,
      alignment: i === 0 ? "left" : "center",
    })),
  ];
  let kategoriAktif: string | undefined;
  let kelompokAktif: string | undefined;
  for (const row of hasil) {
    const kategori = row.kategori ?? "Lainnya";
    if (kategori !== kategoriAktif) {
      kategoriAktif = kategori;
      kelompokAktif = undefined;
      body.push([{ text: String(kategori).toUpperCase(), bold: true, fontSize: 10, colSpan: 6, margin: [0, 3, 0, 0] }, "", "", "", "", ""]);
    }
    if (row.kelompok && row.kelompok !== kelompokAktif) {
      kelompokAktif = row.kelompok;
      body.push([{ text: row.kelompok, bold: true, colSpan: 6, margin: [6, 0, 0, 0] }, "", "", "", "", ""]);
    }
    const satuan = row.itemPemeriksaan?.satuan ?? "";
    const rujukan = String(row.itemPemeriksaan?.nilaiRujukan ?? "");
    const flag = (row.flag && !/^n(ormal)?$/i.test(row.flag) ? String(row.flag).toUpperCase() : "") || hitungFlag(row.result, rujukan);
    const warna = WARNA_FLAG[flag];
    const namaItem: any[] = [{ text: row.itemPemeriksaan?.name ?? "-" }];
    if (row.dirujuk) {
      namaItem.push({ text: `\nRujukan - ${row.labRujukan?.name ?? "-"}`, italics: true, fontSize: 7, color: "#667085" });
    }
    body.push([
      { stack: [{ text: namaItem }], margin: [row.kelompok ? 12 : 6, 0, 0, 0] },
      { text: row.result ?? "-", bold: true, alignment: "center", color: warna ?? "black" },
      { text: flag, bold: true, alignment: "center", color: warna ?? "black" },
      { text: (satuan ? rujukan.replace(new RegExp(`\\s*${escRegex(satuan)}\\s*$`), "") : rujukan) || "-", alignment: "center" },
      { text: satuan || "-", alignment: "center" },
      { text: row.itemPemeriksaan?.metode ?? "-", alignment: "center" },
    ]);
  }
  if (!hasil.length) body.push([{ text: "Belum ada hasil", colSpan: 6, alignment: "center", italics: true }, "", "", "", "", ""]);

  const legenda = {
    margin: [0, 4, 0, 0],
    fontSize: 7.5,
    text: [
      { text: "CH", bold: true, color: WARNA_FLAG.CH }, " : Kritis Tinggi     ",
      { text: "CL", bold: true, color: WARNA_FLAG.CL }, " : Kritis Rendah     ",
      { text: "TN", bold: true, color: WARNA_FLAG.TN }, " : Tidak Normal     ",
      { text: "H", bold: true, color: WARNA_FLAG.H }, " : Tinggi     ",
      { text: "L", bold: true, color: WARNA_FLAG.L }, " : Rendah",
    ],
  };

  // ── Validasi & penanggung jawab (QR sebagai penanda verifikasi dokumen) ──
  const validator = order?.petugasExpertise ?? order?.petugasOrder ?? "-";
  const dokterPj = namaDokter(order?.practitioner);
  const kodeQr = (siapa: string) => `${profil?.name ?? ""} | Hasil Lab ${order?.noOrder ?? ""} | ${pasien.name ?? ""} | ${siapa}`;
  const tandaTangan = (waktu: string, judul: string, nama: string) => ({
    width: 190,
    alignment: "center",
    stack: [
      { text: waktu, fontSize: 8 },
      { text: judul, bold: true, margin: [0, 1, 0, 4] },
      { qr: kodeQr(nama), fit: 58, alignment: "center" },
      { text: nama, bold: true, margin: [0, 4, 0, 0] },
    ],
  });

  // Garis tabel: tebal di kepala & akhir, putus-putus antar baris (seperti format hasil lab RS pada umumnya).
  const layoutHasil = {
    hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.4),
    vLineWidth: () => 0,
    hLineStyle: (i: number, node: any) => (i <= 1 || i === node.table.body.length ? null : { dash: { length: 1.5, space: 1.5 } }),
    hLineColor: (i: number, node: any) => (i <= 1 || i === node.table.body.length ? "black" : "#98A2B3"),
    paddingTop: () => 2.5,
    paddingBottom: () => 2.5,
    paddingLeft: () => 3,
    paddingRight: () => 3,
  };

  return bukaPdf(
    {
      info: { title: `Hasil Lab ${order?.noOrder ?? ""}` },
      pageSize: "A4",
      pageMargins: [35, 30, 35, 45],
      defaultStyle: { font: "Arial", fontSize: 8.5 },
      footer: (halaman: number, total: number) => ({
        columns: [
          { text: `Dicetak: ${epochToDate(Math.floor(Date.now() / 1000), "dateTime")}`, fontSize: 7, color: "#667085" },
          { text: "Dokumen ini dicetak oleh sistem", alignment: "center", italics: true, fontSize: 7, color: "#667085" },
          { text: `Hal. ${halaman}/${total}`, alignment: "right", fontSize: 7, color: "#667085" },
        ],
        margin: [35, 15, 35, 0],
      }),
      content: [
        kop,
        {
          canvas: [
            { type: "line", x1: 0, y1: 4, x2: LEBAR, y2: 4, lineWidth: 1.5, lineColor: warnaTema("300") },
            { type: "line", x1: 0, y1: 6.5, x2: LEBAR, y2: 6.5, lineWidth: 0.5, lineColor: warnaTema("300") },
          ],
          margin: [0, 4, 0, 6],
        },
        { text: "HASIL PEMERIKSAAN LABORATORIUM", bold: true, fontSize: 12, alignment: "center", margin: [0, 0, 0, 8] },
        { columns: [tabelIdentitas(kiri, 82), tabelIdentitas(kanan, 78)], columnGap: 14 },
        { margin: [0, 10, 0, 0], table: { headerRows: 1, widths: ["*", 55, 28, 95, 55, 70], body }, layout: layoutHasil },
        legenda,
        { canvas: [{ type: "line", x1: 0, y1: 2, x2: LEBAR, y2: 2, lineWidth: 0.6 }], margin: [0, 4, 0, 4] },
        { text: [{ text: "Catatan : ", bold: true }, order?.catatanAnalis ? htmlKeTeks(order.catatanAnalis) : "-"] },
        { text: [{ text: "Expertise : ", bold: true }, order?.catatanExpertise ? htmlKeTeks(order.catatanExpertise) : "-"], margin: [0, 4, 0, 0] },
        {
          margin: [0, 14, 0, 0],
          unbreakable: true,
          columns: [
            tandaTangan(`Validasi, ${tanggalEpoch(order?.waktuValidasi)}`, "Validator", validator),
            { text: "", width: "*" },
            tandaTangan(`Selesai, ${tanggalEpoch(order?.waktuSelsai ?? order?.waktuExpertise)}`, "Dokter Penanggung Jawab", dokterPj),
          ],
        },
      ],
    },
    `Hasil Lab ${order?.noOrder ?? ""}`,
  );
}
