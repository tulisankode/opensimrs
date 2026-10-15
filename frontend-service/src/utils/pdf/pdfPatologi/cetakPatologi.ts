import pdfMake from "pdfmake/build/pdfmake";
import { customVfs } from "@/utils/customVfs";
import { logoFaskes, profilFaskes, warnaTema } from "@/utils/tema";
import { bukaPdf, gambarPdfValid } from "@/utils/pdf/bukaPdf";
import { FIKSASI_PA, JENIS_PA, LATERALITAS_PA, PELAYANAN_PA, SUMBER_PA, rupiahPa, umurPa, waktuPa } from "@/stores/penunjang/patologi";

// Cetakan modul Patologi Anatomi: bukti order (A4), laporan hasil PA resmi (A4, satu kasus per halaman: identitas,
// data klinis & spesimen, makroskopis, mikroskopis, kesimpulan/diagnosis tebal, ICD-O/ICD-10, tanda tangan Sp.PA
// + QR, nomor PA), dan label wadah / kaset / slide (50 × 25 mm).
// `order` = payload detail order (GET /patologi/order/:uuid, camelCase) termasuk `items` & `pasien`.

pdfMake.vfs = customVfs.pdfMake.vfs;
pdfMake.fonts = {
  Arial: { normal: "Arial.ttf", bold: "Arial_Bold.ttf", italics: "Arial_Italic.ttf", bolditalics: "Arial_Bold_Italic.ttf" },
};

const LEBAR = 595 - 80;
const ABU = "#475467";
const JENIS_KELAMIN: Record<string, string> = { Male: "Laki-laki", Female: "Perempuan", L: "Laki-laki", P: "Perempuan" };

const kop = (judul: string, sub?: string) => {
  const profil = profilFaskes.value ?? {};
  const logo = gambarPdfValid(logoFaskes()) ? logoFaskes() : null;
  const teks = {
    width: "*",
    alignment: logo ? "left" : "center",
    stack: [
      { text: profil?.name ?? "-", bold: true, fontSize: 15 },
      { text: "Instalasi Patologi Anatomi", bold: true, color: warnaTema("400") },
      { text: profil?.address?.fullAddress ?? "", margin: [0, 2, 0, 0] },
      { text: [profil?.phone, profil?.email].filter(Boolean).join(" · ") },
    ],
  };
  return [
    logo ? { columns: [{ image: logo, fit: [90, 50], width: 100 }, teks], columnGap: 10 } : teks,
    { canvas: [{ type: "line", x1: 0, y1: 4, x2: LEBAR, y2: 4, lineWidth: 1.5, lineColor: warnaTema("300") }], margin: [0, 4, 0, 8] },
    { text: judul, bold: true, fontSize: 12, alignment: "center" },
    sub ? { text: sub, bold: true, fontSize: 10, alignment: "center", color: warnaTema("400"), margin: [0, 1, 0, 0] } : {},
    { text: "", margin: [0, 0, 0, 6] },
  ];
};

const tabelLabel = (baris: [string, string][], lebarLabel = 88) => ({
  width: "*",
  table: { widths: [lebarLabel, "*"], body: baris.map(([l, n]) => [{ text: l, color: ABU }, { text: `: ${n || "-"}` }]) },
  layout: { defaultBorder: false, paddingTop: () => 1, paddingBottom: () => 1, paddingLeft: () => 0 },
});

const asal = (order: any) =>
  order?.sumber === "rujukan"
    ? [order?.faskesPerujuk, "Rujukan luar"].filter(Boolean).join(" · ")
    : `${SUMBER_PA[order?.sumber] ?? "-"} · ${order?.lokasiAsal ?? PELAYANAN_PA[order?.pelayanan] ?? "-"}${order?.noReg ? ` (${order.noReg})` : ""}`;

