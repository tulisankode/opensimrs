// API modul Sarana dan Prasarana / IPSRS (penunjang-service: /api/v3/penunjang/sarpras). Request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler).
import { apiPenunjangGet, apiPenunjangPatch, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";
export { waktuRad as waktuSarpras, rupiahRad as rupiahSarpras } from "@/stores/penunjang/radiologi";

type Gaya = { label: string; bg: string; text: string };
const kuning = { bg: "bg-[#FEF0C7]", text: "text-[#B54708]" };
const hijau = { bg: "bg-[#D1FADF]", text: "text-[#027A48]" };
const merah = { bg: "bg-[#FDE2E1]", text: "text-[#B42318]" };
const biru = { bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" };
const ungu = { bg: "bg-[#E0EAFF]", text: "text-[#3538CD]" };
const abu = { bg: "bg-[#F2F4F7]", text: "text-[#344054]" };

export const MODUL_SARPRAS = "Sarana dan Prasarana (IPSRS)";
export const KATEGORI_ASET: Record<string, string> = { alat_medis: "Alat Medis", non_medis: "Nonmedis", gedung_utilitas: "Gedung/Utilitas", kendaraan: "Kendaraan" };
export const PRIORITAS: Record<string, string> = { darurat: "Darurat", tinggi: "Tinggi", sedang: "Sedang", rendah: "Rendah" };
export const FREKUENSI: Record<string, string> = { harian: "Harian", mingguan: "Mingguan", bulanan: "Bulanan", tahunan: "Tahunan" };
export const HASIL_KALIBRASI: Record<string, string> = { lulus: "Lulus", tidak_lulus: "Tidak Lulus", perlu_tindak_lanjut: "Perlu Tindak Lanjut" };
export const JENIS_UTILITAS: Record<string, string> = { listrik: "Listrik", air: "Air", genset: "Genset", oksigen_sentral: "Oksigen Sentral" };
export const SATUAN_UTILITAS: Record<string, string> = { listrik: "kWh", air: "m³", genset: "jam", oksigen_sentral: "bar" };

export const STATUS_ASET: Record<string, Gaya> = {
  aktif: { label: "Aktif", ...hijau },
  rusak: { label: "Rusak", ...merah },
  dalam_perbaikan: { label: "Dalam Perbaikan", ...kuning },
  dihapuskan: { label: "Dihapuskan", ...abu },
};
export const STATUS_LAPORAN: Record<string, Gaya> = {
  baru: { label: "Baru", ...kuning },
  diproses: { label: "Diproses", ...biru },
  menunggu_suku_cadang: { label: "Menunggu Suku Cadang", ...ungu },
  selesai: { label: "Selesai", ...hijau },
  tidak_dapat_diperbaiki: { label: "Tidak Dapat Diperbaiki", ...merah },
};
export const GAYA_PRIORITAS: Record<string, Gaya> = {
  darurat: { label: "Darurat", ...merah },
  tinggi: { label: "Tinggi", ...kuning },
  sedang: { label: "Sedang", ...biru },
  rendah: { label: "Rendah", ...abu },
};
export const STATUS_JATUH_TEMPO: Record<string, Gaya> = {
  terlambat: { label: "Terlambat", ...merah },
  jatuh_tempo: { label: "Jatuh Tempo Hari Ini", ...kuning },
  terjadwal: { label: "Terjadwal", ...hijau },
};
export const STATUS_KALIBRASI: Record<string, Gaya> = {
  terjadwal: { label: "Terjadwal", ...biru },
  berlaku: { label: "Berlaku", ...hijau },
  jatuh_tempo: { label: "Mendekati Jatuh Tempo", ...kuning },
  kedaluwarsa: { label: "Kedaluwarsa", ...merah },
  tanpa_masa_berlaku: { label: "Tanpa Masa Berlaku", ...abu },
  digantikan: { label: "Digantikan", ...abu },
  belum_ada: { label: "Belum Ada Kalibrasi", ...merah },
};
const gaya = (daftar: Record<string, Gaya>) => (k?: string | null) => daftar[k ?? ""] ?? { label: k ?? "-", ...abu };
export const gayaStatusAset = gaya(STATUS_ASET);
export const gayaStatusLaporan = gaya(STATUS_LAPORAN);
export const gayaPrioritas = gaya(GAYA_PRIORITAS);
export const gayaJatuhTempo = gaya(STATUS_JATUH_TEMPO);
export const gayaStatusKalibrasi = gaya(STATUS_KALIBRASI);

export const opsi = (obj: Record<string, string | Gaya>) => Object.entries(obj).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label }));

