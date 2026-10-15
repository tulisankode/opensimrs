import pdfMake from "pdfmake/build/pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { customVfs } from "../../customVfs";
import {
  convertImageToBase64,
  countAge,
  epochToDate,
  formatStringDate,
  generateQRCode,
} from "../../Helpers";
import logoUrl from "@/assets/images/opensimrs-square.png";

export async function createTiketAntrianPDF(data: any) {
  pdfMake.vfs = customVfs.pdfMake.vfs;
  pdfMake.fonts = {
    Arial: {
      normal: "Arial.ttf",
      bold: "Arial_Bold.ttf",
      italics: "Arial_Italic.ttf",
      bolditalics: "Arial_Bold_Italic.ttf",
    },
  };

  // Get faskes profile from localStorage
  const faskesProfile = JSON.parse(
    localStorage.getItem("faskes_profile") ?? "{}"
  );

  let logo = await convertImageToBase64(logoUrl);
  if (faskesProfile.logo && faskesProfile.logo.startsWith("data:image")) {
    logo = faskesProfile.logo;
  }

  // Generate QR Code for booking code
  const qrCodeData = await generateQRCode(
    `${data.patient.name || ""}-${data.patient.noRm || ""}`
  );

  // Determine nomor antrian based on selected number from UI first
  let nomorAntrian = data.__selectedNoAntrian as string;
  const hasVal = (v?: any) =>
    !(
      v === null ||
      v === undefined ||
      (typeof v === "string" && v.trim() === "")
    );
  if (!hasVal(nomorAntrian)) {
    // If no explicit selection from UI, fallback based on page source
    if (data?.__printSource === "farmasi") {
      nomorAntrian =
        data.noAntrianFarmasi ||
        data.noAntrianPoli ||
        data.noAntrianAdmisi ||
        "";
    } else {
      // Non-Farmasi (e.g., Print page): prioritize Admisi then Poli; ignore Farmasi
      nomorAntrian = data.noAntrianAdmisi || data.noAntrianPoli || "";
    }
  }

  // Helper lokal untuk format tanggal Indonesia seperti Figma: "01 Januari 2000"
  const MONTHS_ID = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const formatDateIndo = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = MONTHS_ID[d.getMonth()];
    const yy = d.getFullYear();
    return `${dd} ${mm} ${yy}`;
  };

  // Mapping gender agar konsisten dengan desain
  const mapGender = (g?: string) => {
    const val = (g || "").toString().toLowerCase();
    if (["l", "male", "laki-laki", "pria", "m"].includes(val))
      return "Laki-laki";
    if (["p", "female", "perempuan", "wanita", "f"].includes(val))
      return "Perempuan";
    return "-";
  };

  // Teks Tgl. Lahir + (umur)
  let tglLahirDenganUmur = "-";
  if (data?.patient?.birthDetail?.birthDate) {
    const d = new Date(data.patient.birthDetail.birthDate);
    const { tahun, bulan, hari } = countAge(d);
    tglLahirDenganUmur = `${formatDateIndo(
      data.patient.birthDetail.birthDate
    )} (${tahun} Thn ${bulan} Bln ${hari} Hri)`;
  }

  const HEADER_IMG_SIZE = 58; // tinggi logo & QR
  const HEADER_LABEL_FZ = 10; // fontSize "Nomor Antrian" (sesuai styles.headerLabel)
  const HEADER_NUMBER_FZ = 25; // fontSize angka antrian (sesuai styles.nomorBesar)
  const DEFAULT_LH = 1.05; // lineHeight default (sesuai defaultStyle.lineHeight)
  const middleTopMargin = Math.max(
    0,
    (HEADER_IMG_SIZE - (HEADER_LABEL_FZ + HEADER_NUMBER_FZ) * DEFAULT_LH) / 2
  );

  const docDefinition: TDocumentDefinitions = {
    pageSize: { width: 226.77, height: 340.16 }, // thermal ticket
    pageOrientation: "landscape",
    pageMargins: [8, 6, 8, 6],
    defaultStyle: {
      font: "Arial",
      fontSize: 7.5, // lebih kecil agar muat
      lineHeight: 1.05,
    },
    background: (currentPage: number, pageSize: any) => {
      const wmW = Math.min(pageSize.width, pageSize.height) * 0.6;
      const x = (pageSize.width - wmW) / 2;
      const y = (pageSize.height - wmW) / 2;
      return {
        image: logo,
        width: wmW,
        opacity: 0.06,
        absolutePosition: { x, y },
      } as any;
    },
    styles: {
      headerLabel: { fontSize: 9.5, color: "#111" },
      nomorBesar: { fontSize: 22, bold: true },
      title: { fontSize: 9.5, bold: true },
      label: { fontSize: 7.5 },
      value: { fontSize: 7.5 },
      valueBold: { fontSize: 7.5, bold: true },
      small: { fontSize: 6.5 },
    },
    content: [
      // Header
      {
        columns: [
          {
            image: logo,
            width: HEADER_IMG_SIZE,
            height: HEADER_IMG_SIZE,
            alignment: "left",
          },
          { width: "*", text: "" },
          {
            width: "auto",
            stack: [
              {
                text: "Nomor Antrian",
                decoration: "underline",
                style: "headerLabel",
                alignment: "right",
                fontSize: HEADER_LABEL_FZ,
              },
              {
                text: nomorAntrian,
                style: "nomorBesar",
                alignment: "right",
                fontSize: HEADER_NUMBER_FZ,
              },
            ],
            margin: [0, middleTopMargin, 1, 0], // pusatkan vertikal
          },
          {
            image: qrCodeData,
            width: HEADER_IMG_SIZE,
            height: HEADER_IMG_SIZE,
            alignment: "right",
          },
        ],
        margin: [0, 0, 0, 0],
      },

      // Garis
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 320.16,
            y2: 0,
            lineWidth: 1.5,
            lineColor: "black",
          },
        ],
        margin: [0, 0, 0, 6],
      },

      // Title
      {
        text:
          data?.__printSource === "farmasi"
            ? "TIKET ANTRIAN FARMASI"
            : "TIKET ANTRIAN POLIKLINIK",
        style: "title",
        alignment: "left",
        margin: [0, 0, 0, 8],
      },

      // Data Pasien
      {
        columns: [
          { text: "No. RM", width: "28%", style: "label" },
          { text: ":", width: "3%", style: "label" },
          { text: data.patient?.noRm || "-", width: "69%", style: "valueBold" },
        ],
        margin: [0, 0, 0, 2.5],
      },
      {
        columns: [
          { text: "Nama Pasien", width: "28%", style: "label" },
          { text: ":", width: "3%", style: "label" },
          { text: data.patient?.name || "-", width: "69%", style: "valueBold" },
        ],
        margin: [0, 0, 0, 2.5],
      },
      {
        columns: [
          { text: "Tgl. Lahir", width: "28%", style: "label" },
          { text: ":", width: "3%", style: "label" },
          { text: tglLahirDenganUmur, width: "69%", style: "value" },
        ],
        margin: [0, 0, 0, 2.5],
      },
      {
        columns: [
          { text: "Jenis Kelamin", width: "28%", style: "label" },
          { text: ":", width: "3%", style: "label" },
          {
            text: mapGender(data.patient?.gender),
            width: "69%",
            style: "value",
          },
        ],
        margin: [0, 0, 0, 2.5],
      },
      {
        columns: [
          { text: "Dokter", width: "28%", style: "label" },
          { text: ":", width: "3%", style: "label" },
          {
            text: data.practitioner?.pegawai
              ? `${data.practitioner.pegawai.firstTitle || ""}${
                  data.practitioner.pegawai.nama || ""
                }${data.practitioner.pegawai.lastTitle || ""}`.trim()
              : "-",
            width: "69%",
            style: "valueBold",
          },
        ],
        margin: [0, 0, 0, 2.5],
      },
      {
        columns: [
          { text: "Tujuan Poli", width: "28%", style: "label" },
          { text: ":", width: "3%", style: "label" },
          { text: data.lokasi?.name || "-", width: "69%", style: "valueBold" },
        ],
        margin: [0, 0, 0, 2.5],
      },
      {
        columns: [
          { text: "Jenis Pasien", width: "28%", style: "label" },
          { text: ":", width: "3%", style: "label" },
          {
            text: data.paymentMethod === 1 ? "TUNAI" : "BPJS",
            width: "69%",
            style: "valueBold",
          },
        ],
        margin: [0, 0, 0, 2.5],
      },
      {
        columns: [
          { text: "No. Asuransi", width: "28%", style: "label" },
          { text: ":", width: "3%", style: "label" },
          { text: data.noBPJS || "-", width: "69%", style: "value" },
        ],
        margin: [0, 0, 0, 2.5],
      },
      {
        columns: [
          { text: "SEP", width: "28%", style: "label" },
          { text: ":", width: "3%", style: "label" },
          { text: "-", width: "69%", style: "value" },
        ],
        margin: [0, 0, 0, 6],
      },

      // Garis sebelum catatan
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 320.16,
            y2: 0,
            lineWidth: 1.5,
            lineColor: "black",
          },
        ],
        margin: [0, 0, 0, 6],
      },

      // Perhatian
      { text: "Perhatian!", fontSize: 9, bold: true, margin: [0, 0, 0, 2] },
      {
        text: "Mohon LEMBAR TIKET ini jangan hilang, agar mempermudah pelayanan. Terimakasih",
        style: "small",
        margin: [0, 0, 0, 8],
      },

      // Footer (tanggal)
      //   {
      //     text: data.tanggalCheckin
      //       ? epochToDate(data.tanggalCheckin, "dateTime")
      //       : new Date().toLocaleString("id-ID"),
      //     style: "small",
      //     alignment: "center",
      //     margin: [0, 4, 0, 0],
      //   },
    ],
  };

  return pdfMake.createPdf(docDefinition);
}