const identitas = (order: any, item?: any) => {
  const p = order?.pasien ?? {};
  const kiri: [string, string][] = [
    ["Nama Pasien", p.name ?? order?.namaPasien ?? "-"],
    ["No. RM", order?.noRm ?? p.noRm ?? "-"],
    ["Jenis Kelamin", JENIS_KELAMIN[p.gender ?? order?.gender] ?? p.gender ?? "-"],
    ["Tgl. Lahir / Umur", `${p.birthDate ? waktuPa(Date.parse(p.birthDate) / 1000, true) : "-"} / ${umurPa(p.birthDate ?? order?.birthDate)}`],
    ["Dokter Pengirim", order?.dokterPengirim ?? "-"],
  ];
  const kanan: [string, string][] = item
    ? [
        ["No. Order", `${order?.noOrder ?? "-"}${order?.cito ? "  (CITO)" : ""}`],
        ["Asal", asal(order)],
        ["Tgl. Terima", waktuPa(item.waktuTerima)],
        ["Tgl. Jawab", item.waktuVerifikasi ? waktuPa(item.waktuVerifikasi) : "-"],
        ["Pembayaran", order?.paymentMethod === 2 ? "Asuransi" : "Tunai"],
      ]
    : [
        ["No. Order", `${order?.noOrder ?? "-"}${order?.cito ? "  (CITO)" : ""}`],
        ["Tgl. Order", waktuPa(order?.createdAt)],
        ["Asal", asal(order)],
        ["Pembayaran", order?.paymentMethod === 2 ? "Asuransi" : "Tunai"],
      ];
  return { columns: [tabelLabel(kiri), tabelLabel(kanan, 70)], columnGap: 12 };
};

const kaki = (halaman: number, total: number) => ({
  columns: [
    { text: `Dicetak: ${waktuPa(Math.floor(Date.now() / 1000))} · Hasil hanya berlaku untuk spesimen yang diterima`, fontSize: 7, color: "#667085" },
    { text: `Hal. ${halaman}/${total}`, alignment: "right", fontSize: 7, color: "#667085" },
  ],
  margin: [40, 15, 40, 0],
});

const buka = (content: any[], namaBerkas: string, ekstra: Record<string, any> = {}) =>
  bukaPdf(
    { info: { title: namaBerkas }, pageSize: "A4", pageMargins: [40, 35, 40, 50], defaultStyle: { font: "Arial", fontSize: 9 }, footer: kaki, content, ...ekstra },
    namaBerkas
  );

const bagian = (judul: string) => ({ text: judul, bold: true, fontSize: 10, color: warnaTema("400"), margin: [0, 8, 0, 2] });
const paragraf = (isi?: string | null) => ({ text: isi?.trim() || "-", lineHeight: 1.25, alignment: "justify" });

