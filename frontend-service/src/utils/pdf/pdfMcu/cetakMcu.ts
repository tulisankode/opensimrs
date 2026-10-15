// Cetak dokumen Medical Check Up (pdfmake): Laporan Hasil MCU per peserta, Surat Keterangan Kesehatan
// (sertifikat), Invoice korporasi (opsional dengan lampiran rekap HRD), dan Rekap Hasil MCU per perusahaan untuk HRD.
// Data = payload API penunjang (camelCase).
import pdfMake from "pdfmake/build/pdfmake";
import { bukaPdf, gambarPdfValid } from "@/utils/pdf/bukaPdf";
import { customVfs } from "@/utils/customVfs";
import { convertImageToBase64, numberToWords } from "@/utils/Helpers";
import { warnaTema } from "@/utils/tema";
import logoUrl from "@/assets/images/opensimrs-square.png";
import {
  SISTEM_FISIK, JENIS_MCU, LABEL_KESIMPULAN_PANJANG, KESIMPULAN_MCU, STATUS_INVOICE, METODE_BAYAR_MCU, LABEL_FLAG_LAB, tglIndo, rupiah, jenisKelamin,
  type Kesimpulan, type StatusInvoice,
} from "@/stores/penunjang/mcu";

pdfMake.vfs = customVfs.pdfMake.vfs;
pdfMake.fonts = {
  Arial: { normal: "Arial.ttf", bold: "Arial_Bold.ttf", italics: "Arial_Italic.ttf", bolditalics: "Arial_Bold_Italic.ttf" },
};

const LEBAR = 595 - 80;
const profil = () => {
  try {
    return JSON.parse(localStorage.getItem("faskes_profile") ?? "{}");
  } catch {
    return {};
  }
};
const logoFaskes = async (p: any) => (gambarPdfValid(p?.logo) ? p.logo : await convertImageToBase64(logoUrl));
const t = (v: any) => (v === undefined || v === null || v === "" ? "-" : String(v));
const hariIniIndo = () => tglIndo(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()));
const kota = (p: any) => p?.address?.kabupaten?.name ?? p?.address?.city ?? "";

const kop = async (judul: string, nomor?: string) => {
  const p = profil();
  return [
    {
      columns: [
        { image: await logoFaskes(p), fit: [70, 45], width: 70 },
        {
          width: "*",
          alignment: "center",
          stack: [
            { text: p?.name ?? "-", bold: true, fontSize: 14 },
            { text: p?.address?.fullAddress ?? "", fontSize: 8, margin: [0, 2, 0, 0] },
            { text: [p?.phone, p?.email].filter(Boolean).join(" · "), fontSize: 8 },
          ],
        },
        { text: "", width: 70 },
      ],
    },
    { canvas: [{ type: "line", x1: 0, y1: 4, x2: LEBAR, y2: 4, lineWidth: 1.5, lineColor: warnaTema("300") }], margin: [0, 2, 0, 8] },
    { text: judul, bold: true, fontSize: 12, alignment: "center" },
    nomor ? { text: `No. ${nomor}`, alignment: "center", margin: [0, 2, 0, 8] } : { text: "", margin: [0, 0, 0, 8] },
  ];
};

const footer = (halaman: number, total: number) => ({
  columns: [
    { text: `Dicetak: ${new Date().toLocaleString("id-ID")}`, fontSize: 7, color: "#667085" },
    { text: `Hal. ${halaman}/${total}`, alignment: "right", fontSize: 7, color: "#667085" },
  ],
  margin: [40, 15, 40, 0],
});

const pasangan = (baris: [string, any][], lebarLabel = 85) => ({
  table: { widths: [lebarLabel, "*"], body: baris.map(([l, v]) => [{ text: l, color: "#475467" }, { text: `: ${t(v)}` }]) },
  layout: "noBorders",
});

