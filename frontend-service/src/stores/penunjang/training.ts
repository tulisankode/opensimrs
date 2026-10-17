// Training (kelas olahraga/edukasi: Zumba, Yoga, Pilates, edukasi) — API penunjang-service
// (/api/v3/penunjang/training/...). Order kelas membentuk tagihan Pembayaran, bukan kunjungan klinis/RME.
// Permintaan dikirim camelCase → snake_case otomatis; respons snake_case → camelCase otomatis.
// Parameter query ditulis snake_case karena tidak dikonversi (lihat apiHandler).
import { defineStore } from "pinia";
import { apiPenunjangGet, apiPenunjangPost, apiPenunjangPut, apiPenunjangDelete } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";

// Izin aksi modul Training (Setting › Hak Akses › Training). Tanpa daftar izin = super admin → boleh; backend
// menegakkan izin yang sama (403). Submodul: "Daftar Kelas", "Booking Kelas", "Datamaster", "Laporan".
export const izinTraining = (submodul: string, aksi: string | string[], fitur?: string) =>
  !getStoredPermissions().length || hasPermission("Training", submodul, aksi as any, fitur ?? null);

export const STATUS_ORDER: Record<string, { label: string; kelas: string }> = {
  booking: { label: "Booking", kelas: "bg-warning-50 text-warning-400 border-warning-75" },
  order: { label: "Terdaftar", kelas: "bg-success-50 text-success-400 border-success-75" },
  batal: { label: "Batal", kelas: "bg-danger-50 text-danger-300 border-danger-75" },
};

// ── Tipe data ──────────────────────────────────────────────────────────────────────
export interface Halaman<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPage: number };
}
export interface SesiKelas {
  uuid?: string;
  namaSesi: string;
  jamMulai?: string | null;
  jamSelesai?: string | null;
  urutan?: number;
}
export interface KelasTraining {
  uuid: string;
  kode: string;
  nama: string;
  jenis?: string | null;
  instruktur?: string | null;
  isSesi: boolean;
  jumlahSlot: number;
  harga: number;
  status: boolean;
  sesi: SesiKelas[];
}
export interface SlotSesi {
  sesiUuid?: string | null;
  namaSesi?: string | null;
  jamMulai?: string | null;
  jamSelesai?: string | null;
  kuota: number;
  terisi: number;
  tersedia: number;
}
export interface Ketersediaan {
  kelasUuid: string;
  tanggalKelas: string;
  isSesi: boolean;
  kuota?: number;
  terisi?: number;
  tersedia?: number;
  sesi?: SlotSesi[];
}
export interface OrderTraining {
  uuid: string;
  noOrder: string;
  kelasUuid: string;
  kelasKode?: string;
  kelasNama: string;
  kelasJenis?: string | null;
  instruktur?: string | null;
  isSesi: boolean;
  sesiUuid?: string | null;
  namaSesi?: string | null;
  jamMulai?: string | null;
  jamSelesai?: string | null;
  tanggalKelas: string;
  patientUuid: string;
  noRm?: string | null;
  namaPasien?: string | null;
  gender?: string | null;
  noHp?: string | null;
  paymentMethod?: number | null;
  penjaminUuid?: string | null;
  harga: number;
  status: "booking" | "order" | "batal";
  alasanBatal?: string | null;
  dibatalkanOleh?: string | null;
  dibatalkanPada?: number | null;
  dibuatOleh?: string | null;
  createdAt: number;
}
export interface PasienRingkas {
  uuid: string;
  noRm: string;
  name: string;
  gender?: string | null;
  phone?: string | null;
  birthDate?: string | null;
}
export interface RingkasanLaporan {
  totalPeserta: number;
  totalPasien: number;
  totalTarif: number;
}
export interface BarisLaporan {
  uuid: string;
  tanggalKelas: string;
  kelasNama: string;
  namaSesi?: string | null;
  noRm?: string | null;
  namaPasien?: string | null;
  paymentMethod?: number | null;
  status: string;
  harga: number;
  noOrder: string;
}

