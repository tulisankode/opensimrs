import { apiPenunjangDelete, apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { izinSdm } from "./sdm";

export const izinPelatihan = (aksi: string) => izinSdm("Pelatihan", aksi);
export const KATEGORI_PELATIHAN = { internal: "Internal", eksternal: "Eksternal" };
export const STATUS_PELATIHAN: Record<string, string> = { rencana: "Rencana", terjadwal: "Terjadwal", berlangsung: "Berlangsung", selesai: "Selesai", dibatalkan: "Dibatalkan" };
export const KEHADIRAN_PELATIHAN = { belum_dicatat: "Belum dicatat", hadir: "Hadir", sebagian: "Sebagian", tidak_hadir: "Tidak hadir" };
export const HASIL_PELATIHAN = { belum_dinilai: "Belum dinilai", lulus: "Lulus", tidak_lulus: "Tidak lulus" };
export const CAKUPAN_PELATIHAN = { semua: "Semua pegawai", unit: "Unit kerja", jenis_pegawai: "Jenis pegawai", pegawai: "Pegawai" };
export const qsPelatihan = (q: Record<string, any> = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== "" && v != null) p.set(k.replace(/[A-Z]/g, (h) => `_${h.toLowerCase()}`), String(v));
  return p.size ? `?${p}` : "";
};
const dasar = "/hr/pelatihan";
export const bacaPelatihan = (path: string, q: Record<string, any> = {}) => apiPenunjangGet(`${dasar}${path}${qsPelatihan(q)}`);
export const catatPelatihan = (path: string, data: object) => apiPenunjangPost(`${dasar}${path}`, data);
export const ubahPelatihan = (path: string, data: object) => apiPenunjangPut(`${dasar}${path}`, data);
export const hapusPelatihan = (path: string, data: object) => apiPenunjangDelete(`${dasar}${path}`, data);

// Tanggal kredensial dan cakupan mengikuti awal hari WIB dari sumber kredensial bersama.
export const epochHariPelatihan = (v: string) => v ? Date.parse(`${v}T00:00:00+07:00`) / 1000 : null;
export const tanggalFormPelatihan = (v: any) => v ? new Date((Number(v) + 7 * 3600) * 1000).toISOString().slice(0, 10) : "";
export const tanggalJamForm = (v: any) => {
  if (!v) return "";
  const d = new Date(Number(v) * 1000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export const waktuPelatihan = (v: any) => v ? new Date(Number(v) * 1000).toLocaleString("id-ID") : "—";

export const eksporPelatihan = async (laporan: any, jenis: string) => {
  const kolom: Record<string, [string, string][]> = {
    jam: [["Nama pegawai", "namaPegawai"], ["Jam tercatat", "jamTercatat"], ["Target jam", "targetJam"], ["Kekurangan jam", "kekuranganJam"], ["Status", "statusPemenuhan"]],
    wajib: [["Nama pegawai", "namaPegawai"], ["Pelatihan wajib", "namaPelatihan"], ["Keterangan", "alasan"]],
    sertifikat: [["Nama pegawai", "namaPegawai"], ["Pelatihan", "namaPelatihan"], ["Nomor sertifikat", "nomor"], ["Akhir berlaku", "tanggalBerakhir"], ["Status", "statusMasaBerlaku"], ["Sisa hari", "sisaHari"]],
    peserta: [["Nama pegawai", "namaPegawai"], ["Pelatihan", "namaPelatihan"], ["Kehadiran", "kehadiran"], ["Hasil", "hasil"], ["Jam hadir", "jamHadir"], ["Jam diakui", "jamDiakui"], ["Verifikasi", "statusVerifikasi"]],
  };
  const k = kolom[jenis];
  if (!k) throw new Error("Jenis laporan tidak dikenal");
  const label: Record<string, string> = { terpenuhi: "Terpenuhi", belum_terpenuhi: "Belum terpenuhi", belum_ditetapkan: "Belum ditetapkan",
    sertifikat_belum_sah: "Sertifikat belum sah", belum_menyelesaikan_pelatihan: "Belum menyelesaikan pelatihan", akan_kedaluwarsa: "Akan kedaluwarsa", kedaluwarsa: "Kedaluwarsa",
    ...HASIL_PELATIHAN, ...KEHADIRAN_PELATIHAN, terverifikasi: "Terverifikasi", belum_diverifikasi: "Belum diverifikasi" };
  const aman = (v: any) => typeof v === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(v) ? `'${v}` : v;
  const baris = (laporan.data ?? []).map((r: any) => k.map(([, key]) => {
    const v = r[key];
    return aman(key === "tanggalBerakhir" ? tanggalFormPelatihan(v) : label[v] ?? v ?? "—");
  }));
  if (laporan.format === "xlsx") {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([k.map(([nama]) => nama), ...baris]), "Pelatihan");
    XLSX.writeFile(wb, laporan.namaBerkas);
  } else {
    const [{ default: pdfMake }, { customVfs }] = await Promise.all([import("pdfmake/build/pdfmake"), import("@/utils/customVfs")]);
    pdfMake.vfs = customVfs.pdfMake.vfs;
    pdfMake.fonts = { Arial: { normal: "Arial.ttf", bold: "Arial_Bold.ttf", italics: "Arial_Italic.ttf", bolditalics: "Arial_Bold_Italic.ttf" } };
    pdfMake.createPdf({ pageOrientation: "landscape", defaultStyle: { font: "Arial", fontSize: 8 }, content: [
      { text: `Laporan Pelatihan ${laporan.tahun}`, fontSize: 14, bold: true, margin: [0, 0, 0, 12] },
      { text: "Cakupan mengikuti kepegawaian saat laporan dibuat.", margin: [0, 0, 0, 8] },
      { table: { headerRows: 1, widths: k.map(() => "*"), body: [k.map(([nama]) => ({ text: nama, bold: true })), ...baris] } },
    ] }).download(laporan.namaBerkas);
  }
};
