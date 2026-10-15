import pdfMake from "pdfmake/build/pdfmake";
import { customVfs } from "../customVfs";

export function createOrderAlkesPdf(payload: any) {
  pdfMake.vfs = customVfs.pdfMake.vfs;

  pdfMake.fonts = {
    Arial: {
      normal: "Arial.ttf",
      bold: "Arial_Bold.ttf",
      italics: "Arial_Italic.ttf",
      bolditalics: "Arial_Bold_Italic.ttf",
    },
  };

  const faskes = (() => {
    try {
      return JSON.parse(localStorage.getItem("faskes") ?? "{}");
    } catch {
      return {};
    }
  })();

  const clinicName = faskes?.faskesName || "NAMA KLINIK";
  const clinicAddress = faskes?.address?.fullAddress || "Jl. Nama alamat";
  const clinicPhone = faskes?.phone || "No. telpon";

  const docDefinition: any = {
    pageSize: "A5",
    pageMargins: [20, 20, 20, 25],
    defaultStyle: { font: "Arial", fontSize: 9 },
    content: [
      { text: clinicName, bold: true, fontSize: 16, alignment: "center" },
      {
        text: clinicAddress,
        fontSize: 10,
        alignment: "center",
        margin: [0, 2, 0, 2],
      },
      {
        text: clinicPhone,
        fontSize: 10,
        alignment: "center",
        margin: [0, 0, 0, 2],
      },

      {
        margin: [0, 0, 0, 0],
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 380,
            y2: 0,
            lineWidth: 1,
            lineColor: "black",
          },
        ],
      },

      {
        text: "ORDER ALKES",
        bold: true,
        fontSize: 14,
        alignment: "center",
        decoration: "underline",
        margin: [0, 8, 0, 9],
      },

      {
        margin: [0, 0, 0, 0],
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 380,
            y2: 0,
            lineWidth: 1,
            lineColor: "black",
          },
        ],
      },

      {
        columns: [
          { text: "APOTEK RAWAT JALAN", bold: true },
          { text: payload?.noOrderAlkes || "", alignment: "right", bold: true },
        ],
        margin: [0, 6, 0, 6],
      },

      {
        margin: [0, 0, 0, 10],
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 380,
            y2: 0,
            lineWidth: 1,
            lineColor: "black",
          },
        ],
      },

      // Baris: Nama
      {
        columns: [
          { width: "25%", text: "Nama", bold: true },
          { width: 8, text: ":" },
          {
            width: "*",
            text: payload?.patient || "Nama Lengkap Pasien Jika Panjang",
            bold: true,
          },
        ],
        margin: [0, 0, 0, 2],
      },
      // Baris: No. RM
      {
        columns: [
          { width: "25%", text: "No. RM", bold: true },
          { width: 8, text: ":" },
          { width: "*", text: payload?.noRm || "00-00-00", bold: true },
        ],
        margin: [0, 0, 0, 2],
      },
      // Baris: Tgl. Lahir
      {
        columns: [
          { width: "25%", text: "Tgl. Lahir", bold: true },
          { width: 8, text: ":" },
          { width: "*", text: payload?.birthDate || "01 JAN 2000", bold: true },
        ],
        margin: [0, 0, 0, 2],
      },
      // Baris: Petugas
      {
        columns: [
          { width: "25%", text: "Petugas", bold: true },
          { width: 8, text: ":" },
          {
            width: "*",
            text: payload?.petugasOrder || "Nama Petugas",
            bold: true,
          },
        ],
        margin: [0, 0, 0, 8],
      },

      {
        margin: [0, 4, 0, 8],
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 380,
            y2: 0,
            lineWidth: 1,
            lineColor: "black",
          },
        ],
      },

      // Blok layanan/no reg/ruangan/penjamin
      {
        columns: [
          { width: "25%", text: "Layanan", bold: true },
          { width: 8, text: ":" },
          {
            width: "*",
            text: payload?.jenisPelayanan || "Rawat Jalan",
            bold: true,
          },
        ],
        margin: [0, 0, 0, 2],
      },
      {
        columns: [
          { width: "25%", text: "No. Reg", bold: true },
          { width: 8, text: ":" },
          { width: "*", text: payload?.noReg || "-", bold: true },
        ],
        margin: [0, 0, 0, 2],
      },
      {
        columns: [
          { width: "25%", text: "Ruangan", bold: true },
          { width: 8, text: ":" },
          { width: "*", text: payload?.ruangan || "-", bold: true },
        ],
        margin: [0, 0, 0, 2],
      },
      {
        columns: [
          { width: "25%", text: "Penjamin", bold: true },
          { width: 8, text: ":" },
          { width: "*", text: payload?.paymentMethod || "Tunai", bold: true },
        ],
        margin: [0, 0, 0, 30],
      },

      // Heading List Order
      {
        columns: [
          { text: "LIST ORDER", bold: true },
          { text: "JML.", bold: true, alignment: "right" },
        ],
        margin: [0, 0, 0, 4],
      },
      {
        margin: [0, 4, 0, 6],
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 380,
            y2: 0,
            lineWidth: 1,
            lineColor: "black",
          },
        ],
      },

      // Daftar item alkes
      ...((payload?.alkesItems || []) as any[]).map((item: any) => ({
        columns: [
          { text: item?.itemMedis?.name || "-", bold: true },
          {
            text: item?.qty != null ? `${item.qty} PCS` : "-",
            alignment: "right",
            bold: true,
          },
        ],
        margin: [0, 4, 0, 4],
      })),
    ],
  };

  pdfMake.createPdf(docDefinition).open();
}
