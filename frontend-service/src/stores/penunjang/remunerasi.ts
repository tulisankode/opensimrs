// API Remunerasi — jasa pelayanan (jaspel) dokter & tenaga kesehatan (penunjang-service: /api/v3/penunjang/akuntansi/
// remunerasi, STD-0032). Request otomatis snake_case, respons camelCase; galat → toast + undefined (lihat apiHandler).
// Nominal & persen dikirim/diterima sebagai teks 2 desimal (dihitung dalam sen di backend) — tampilan saja di sini.
import { apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";
import { MODUL_AKUNTANSI, kodeSnake } from "@/stores/penunjang/akuntansi";

export const SUB_REMUNERASI = {
  konfigurasi: "Konfigurasi Remunerasi",
  periode: "Periode Remunerasi",
  verifikasi: "Verifikasi Remunerasi",
  persetujuan: "Persetujuan Remunerasi",
  pembayaran: "Pembayaran Remunerasi",
  slip: "Slip Remunerasi",
  rekap: "Rekap Remunerasi",
} as const;
export const STATUS_PERIODE_REMUN: Record<string, string> = {
  draf: "Draf",
  dihitung: "Dihitung",
  diverifikasi: "Diverifikasi",
  disetujui: "Disetujui",
  dibayar: "Dibayar",
};
export const GAYA_STATUS_REMUN: Record<string, string> = {
  draf: "bg-[#F2F4F7] text-[#344054]",
  dihitung: "bg-[#FEF0C7] text-[#B54708]",
  diverifikasi: "bg-[#EFF8FF] text-[#175CD3]",
  disetujui: "bg-[#ECFDF3] text-[#027A48]",
  dibayar: "bg-[#ECFDF3] text-[#027A48]",
  disahkan: "bg-[#ECFDF3] text-[#027A48]",
  pengecualian: "bg-[#FEE4E2] text-[#B42318]",
};

// Izin aksi (tanpa daftar izin = super admin → boleh; backend tetap memeriksa izin).
export const izinRemunerasi = (sub: keyof typeof SUB_REMUNERASI, aksi: string) =>
  !getStoredPermissions().length || hasPermission(MODUL_AKUNTANSI, SUB_REMUNERASI[sub], aksi, null);

// Objek berkunci kode snake_case (mis. indeks profesi) dari respons camelCase.
export const keSnake = (o: Record<string, any> = {}) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [kodeSnake(k), v]));
export const persen = (bp?: number | string | null) => `${(Number(bp ?? 0) / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.append(kodeSnake(k), String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};
const D = "/akuntansi/remunerasi";

export const referensiRemunerasi = () => apiPenunjangGet(`${D}/referensi`);
// Konfigurasi
export const daftarSkema = () => apiPenunjangGet(`${D}/skema`);
export const simpanSkema = (data: Record<string, any>, uuid?: string) => (uuid ? apiPenunjangPut(`${D}/skema/${uuid}`, data) : apiPenunjangPost(`${D}/skema`, data));
export const sahkanSkema = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`${D}/skema/${uuid}/sahkan`, data);
export const daftarPenerima = () => apiPenunjangGet(`${D}/penerima`);
export const daftarPraktisi = () => apiPenunjangGet(`${D}/praktisi`);
export const simpanPenerima = (data: Record<string, any>, uuid?: string) => (uuid ? apiPenunjangPut(`${D}/penerima/${uuid}`, data) : apiPenunjangPost(`${D}/penerima`, data));
// Periode
export const daftarPeriodeRemun = (params: Record<string, any> = {}) => apiPenunjangGet(`${D}/periode${qs(params)}`);
export const buatPeriodeRemun = (data: Record<string, any>) => apiPenunjangPost(`${D}/periode`, data);
export const detailPeriodeRemun = (uuid: string) => apiPenunjangGet(`${D}/periode/${uuid}`);
export const sumberPeriodeRemun = (uuid: string, params: Record<string, any> = {}) => apiPenunjangGet(`${D}/periode/${uuid}/sumber${qs(params)}`);
export const hitungPeriodeRemun = (uuid: string) => apiPenunjangPost(`${D}/periode/${uuid}/hitung`);
export const simpanKinerja = (uuid: string, data: any[]) => apiPenunjangPut(`${D}/periode/${uuid}/kinerja`, { data });
export const tambahKoreksi = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`${D}/periode/${uuid}/koreksi`, data);
export const hapusKoreksi = (uuid: string, koreksi: string, alasan: string) => apiPenunjangPost(`${D}/periode/${uuid}/koreksi/${koreksi}/hapus`, { alasan });
export const tanganiPengecualian = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`${D}/periode/${uuid}/pengecualian`, data);
export const verifikasiPeriodeRemun = (uuid: string, catatan = "") => apiPenunjangPost(`${D}/periode/${uuid}/verifikasi`, { catatan });
export const kembalikanPeriodeRemun = (uuid: string, alasan: string) => apiPenunjangPost(`${D}/periode/${uuid}/kembalikan`, { alasan });
export const setujuiPeriodeRemun = (uuid: string, catatan = "") => apiPenunjangPost(`${D}/periode/${uuid}/setujui`, { catatan });
export const bayarPeriodeRemun = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`${D}/periode/${uuid}/bayar`, data);
// Slip & rekap (hanya periode disetujui/dibayar)
export const slipSaya = () => apiPenunjangGet(`${D}/slip/saya`);
export const detailSlipSaya = (periode: string) => apiPenunjangGet(`${D}/slip/saya/${periode}`);
export const slipPenerima = (periode: string, practitioner: string) => apiPenunjangGet(`${D}/slip/${periode}/${practitioner}`);
export const rekapRemunerasi = (periodeUuid: string, ekspor?: string) => apiPenunjangGet(`${D}/rekap${qs({ periodeUuid, ekspor })}`);