// Bukti order PA (untuk pasien / kasir / pengantar spesimen).
export function createBuktiOrderPaPdf(order: any) {
  const items = order?.items ?? [];
  buka(
    [
      ...kop("BUKTI ORDER PEMERIKSAAN PATOLOGI ANATOMI"),
      identitas(order),
      {
        margin: [0, 8, 0, 0],
        columns: [
          tabelLabel([
            ["Data klinis", order?.klinis ?? "-"],
            ["Riwayat", order?.riwayat ?? "-"],
          ]),
          tabelLabel(
            [
              ["Lokasi/organ", order?.lokasiAnatomi ?? "-"],
              ["Cara ambil", order?.caraPengambilan ?? "-"],
            ],
            70
          ),
        ],
        columnGap: 12,
      },
      order?.catatan ? { text: [{ text: "Catatan: ", bold: true }, order.catatan], margin: [0, 4, 0, 0] } : {},
      {
        margin: [0, 10, 0, 0],
        table: {
          headerRows: 1,
          widths: [20, 65, "*", 80, 75],
          body: [
            ["No", "Kode", "Pemeriksaan", "Jenis", "Tarif"].map((h) => ({ text: h, bold: true, fillColor: warnaTema("50") })),
            ...items.map((i: any, n: number) => [
              String(n + 1),
              i.kode ?? "-",
              { text: [i.nama, i.noPaInduk ? { text: `\nBlok kasus ${i.noPaInduk}`, color: ABU, fontSize: 8 } : ""] },
              JENIS_PA[i.jenis as keyof typeof JENIS_PA]?.singkat ?? i.jenis,
              { text: rupiahPa(i.harga), alignment: "right" },
            ]),
            [{ text: "Total", bold: true, colSpan: 4, alignment: "right" }, "", "", "", { text: rupiahPa(order?.total), bold: true, alignment: "right" }],
          ],
        },
        layout: "lightHorizontalLines",
      },
      {
        text:
          "Petunjuk pengiriman jaringan: masukkan jaringan ke wadah berlabel identitas pasien, rendam dalam formalin buffer 10% (volume ± 10× jaringan) segera setelah diambil; sediaan sitologi difiksasi alkohol 95%. Jaringan potong beku dikirim segar tanpa fiksasi.",
        italics: true,
        color: ABU,
        margin: [0, 10, 0, 0],
      },
      {
        columns: [
          { text: `Status: ${String(order?.status ?? "-").toUpperCase()}${order?.divalidasiPada ? ` · divalidasi ${waktuPa(order.divalidasiPada)} oleh ${order.divalidasiOleh ?? "-"}` : ""}`, color: ABU, width: "*" },
          { width: 190, alignment: "center", stack: [{ text: "Petugas Patologi Anatomi", margin: [0, 0, 0, 35] }, { text: order?.divalidasiOleh ?? order?.dibuatOleh ?? "( .................... )", bold: true }] },
        ],
        margin: [0, 16, 0, 0],
      },
    ],
    `Order ${order?.noOrder ?? ""}`
  );
}