// Izin aksi modul (tanpa daftar izin = super admin → boleh; backend tetap memeriksa izin).
export const izinSarpras = (submodul: string, aksi: string) => !getStoredPermissions().length || hasPermission(MODUL_SARPRAS, submodul, aksi, null);

// Tanggal tanpa jam dikirim sebagai pukul 12.00 waktu perangkat agar jatuh pada hari kalender yang sama di WIB/WITA/WIT
// (backend menyimpannya sebagai awal hari Asia/Jakarta). Waktu kejadian dikirim apa adanya (epoch detik).
export const epochTanggal = (d?: Date | null) => (d ? Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime() / 1000) : undefined);
export const epochWaktu = (d?: Date | null) => (d ? Math.floor(d.getTime() / 1000) : undefined);
export const epochAwalHari = (d?: Date | null) => (d ? Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000) : undefined);
export const epochAkhirHari = (d?: Date | null) => (d ? Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime() / 1000) : undefined);
export const tanggalDariEpoch = (e?: number | string | null) => {
  const n = Number(e);
  return n ? new Date(n * 1000) : null;
};
export const tanggalSarpras = (e?: number | string | null) => {
  const n = Number(e);
  return n ? new Date(n * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-";
};
export const durasiSarpras = (detik?: number | null) => {
  if (detik === null || detik === undefined || Number.isNaN(Number(detik))) return "-";
  const n = Math.max(Math.round(Number(detik)), 0);
  const h = Math.floor(n / 86400);
  const j = Math.floor((n % 86400) / 3600);
  const m = Math.round((n % 3600) / 60);
  return h ? `${h} hr ${j} jam` : j ? `${j} jam ${m} mnt` : `${m} mnt`;
};

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

// Berkas → { namaBerkas, tipeMime, dataBase64 } (dikirim JSON; tipe & ukuran diperiksa ulang di backend).
export const bacaBerkas = (file: File) =>
  new Promise<{ namaBerkas: string; tipeMime: string; dataBase64: string }>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ namaBerkas: file.name, tipeMime: file.type, dataBase64: String(r.result).replace(/^data:[^;]+;base64,/, "") });
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
// Buka berkas hasil unduhan (base64) di tab baru.
export const bukaBerkas = (b?: { namaBerkas: string; tipeMime: string; dataBase64: string } | null) => {
  if (!b) return;
  const biner = atob(b.dataBase64);
  const isi = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) isi[i] = biner.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([isi], { type: b.tipeMime }));
  const w = window.open(url, "_blank");
  if (!w) {
    const a = document.createElement("a");
    a.href = url;
    a.download = b.namaBerkas;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// ── Referensi & pengaturan
export const referensiSarpras = () => apiPenunjangGet("/sarpras/referensi");
export const pengaturanSarpras = () => apiPenunjangGet("/sarpras/pengaturan");
export const simpanPengaturanSarpras = (ambangKalibrasiHari: number) => apiPenunjangPut("/sarpras/pengaturan", { ambangKalibrasiHari });

// ── Aset
export const daftarAset = (params: Record<string, any> = {}) => apiPenunjangGet(`/sarpras/aset${qs(params)}`);
export const detailAset = (uuid: string) => apiPenunjangGet(`/sarpras/aset/${uuid}`);
export const simpanAset = (data: Record<string, any>, uuid?: string) => (uuid ? apiPenunjangPut(`/sarpras/aset/${uuid}`, data) : apiPenunjangPost("/sarpras/aset", data));
export const pindahLokasiAset = (uuid: string, lokasiUuid: string, catatan?: string) => apiPenunjangPatch(`/sarpras/aset/${uuid}/lokasi`, { lokasiUuid, catatan });
export const ubahStatusAset = (uuid: string, status: string, alasan?: string) => apiPenunjangPatch(`/sarpras/aset/${uuid}/status`, { status, alasan });
export const riwayatAset = (uuid: string, params: Record<string, any> = {}) => apiPenunjangGet(`/sarpras/aset/${uuid}/riwayat${qs(params)}`);

// ── Laporan kerusakan (work order)
export const daftarLaporanKerusakan = (params: Record<string, any> = {}) => apiPenunjangGet(`/sarpras/laporan-kerusakan${qs(params)}`);
export const detailLaporanKerusakan = (uuid: string) => apiPenunjangGet(`/sarpras/laporan-kerusakan/${uuid}`);
export const buatLaporanKerusakan = (data: Record<string, any>) => apiPenunjangPost("/sarpras/laporan-kerusakan", data);
export const tugaskanLaporan = (uuid: string, teknisiUuid: string, prioritas?: string) => apiPenunjangPatch(`/sarpras/laporan-kerusakan/${uuid}/tugaskan`, { teknisiUuid, prioritas });
export const ubahStatusLaporan = (uuid: string, status: string, catatan?: string) => apiPenunjangPatch(`/sarpras/laporan-kerusakan/${uuid}/status`, { status, catatan });
export const tutupLaporan = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`/sarpras/laporan-kerusakan/${uuid}/tutup`, data);
export const catatSukuCadang = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`/sarpras/laporan-kerusakan/${uuid}/suku-cadang`, data);
export const unggahFotoKerusakan = (uuid: string, berkas: Record<string, any>) => apiPenunjangPost(`/sarpras/laporan-kerusakan/${uuid}/berkas`, berkas);
export const ambilFotoKerusakan = (uuid: string, berkasUuid: string) => apiPenunjangGet(`/sarpras/laporan-kerusakan/${uuid}/berkas/${berkasUuid}`);