const identitas = (d: any) => ({
  columns: [
    pasangan([
      ["Nama", d.namaPasien],
      ["No. RM", d.noRm],
      ["Jenis Kelamin", jenisKelamin(d.gender)],
      ["Tgl. Lahir / Umur", `${tglIndo(d.tanggalLahir)} / ${d.umur ?? "-"} th`],
      ["NIK", d.nik],
    ]),
    pasangan([
      ["No. MCU", d.noMcu],
      ["Tgl. Pemeriksaan", tglIndo(d.tanggal)],
      ["Paket", d.namaPaket],
      ["Jenis MCU", JENIS_MCU[d.jenisMcu] ?? d.jenisMcu],
      ["Perusahaan", d.namaPerusahaan ?? "Perorangan"],
      ...(d.nikKaryawan || d.jabatan ? ([["NIK Kary. / Jabatan", `${t(d.nikKaryawan)} / ${t(d.jabatan)}`]] as [string, any][]) : []),
    ]),
  ],
  columnGap: 12,
});

const judulBagian = (teks: string) => ({
  table: { widths: ["*"], body: [[{ text: teks, bold: true, color: "white", fillColor: warnaTema("300"), margin: [4, 2, 4, 2] }]] },
  layout: "noBorders",
  margin: [0, 10, 0, 4],
});

const tabel = (kepala: string[], isi: any[][], lebar: any[]) => ({
  table: {
    headerRows: 1,
    widths: lebar,
    body: [kepala.map((h) => ({ text: h, bold: true, fillColor: warnaTema("50") })), ...(isi.length ? isi : [[{ text: "-", colSpan: kepala.length }, ...kepala.slice(1).map(() => "")]])],
  },
  layout: "lightHorizontalLines",
});

const stasiunData = (d: any, kode: string) => d.stasiun?.find((s: any) => s.kode === kode);

