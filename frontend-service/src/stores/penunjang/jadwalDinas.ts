import { baseInstancePenunjang } from "@/utils/Api";
import { izinSdm } from "./sdm";

export interface PolaShift { uuid: string; kode: string; nama: string; mulaiMenit: number; selesaiMenit: number; lintasHari: boolean; libur: boolean; aktif: boolean; versiKunci: number; unitUuid?: string | null }
export interface VersiJadwal { uuid: string; jadwalUuid: string; unitUuid: string; periodeMulai: number; nomorVersi: number; versiKunci: number; status: string; versiAktifUuid?: string; alasanRevisi?: string }
export interface Penempatan { uuid?: string; kepegawaianUuid: string; polaShiftUuid: string; tanggalKerja: number; nama?: string; mulaiEpoch?: number; selesaiEpoch?: number; potretShift?: Pick<PolaShift, "kode" | "nama" | "mulaiMenit" | "selesaiMenit" | "lintasHari" | "libur"> }
export interface Temuan { aturan: string; tingkat: string; message: string; kepegawaianUuid?: string; tanggalKerja?: number; jedaMenit?: number; minimumMenit?: number; aktualMenit?: number; maksimumMenit?: number; minimumStaf?: number; kekurangan?: number }
export const bolehJadwal = izinSdm;
export class GalatJadwal extends Error {
  constructor(public status: number, message: string, public payload: any) { super(message); }
}
export const apiJadwal = async (path: string, metode: "get" | "post" | "put" | "delete" = "get", data?: object): Promise<any> => {
  try {
    const hasil = await baseInstancePenunjang.request({ url: `/hr/jadwal-dinas${path}`, method: metode, data });
    return hasil.data.payload;
  } catch (e: any) {
    throw new GalatJadwal(e.response?.status ?? 500, e.response?.status === 409 ? "Data berubah. Muat ulang lalu tinjau perubahan Anda sebelum menyimpan kembali." : e.response?.data?.message ?? "Permintaan gagal diproses", e.response?.data?.payload);
  }
};
export const kueriJadwal = (obj: Record<string, any>) => `?${new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== undefined && v !== "" && v !== null).map(([k, v]) => [k.replace(/[A-Z]/g, (x) => `_${x.toLowerCase()}`), String(v)]))}`;
export const epochWib = (tanggal: string) => Math.floor(Date.parse(`${tanggal}T00:00:00+07:00`) / 1000);
export const isoWib = (epoch: number) => new Date((Number(epoch) + 25200) * 1000).toISOString().slice(0, 10);
export const tanggalJadwal = (epoch?: number) => epoch == null ? "—" : new Date(Number(epoch) * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
export const hariBulan = (periode: number) => {
  const d = new Date((Number(periode) + 25200) * 1000), jumlah = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: jumlah }, (_, i) => Number(periode) + i * 86400);
};
export const amanCsv = (nilai: unknown) => `"${String(nilai ?? "").replace(/^[\s\u0000-\u001f]*[=+@-]/, (x) => `'${x}`).replace(/"/g, '""')}"`;
