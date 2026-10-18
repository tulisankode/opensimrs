// API modul Manajemen Ambulans (penunjang-service: /api/v3/penunjang/ambulans). Request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler).
import { apiPenunjangGet, apiPenunjangPatch, apiPenunjangPost, apiPenunjangPut, apiPenunjangDelete } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";
export { waktuRad as waktuAmbulans, rupiahRad as rupiahAmbulans } from "@/stores/penunjang/radiologi";

export const JENIS_ARMADA: Record<string, string> = { transport: "Transport", gawat_darurat: "Gawat Darurat", jenazah: "Jenazah" };
export const STATUS_ARMADA: Record<string, string> = { siap: "Siap", bertugas: "Bertugas", servis: "Servis" };
export const PERAN_KRU: Record<string, string> = { sopir: "Sopir", perawat: "Perawat Pendamping" };
export const SUMBER_PERMINTAAN: Record<string, string> = { igd: "IGD", ruangan: "Ruangan", telepon: "Telepon/Masyarakat", rujukan: "Rujukan" };
export const JENIS_LAYANAN: Record<string, string> = { gawat_darurat: "Gawat Darurat", rujukan: "Rujukan", pemulangan: "Pemulangan", jenazah: "Jenazah" };
export const PRIORITAS: Record<string, string> = { darurat: "Darurat", segera: "Segera", biasa: "Biasa" };
export const STATUS_PERMINTAAN: Record<string, string> = { menunggu: "Menunggu Penugasan", ditugaskan: "Ditugaskan", proses: "Proses", selesai: "Selesai", batal: "Batal" };
export const TAHAP_PERJALANAN: Record<string, string> = {
  berangkat: "Berangkat dari Faskes", tiba_lokasi: "Tiba di Lokasi Jemput", berangkat_tujuan: "Berangkat ke Tujuan", tiba_tujuan: "Tiba di Tujuan", kembali: "Kembali ke Faskes",
};
export const METODE_TARIF: Record<string, string> = { jenis: "Per Jenis Layanan", per_km: "Per Kilometer", zona: "Per Zona" };
export const STATUS_PENERUSAN: Record<string, string> = { belum_dihitung: "Belum Dihitung", menunggu: "Menunggu Diteruskan", terkirim: "Terkirim", gagal: "Gagal" };