// ── Pemeliharaan preventif
export const daftarJadwalPemeliharaan = (params: Record<string, any> = {}) => apiPenunjangGet(`/sarpras/pemeliharaan/jadwal${qs(params)}`);
export const simpanJadwalPemeliharaan = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/sarpras/pemeliharaan/jadwal/${uuid}`, data) : apiPenunjangPost("/sarpras/pemeliharaan/jadwal", data);
export const nonaktifkanJadwal = (uuid: string, alasan: string) => apiPenunjangPatch(`/sarpras/pemeliharaan/jadwal/${uuid}/nonaktifkan`, { alasan });
export const catatPelaksanaan = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`/sarpras/pemeliharaan/jadwal/${uuid}/pelaksanaan`, data);
export const riwayatPelaksanaan = (uuid: string, params: Record<string, any> = {}) => apiPenunjangGet(`/sarpras/pemeliharaan/jadwal/${uuid}/riwayat${qs(params)}`);

// ── Kalibrasi
export const daftarKalibrasi = (params: Record<string, any> = {}) => apiPenunjangGet(`/sarpras/kalibrasi${qs(params)}`);
export const detailKalibrasi = (uuid: string) => apiPenunjangGet(`/sarpras/kalibrasi/${uuid}`);
export const catatKalibrasi = (data: Record<string, any>) => apiPenunjangPost("/sarpras/kalibrasi", data);
export const ubahJadwalKalibrasi = (uuid: string, tanggalJadwal: number, alasan: string) => apiPenunjangPut(`/sarpras/kalibrasi/${uuid}/jadwal`, { tanggalJadwal, alasan });
export const isiHasilKalibrasi = (uuid: string, data: Record<string, any>) => apiPenunjangPatch(`/sarpras/kalibrasi/${uuid}/hasil`, data);
export const unggahSertifikat = (uuid: string, berkas: Record<string, any>) => apiPenunjangPost(`/sarpras/kalibrasi/${uuid}/sertifikat`, berkas);
export const ambilSertifikat = (uuid: string, berkasUuid: string) => apiPenunjangGet(`/sarpras/kalibrasi/${uuid}/sertifikat/${berkasUuid}`);

// ── Utilitas
export const daftarUtilitas = (params: Record<string, any> = {}) => apiPenunjangGet(`/sarpras/utilitas${qs(params)}`);
export const catatUtilitas = (data: Record<string, any>) => apiPenunjangPost("/sarpras/utilitas", data);

// ── Laporan
export const laporanSarpras = (jenis: string, params: Record<string, any> = {}) => apiPenunjangGet(`/sarpras/laporan/${jenis}${qs(params)}`);
