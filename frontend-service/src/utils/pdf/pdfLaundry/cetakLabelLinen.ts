import pdfMake from "pdfmake/build/pdfmake";
import { customVfs } from "@/utils/customVfs";
import { bukaPdf } from "@/utils/pdf/bukaPdf";
import { generateBarcode } from "@/utils/Helpers";

// Label unit linen (STD-0030): 50 × 25 mm, satu label per halaman — pola sama dengan label set CSSD. QR/barcode
// hanya berisi kode unit (unik per faskes, tanpa data pasien) sehingga dapat dipindai kamera peramban atau scanner
// USB/keyboard wedge. Label fisik tahan cuci panas/setrika (heat-transfer/tenun) di luar cakupan perangkat lunak.

pdfMake.vfs = customVfs.pdfMake.vfs;
pdfMake.fonts = {
  Arial: { normal: "Arial.ttf", bold: "Arial_Bold.ttf", italics: "Arial_Italic.ttf", bolditalics: "Arial_Bold_Italic.ttf" },
};
const ABU = "#475467";

export type LabelLinen = { kodeUnit: string; nilai: string; namaJenis?: string; namaFaskes?: string };

export function createLabelLinenPdf(label: LabelLinen[], format: "qr" | "barcode" = "qr", namaBerkas = "Label Unit Linen") {
  const L = 142;
  const T = 71;
  const teks = (l: LabelLinen) => [
    { text: l.kodeUnit, bold: true, fontSize: 8 },
    { text: l.namaJenis ?? "", margin: [0, 1, 0, 0] },
    { text: l.namaFaskes ?? "", color: ABU },
  ];
  bukaPdf(
    {
      info: { title: namaBerkas },
      pageSize: { width: L, height: T },
      pageMargins: [5, 4, 5, 3],
      defaultStyle: { font: "Arial", fontSize: 6 },
      content: label.map((l, n) =>
        format === "barcode"
          ? { pageBreak: n ? "before" : undefined, stack: [{ image: generateBarcode(l.nilai), width: 128, height: 32 }, ...teks(l)] }
          : { pageBreak: n ? "before" : undefined, columns: [{ qr: l.nilai, fit: 50, width: 52 }, { width: "*", stack: teks(l) }], columnGap: 3 },
      ),
    },
    namaBerkas,
  );
}
