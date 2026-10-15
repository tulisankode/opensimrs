import pdfMake from "pdfmake/build/pdfmake";
import { customVfs } from "@/utils/customVfs";
import { logoFaskes, profilFaskes, warnaTema } from "@/utils/tema";
import { bukaPdf, gambarPdfValid } from "@/utils/pdf/bukaPdf";
import { MODALITAS_RAD, PELAYANAN_RAD, SUMBER_RAD, rupiahRad, umurRad, waktuRad } from "@/stores/penunjang/radiologi";

// Cetakan modul Radiologi (A4): bukti order dan hasil pemeriksaan (expertise dokter Sp.Rad).
// `order` = payload detail order (GET /radiologi/order/:uuid, camelCase) termasuk `items` & `pasien`.

pdfMake.vfs = customVfs.pdfMake.vfs;
pdfMake.fonts = {
  Arial: {
    normal: "Arial.ttf",
    bold: "Arial_Bold.ttf",
    italics: "Arial_Italic.ttf",
    bolditalics: "Arial_Bold_Italic.ttf",
  },
};

const LEBAR = 595 - 80;
const JENIS_KELAMIN: Record<string, string> = { Male: "Laki-laki", Female: "Perempuan", L: "Laki-laki", P: "Perempuan" };

const kop = (judul: string) => {
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
    { canvas: [{ type: "line", x1: 0, y1: 4, x2: LEBAR, y2: 4, lineWidth: 1.5, lineColor: warnaTema("300") }], margin: [0, 4, 0, 8] },
    { text: judul, bold: true, fontSize: 12, alignment: "center", margin: [0, 0, 0, 8] },
  ];
};