// Isi per stasiun untuk laporan hasil.
const bagianStasiun = (d: any, s: any): any[] => {
  const x = s.data ?? {};
  switch (s.kode) {
    case "anamnesis":
      return [pasangan([
        ["Keluhan saat ini", x.keluhan], ["Riwayat penyakit", x.riwayatPenyakit], ["Riwayat keluarga", x.riwayatKeluarga],
        ["Riwayat operasi", x.riwayatOperasi], ["Obat rutin", x.obatRutin], ["Alergi", x.alergi],
        ["Merokok / Alkohol", `${t(x.merokok)} / ${t(x.alkohol)}`], ["Olahraga", x.olahraga], ["Riwayat pekerjaan", x.riwayatPekerjaan],
      ], 110)];
    case "tanda_vital":
      return [{
        columns: [
          pasangan([["Tekanan darah", x.sistole ? `${x.sistole}/${x.diastole} mmHg` : "-"], ["Nadi", x.nadi ? `${x.nadi} x/menit` : "-"],
            ["Pernapasan", x.respirasi ? `${x.respirasi} x/menit` : "-"], ["Suhu", x.suhu ? `${x.suhu} °C` : "-"]], 90),
          pasangan([["Berat badan", x.beratBadan ? `${x.beratBadan} kg` : "-"], ["Tinggi badan", x.tinggiBadan ? `${x.tinggiBadan} cm` : "-"],
            ["IMT", x.imt ? `${x.imt} kg/m² (${t(x.kategoriImt)})` : "-"], ["Lingkar perut", x.lingkarPerut ? `${x.lingkarPerut} cm` : "-"]], 90),
        ],
      }];
    case "fisik": {
      const sistem = Array.isArray(x.sistem) ? x.sistem : [];
      return [
        tabel(["Sistem", "Hasil", "Keterangan"], SISTEM_FISIK.map((sf) => {
          const r = sistem.find((y: any) => y.kode === sf.kode);
          const ab = r?.status === "abnormal";
          return [sf.nama, { text: r ? (ab ? "Abnormal" : "Normal") : "-", bold: ab, color: ab ? "#B42318" : "black" }, t(r?.catatan)];
        }), [150, 60, "*"]),
        ...(x.catatan ? [{ text: `Catatan: ${x.catatan}`, margin: [0, 4, 0, 0] }] : []),
      ];
    }
    case "visus":
      return [pasangan([
        ["Visus OD (kanan)", `${t(x.od)}${x.odKoreksi ? ` — koreksi ${x.odKoreksi}` : ""}`],
        ["Visus OS (kiri)", `${t(x.os)}${x.osKoreksi ? ` — koreksi ${x.osKoreksi}` : ""}`],
        ["Kacamata", x.kacamata ? "Ya" : "Tidak"], ["Buta warna (Ishihara)", x.butaWarna], ["Kesan", x.kesan],
      ], 110)];
    case "laboratorium": {
      const manual = Array.isArray(x.hasil) ? x.hasil : [];
      const lab = d.laboratorium;
      const baris: any[][] = [];
      // Hasil dari Laboratorium (lab-service / LIS), dikelompokkan per pemeriksaan.
      if (lab?.noOrder && !lab.batal) {
        let kelompok = "";
        for (const h of lab.hasil ?? []) {
          if (h.kelompok !== kelompok) {
            kelompok = h.kelompok;
            baris.push([{ text: kelompok, bold: true, colSpan: 5, color: warnaTema("400") }, "", "", "", ""]);
          }
          baris.push([
            { text: h.nama, margin: [6, 0, 0, 0] }, { text: h.hasil ?? "(belum ada hasil)", bold: h.abnormal, color: h.hasil ? "black" : "#98A2B3" },
            t(h.satuan), t(h.nilaiRujukan), { text: h.abnormal ? LABEL_FLAG_LAB[h.flag] ?? h.flag : "", color: "#B42318" },
          ]);
        }
      }
      for (const h of manual) {
        baris.push([
          t(h.nama), { text: t(h.nilai), bold: h.flag && h.flag !== "N" }, t(h.satuan), t(h.nilaiRujukan),
          { text: h.flag === "H" ? "Tinggi" : h.flag === "L" ? "Rendah" : h.flag === "A" ? "Abnormal" : "", color: "#B42318" },
        ]);
      }
      return [
        ...(lab?.noOrder && !lab.batal
          ? [{ text: `No. order lab ${lab.noOrder}${lab.dokterLab ? ` · Penanggung jawab: ${lab.dokterLab}` : ""}`, fontSize: 8, color: "#475467", margin: [0, 0, 0, 2] }]
          : []),
        tabel(["Pemeriksaan", "Hasil", "Satuan", "Nilai Rujukan", "Ket."], baris, ["*", 70, 55, 95, 55]),
        ...(lab?.catatanAnalis ? [{ text: `Catatan analis: ${lab.catatanAnalis}`, margin: [0, 4, 0, 0] }] : []),
        ...(x.kesan ? [{ text: `Kesan: ${x.kesan}`, margin: [0, 4, 0, 0] }] : []),
      ];
    }
    case "radiologi": {
      const items = d.radiologi?.items ?? [];
      return [
        ...items.map((i: any) => ({
          stack: [
            { text: `${i.nama}${i.status !== "selesai" ? " (hasil belum tersedia)" : ""}`, bold: true },
            ...(i.hasil ? [{ text: i.hasil, margin: [0, 2, 0, 0] }] : []),
            ...(i.kesan ? [{ text: [{ text: "Kesan: ", bold: true }, i.kesan], margin: [0, 2, 0, 0] }] : []),
            ...(i.dokterRadiologi ? [{ text: `Radiolog: ${i.dokterRadiologi}`, italics: true, fontSize: 8, color: "#475467" }] : []),
          ],
          margin: [0, 0, 0, 4],
        })),
        ...(x.hasil ? [{ text: `Kesimpulan radiologi: ${x.hasil}`, bold: true, color: x.hasil === "Abnormal" ? "#B42318" : "black" }] : []),
        ...(x.kesan ? [{ text: `Catatan dokter MCU: ${x.kesan}` }] : []),
        ...(!items.length && !x.kesan ? [{ text: "-" }] : []),
      ];
    }
    case "audiometri":
      return [pasangan([["Telinga kanan (AD)", x.kanan], ["Telinga kiri (AS)", x.kiri], ["Hasil", x.hasil], ["Kesan", x.kesan]], 110)];
    case "ekg":
      return [pasangan([["Irama / Frekuensi", `${t(x.irama)} / ${x.frekuensi ? `${x.frekuensi} x/menit` : "-"}`], ["Hasil", x.hasil], ["Kesan", x.kesan]], 110)];
    case "spirometri":
      return [pasangan([["FVC", x.fvc ? `${x.fvc} %pred` : "-"], ["FEV1", x.fev ? `${x.fev} %pred` : "-"], ["FEV1/FVC", x.rasio ? `${x.rasio} %` : "-"],
        ["Hasil", x.hasil], ["Kesan", x.kesan]], 110)];
    case "gigi":
      return [pasangan([["Karies", x.karies], ["Gigi hilang", x.gigiHilang], ["Kalkulus", x.kalkulus], ["Gingiva", x.gingiva], ["Kesan", x.kesan]], 110)];
    default:
      return [{ text: Object.entries(x).map(([k, v]) => `${k}: ${t(v)}`).join("\n") || "-" }];
  }
};

