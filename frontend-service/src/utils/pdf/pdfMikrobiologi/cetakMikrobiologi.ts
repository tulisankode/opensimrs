import pdfMake from "pdfmake/build/pdfmake";
import { customVfs } from "@/utils/customVfs";
import { logoFaskes, profilFaskes, warnaTema } from "@/utils/tema";
import { bukaPdf, gambarPdfValid } from "@/utils/pdf/bukaPdf";
import {
  GRAM_MIKRO,
  KULTUR_MIKRO,
  PELAYANAN_MIKRO,
  PENANDA_MIKRO,
  PEWARNAAN_MIKRO,
  SUMBER_MIKRO,
  namaSpesimen,
  rupiahMikro,
  umurMikro,
  waktuMikro,
} from "@/stores/penunjang/mikrobiologi";

// Cetakan modul Mikrobiologi Klinik (A4): bukti order, hasil pemeriksaan (laporan SEMENTARA ber-watermark atau
// FINAL bertanda tangan Sp.MK + QR), dan antibiogram kumulatif (A4 lanskap).
// `order` = payload GET /mikrobiologi/order/:uuid (camelCase) termasuk `items[].hasil.isolat[].kepekaan`.

pdfMake.vfs = customVfs.pdfMake.vfs;
pdfMake.fonts = {
  Arial: {
    normal: "Arial.ttf",
    bold: "Arial_Bold.ttf",
    italics: "Arial_Italic.ttf",
    bolditalics: "Arial_Bold_Italic.ttf",
  },
};

const JENIS_KELAMIN: Record<string, string> = { Male: "Laki-laki", Female: "Perempuan", L: "Laki-laki", P: "Perempuan" };
const WARNA_SIR: Record<string, string> = { S: "#027A48", I: "#B54708", R: "#D92D20" };
const NAMA_SIR: Record<string, string> = { S: "Sensitif", I: "Intermediet", R: "Resisten" };

const kop = (judul: string, lebar: number) => {
  const profil = profilFaskes.value ?? {};
  const logo = gambarPdfValid(logoFaskes()) ? logoFaskes() : null;
  const teks = {
    width: "*",
    alignment: logo ? "left" : "center",
    stack: [
      { text: profil?.name ?? "-", bold: true, fontSize: 15 },
      { text: profil?.address?.fullAddress ?? "", margin: [0, 2, 0, 0] },
      { text: [profil?.phone, profil?.email].filter(Boolean).join(" · ") },
    ],
  };
  return [
    logo ? { columns: [{ image: logo, fit: [90, 45], width: 100 }, teks], columnGap: 10 } : teks,
    { canvas: [{ type: "line", x1: 0, y1: 4, x2: lebar, y2: 4, lineWidth: 1.5, lineColor: warnaTema("300") }], margin: [0, 4, 0, 8] },
    { text: judul, bold: true, fontSize: 12, alignment: "center", margin: [0, 0, 0, 8] },
  ];
};

const identitas = (order: any) => {
  const p = order?.pasien ?? {};
  const kiri: [string, string][] = [
    ["Nama Pasien", p.name ?? order?.namaPasien ?? "-"],
    ["No. RM", order?.noRm ?? p.noRm ?? "-"],
    ["Jenis Kelamin", JENIS_KELAMIN[p.gender ?? order?.gender] ?? p.gender ?? "-"],
    ["Tgl. Lahir / Umur", `${p.birthDate ? waktuMikro(Date.parse(p.birthDate) / 1000, true) : "-"} / ${umurMikro(p.birthDate ?? order?.birthDate)}`],
  ];
  const kanan: [string, string][] = [
    ["No. Order", `${order?.noOrder ?? "-"}${order?.cito ? "  (CITO)" : ""}`],
    ["Tgl. Order", waktuMikro(order?.createdAt)],
    [
      "Asal / Pelayanan",
      order?.sumber === "aps"
        ? `APS / rujukan luar${order?.lokasiAsal ? ` · ${order.lokasiAsal}` : ""}`
        : `${SUMBER_MIKRO[order?.sumber] ?? "-"} · ${order?.lokasiAsal ?? PELAYANAN_MIKRO[order?.pelayanan] ?? "-"}${order?.noReg ? ` (${order.noReg})` : ""}`,
    ],
    ["Dokter Pengirim", order?.dokterPengirim ?? "-"],
  ];
  return {
    columns: [kiri, kanan].map((baris) => ({
      width: "*",
      table: { widths: [85, "*"], body: baris.map(([l, n]) => [{ text: l }, { text: `: ${n ?? "-"}` }]) },
      layout: "noBorders",
    })),
    columnGap: 10,
  };
};