const identitas = (order: any) => {
  const p = order?.pasien ?? {};
  const kiri: [string, string][] = [
    ["Nama Pasien", p.name ?? order?.namaPasien ?? "-"],
    ["No. RM", order?.noRm ?? p.noRm ?? "-"],
    ["Jenis Kelamin", JENIS_KELAMIN[p.gender ?? order?.gender] ?? p.gender ?? "-"],
    ["Tgl. Lahir / Umur", `${p.birthDate ? waktuRad(Date.parse(p.birthDate) / 1000, true) : "-"} / ${umurRad(p.birthDate ?? order?.birthDate)}`],
  ];
  const kanan: [string, string][] = [
    ["No. Order", `${order?.noOrder ?? "-"}${order?.cito ? "  (CITO)" : ""}`],
    ["Tgl. Order", waktuRad(order?.createdAt)],
    ["Asal / Pelayanan", `${SUMBER_RAD[order?.sumber] ?? "-"} · ${order?.lokasiAsal ?? PELAYANAN_RAD[order?.pelayanan] ?? "-"}${order?.noReg ? ` (${order.noReg})` : ""}`],
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

const kaki = (halaman: number, total: number) => ({
  columns: [
    { text: `Dicetak: ${waktuRad(Math.floor(Date.now() / 1000))}`, fontSize: 7, color: "#667085" },
    { text: `Hal. ${halaman}/${total}`, alignment: "right", fontSize: 7, color: "#667085" },
  ],
  margin: [40, 15, 40, 0],
});

const buka = (content: any[], namaBerkas: string) =>
  bukaPdf(
    {
      info: { title: namaBerkas },
      pageSize: "A4",
      pageMargins: [40, 35, 40, 50],
      defaultStyle: { font: "Arial", fontSize: 9 },
      footer: kaki,
      content,
    },
    namaBerkas,
  );

// Bukti order radiologi (untuk pasien / dibawa ke kasir & ruang pemeriksaan).
export function createBuktiOrderRadPdf(order: any) {
  const items = order?.items ?? [];
  buka(
    [
      ...kop("BUKTI ORDER PEMERIKSAAN RADIOLOGI"),
      identitas(order),
      order?.klinis ? { text: [{ text: "Keterangan klinis: ", bold: true }, order.klinis], margin: [0, 8, 0, 0] } : {},
      order?.catatan ? { text: [{ text: "Catatan: ", bold: true }, order.catatan], margin: [0, 4, 0, 0] } : {},
      {
        margin: [0, 10, 0, 0],
        table: {
          headerRows: 1,
          widths: [20, 60, "*", 80, 80],
          body: [
            ["No", "Kode", "Pemeriksaan", "Modalitas", "Tarif"].map((h) => ({ text: h, bold: true, fillColor: warnaTema("50") })),
            ...items.map((i: any, n: number) => [
              String(n + 1),
              i.kode ?? "-",
              i.nama,
              MODALITAS_RAD[i.modalitas] ?? i.modalitas ?? "-",
              { text: order?.tanpaTagihan ? "-" : rupiahRad(i.harga), alignment: "right" },
            ]),
            [
              { text: "Total", bold: true, colSpan: 4, alignment: "right" },
              "",
              "",
              "",
              { text: order?.tanpaTagihan ? "Paket MCU" : rupiahRad(order?.total), bold: true, alignment: "right" },
            ],
          ],
        },
        layout: "lightHorizontalLines",
      },
      {
        text: `Status: ${String(order?.status ?? "-").toUpperCase()}${order?.divalidasiPada ? ` · divalidasi ${waktuRad(order.divalidasiPada)} oleh ${order.divalidasiOleh ?? "-"}` : ""}`,
        margin: [0, 10, 0, 0],
        color: "#475467",
      },
      {
        columns: [
          { text: "", width: "*" },
          { width: 190, alignment: "center", stack: [{ text: "Petugas Radiologi", margin: [0, 0, 0, 35] }, { text: order?.divalidasiOleh ?? order?.dibuatOleh ?? "( .................... )", bold: true }] },
        ],
        margin: [0, 20, 0, 0],
      },
    ],
    `Order ${order?.noOrder ?? ""}`
  );
}

// Hasil pemeriksaan radiologi. `itemUuid` diisi untuk mencetak satu pemeriksaan; kosong = semua item selesai.
export function createHasilRadPdf(order: any, itemUuid?: string) {
  const items = (order?.items ?? []).filter((i: any) => i.status === "selesai" && (!itemUuid || i.uuid === itemUuid));
  const blok = items.flatMap((i: any, n: number) => {
    const gambar = (i.lampiran ?? []).filter((l: any) => gambarPdfValid(l?.data));
    return [
      {
        margin: [0, n ? 14 : 10, 0, 4],
        table: {
          widths: ["*"],
          body: [[{ text: `${i.nama}${i.kode ? ` (${i.kode})` : ""} — ${MODALITAS_RAD[i.modalitas] ?? i.modalitas ?? ""}`, bold: true, fillColor: warnaTema("50") }]],
        },
        layout: "noBorders",
      },
      { text: "Yth. Teman Sejawat, berikut hasil pemeriksaan radiologi:", italics: true, color: "#475467", margin: [0, 0, 0, 4] },
      { text: "Hasil / Uraian:", bold: true },
      { text: i.hasil ?? "-", margin: [0, 2, 0, 6], lineHeight: 1.2 },
      { text: "Kesan:", bold: true },
      { text: i.kesan ?? "-", bold: true, margin: [0, 2, 0, 6] },
      ...(gambar.length
        ? [{ columns: gambar.slice(0, 3).map((g: any) => ({ image: g.data, fit: [160, 130], width: "auto" })), columnGap: 8, margin: [0, 4, 0, 6] }]
        : []),
      {
        columns: [
          { text: `Radiografer: ${i.radiografer ?? "-"} · Diperiksa: ${waktuRad(i.waktuPeriksa)}`, color: "#475467", fontSize: 8, width: "*" },
          {
            width: 190,
            alignment: "center",
            stack: [
              { text: `Dibaca: ${waktuRad(i.waktuHasil)}` },
              { text: "Dokter Spesialis Radiologi", margin: [0, 2, 0, 35] },
              { text: i.dokterRadiologi ?? "-", bold: true },
            ],
          },
        ],
        margin: [0, 6, 0, 0],
        unbreakable: true,
      },
    ];
  });
  buka(
    [
      ...kop("HASIL PEMERIKSAAN RADIOLOGI"),
      identitas(order),
      order?.klinis ? { text: [{ text: "Keterangan klinis: ", bold: true }, order.klinis], margin: [0, 8, 0, 0] } : {},
      ...(blok.length ? blok : [{ text: "Belum ada hasil pemeriksaan yang selesai.", italics: true, margin: [0, 12, 0, 0] }]),
    ],
    `Hasil Radiologi ${order?.noOrder ?? ""}`
  );
}

const tglPanjang = (iso?: string | null) => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
};
const antrean = (kode?: string | null, n?: number | null) => (n ? `${kode ?? ""}-${String(n).padStart(3, "0")}` : "-");

// Slip jadwal / nomor antrean pemeriksaan (A5) untuk pasien: ruang, tanggal & jam, pemeriksaan + persiapan.
// `jadwal` = baris GET /radiologi/jadwal/:uuid (camelCase) termasuk `items` (dengan persiapan).
export function createSlipJadwalRadPdf(jadwal: any) {
  const items = jadwal?.items ?? [];
  const persiapan = items.filter((i: any) => i.persiapan);
  const baris: [string, string][] = [
    ["Nama Pasien", `${jadwal?.namaPasien ?? "-"}`],
    ["No. RM", jadwal?.noRm ?? "-"],
    ["No. Order", `${jadwal?.noOrder ?? "-"}${jadwal?.cito ? "  (CITO)" : ""}`],
    ["Ruang / Alat", `${jadwal?.ruang ?? "-"}${jadwal?.namaAlat ? ` (${jadwal.namaAlat})` : ""}`],
    ["Tanggal", tglPanjang(jadwal?.tanggal)],
    ["Jam", `${jadwal?.jamMulai ?? "-"} – ${jadwal?.jamSelesai ?? "-"} WIB`],
  ];
  bukaPdf(
    {
      info: { title: `Jadwal ${jadwal?.noOrder ?? ""}` },
      pageSize: "A5",
      pageMargins: [30, 28, 30, 36],
      defaultStyle: { font: "Arial", fontSize: 9 },
      footer: kaki,
      content: [
        ...kop("JADWAL PEMERIKSAAN RADIOLOGI").map((k: any) => (k?.canvas ? { ...k, canvas: [{ ...k.canvas[0], x2: 420 - 60 }] } : k)),
        jadwal?.noAntrean
          ? { text: [{ text: "No. Antrean  " }, { text: antrean(jadwal.ruangKode, jadwal.noAntrean), bold: true, fontSize: 20 }], alignment: "center", margin: [0, 0, 0, 8] }
          : {},
        { table: { widths: [80, "*"], body: baris.map(([l, n]) => [{ text: l }, { text: `: ${n}`, bold: l === "Jam" || l === "Tanggal" }]) }, layout: "noBorders" },
        { text: "Pemeriksaan:", bold: true, margin: [0, 8, 0, 2] },
        { ul: items.map((i: any) => `${i.nama}${i.kode ? ` (${i.kode})` : ""}`) },
        persiapan.length
          ? [
              { text: "Persiapan pasien:", bold: true, margin: [0, 8, 0, 2] },
              { ul: persiapan.map((i: any) => ({ text: [{ text: `${i.nama}: `, bold: true }, i.persiapan] })) },
            ]
          : {},
        jadwal?.catatan ? { text: [{ text: "Catatan: ", bold: true }, jadwal.catatan], margin: [0, 6, 0, 0] } : {},
        {
          text: "Harap datang 15 menit sebelum jadwal dan melapor ke petugas radiologi dengan membawa slip ini. Wanita usia subur wajib memberi tahu petugas bila sedang/mungkin hamil.",
          italics: true,
          color: "#475467",
          margin: [0, 10, 0, 0],
        },
      ],
    },
    `Jadwal ${jadwal?.noOrder ?? ""}`
  );
}

// Daftar jadwal/antrean pemeriksaan per ruang pada satu tanggal (A4) untuk radiografer.
// `ruang` = payload papan (GET /radiologi/jadwal/papan) → ruang[].slot[].jadwal + ruang[].diLuarSlot.
export function createDaftarJadwalRadPdf(tanggal: string, ruang: any[]) {
  const blok = ruang
    .map((r) => {
      const jadwal = [...(r.slot ?? []).map((s: any) => s.jadwal).filter(Boolean), ...(r.diLuarSlot ?? [])]
        .filter((j: any, n: number, a: any[]) => a.findIndex((x) => x.uuid === j.uuid) === n)
        .sort((a: any, b: any) => String(a.jamMulai).localeCompare(String(b.jamMulai)));
      return { r, jadwal };
    })
    .filter((x) => x.jadwal.length);
  const STATUS: Record<string, string> = { terjadwal: "Terjadwal", hadir: "Hadir", diperiksa: "Diperiksa", batal: "Batal" };
  buka(
    [
      ...kop(`JADWAL PEMERIKSAAN RADIOLOGI — ${tglPanjang(tanggal).toUpperCase()}`),
      ...(blok.length
        ? blok.flatMap(({ r, jadwal }, n) => [
            { text: `${r.nama}${r.namaAlat ? ` · ${r.namaAlat}` : ""}  (${r.jamBuka}–${r.jamTutup})`, bold: true, margin: [0, n ? 12 : 4, 0, 4] },
            {
              table: {
                headerRows: 1,
                widths: [55, 50, "*", "*", 60, 55],
                body: [
                  ["Jam", "Antrean", "Pasien", "Pemeriksaan", "Asal", "Status"].map((h) => ({ text: h, bold: true, fillColor: warnaTema("50") })),
                  ...jadwal.map((j: any) => [
                    `${j.jamMulai}–${j.jamSelesai}`,
                    antrean(j.ruangKode, j.noAntrean),
                    { text: [{ text: j.namaPasien ?? "-", bold: true }, `\n${j.noRm ?? ""} · ${j.noOrder ?? ""}${j.cito ? " · CITO" : ""}`] },
                    (j.items ?? []).map((i: any) => i.nama).join(", "),
                    j.sumber === j.pelayanan ? SUMBER_RAD[j.sumber] ?? "-" : `${SUMBER_RAD[j.sumber] ?? "-"} · ${PELAYANAN_RAD[j.pelayanan] ?? "-"}`,
                    STATUS[j.status] ?? j.status,
                  ]),
                ],
              },
              layout: "lightHorizontalLines",
            },
          ])
        : [{ text: "Tidak ada jadwal pemeriksaan pada tanggal ini.", italics: true, margin: [0, 10, 0, 0] }]),
    ],
    `Jadwal Radiologi ${tanggal}`
  );
}
