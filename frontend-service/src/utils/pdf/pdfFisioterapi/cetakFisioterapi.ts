// Cetakan Fisioterapi / Rehabilitasi Medik (pdfmake, A4):
// - Jadwal Kunjungan Terapi: identitas pasien + daftar sesi terjadwal (untuk dibawa pasien).
// - Asuhan Terapi: order, tindakan, dan evaluasi rehab medik per sesi (SOAP, fase, inform consent).
import pdfMake from "pdfmake/build/pdfmake";
import { bukaPdf, gambarPdfValid } from "@/utils/pdf/bukaPdf";
import { customVfs } from "@/utils/customVfs";
import { warnaTema, logoFaskes } from "@/utils/tema";
import { labelJam, labelJenis, labelGender, tglIndo, umur, waktuEpoch, rupiah, STATUS_JADWAL, SUMBER_ORDER, type OrderFisio } from "@/stores/penunjang/fisioterapi";

pdfMake.vfs = customVfs.pdfMake.vfs;
pdfMake.fonts = {
  Arial: { normal: "Arial.ttf", bold: "Arial_Bold.ttf", italics: "Arial_Italic.ttf", bolditalics: "Arial_Bold_Italic.ttf" },
};

const LEBAR = 595 - 80;

const profil = () => {
  try {
    return JSON.parse(localStorage.getItem("faskes_profile") ?? "{}") ?? {};
  } catch {
    return {};
  }
};

const kop = (judul: string) => {
  const p = profil();
  const logo = gambarPdfValid(logoFaskes()) ? logoFaskes() : null;
  return [
    {
      columns: [
        logo ? { image: logo, fit: [70, 45], width: 70 } : { text: "", width: 70 },
        {
          width: "*",
          alignment: "center",
          stack: [
            { text: p?.name ?? "-", bold: true, fontSize: 14 },
            { text: p?.address?.fullAddress ?? "", margin: [0, 2, 0, 0] },
            { text: [p?.phone, p?.email].filter(Boolean).join(" · ") },
          ],
        },
        { text: "", width: 70 },
      ],
    },
    { canvas: [{ type: "line", x1: 0, y1: 4, x2: LEBAR, y2: 4, lineWidth: 1.2, lineColor: warnaTema("300") }], margin: [0, 2, 0, 8] },
    { text: judul, bold: true, fontSize: 12, alignment: "center", color: warnaTema("400"), margin: [0, 0, 0, 8] },
  ];
};

const identitas = (o: OrderFisio) => ({
  columns: [
    [
      ["Nama Pasien", o.namaPasien],
      ["No. RM", o.noRm],
      ["Jenis Kelamin", labelGender(o.gender)],
      ["Tgl. Lahir / Umur", `${tglIndo(o.tanggalLahir)} / ${umur(o.tanggalLahir)}`],
    ],
    [
      ["No. Order", o.noOrder],
      ["Jenis Fisioterapi", labelJenis(o.jenisFisio)],
      ["Asal Order", `${SUMBER_ORDER[o.sumber] ?? o.sumber}${o.noReg ? ` (${o.noReg})` : ""}`],
      ["Dokter Pengirim", o.dokterPengirim ?? "-"],
    ],
  ].map((baris) => ({
    width: "*",
    table: { widths: [85, "*"], body: baris.map(([l, v]) => [{ text: l }, { text: `: ${v ?? "-"}` }]) },
    layout: "noBorders",
  })),
  columnGap: 10,
});

const kepala = (teks: string[]) => teks.map((t) => ({ text: t, bold: true, fillColor: warnaTema("50") }));

const kaki = () => (hal: number, total: number) => ({
  columns: [
    { text: `Dicetak: ${waktuEpoch(Math.floor(Date.now() / 1000))}`, fontSize: 7, color: "#667085" },
    { text: `Hal. ${hal}/${total}`, alignment: "right", fontSize: 7, color: "#667085" },
  ],
  margin: [40, 15, 40, 0],
});

const tandaTangan = (kiri: string, kanan: string) => ({
  margin: [0, 24, 0, 0],
  columns: [
    { width: "*", alignment: "center", stack: [{ text: kiri }, { text: "\n\n\n(.................................)" }] },
    { width: "*", alignment: "center", stack: [{ text: kanan }, { text: "\n\n\n(.................................)" }] },
  ],
});

