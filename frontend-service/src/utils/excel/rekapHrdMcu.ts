// Ekspor Excel rekap hasil MCU per perusahaan untuk HRD (sheet Ringkasan + Peserta; temuan abnormal ditandai merah).
import * as XLSX from "xlsx-js-style";
import { KESIMPULAN_MCU, tglIndo, type Kesimpulan } from "@/stores/penunjang/mcu";

const KEPALA = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "0E7C86" } }, alignment: { wrapText: true, vertical: "center" } };
const MERAH = { font: { bold: true, color: { rgb: "B42318" } } };

export function eksporRekapHrdExcel(r: any) {
  const rg = r.ringkasan ?? {};
  const wb = XLSX.utils.book_new();
  const ringkas: any[][] = [
    [{ v: `Rekap Hasil MCU — ${r.perusahaan?.nama ?? ""}`, s: { font: { bold: true, sz: 14 } } }],
    [r.invoice ? `Invoice ${r.invoice.noInvoice}` : `Periode ${tglIndo(r.periode?.mulai)} s.d. ${tglIndo(r.periode?.selesai)}`],
    [`Peserta ${rg.total ?? 0}, selesai ${rg.selesai ?? 0}, belum selesai ${rg.belumSelesai ?? 0}`],
    [],
    ["Kesimpulan", "Jumlah", "%"].map((v) => ({ v, s: KEPALA })),
    ...(rg.kesimpulan ?? []).map((k: any) => [k.label, k.jumlah, k.persen / 100]),
    [],
    ["Temuan abnormal", "Jumlah", "Diperiksa", "%"].map((v) => ({ v, s: KEPALA })),
    ...(rg.temuan ?? []).map((k: any) => [k.label, k.jumlah, k.diperiksa, k.persen / 100]),
    [],
    ["Bagian", "Peserta", "Selesai", "Fit", "Fit dg catatan", "Unfit"].map((v) => ({ v, s: KEPALA })),
    ...(rg.perBagian ?? []).map((b: any) => [b.bagian, b.peserta, b.selesai, b.fit, b.fitCatatan, b.unfit]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(ringkas);
  ws1["!cols"] = [{ wch: 42 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 }];
  for (const [alamat, c] of Object.entries(ws1)) if (!alamat.startsWith("!") && typeof (c as any).v === "number" && (c as any).v <= 1 && (c as any).v > 0 && /^[CD]/.test(alamat)) (c as any).z = "0.0%";
  XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan");

  const kolom = ["No", "No. MCU", "Tanggal", "Nama", "NIK Karyawan", "Jabatan", "Bagian", "JK", "Umur", "Paket", "Status", "Kesimpulan",
    "IMT", "Kategori IMT", "Tekanan Darah", "Kategori TD", "Gula Darah", "Kolesterol", "Visus", "Buta Warna", "Radiologi", "Catatan", "Saran"];
  const sel = (v: any, abnormal: any) => ({ v: v ?? "", s: abnormal === true ? MERAH : {} });
  const baris = (r.peserta ?? []).map((x: any, i: number) => {
    const tm = x.temuan ?? {};
    return [
      i + 1, x.noMcu, x.tanggal, x.nama, x.nikKaryawan ?? "", x.jabatan ?? "", x.bagian ?? "", x.gender === "Male" ? "L" : x.gender === "Female" ? "P" : "",
      x.umur ?? "", x.namaPaket, x.status, x.kesimpulan ? KESIMPULAN_MCU[x.kesimpulan as Kesimpulan]?.label ?? x.kesimpulan : "",
      sel(tm.imt, tm.imtAbnormal), sel(tm.kategoriImt, tm.imtAbnormal), sel(tm.tekananDarah, tm.tdAbnormal), sel(tm.kategoriTd, tm.tdAbnormal),
      sel(tm.gulaDarah, tm.gulaAbnormal), sel(tm.kolesterol, tm.kolesterolAbnormal), sel(tm.visus, tm.visusAbnormal), sel(tm.butaWarna, tm.butaWarnaAbnormal),
      sel(tm.radiologi, tm.radiologiAbnormal), x.catatanKesimpulan ?? "", x.saran ?? "",
    ];
  });
  const ws2 = XLSX.utils.aoa_to_sheet([kolom.map((v) => ({ v, s: KEPALA })), ...baris]);
  ws2["!cols"] = kolom.map((k) => ({ wch: ["Nama", "Radiologi", "Catatan", "Saran"].includes(k) ? 30 : 13 }));
  ws2["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(kolom.length - 1)}${baris.length + 1}` };
  XLSX.utils.book_append_sheet(wb, ws2, "Peserta");
  XLSX.writeFile(wb, `Rekap MCU ${r.perusahaan?.nama ?? ""} ${r.periode?.mulai ?? ""}_${r.periode?.selesai ?? ""}.xlsx`);
}
