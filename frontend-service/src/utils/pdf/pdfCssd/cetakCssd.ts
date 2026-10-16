import pdfMake from "pdfmake/build/pdfmake";
import { customVfs } from "@/utils/customVfs";
import { bukaPdf } from "@/utils/pdf/bukaPdf";

// Label set instrumen CSSD: 50 × 25 mm (satu label per halaman), QR berisi kode barcode set fisik — pola sama
// dengan label wadah Patologi Anatomi (cetak dari peramban, dipindai pemindai USB generik/keyboard wedge).

pdfMake.vfs = customVfs.pdfMake.vfs;
pdfMake.fonts = {
  Arial: { normal: "Arial.ttf", bold: "Arial_Bold.ttf", italics: "Arial_Italic.ttf", bolditalics: "Arial_Bold_Italic.ttf" },
};
const ABU = "#475467";

export function createLabelSetCssdPdf(label: { kodeBarcode: string; kodeSetFisik?: string; namaSet?: string }[], namaBerkas = "Label Set CSSD") {
  const L = 142;
  const T = 71;
  bukaPdf(
    {
      info: { title: namaBerkas },
      pageSize: { width: L, height: T },
      pageMargins: [5, 4, 5, 3],
      defaultStyle: { font: "Arial", fontSize: 6 },
      content: label.map((l, n) => ({
        pageBreak: n ? "before" : undefined,
        columns: [
          { qr: l.kodeBarcode, fit: 50, width: 52 },
          {
            width: "*",
            stack: [
              { text: l.kodeBarcode, bold: true, fontSize: 8 },
              { text: l.namaSet ?? "", margin: [0, 1, 0, 0] },
              { text: l.kodeSetFisik ?? "", color: ABU },
            ],
          },
        ],
        columnGap: 3,
      })),
    },
    namaBerkas,
  );
}