const klinis = (order: any) => [
  order?.klinis ? { text: [{ text: "Keterangan klinis: ", bold: true }, order.klinis], margin: [0, 6, 0, 0] } : {},
  order?.antibiotikSedang ? { text: [{ text: "Antibiotik yang sedang diberikan: ", bold: true }, order.antibiotikSedang], margin: [0, 2, 0, 0] } : {},
];

const kaki = (halaman: number, total: number) => ({
  columns: [
    { text: `Dicetak: ${waktuMikro(Math.floor(Date.now() / 1000))}`, fontSize: 7, color: "#667085" },
    { text: `Hal. ${halaman}/${total}`, alignment: "right", fontSize: 7, color: "#667085" },
  ],
  margin: [40, 15, 40, 0],
});

const dokumen = (content: any[], namaBerkas: string, tambahan: Record<string, any> = {}) =>
  bukaPdf(
    {
      info: { title: namaBerkas },
      pageSize: "A4",
      pageMargins: [40, 35, 40, 50],
      defaultStyle: { font: "Arial", fontSize: 9 },
      footer: kaki,
      content,
      ...tambahan,
    },
    namaBerkas,
  );

// ── Bukti order (pasien / kasir / petugas pengambil spesimen)
export function createBuktiOrderMikroPdf(order: any) {
  const items = order?.items ?? [];
  dokumen(
    [
      ...kop("BUKTI ORDER PEMERIKSAAN MIKROBIOLOGI", 515),
      identitas(order),
      ...klinis(order),
      {
        margin: [0, 10, 0, 0],
        table: {
          headerRows: 1,
          widths: [18, 50, "*", 120, 30, 70],
          body: [
            ["No", "Kode", "Pemeriksaan", "Spesimen", "TAT", "Tarif"].map((h) => ({ text: h, bold: true, fillColor: warnaTema("50") })),
            ...items.map((i: any, n: number) => [
              String(n + 1),
              i.kode ?? "-",
              i.nama,
              `${namaSpesimen(i.jenisSpesimen)}${i.lokasiSpesimen ? `\n${i.lokasiSpesimen}` : ""}`,
              i.tatHari != null ? `${i.tatHari} hr` : "-",
              { text: rupiahMikro(i.harga), alignment: "right" },
            ]),
            [{ text: "Total", bold: true, colSpan: 5, alignment: "right" }, "", "", "", "", { text: rupiahMikro(order?.total), bold: true, alignment: "right" }],
          ],
        },
        layout: "lightHorizontalLines",
      },
      {
        text: "Spesimen diambil sebelum pemberian antibiotik bila memungkinkan, dalam wadah steril, berlabel identitas lengkap, dan dikirim ke laboratorium ≤ 2 jam (darah: botol kultur, suhu ruang).",
        italics: true,
        color: "#475467",
        margin: [0, 8, 0, 0],
      },
      {
        text: `Status: ${String(order?.status ?? "-").toUpperCase()}${order?.divalidasiPada ? ` · divalidasi ${waktuMikro(order.divalidasiPada)} oleh ${order.divalidasiOleh ?? "-"}` : ""}`,
        margin: [0, 8, 0, 0],
        color: "#475467",
      },
      {
        columns: [
          { text: "", width: "*" },
          { width: 190, alignment: "center", stack: [{ text: "Petugas Mikrobiologi", margin: [0, 0, 0, 35] }, { text: order?.divalidasiOleh ?? order?.dibuatOleh ?? "( .................... )", bold: true }] },
        ],
        margin: [0, 16, 0, 0],
      },
    ],
    `Order ${order?.noOrder ?? ""}`,
  );
}

// ── Hasil pemeriksaan per item (spesimen)
const baris2 = (label: string, nilai?: string | null) => (nilai ? [{ text: label, color: "#475467" }, { text: nilai }] : null);