// Satu halaman laporan PA untuk satu kasus.
const halamanLaporan = (order: any, i: any, n: number) => {
  const jenis = JENIS_PA[i.jenis as keyof typeof JENIS_PA]?.label?.toUpperCase() ?? "";
  const final = i.statusLaporan === "verifikasi" && i.status === "selesai";
  const gambar = (i.gambarMakro ?? []).filter((g: any) => gambarPdfValid(g?.data));
  const profil = profilFaskes.value ?? {};
  const qr = [
    `Laporan PA ${i.noPa ?? "-"}`,
    `Pasien: ${order?.pasien?.name ?? order?.namaPasien ?? "-"} (${order?.noRm ?? "-"})`,
    `Diverifikasi: ${i.dokterPaNama ?? "-"} ${i.waktuVerifikasi ? waktuPa(i.waktuVerifikasi) : ""}`,
    profil?.name ?? "",
  ].join("\n");
  const spesimen: [string, string][] = [
    ["Jenis spesimen", i.jenisSpesimen ?? "-"],
    ["Lokasi / organ", [i.lokasiAnatomi, LATERALITAS_PA[i.lateralitas]].filter(Boolean).join(" · ") || "-"],
    ["Cara pengambilan", i.caraPengambilan ?? order?.caraPengambilan ?? "-"],
  ];
  const spesimen2: [string, string][] = [
    ["Fiksasi", FIKSASI_PA[i.fiksasi] ?? "-"],
    ["Jumlah wadah", i.jumlahWadah != null ? String(i.jumlahWadah) : "-"],
    ["Blok / slide", `${i.jumlahBlok ?? 0} blok · ${i.jumlahSlide ?? 0} slide`],
  ];
  return [
    ...kop("HASIL PEMERIKSAAN PATOLOGI ANATOMI", jenis).map((k: any, x: number) => (x === 0 && n ? { ...k, pageBreak: "before" } : k)),
    {
      table: {
        widths: ["*", "auto"],
        body: [
          [
            { text: [{ text: "Pemeriksaan: ", color: ABU }, { text: i.nama, bold: true }, i.noPaInduk ? { text: `  (blok kasus ${i.noPaInduk})`, color: ABU } : ""], margin: [4, 4, 4, 4] },
            { text: [{ text: "No. PA  ", color: ABU }, { text: i.noPa ?? "-", bold: true, fontSize: 13 }], margin: [8, 2, 8, 2], fillColor: warnaTema("50") },
          ],
        ],
      },
      layout: { hLineColor: () => warnaTema("200"), vLineColor: () => warnaTema("200") },
      margin: [0, 0, 0, 6],
    },
    identitas(order, i),
    bagian("DATA KLINIS"),
    paragraf([order?.klinis, order?.riwayat ? `Riwayat: ${order.riwayat}` : ""].filter(Boolean).join("\n")),
    bagian("SPESIMEN"),
    { columns: [tabelLabel(spesimen), tabelLabel(spesimen2, 70)], columnGap: 12 },
    bagian("MAKROSKOPIS"),
    paragraf(i.makroskopis),
    ...(gambar.length ? [{ columns: gambar.slice(0, 3).map((g: any) => ({ image: g.data, fit: [150, 110], width: "auto" })), columnGap: 8, margin: [0, 4, 0, 0] }] : []),
    bagian("MIKROSKOPIS"),
    paragraf(i.mikroskopis),
    bagian("KESIMPULAN / DIAGNOSIS"),
    {
      table: { widths: ["*"], body: [[{ text: i.diagnosis?.trim() || "-", bold: true, fontSize: 10.5, lineHeight: 1.25, margin: [6, 5, 6, 5] }]] },
      layout: { hLineColor: () => warnaTema("300"), vLineColor: () => warnaTema("300"), hLineWidth: () => 1, vLineWidth: () => 1 },
    },
    {
      margin: [0, 4, 0, 0],
      text: [
        { text: "ICD-O topografi: ", color: ABU }, { text: i.icdOTopografi ?? "-", bold: true },
        { text: "   ICD-O morfologi: ", color: ABU }, { text: i.icdOMorfologi ?? "-", bold: true },
        { text: "   ICD-10: ", color: ABU }, { text: i.icd10 ? `${i.icd10}${i.icd10Nama ? ` — ${String(i.icd10Nama).split("~").pop()}` : ""}` : "-", bold: true },
      ],
    },
    i.komentar && i.komentar !== "-" ? [bagian("KOMENTAR / SARAN"), paragraf(i.komentar)] : {},
    i.revisi ? { text: `Laporan revisi ke-${i.revisi}${i.alasanRevisi ? `: ${i.alasanRevisi}` : ""}. Laporan ini menggantikan laporan sebelumnya.`, italics: true, color: "#B42318", margin: [0, 6, 0, 0] } : {},
    {
      columns: [
        {
          width: "*",
          stack: [
            { text: `Diterima: ${waktuPa(i.waktuTerima)}${i.petugasTerima ? ` · ${i.petugasTerima}` : ""}`, color: ABU, fontSize: 8 },
            { text: `Makroskopis: ${i.petugasMakroskopis ?? "-"}${i.waktuMakroskopis ? ` · ${waktuPa(i.waktuMakroskopis)}` : ""}`, color: ABU, fontSize: 8 },
            final ? {} : { text: "DRAFT — BELUM DIVERIFIKASI DOKTER Sp.PA", bold: true, color: "#B42318", margin: [0, 6, 0, 0] },
          ],
        },
        {
          width: 230,
          columns: [
            final ? { qr, fit: 72, width: 76 } : { text: "", width: 76 },
            {
              width: "*",
              alignment: "center",
              stack: [
                { text: [profil?.address?.city ?? profil?.address?.cityName, i.waktuVerifikasi ? waktuPa(i.waktuVerifikasi, true) : ""].filter(Boolean).join(", ") || " " },
                { text: "Dokter Spesialis Patologi Anatomi", margin: [0, 2, 0, final ? 30 : 38] },
                { text: i.dokterPaNama ?? "( .................................... )", bold: true, decoration: "underline" },
                { text: i.dokterPaSip ? `SIP. ${i.dokterPaSip}` : "", fontSize: 8, color: ABU },
              ],
            },
          ],
          columnGap: 4,
        },
      ],
      margin: [0, 14, 0, 0],
      unbreakable: true,
    },
  ];
};