const tandaTangan = (d: any, label = "Dokter Pemeriksa") => ({
  columns: [
    { text: "", width: "*" },
    {
      width: 200,
      alignment: "center",
      stack: [
        { text: `${kota(profil()) ? kota(profil()) + ", " : ""}${d.selesaiPada ? tglIndo(new Date(Number(d.selesaiPada) * 1000).toISOString()) : hariIniIndo()}` },
        { text: label, margin: [0, 2, 0, 45] },
        { text: t(d.dokterPemeriksa), bold: true, decoration: "underline" },
      ],
    },
  ],
  margin: [0, 20, 0, 0],
  unbreakable: true,
});

const kotakKesimpulan = (d: any) => {
  const warna = d.kesimpulan === "fit" ? "#027A48" : d.kesimpulan === "unfit" ? "#B42318" : "#B54708";
  return {
    table: {
      widths: ["*"],
      body: [[{
        stack: [
          { text: "KESIMPULAN", bold: true, color: "#475467", fontSize: 8 },
          { text: d.kesimpulan ? LABEL_KESIMPULAN_PANJANG[d.kesimpulan as Kesimpulan] : "Belum ada kesimpulan", bold: true, fontSize: 11, color: d.kesimpulan ? warna : "#667085", margin: [0, 2, 0, 4] },
          ...(d.catatanKesimpulan ? [{ text: [{ text: "Catatan / temuan: ", bold: true }, d.catatanKesimpulan] }] : []),
          ...(d.saran ? [{ text: [{ text: "Saran: ", bold: true }, d.saran], margin: [0, 2, 0, 0] }] : []),
        ],
        margin: [6, 6, 6, 6],
      }]],
    },
    layout: { hLineColor: () => warna, vLineColor: () => warna },
    margin: [0, 10, 0, 0],
  };
};

// ── Laporan Hasil MCU per peserta ─────────────────────────────────────────────
export async function cetakLaporanMcu(d: any) {
  const isi: any[] = [...(await kop("LAPORAN HASIL MEDICAL CHECK UP", d.noMcu)), identitas(d)];
  for (const s of d.stasiun ?? []) {
    if (s.kode === "kesimpulan") continue;
    isi.push(judulBagian(s.nama), ...bagianStasiun(d, s));
  }
  isi.push(kotakKesimpulan(d), tandaTangan(d));
  bukaPdf({ pageSize: "A4", pageMargins: [40, 30, 40, 45], defaultStyle: { font: "Arial", fontSize: 9 }, footer, content: isi }, "MCU");
}

// ── Surat Keterangan Kesehatan (sertifikat MCU) ───────────────────────────────
export async function cetakSertifikatMcu(d: any) {
  const tv = stasiunData(d, "tanda_vital")?.data ?? {};
  const visus = stasiunData(d, "visus")?.data ?? {};
  const isi: any[] = [
    ...(await kop("SURAT KETERANGAN KESEHATAN", d.noMcu)),
    { text: "Yang bertanda tangan di bawah ini, dokter pemeriksa pada fasilitas kesehatan tersebut di atas, menerangkan bahwa:", margin: [0, 6, 0, 8] },
    {
      margin: [20, 0, 0, 0],
      ...pasangan([
        ["Nama", d.namaPasien], ["Jenis Kelamin", jenisKelamin(d.gender)], ["Tgl. Lahir / Umur", `${tglIndo(d.tanggalLahir)} / ${d.umur ?? "-"} tahun`],
        ["NIK", d.nik], ["Perusahaan / Instansi", d.namaPerusahaan ?? "-"], ["Jabatan / Bagian", [d.jabatan, d.bagian].filter(Boolean).join(" / ") || "-"],
      ], 120),
    },
    {
      text: `telah menjalani Medical Check Up (${d.namaPaket}${d.jenisMcu ? `, ${JENIS_MCU[d.jenisMcu] ?? d.jenisMcu}` : ""}) pada tanggal ${tglIndo(d.tanggal)} dengan hasil ringkas:`,
      margin: [0, 8, 0, 6],
    },
    {
      margin: [20, 0, 0, 0],
      ...pasangan([
        ["Tekanan darah", tv.sistole ? `${tv.sistole}/${tv.diastole} mmHg` : "-"],
        ["TB / BB / IMT", tv.tinggiBadan ? `${tv.tinggiBadan} cm / ${t(tv.beratBadan)} kg / ${t(tv.imt)}` : "-"],
        ["Visus OD / OS", visus.od ? `${visus.od} / ${t(visus.os)}` : "-"],
        ["Buta warna", visus.butaWarna],
      ], 120),
    },
    { text: "Berdasarkan hasil pemeriksaan tersebut, yang bersangkutan dinyatakan:", margin: [0, 10, 0, 0] },
    kotakKesimpulan(d),
    { text: "Demikian surat keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.", margin: [0, 10, 0, 0] },
    tandaTangan(d),
  ];
  bukaPdf({ pageSize: "A4", pageMargins: [50, 30, 50, 45], defaultStyle: { font: "Arial", fontSize: 10 }, footer, content: isi }, "MCU");
}