const blokItem = (i: any, n: number) => {
  const h = i.hasil ?? {};
  const final = h.status === "final";
  const gram = (h.gramTemuan ?? []).map((g: any) => [g.jumlah, g.sifat ? `Gram ${g.sifat}` : "", g.bentuk, g.susunan].filter(Boolean).join(" "));
  const pewarnaan = [
    baris2("Jenis", h.pewarnaanJenis ? PEWARNAAN_MIKRO[h.pewarnaanJenis] ?? h.pewarnaanJenis : null),
    baris2("Temuan", gram.length ? gram.join("; ") : null),
    baris2("Leukosit (PMN)", h.selLeukosit),
    baris2("Sel epitel", h.selEpitel),
    baris2("Keterangan", h.hasilPewarnaan),
  ].filter(Boolean) as any[];
  const kultur = [
    baris2("Hasil kultur", h.kulturStatus ? KULTUR_MIKRO[h.kulturStatus] ?? h.kulturStatus : null),
    baris2("Media", h.media),
    baris2("Lama inkubasi", h.lamaInkubasiJam ? `${h.lamaInkubasiJam} jam` : null),
    baris2("Keterangan", h.keteranganKultur),
  ].filter(Boolean) as any[];
  const tabelInfo = (judul: string, isi: any[]) =>
    isi.length
      ? [
          { text: judul, bold: true, margin: [0, 6, 0, 2] },
          { table: { widths: [90, "*"], body: isi }, layout: "noBorders" },
        ]
      : [];

  const isolat = (h.isolat ?? []).flatMap((x: any, k: number) => {
    const kp = (x.kepekaan ?? []).filter((r: any) => r.dilaporkan !== false);
    const penanda = (x.penanda ?? []).filter(Boolean);
    return [
      {
        margin: [0, 8, 0, 2],
        text: [
          { text: `Isolat ${k + 1}: `, bold: true },
          { text: x.namaOrganisme, bold: true, italics: true },
          x.jumlahKoloni ? `  —  ${x.jumlahKoloni}` : "",
          x.gram ? `  (${GRAM_MIKRO[x.gram] ?? x.gram})` : "",
        ],
      },
      penanda.length
        ? {
            text: [{ text: "Penanda resistensi: ", bold: true }, ...penanda.map((p: string, m: number) => ({ text: `${m ? ", " : ""}${p} (${PENANDA_MIKRO[p] ?? p})`, bold: true, color: "#D92D20" }))],
            margin: [0, 0, 0, 2],
          }
        : {},
      x.catatan ? { text: x.catatan, italics: true, color: "#475467", margin: [0, 0, 0, 2] } : {},
      kp.length
        ? {
            table: {
              headerRows: 1,
              widths: [18, "*", 120, 55, 50, 70],
              body: [
                ["No", "Antibiotik", "Golongan", "MIC (µg/mL)", "Zona (mm)", "Interpretasi"].map((t) => ({ text: t, bold: true, fillColor: warnaTema("50") })),
                ...kp.map((r: any, m: number) => [
                  String(m + 1),
                  `${r.nama}${r.kode ? ` (${r.kode})` : ""}`,
                  r.golongan ?? "-",
                  { text: r.mic ?? "-", alignment: "center" },
                  { text: r.zona != null ? String(r.zona) : "-", alignment: "center" },
                  r.interpretasi
                    ? { text: `${r.interpretasi} — ${NAMA_SIR[r.interpretasi]}`, bold: true, color: WARNA_SIR[r.interpretasi] }
                    : { text: "-", color: "#667085" },
                ]),
              ],
            },
            layout: "lightHorizontalLines",
          }
        : { text: "Uji kepekaan tidak dilakukan / tidak dilaporkan.", italics: true, color: "#475467" },
    ];
  });

  const tandaTangan = final
    ? {
        columns: [
          {
            width: "*",
            color: "#475467",
            fontSize: 8,
            stack: [
              { text: `Diterima: ${waktuMikro(i.waktuTerima)}${i.waktuAmbil ? ` · Diambil: ${waktuMikro(i.waktuAmbil)}` : ""}` },
              h.sementaraPada ? { text: `Laporan sementara: ${waktuMikro(h.sementaraPada)}` } : {},
              { text: `Sumber data: ${h.sumber === "lis" ? "LIS / alat" : "input manual"}` },
            ],
          },
          {
            width: 200,
            alignment: "center",
            stack: [
              { text: `Diverifikasi: ${waktuMikro(h.diverifikasiPada)}` },
              { text: "Dokter Spesialis Mikrobiologi Klinik", margin: [0, 2, 0, 4] },
              {
                qr: `Hasil mikrobiologi ${i.noMikro ?? ""} (${i.nama}) diverifikasi oleh ${h.dokterMikro ?? "-"} pada ${waktuMikro(h.diverifikasiPada)}`,
                fit: 60,
                alignment: "center",
              },
              { text: h.dokterMikro ?? "-", bold: true, margin: [0, 4, 0, 0] },
            ],
          },
        ],
        margin: [0, 8, 0, 0],
        unbreakable: true,
      }
    : {
        columns: [
          { width: "*", text: `Diterima: ${waktuMikro(i.waktuTerima)}`, color: "#475467", fontSize: 8 },
          {
            width: 200,
            alignment: "center",
            stack: [
              { text: `Laporan sementara: ${waktuMikro(h.sementaraPada)}` },
              { text: "Petugas Laboratorium Mikrobiologi", margin: [0, 2, 0, 25] },
              { text: h.sementaraOleh ?? "-", bold: true },
              { text: "Belum diverifikasi — hasil dapat berubah", italics: true, color: "#D92D20", fontSize: 8 },
            ],
          },
        ],
        margin: [0, 8, 0, 0],
        unbreakable: true,
      };

  return [
    {
      margin: [0, n ? 16 : 10, 0, 4],
      table: {
        widths: ["*", "auto"],
        body: [
          [
            { text: `${i.nama}${i.kode ? ` (${i.kode})` : ""}`, bold: true, fillColor: warnaTema("50") },
            { text: final ? "FINAL" : "SEMENTARA", bold: true, color: final ? "#027A48" : "#D92D20", fillColor: warnaTema("50") },
          ],
        ],
      },
      layout: "noBorders",
    },
    {
      text: [
        { text: "Spesimen: ", bold: true },
        `${namaSpesimen(i.jenisSpesimen)}${i.lokasiSpesimen ? ` — ${i.lokasiSpesimen}` : ""}`,
        { text: "   No. Mikro: ", bold: true },
        i.noMikro ?? "-",
      ],
    },
    ...tabelInfo("Pewarnaan / Mikroskopis", pewarnaan),
    ...tabelInfo("Kultur", kultur),
    h.hasilTeks ? [{ text: "Hasil", bold: true, margin: [0, 6, 0, 2] }, { text: h.hasilTeks, lineHeight: 1.2 }] : {},
    !final && h.laporanSementara
      ? { margin: [0, 6, 0, 0], table: { widths: ["*"], body: [[{ text: [{ text: "Laporan sementara: ", bold: true }, h.laporanSementara], fillColor: "#FEF3F2" }]] }, layout: "noBorders" }
      : {},
    ...isolat,
    (h.isolat ?? []).some((x: any) => (x.kepekaan ?? []).length)
      ? { text: "S = Sensitif, I = Intermediet, R = Resisten. Interpretasi mengacu breakpoint yang berlaku di laboratorium (CLSI/EUCAST).", fontSize: 7, color: "#667085", margin: [0, 2, 0, 0] }
      : {},
    h.kesimpulan ? { text: [{ text: "Kesimpulan: ", bold: true }, h.kesimpulan], margin: [0, 6, 0, 0] } : {},
    h.catatan ? { text: [{ text: "Catatan: ", bold: true }, h.catatan], margin: [0, 2, 0, 0] } : {},
    tandaTangan,
  ];
};