type Gaya = { label: string; bg: string; text: string };
export const GAYA_STATUS_PERMINTAAN: Record<string, Gaya> = {
  menunggu: { label: "Menunggu Penugasan", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  ditugaskan: { label: "Ditugaskan", bg: "bg-[#E0EAFF]", text: "text-[#3538CD]" },
  proses: { label: "Proses", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  selesai: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  batal: { label: "Batal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const gayaStatusPermintaan = (s?: string) => GAYA_STATUS_PERMINTAAN[s ?? ""] ?? GAYA_STATUS_PERMINTAAN.menunggu;
export const GAYA_STATUS_ARMADA: Record<string, Gaya> = {
  siap: { label: "Siap", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  bertugas: { label: "Bertugas", bg: "bg-[#E0EAFF]", text: "text-[#3538CD]" },
  servis: { label: "Servis", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const gayaStatusArmada = (s?: string) => GAYA_STATUS_ARMADA[s ?? ""] ?? GAYA_STATUS_ARMADA.siap;

// Izin aksi modul (tanpa daftar izin = super admin → boleh; backend tetap memeriksa login).
export const izinAmbulans = (submodul: string, aksi: string, fitur?: string) =>
  !getStoredPermissions().length || hasPermission("Manajemen Ambulans", submodul, aksi, fitur ?? null);

export const opsi = (obj: Record<string, string>) => Object.entries(obj).map(([value, label]) => ({ value, label }));

// Konversi tanggal/waktu Vue (Date) ⟷ epoch detik yang disimpan backend.
export const epochDariTanggal = (d?: Date | null) => (d ? Math.floor(d.getTime() / 1000) : undefined);
export const tanggalDariEpoch = (e?: number | string | null) => {
  const n = Number(e);
  return n ? new Date((n > 1e12 ? n / 1000 : n) * 1000) : null;
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

// ── Armada ───────────────────────────────────────────────────────────────────
export const daftarArmada = (params: Record<string, any> = {}) => apiPenunjangGet(`/ambulans/armada${qs(params)}`);
export const detailArmada = (uuid: string) => apiPenunjangGet(`/ambulans/armada/${uuid}`);
export const simpanArmada = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/ambulans/armada/${uuid}`, data) : apiPenunjangPost("/ambulans/armada", data);
export const ubahStatusArmada = (uuid: string, status: string, catatan?: string) => apiPenunjangPatch(`/ambulans/armada/${uuid}/status`, { status, catatan });
export const riwayatServisArmada = (uuid: string, params: Record<string, any> = {}) => apiPenunjangGet(`/ambulans/armada/${uuid}/servis${qs(params)}`);
export const catatServisArmada = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`/ambulans/armada/${uuid}/servis`, data);

// ── Kru & jadwal jaga ────────────────────────────────────────────────────────
export const daftarKru = (params: Record<string, any> = {}) => apiPenunjangGet(`/ambulans/kru${qs(params)}`);
export const simpanKru = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/ambulans/kru/${uuid}`, data) : apiPenunjangPost("/ambulans/kru", data);
export const jadwalJagaKru = (uuid: string, params: Record<string, any> = {}) => apiPenunjangGet(`/ambulans/kru/${uuid}/jadwal${qs(params)}`);
export const tambahJadwalJagaKru = (uuid: string, data: { waktu_mulai: number; waktu_selesai: number }) => apiPenunjangPost(`/ambulans/kru/${uuid}/jadwal`, data);
export const hapusJadwalJagaKru = (uuid: string, jadwalUuid: string) => apiPenunjangDelete(`/ambulans/kru/${uuid}/jadwal/${jadwalUuid}`);

// ── Permintaan ───────────────────────────────────────────────────────────────
export const daftarPermintaan = (params: Record<string, any> = {}) => apiPenunjangGet(`/ambulans/permintaan${qs(params)}`);
export const detailPermintaan = (uuid: string) => apiPenunjangGet(`/ambulans/permintaan/${uuid}`);
export const buatPermintaan = (data: Record<string, any>) => apiPenunjangPost("/ambulans/permintaan", data);
export const batalPermintaan = (uuid: string, alasan: string) => apiPenunjangPost(`/ambulans/permintaan/${uuid}/batal`, { alasan });

// ── Penugasan ────────────────────────────────────────────────────────────────
export const daftarPenugasanAktif = () => apiPenunjangGet(`/ambulans/penugasan`);
export const tugaskanArmada = (permintaanUuid: string, data: { armada_uuid: string; sopir_kru_uuid: string; perawat_kru_uuid?: string }) =>
  apiPenunjangPost(`/ambulans/permintaan/${permintaanUuid}/penugasan`, data);
export const batalPenugasan = (uuid: string, alasan: string) => apiPenunjangPost(`/ambulans/penugasan/${uuid}/batal`, { alasan });

// ── Perjalanan ───────────────────────────────────────────────────────────────
export const mulaiPerjalanan = (penugasanUuid: string) => apiPenunjangPost(`/ambulans/penugasan/${penugasanUuid}/perjalanan`);
export const catatTahapPerjalanan = (uuid: string, data: { tahap: string; waktu?: number; km_awal?: number; km_akhir?: number }) =>
  apiPenunjangPatch(`/ambulans/perjalanan/${uuid}/tahap`, data);
export const selesaikanPerjalanan = (
  uuid: string,
  data: { km_akhir: number; bbm_nilai?: number; bbm_satuan?: string; catatan_pendamping?: string; status_armada: string; zona?: string },
) => apiPenunjangPatch(`/ambulans/perjalanan/${uuid}/selesai`, data);

// ── Tarif ────────────────────────────────────────────────────────────────────
export const daftarTarif = (params: Record<string, any> = {}) => apiPenunjangGet(`/ambulans/tarif${qs(params)}`);
export const simpanTarif = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/ambulans/tarif/${uuid}`, data) : apiPenunjangPost("/ambulans/tarif", data);
export const nonaktifkanTarif = (uuid: string) => apiPenunjangDelete(`/ambulans/tarif/${uuid}`);

// ── Biaya & kuitansi ─────────────────────────────────────────────────────────
export const teruskanBiaya = (biayaUuid: string) => apiPenunjangPost(`/ambulans/biaya/${biayaUuid}/teruskan`);
export const daftarKuitansi = (params: Record<string, any> = {}) => apiPenunjangGet(`/ambulans/kuitansi${qs(params)}`);
export const detailKuitansi = (uuid: string) => apiPenunjangGet(`/ambulans/kuitansi/${uuid}`);

// ── Laporan ──────────────────────────────────────────────────────────────────
export const laporanAmbulans = (params: { tanggal_mulai: number; tanggal_selesai: number }) => apiPenunjangGet(`/ambulans/laporan${qs(params)}`);