// ── Invoice korporasi ─────────────────────────────────────────────────────────
// rekap (opsional) = payload /mcu/laporan/rekap-hrd?invoice_uuid= → dilampirkan sebagai halaman lanskap.
export async function cetakInvoiceMcu(inv: any, rekap: any = null) {
  const p = profil();
  const rincian = (inv.rincian ?? []).map((r: any, i: number) => [
    i + 1, r.tambahan ? r.namaPaket : `Medical Check Up — ${r.namaPaket}`, { text: r.jumlah, alignment: "center" }, { text: rupiah(r.harga), alignment: "right" },
    { text: rupiah(r.subtotal), alignment: "right" },
  ]);
  const peserta = (inv.peserta ?? []).map((s: any, i: number) => [
    i + 1, t(s.noMcu), tglIndo(s.tanggal), t(s.namaPasien), t(s.nikKaryawan), t(s.namaPaket), { text: rupiah(s.harga), alignment: "right" },
  ]);
  const bayar = (inv.pembayaran ?? []).filter((b: any) => !b.deletedAt);
  const terbilang = Number(inv.total) > 0 ? `${numberToWords(Number(inv.total)).trim()} Rupiah` : "-";
  const status = STATUS_INVOICE[inv.status as StatusInvoice]?.label ?? String(inv.status ?? "");
  const isi: any[] = [
    ...(await kop("INVOICE MEDICAL CHECK UP", inv.noInvoice)),
    {
      columns: [
        { stack: [{ text: "Ditagihkan kepada:", color: "#475467" }, { text: inv.namaPerusahaan, bold: true }, { text: t(inv.alamatPerusahaan) }, { text: `PIC: ${t(inv.pic)} ${inv.telepon ? "· " + inv.telepon : ""}` }] },
        pasangan([
          ["Tanggal", tglIndo(inv.tanggal)], ["Periode", `${tglIndo(inv.periodeMulai)} s.d. ${tglIndo(inv.periodeSelesai)}`],
          ["Jatuh tempo", tglIndo(inv.jatuhTempo)], ["Status", status.toUpperCase()],
        ]),
      ],
      columnGap: 12,
      margin: [0, 0, 0, 10],
    },
    tabel(["No", "Uraian", "Jumlah Peserta", "Harga Satuan", "Subtotal"], rincian, [20, "*", 70, 80, 90]),
    {
      table: {
        widths: ["*", 90],
        body: [
          [{ text: "TOTAL", bold: true, alignment: "right" }, { text: rupiah(inv.total), bold: true, alignment: "right" }],
          ...(bayar.length
            ? [
                [{ text: "Sudah dibayar", alignment: "right" }, { text: rupiah(inv.totalBayar), alignment: "right" }],
                [{ text: "SISA TAGIHAN", bold: true, alignment: "right" }, { text: rupiah(inv.sisa), bold: true, alignment: "right", color: Number(inv.sisa) > 0 ? "#B42318" : "#027A48" }],
              ]
            : []),
        ],
      },
      layout: "noBorders",
      margin: [0, 4, 0, 0],
    },
    { text: [{ text: "Terbilang: ", bold: true }, { text: terbilang, italics: true }], margin: [0, 4, 0, 0] },
    ...(inv.catatan ? [{ text: `Catatan: ${inv.catatan}`, margin: [0, 4, 0, 0] }] : []),
    ...(bayar.length
      ? [
          { text: "Riwayat Pembayaran", bold: true, margin: [0, 10, 0, 4] },
          tabel(
            ["No. Bayar", "Tanggal", "Metode", "Referensi", "Jumlah"],
            bayar.map((b: any) => [t(b.noBayar), tglIndo(b.tanggal), METODE_BAYAR_MCU[b.metode] ?? b.metode, t(b.noReferensi), { text: rupiah(b.jumlah), alignment: "right" }]),
            [90, 70, 80, "*", 80],
          ),
        ]
      : []),
    {
      columns: [
        { text: `Pembayaran ditransfer ke rekening ${p?.name ?? "faskes"}. Mohon cantumkan nomor invoice pada berita transfer.`, fontSize: 8, color: "#475467", width: "*" },
        { width: 200, alignment: "center", stack: [{ text: `${kota(p) ? kota(p) + ", " : ""}${tglIndo(inv.tanggal)}` }, { text: "Bagian Keuangan", margin: [0, 2, 0, 45] }, { text: "(.................................)" }] },
      ],
      margin: [0, 16, 0, 0],
      unbreakable: true,
    },
    { text: "Lampiran: Daftar Peserta", bold: true, pageBreak: "before", margin: [0, 0, 0, 6] },
    tabel(["No", "No. MCU", "Tanggal", "Nama Peserta", "NIK Kary.", "Paket", "Tagihan"], peserta, [20, 98, 62, "*", 50, 75, 62]),
  ];
  if (rekap) isi.push({ text: "", pageBreak: "before", pageOrientation: "landscape" }, ...(await kontenRekapHrd(rekap, false)));
  bukaPdf({ pageSize: "A4", pageMargins: [40, 30, 40, 45], defaultStyle: { font: "Arial", fontSize: 9 }, footer, content: isi }, `Invoice ${inv.noInvoice}`);
}