// Hasil pemeriksaan. `itemUuid` = cetak satu spesimen; kosong = semua item yang sudah sementara/final.
// Bila ada item yang belum final, dokumen bertanda "LAPORAN SEMENTARA" (judul + watermark).
export function createHasilMikroPdf(order: any, itemUuid?: string) {
  const items = (order?.items ?? []).filter(
    (i: any) => ["sementara", "final"].includes(i.hasil?.status) && (!itemUuid || i.uuid === itemUuid),
  );
  const sementara = items.some((i: any) => i.hasil?.status !== "final");
  dokumen(
    [
      ...kop(sementara ? "LAPORAN SEMENTARA HASIL PEMERIKSAAN MIKROBIOLOGI" : "HASIL PEMERIKSAAN MIKROBIOLOGI KLINIK", 515),
      identitas(order),
      ...klinis(order),
      ...(items.length ? items.flatMap(blokItem) : [{ text: "Belum ada hasil (laporan sementara/final) untuk dicetak.", italics: true, margin: [0, 12, 0, 0] }]),
    ],
    `${sementara ? "Hasil Sementara" : "Hasil"} Mikrobiologi ${order?.noOrder ?? ""}`,
    sementara ? { watermark: { text: "SEMENTARA", color: "#D92D20", opacity: 0.08, bold: true } } : {},
  );
}

