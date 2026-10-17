// API modul Program Puskesmas (program-puskesmas-service: /api/v3/program-puskesmas). Request otomatis
// snake_case, respons camelCase; galat → toast + undefined (lihat apiHandler).
import { apiProgramPuskesmasDelete, apiProgramPuskesmasDownload, apiProgramPuskesmasGet, apiProgramPuskesmasPost, apiProgramPuskesmasPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";

// Izin aksi modul (tanpa daftar izin = super admin → boleh; backend tetap memeriksa login).
export const izinPkm = (submodul: string, aksi: string, fitur?: string) =>
  !getStoredPermissions().length || hasPermission("Program Puskesmas", submodul, aksi, fitur ?? null);

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
    q.append(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

// Tanggal lokal YYYY-MM-DD.
export const keTanggal = (d?: Date | null) => {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const waktuPkm = (epoch?: number | string | null, tanpaJam = false) => {
  const n = Number(epoch);
  if (!n) return "-";
  const d = new Date((n > 1e12 ? n / 1000 : n) * 1000);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", ...(tanpaJam ? {} : { hour: "2-digit", minute: "2-digit" }) });
};
export const opsi = (obj: Record<string, string>) => Object.entries(obj).map(([value, label]) => ({ value, label }));

export const NOMOR_KUNJUNGAN_ANC = ["K1", "K2", "K3", "K4", "K5", "K6"];
export const JENIS_SASARAN: Record<string, string> = { ibu_hamil: "Ibu Hamil", bayi: "Bayi", balita: "Balita" };
export const STATUS_SASARAN: Record<string, string> = { belum_dilayani: "Belum Dilayani", sudah_dilayani: "Sudah Dilayani" };
export const JENIS_KEGIATAN_UKM: Record<string, string> = { posyandu: "Posyandu", penyuluhan: "Penyuluhan", kesling: "Kesehatan Lingkungan", lainnya: "Lainnya" };
export const KELOMPOK_SASARAN_VAKSIN: Record<string, string> = { bayi: "Bayi", balita: "Balita", anak_sekolah: "Anak Sekolah", wus: "WUS" };
export const STATUS_KIRIM_SATUSEHAT: Record<string, string> = {
  tidak_berlaku: "Tidak Berlaku",
  menunggu: "Menunggu Kirim",
  terkirim: "Terkirim",
  gagal: "Gagal",
};

// ── Referensi (pencarian pasien/kunjungan/kelurahan untuk form)
export const cariPasienPkm = (cari: string) => apiProgramPuskesmasGet(`/referensi/pasien${qs({ cari })}`);
export const daftarKunjunganPasienPkm = (patientUuid: string, maternity?: boolean) =>
  apiProgramPuskesmasGet(`/referensi/kunjungan${qs({ patient_uuid: patientUuid, maternity: maternity === undefined ? undefined : maternity ? "1" : "0" })}`);
export const cariKelurahanPkm = (cari: string) => apiProgramPuskesmasGet(`/referensi/kelurahan${qs({ cari })}`);

// ── KIA: ANC, persalinan, nifas, kohort
export const daftarAncPkm = (params: Record<string, any> = {}) => apiProgramPuskesmasGet(`/kia/anc${qs(params)}`);
export const riwayatAncPkm = (patientUuid: string) => apiProgramPuskesmasGet(`/kia/anc/riwayat/${patientUuid}`);
export const simpanAncPkm = (data: Record<string, any>, uuid?: string) => (uuid ? apiProgramPuskesmasPut(`/kia/anc/${uuid}`, data) : apiProgramPuskesmasPost("/kia/anc", data));
export const hapusAncPkm = (uuid: string) => apiProgramPuskesmasDelete(`/kia/anc/${uuid}`);
export const daftarPersalinanPkm = (params: Record<string, any> = {}) => apiProgramPuskesmasGet(`/kia/persalinan${qs(params)}`);
export const simpanPersalinanPkm = (data: Record<string, any>) => apiProgramPuskesmasPost("/kia/persalinan", data);
export const daftarNifasPkm = (kiaPersalinanUuid: string) => apiProgramPuskesmasGet(`/kia/nifas${qs({ kia_persalinan_uuid: kiaPersalinanUuid })}`);
export const simpanNifasPkm = (data: Record<string, any>) => apiProgramPuskesmasPost("/kia/nifas", data);
export const kohortIbuPkm = (params: Record<string, any> = {}) => apiProgramPuskesmasGet(`/kia/kohort${qs(params)}`);

// ── KB
export const daftarKbPkm = (params: Record<string, any> = {}) => apiProgramPuskesmasGet(`/kb/pelayanan${qs(params)}`);
export const simpanKbPkm = (data: Record<string, any>, uuid?: string) => (uuid ? apiProgramPuskesmasPut(`/kb/pelayanan/${uuid}`, data) : apiProgramPuskesmasPost("/kb/pelayanan", data));
export const hapusKbPkm = (uuid: string) => apiProgramPuskesmasDelete(`/kb/pelayanan/${uuid}`);

// ── Imunisasi
export const daftarJenisVaksinPkm = (params: Record<string, any> = {}) => apiProgramPuskesmasGet(`/imunisasi/jenis-vaksin${qs(params)}`);
export const simpanJenisVaksinPkm = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiProgramPuskesmasPut(`/imunisasi/jenis-vaksin/${uuid}`, data) : apiProgramPuskesmasPost("/imunisasi/jenis-vaksin", data);
export const hapusJenisVaksinPkm = (uuid: string) => apiProgramPuskesmasDelete(`/imunisasi/jenis-vaksin/${uuid}`);
export const riwayatImunisasiPkm = (patientUuid: string) => apiProgramPuskesmasGet(`/imunisasi/riwayat/${patientUuid}`);
export const daftarImunisasiPkm = (params: Record<string, any> = {}) => apiProgramPuskesmasGet(`/imunisasi${qs(params)}`);
export const simpanImunisasiPkm = (data: Record<string, any>) => apiProgramPuskesmasPost("/imunisasi", data);
export const kirimUlangSatuSehatPkm = (uuid: string) => apiProgramPuskesmasPost(`/imunisasi/${uuid}/kirim-ulang`);

// ── MTBS/MTBM
export const daftarMtbsPkm = (params: Record<string, any> = {}) => apiProgramPuskesmasGet(`/mtbs${qs(params)}`);
export const detailMtbsPkm = (uuid: string) => apiProgramPuskesmasGet(`/mtbs/${uuid}`);
export const simpanMtbsPkm = (data: Record<string, any>, uuid?: string) => (uuid ? apiProgramPuskesmasPut(`/mtbs/${uuid}`, data) : apiProgramPuskesmasPost("/mtbs", data));
export const hapusMtbsPkm = (uuid: string) => apiProgramPuskesmasDelete(`/mtbs/${uuid}`);

// ── Sasaran Program
export const daftarSasaranPkm = (params: Record<string, any> = {}) => apiProgramPuskesmasGet(`/sasaran${qs(params)}`);
export const ringkasanSasaranPkm = (periode: string) => apiProgramPuskesmasGet(`/sasaran/ringkasan${qs({ periode })}`);
export const simpanSasaranPkm = (data: Record<string, any>) => apiProgramPuskesmasPost("/sasaran", data);
export const ubahSasaranPkm = (uuid: string, data: Record<string, any>) => apiProgramPuskesmasPut(`/sasaran/${uuid}`, data);

// ── Kegiatan UKM
export const daftarUkmPkm = (params: Record<string, any> = {}) => apiProgramPuskesmasGet(`/ukm/kegiatan${qs(params)}`);
export const ringkasanUkmPkm = (periode: string) => apiProgramPuskesmasGet(`/ukm/ringkasan${qs({ periode })}`);
export const simpanUkmPkm = (data: Record<string, any>, uuid?: string) => (uuid ? apiProgramPuskesmasPut(`/ukm/kegiatan/${uuid}`, data) : apiProgramPuskesmasPost("/ukm/kegiatan", data));
export const hapusUkmPkm = (uuid: string) => apiProgramPuskesmasDelete(`/ukm/kegiatan/${uuid}`);

// ── Laporan Dinkes
export const laporanLb1Pkm = (periode: string) => apiProgramPuskesmasGet(`/laporan/lb1${qs({ periode })}`);
export const laporanKiaPkm = (periode: string) => apiProgramPuskesmasGet(`/laporan/kia${qs({ periode })}`);
export const laporanImunisasiPkm = (periode: string) => apiProgramPuskesmasGet(`/laporan/imunisasi${qs({ periode })}`);
export const laporanProgramPkm = (periode: string) => apiProgramPuskesmasGet(`/laporan/program${qs({ periode })}`);
export const formatLaporanPkm = (jenis: string) => apiProgramPuskesmasGet(`/laporan/format/${jenis}`);
export const simpanFormatLaporanPkm = (jenis: string, data: Record<string, any>) => apiProgramPuskesmasPut(`/laporan/format/${jenis}`, data);
// Ekspor Excel: unduh berkas dan picu penyimpanan di peramban.
export const eksporLaporanPkm = async (jenis: string, periode: string) => {
  const res = await apiProgramPuskesmasDownload(`/laporan/${jenis}/ekspor${qs({ periode })}`);
  if (!res) return false;
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${jenis}-${periode}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  return true;
};