// ── Rekap hasil MCU per perusahaan (HRD) ──────────────────────────────────────
const ya = (v: any) => v === true;
const sel = (nilai: any, abnormal: any, catatan?: string | null) => ({
  text: `${t(nilai)}${catatan ? `\n${catatan}` : ""}`,
  bold: ya(abnormal),
  color: ya(abnormal) ? "#B42318" : "black",
  fontSize: 7,
});

export async function kontenRekapHrd(r: any, denganKop = true): Promise<any[]> {
  const rg = r.ringkasan ?? {};
  const judul = `REKAP HASIL MEDICAL CHECK UP — ${String(r.perusahaan?.nama ?? "").toUpperCase()}`;
  const sub = r.invoice ? `Lampiran invoice ${r.invoice.noInvoice} · periode ${tglIndo(r.periode?.mulai)} s.d. ${tglIndo(r.periode?.selesai)}` : `Periode ${tglIndo(r.periode?.mulai)} s.d. ${tglIndo(r.periode?.selesai)}`;
  const kepala = denganKop ? await kop(judul) : [{ text: judul, bold: true, fontSize: 12, alignment: "center" }];
  const ringkasKesimpulan = (rg.kesimpulan ?? []).map((k: any) => [k.label, { text: k.jumlah, alignment: "center" }, { text: `${k.persen}%`, alignment: "right" }]);
  const ringkasTemuan = (rg.temuan ?? []).map((k: any) => [k.label, { text: `${k.jumlah} / ${k.diperiksa}`, alignment: "center" }, { text: `${k.persen}%`, alignment: "right" }]);
  const perBagian = (rg.perBagian ?? []).map((b: any) => [b.bagian, { text: b.peserta, alignment: "center" }, { text: b.selesai, alignment: "center" }, { text: b.fit, alignment: "center" }, { text: b.fitCatatan, alignment: "center" }, { text: b.unfit, alignment: "center" }]);
  const warnaKesimpulan = (k: string) => (k === "fit" ? "#027A48" : k === "unfit" ? "#B42318" : "#B54708");
  const baris = (r.peserta ?? []).map((x: any, i: number) => {
    const tm = x.temuan ?? {};
    return [
      { text: i + 1, fontSize: 7 },
      { text: `${x.nama}\n${t(x.nikKaryawan)}`, fontSize: 7 },
      { text: `${[x.bagian, x.jabatan].filter(Boolean).join(" / ") || "-"}`, fontSize: 7 },
      { text: `${x.gender === "Male" ? "L" : x.gender === "Female" ? "P" : "-"} / ${x.umur ?? "-"}`, fontSize: 7, alignment: "center" },
      x.kesimpulan
        ? { text: KESIMPULAN_MCU[x.kesimpulan as Kesimpulan]?.label ?? x.kesimpulan, bold: true, color: warnaKesimpulan(x.kesimpulan), fontSize: 7 }
        : { text: x.status === "selesai" ? "-" : "Belum selesai", color: "#98A2B3", fontSize: 7 },
      sel(tm.imt ? `${tm.imt}` : null, tm.imtAbnormal, tm.kategoriImt),
      sel(tm.tekananDarah, tm.tdAbnormal, tm.kategoriTd && tm.kategoriTd !== "Normal" ? tm.kategoriTd : null),
      sel(tm.gulaDarah, tm.gulaAbnormal),
      sel(tm.kolesterol, tm.kolesterolAbnormal),
      sel(tm.visus, tm.visusAbnormal, tm.butaWarna && tm.butaWarna !== "Normal" ? tm.butaWarna : null),
      sel(tm.radiologi, tm.radiologiAbnormal),
      { text: [x.catatanKesimpulan, x.saran ? `Saran: ${x.saran}` : null].filter(Boolean).join("\n") || "-", fontSize: 7 },
    ];
  });
  return [
    ...kepala,
    { text: sub, alignment: "center", margin: [0, 0, 0, 8], color: "#475467" },
    {
      columns: [
        { width: "*", stack: [{ text: `Peserta: ${rg.total ?? 0} · selesai ${rg.selesai ?? 0} · belum selesai ${rg.belumSelesai ?? 0}`, bold: true, margin: [0, 0, 0, 4] },
          tabel(["Kesimpulan", "Jumlah", "%"], ringkasKesimpulan, ["*", 45, 40])] },
        { width: "*", stack: [{ text: "Temuan abnormal utama", bold: true, margin: [0, 0, 0, 4] }, tabel(["Temuan", "Jumlah / diperiksa", "%"], ringkasTemuan, ["*", 75, 40])] },
        { width: "*", stack: [{ text: "Per bagian", bold: true, margin: [0, 0, 0, 4] }, tabel(["Bagian", "Peserta", "Selesai", "Fit", "Catatan", "Unfit"], perBagian, ["*", 35, 35, 25, 35, 28])] },
      ],
      columnGap: 12,
      margin: [0, 0, 0, 10],
    },
    {
      table: {
        headerRows: 1,
        widths: [16, 90, 70, 30, 55, 50, 50, 50, 50, 60, "*", 90],
        body: [
          ["No", "Nama / NIK Kary.", "Bagian / Jabatan", "JK/Umur", "Kesimpulan", "IMT", "Tekanan Darah", "Gula Darah", "Kolesterol", "Visus / Buta warna", "Radiologi", "Catatan / Saran"].map((h) => ({
            text: h, bold: true, fillColor: warnaTema("50"), fontSize: 7,
          })),
          ...(baris.length ? baris : [[{ text: "Tidak ada peserta", colSpan: 12, alignment: "center" }, ...Array(11).fill("")]]),
        ],
      },
      layout: "lightHorizontalLines",
    },
    { text: "Nilai bercetak tebal merah = di luar batas normal / perlu tindak lanjut. Data bersifat rahasia medis — hanya untuk keperluan penilaian kelaikan kerja.", fontSize: 7, color: "#475467", margin: [0, 6, 0, 0] },
  ];
}

export async function cetakRekapHrdMcu(r: any) {
  const isi = await kontenRekapHrd(r, true);
  bukaPdf(
    { pageSize: "A4", pageOrientation: "landscape", pageMargins: [30, 30, 30, 40], defaultStyle: { font: "Arial", fontSize: 8 }, footer, content: isi },
    `Rekap MCU ${r.perusahaan?.nama ?? ""}`,
  );
}