// ── Antibiogram kumulatif (A4 lanskap). Tabel per kelompok Gram; sel = %S (n diuji) dengan warna
// ≥ 90% hijau, 60–89% kuning, < 60% merah. Organisme < 30 isolat diberi tanda *.
export function createAntibiogramMikroPdf(data: any, keteranganFilter: string) {
  const ab: any[] = data?.antibiotik ?? [];
  const organisme: any[] = data?.organisme ?? [];
  const warna = (p: number) => (p >= 90 ? "#D1FADF" : p >= 60 ? "#FEF0C7" : "#FEE4E2");
  const grup = [
    ["negatif", "Gram negatif"],
    ["positif", "Gram positif"],
    ["jamur", "Jamur"],
    ["lain", "Lainnya"],
  ].map(([kode, nama]) => ({ nama, baris: organisme.filter((o) => (kode === "lain" ? !["negatif", "positif", "jamur"].includes(o.gram) : o.gram === kode)) }));
  const tabel = grup
    .filter((g) => g.baris.length)
    .flatMap((g) => {
      const kolom = ab.filter((a) => g.baris.some((o) => o.kepekaan?.[a.uuid]));
      return [
        { text: g.nama, bold: true, margin: [0, 8, 0, 3] },
        {
          table: {
            headerRows: 1,
            widths: [130, 22, ...kolom.map(() => "*")],
            body: [
              [
                { text: "Organisme", bold: true, fillColor: warnaTema("50") },
                { text: "n", bold: true, alignment: "center", fillColor: warnaTema("50") },
                ...kolom.map((a) => ({ text: a.kode, bold: true, alignment: "center", fontSize: 6.5, fillColor: warnaTema("50") })),
              ],
              ...g.baris.map((o) => [
                { text: `${o.nama}${o.cukup ? "" : " *"}`, italics: true },
                { text: String(o.jumlahIsolat), alignment: "center" },
                ...kolom.map((a) => {
                  const s = o.kepekaan?.[a.uuid];
                  return s
                    ? { text: [{ text: `${s.persenS}`, bold: true }, { text: `\n(${s.diuji})`, fontSize: 5.5, color: "#475467" }], alignment: "center", fillColor: warna(s.persenS) }
                    : { text: "", alignment: "center" };
                }),
              ]),
            ],
          },
          layout: { hLineColor: () => "#D0D5DD", vLineColor: () => "#D0D5DD", hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
          fontSize: 7,
        },
      ];
    });
  bukaPdf(
    {
      info: { title: "Antibiogram" },
      pageSize: "A4",
      pageOrientation: "landscape",
      pageMargins: [30, 30, 30, 40],
      defaultStyle: { font: "Arial", fontSize: 8 },
      footer: (h: number, t: number) => ({ ...kaki(h, t), margin: [30, 12, 30, 0] }),
      content: [
        ...kop("ANTIBIOGRAM KUMULATIF — PERSENTASE SENSITIF (%S)", 782),
        { text: keteranganFilter, alignment: "center", color: "#475467", margin: [0, 0, 0, 4] },
        ...(tabel.length ? tabel : [{ text: "Tidak ada isolat final pada periode ini.", italics: true, margin: [0, 10, 0, 0] }]),
        {
          margin: [0, 8, 0, 0],
          fontSize: 7,
          color: "#475467",
          stack: [
            { text: `Total ${data?.totalIsolat ?? 0} isolat${data?.isolatPertama ? " (isolat pertama per pasien per spesies dalam periode, CLSI M39)" : ""}. Angka = %S, (n) = jumlah isolat diuji.` },
            { text: `* Kurang dari ${data?.minimalIsolat ?? 30} isolat — persentase kurang dapat diandalkan secara statistik.` },
            { text: `Kode antibiotik (WHONET): ${ab.map((a) => `${a.kode} = ${a.nama}`).join("; ")}` },
          ],
        },
      ],
    },
    "Antibiogram",
  );
}
