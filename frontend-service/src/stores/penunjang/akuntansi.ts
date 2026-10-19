// API modul Akuntansi & Remunerasi (penunjang-service: /api/v3/penunjang/akuntansi, STD-0031). Request otomatis
// snake_case, respons camelCase; galat → toast + undefined (lihat apiHandler). Nominal dikirim & diterima sebagai teks
// 2 desimal (NUMERIC di database) — jangan dijumlahkan dengan float untuk keperluan pembukuan; tampilan saja.
import { apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";

export const MODUL_AKUNTANSI = "Akuntansi & Remunerasi";
export const STATUS_JURNAL: Record<string, string> = { menunggu: "Menunggu Persetujuan", final: "Final", ditolak: "Ditolak", dibatalkan: "Dibatalkan" };
export const JENIS_JURNAL: Record<string, string> = { otomatis: "Otomatis", manual: "Manual", penyesuaian: "Penyesuaian", koreksi: "Koreksi" };
export const STATUS_EVENT: Record<string, string> = { dijurnal: "Dijurnal", tertahan: "Tertahan", konflik: "Konflik", dilewati: "Dilewati" };
export const KELOMPOK_AKUN: Record<string, string> = { aset: "Aset", kewajiban: "Kewajiban", ekuitas: "Ekuitas", pendapatan: "Pendapatan", beban: "Beban" };
export const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const GAYA_STATUS: Record<string, string> = {
  final: "bg-[#ECFDF3] text-[#027A48]",
  dijurnal: "bg-[#ECFDF3] text-[#027A48]",
  terbuka: "bg-[#ECFDF3] text-[#027A48]",
  menunggu: "bg-[#FEF0C7] text-[#B54708]",
  tertahan: "bg-[#FEF0C7] text-[#B54708]",
  konflik: "bg-[#FEE4E2] text-[#B42318]",
  ditolak: "bg-[#FEE4E2] text-[#B42318]",
  tutup: "bg-[#F2F4F7] text-[#344054]",
  dibatalkan: "bg-[#F2F4F7] text-[#344054]",
  dilewati: "bg-[#F2F4F7] text-[#344054]",
};

// Izin aksi (tanpa daftar izin = super admin → boleh; backend tetap memeriksa izin).
export const izinAkuntansi = (submodul: string, aksi: string) => !getStoredPermissions().length || hasPermission(MODUL_AKUNTANSI, submodul, aksi, null);

// Rupiah dari teks/angka NUMERIC; negatif ditampilkan dalam kurung (konvensi laporan keuangan).
export const rupiah = (v?: string | number | null, kurung = true) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "-";
  const teks = Math.abs(n).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? (kurung ? `(${teks})` : `-${teks}`) : teks;
};
export const tanggalAk = (e?: number | string | null) => {
  const n = Number(e);
  return n ? new Date(n * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-";
};
export const waktuAk = (e?: number | string | null) => {
  const n = Number(e);
  return n ? new Date(n * 1000).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "-";
};
// Tanggal dari date picker (zona perangkat) → epoch tengah hari agar hari kalender sama di WIB.
export const epochHari = (d?: Date | null) => (d ? Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime() / 1000) : undefined);
export const tanggalDariEpoch = (e?: number | string | null) => (Number(e) ? new Date(Number(e) * 1000) : null);
export const namaPeriode = (tahun: number, bulan: number) => `${NAMA_BULAN[bulan - 1]} ${tahun}`;
// Kode snake_case dari kunci objek yang sudah dikonversi camelCase oleh axios.
export const kodeSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.append(kodeSnake(k), String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const referensiAkuntansi = () => apiPenunjangGet("/akuntansi/referensi");
// COA
export const daftarAkun = (params: Record<string, any> = {}) => apiPenunjangGet(`/akuntansi/akun${qs(params)}`);
export const simpanAkun = (data: Record<string, any>, uuid?: string) => (uuid ? apiPenunjangPut(`/akuntansi/akun/${uuid}`, data) : apiPenunjangPost("/akuntansi/akun", data));
export const pasangCoaBawaan = () => apiPenunjangPost("/akuntansi/akun/pasang-bawaan");
// Pemetaan
export const daftarPemetaan = () => apiPenunjangGet("/akuntansi/pemetaan");
export const simpanPemetaan = (data: Record<string, any>) => apiPenunjangPost("/akuntansi/pemetaan", data);
export const nonaktifPemetaan = (uuid: string) => apiPenunjangPost(`/akuntansi/pemetaan/${uuid}/nonaktif`);
// Jurnal & persetujuan
export const daftarJurnal = (params: Record<string, any> = {}) => apiPenunjangGet(`/akuntansi/jurnal${qs(params)}`);
export const detailJurnal = (uuid: string) => apiPenunjangGet(`/akuntansi/jurnal/${uuid}`);
export const buatJurnal = (data: Record<string, any>) => apiPenunjangPost("/akuntansi/jurnal", data);
export const setujuiJurnal = (uuid: string, catatan = "") => apiPenunjangPost(`/akuntansi/jurnal/${uuid}/setujui`, { catatan });
export const tolakJurnal = (uuid: string, alasan: string) => apiPenunjangPost(`/akuntansi/jurnal/${uuid}/tolak`, { alasan });
export const batalkanJurnal = (uuid: string) => apiPenunjangPost(`/akuntansi/jurnal/${uuid}/batalkan`);
export const koreksiJurnal = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`/akuntansi/jurnal/${uuid}/koreksi`, data);
// Jurnal otomatis
export const prosesJurnal = (data: Record<string, any>) => apiPenunjangPost("/akuntansi/proses", data);
export const pratinjauProses = (tahun: number, bulan: number) => apiPenunjangGet(`/akuntansi/proses/pratinjau${qs({ tahun, bulan })}`);
export const daftarEvent = (params: Record<string, any> = {}) => apiPenunjangGet(`/akuntansi/event${qs(params)}`);
export const selesaikanEvent = (uuid: string, alasan: string) => apiPenunjangPost(`/akuntansi/event/${uuid}/selesaikan`, { alasan });
// Buku besar & neraca saldo
export const bukuBesar = (params: Record<string, any>) => apiPenunjangGet(`/akuntansi/buku-besar${qs(params)}`);
export const neracaSaldo = (params: Record<string, any>) => apiPenunjangGet(`/akuntansi/neraca-saldo${qs(params)}`);
// Periode
export const daftarPeriode = (tahun: number) => apiPenunjangGet(`/akuntansi/periode${qs({ tahun })}`);
export const kesiapanPeriode = (tahun: number, bulan: number) => apiPenunjangGet(`/akuntansi/periode/kesiapan${qs({ tahun, bulan })}`);
export const tutupPeriode = (data: Record<string, any>) => apiPenunjangPost("/akuntansi/periode/tutup", data);
export const bukaPeriode = (data: Record<string, any>) => apiPenunjangPost("/akuntansi/periode/buka", data);
export const ambilPengaturan = () => apiPenunjangGet("/akuntansi/pengaturan");
export const simpanPengaturan = (data: Record<string, any>) => apiPenunjangPut("/akuntansi/pengaturan", data);
// Laporan (jenis: neraca | laba-rugi | arus-kas | perubahan-ekuitas | aging-piutang | aging-utang)
export const laporanAkuntansi = (jenis: string, params: Record<string, any> = {}) => apiPenunjangGet(`/akuntansi/laporan/${jenis}${qs(params)}`);