// Jadwal Kunjungan Terapi (detail order lengkap dengan `jadwal`).
export function cetakJadwalTerapi(o: OrderFisio) {
  const jadwal = (o.jadwal ?? []).filter((j) => j.status !== "batal");
  bukaPdf(
    {
      pageSize: "A4",
      pageMargins: [40, 35, 40, 50],
      defaultStyle: { font: "Arial", fontSize: 9 },
      footer: kaki(),
      content: [
        ...kop("JADWAL KUNJUNGAN TERAPI"),
        identitas(o),
        { text: `Tindakan: ${o.tindakanRingkas ?? "-"}  ·  Jumlah sesi: ${o.jumlahSesi}`, margin: [0, 8, 0, 0] },
        {
          margin: [0, 8, 0, 0],
          table: {
            headerRows: 1,
            widths: [35, "*", 80, "*", 60, 70],
            body: [
              kepala(["Sesi", "Hari, Tanggal", "Jam", "Bed / Ruangan", "Status", "Paraf Terapis"]),
              ...(jadwal.length
                ? jadwal.map((j) => [
                    { text: String(j.sesiKe ?? "-"), alignment: "center" },
                    tglIndo(j.tanggal, true),
                    labelJam(j.jamSlot),
                    `${j.bed ?? "-"}${j.ruangan ? ` / ${j.ruangan}` : ""}`,
                    STATUS_JADWAL[j.status]?.label ?? j.status,
                    "",
                  ])
                : [[{ text: "Belum ada sesi terjadwal", colSpan: 6, alignment: "center", italics: true }, "", "", "", "", ""]]),
            ],
          },
          layout: "lightHorizontalLines",
        },
        {
          margin: [0, 12, 0, 0],
          fontSize: 8,
          color: "#475467",
          ul: [
            "Mohon hadir 10 menit sebelum jam terapi dimulai dan membawa kartu ini.",
            "Perubahan jadwal dapat dilakukan melalui admin fisioterapi sebelum sesi dievaluasi.",
            "Gunakan pakaian yang nyaman sesuai area yang akan diterapi.",
          ],
        },
        tandaTangan("Pasien / Keluarga", "Admin Fisioterapi"),
      ],
    },
    "Fisioterapi",
  );
}

// Asuhan Terapi: order + seluruh evaluasi (atau satu evaluasi bila `evaluasiUuid` diisi).
export function cetakAsuhanTerapi(o: OrderFisio, evaluasiUuid?: string) {
  const daftar = (o.evaluasi ?? []).filter((e) => !evaluasiUuid || e.uuid === evaluasiUuid);
  const blokEvaluasi = daftar.flatMap((e, i) => {
    const ic = e.persetujuan ?? {};
    return [
      {
        margin: [0, i ? 12 : 8, 0, 4],
        table: {
          widths: ["*"],
          body: [[{
            text: `Sesi ${e.sesiKe ?? "-"} — ${tglIndo(e.tanggal, true)} ${labelJam(e.jamSlot)}${e.bed ? ` · ${e.bed}` : ""}  ·  Fase Rehabilitasi: ${e.faseRehabilitasi ? `Fase ${e.faseRehabilitasi}` : "-"}`,
            bold: true,
            color: "white",
            fillColor: warnaTema("300"),
          }]],
        },
        layout: "noBorders",
      },
      {
        table: {
          widths: [110, "*"],
          body: [
            ["Subjektif (S)", e.subjektif],
            ["Objektif (O)", e.objektif],
            ["Asesmen (A)", e.asesmen],
            ["Intervensi / Plan (P)", e.intervensi],
            ["Evaluasi", e.evaluasi],
            ["Edukasi", e.edukasi],
            [
              "Inform Consent",
              ic.jenis
                ? `${ic.jenis === "penolakan" ? "PENOLAKAN" : "PERSETUJUAN"} tindakan${ic.tindakan ? ` (${ic.tindakan})` : ""} oleh ${ic.nama ?? "-"}${ic.hubungan ? ` (${ic.hubungan})` : ""}${ic.saksi ? `, saksi: ${ic.saksi}` : ""}${ic.alasan ? `. Alasan: ${ic.alasan}` : ""}`
                : "-",
            ],
            ["Terapis", e.terapis],
          ].map(([l, v]) => [{ text: l, bold: true }, { text: v || "-" }]),
        },
        layout: "lightHorizontalLines",
      },
    ];
  });

  bukaPdf(
    {
      pageSize: "A4",
      pageMargins: [40, 35, 40, 50],
      defaultStyle: { font: "Arial", fontSize: 9 },
      footer: kaki(),
      content: [
        ...kop("ASUHAN TERAPI / REHABILITASI MEDIK"),
        identitas(o),
        {
          margin: [0, 8, 0, 0],
          table: {
            widths: [110, "*"],
            body: [
              ["Diagnosis", o.diagnosis],
              ["Keluhan", o.keluhan],
              ["Tgl. Order", waktuEpoch(o.createdAt)],
              ["Sesi", `${o.sesiSelesai} dari ${o.jumlahSesi} sesi selesai`],
            ].map(([l, v]) => [{ text: l, bold: true }, { text: v || "-" }]),
          },
          layout: "lightHorizontalLines",
        },
        {
          margin: [0, 8, 0, 0],
          table: {
            headerRows: 1,
            widths: ["*", 50, 80],
            body: [
              kepala(["Tindakan Terapi", "Qty/Sesi", "Tarif"]),
              ...(o.tindakan ?? []).map((t) => [t.nama, { text: String(t.qty), alignment: "center" }, { text: rupiah(t.harga), alignment: "right" }]),
            ],
          },
          layout: "lightHorizontalLines",
        },
        ...(blokEvaluasi.length ? blokEvaluasi : [{ text: "Belum ada evaluasi terapi.", italics: true, margin: [0, 10, 0, 0] }]),
        tandaTangan("Pasien / Keluarga", "Fisioterapis"),
      ],
    },
    "Fisioterapi",
  );
}