// Laporan hasil PA. `itemUuid` = satu kasus; kosong = semua kasus yang laporannya ada (terverifikasi atau draft bila
// `termasukDraft`). Draft ditandai "DRAFT" dan tanpa QR.
export function createHasilPaPdf(order: any, itemUuid?: string, termasukDraft = false) {
  const items = (order?.items ?? []).filter(
    (i: any) => (!itemUuid || i.uuid === itemUuid) && i.diagnosis && (termasukDraft || itemUuid || i.status === "selesai")
  );
  const isi = items.length ? items.flatMap((i: any, n: number) => halamanLaporan(order, i, n)) : [...kop("HASIL PEMERIKSAAN PATOLOGI ANATOMI"), identitas(order), { text: "Belum ada laporan yang terverifikasi.", italics: true, margin: [0, 12, 0, 0] }];
  const satu = items.length === 1 ? items[0] : null;
  const draft = items.some((i: any) => i.status !== "selesai");
  buka(isi, `Hasil PA ${satu?.noPa ?? order?.noOrder ?? ""}`, draft ? { watermark: { text: "DRAFT", color: "#B42318", opacity: 0.08, bold: true } } : {});
}

// Label 50 × 25 mm (satu label per halaman) untuk wadah spesimen, kaset blok parafin, atau slide.
// `label` = [{ kode, baris1, baris2 }] — kode dicetak tebal + QR.
export function createLabelPaPdf(label: { kode: string; baris1?: string; baris2?: string }[], namaBerkas = "Label PA") {
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
          { qr: l.kode, fit: 50, width: 52 },
          {
            width: "*",
            stack: [
              { text: l.kode, bold: true, fontSize: 8 },
              { text: l.baris1 ?? "", margin: [0, 1, 0, 0] },
              { text: l.baris2 ?? "", color: ABU },
            ],
          },
        ],
        columnGap: 3,
      })),
    },
    namaBerkas
  );
}

// Label wadah untuk satu kasus (sejumlah wadah) dari detail kasus (GET /patologi/kasus/:uuid).
export function createLabelWadahPaPdf(kasus: any) {
  const n = Math.max(Number(kasus?.jumlahWadah) || 1, 1);
  const nama = kasus?.order?.pasien?.name ?? kasus?.order?.namaPasien ?? "-";
  createLabelPaPdf(
    Array.from({ length: n }, (_, x) => ({
      kode: kasus?.noPa ?? "-",
      baris1: `${nama} · RM ${kasus?.order?.noRm ?? "-"}`,
      baris2: `${kasus?.jenisSpesimen ?? kasus?.nama ?? ""} · wadah ${x + 1}/${n}`,
    })),
    `Label wadah ${kasus?.noPa ?? ""}`
  );
}

// Label kaset blok & slide untuk satu kasus (atau daftar arsip terpilih).
export function createLabelArsipPaPdf(arsip: any[], namaPasien?: string, noRm?: string) {
  createLabelPaPdf(
    arsip.map((a) => ({
      kode: a.kode,
      baris1: `${a.namaPasien ?? namaPasien ?? "-"} · RM ${a.noRm ?? noRm ?? "-"}`,
      baris2: `${a.jenis === "blok" ? "Blok parafin" : `Slide ${a.pewarnaan ?? ""}`}${a.lokasiRak ? ` · ${a.lokasiRak}` : ""}`,
    })),
    "Label blok & slide PA"
  );
}