const qs = (obj: Record<string, unknown>) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(Array.isArray(v) ? v.join(",") : String(v))}`)
    .join("&");

// ── API ────────────────────────────────────────────────────────────────────────────
const B = "/training";
export const apiTraining = {
  cariPasien: (cari: string) => apiPenunjangGet(`${B}/pasien?${qs({ cari })}`),

  daftarKelas: (q: { page?: number; limit?: number; cari?: string; status?: string } = {}) => apiPenunjangGet(`${B}/kelas?${qs(q)}`),
  detailKelas: (uuid: string) => apiPenunjangGet(`${B}/kelas/${uuid}`),
  simpanKelas: (data: Record<string, unknown>, uuid?: string) => (uuid ? apiPenunjangPut(`${B}/kelas/${uuid}`, data) : apiPenunjangPost(`${B}/kelas`, data)),
  hapusKelas: (uuid: string) => apiPenunjangDelete(`${B}/kelas/${uuid}`),
  imporKelas: (baris: Record<string, unknown>[]) => apiPenunjangPost(`${B}/kelas/impor`, { baris }),

  slot: (kelasUuid: string, tanggalKelas: string) => apiPenunjangGet(`${B}/slot?${qs({ kelas_uuid: kelasUuid, tanggal_kelas: tanggalKelas })}`),

  daftarBooking: (q: Record<string, unknown> = {}) => apiPenunjangGet(`${B}/booking?${qs(q)}`),
  detailBooking: (uuid: string) => apiPenunjangGet(`${B}/booking/${uuid}`),
  buatBooking: (data: { kelasUuid: string; tanggalKelas: string; sesiUuid?: string | null; patientUuid: string }) => apiPenunjangPost(`${B}/booking`, data),
  ubahBooking: (uuid: string, data: Record<string, unknown>) => apiPenunjangPut(`${B}/booking/${uuid}`, data),
  lanjutDaftar: (uuid: string, data: { paymentMethod: number; penjaminUuid?: string | null }) => apiPenunjangPost(`${B}/booking/${uuid}/daftar`, data),
  batalBooking: (uuid: string, alasan: string) => apiPenunjangPut(`${B}/booking/${uuid}/batal`, { alasan }),

  daftarOrder: (q: Record<string, unknown> = {}) => apiPenunjangGet(`${B}/order?${qs(q)}`),
  detailOrder: (uuid: string) => apiPenunjangGet(`${B}/order/${uuid}`),
  buatOrder: (data: { kelasUuid: string; tanggalKelas: string; sesiUuid?: string | null; patientUuid: string; paymentMethod: number; penjaminUuid?: string | null }) =>
    apiPenunjangPost(`${B}/order`, data),
  batalOrder: (uuid: string, alasan: string) => apiPenunjangPut(`${B}/order/${uuid}/batal`, { alasan }),

  laporanRekapitulasi: (q: { tanggalMulai?: string; tanggalSelesai?: string; kelasUuid?: string; page?: number; limit?: number } = {}) =>
    apiPenunjangGet(
      `${B}/laporan/rekapitulasi?${qs({ tanggal_mulai: q.tanggalMulai, tanggal_selesai: q.tanggalSelesai, kelas_uuid: q.kelasUuid, page: q.page, limit: q.limit })}`,
    ),
};

export const rupiah = (n?: number | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n) || 0);

// Store ringan: cache datamaster kelas aktif (dipakai form booking/pendaftaran).
export const useTrainingStore = defineStore("penunjangTraining", {
  state: () => ({
    kelas: [] as KelasTraining[],
  }),
  actions: {
    async muatKelas(paksa = false) {
      if (this.kelas.length && !paksa) return this.kelas;
      const r = await apiTraining.daftarKelas({ limit: 9999, status: "true" });
      this.kelas = r?.payload?.data ?? [];
      return this.kelas;
    },
  },
});
