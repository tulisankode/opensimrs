import { apiPenunjangGet, apiPenunjangPost, apiPenunjangPut, apiPenunjangPatch } from "@/utils/apiHandler";
import { baseInstanceMentah } from "@/utils/Api";
import { izinSdm } from "./sdm";

const basis = "/hr/kehadiran-cuti";
export const bolehKehadiran = (aksi: string) => izinSdm("Kehadiran, Cuti & Izin", aksi);
const qs = (data: Record<string, any>) => new URLSearchParams(Object.entries(data).filter(([, v]) => v !== "" && v != null).map(([k, v]) => [k.replace(/[A-Z]/g, (h) => `_${h.toLowerCase()}`), String(v)])).toString();
export const ambilKehadiran = (path: string, data: Record<string, any> = {}) => apiPenunjangGet(`${basis}${path}?${qs(data)}`);
export const kirimKehadiran = (path: string, data: Record<string, any>) => apiPenunjangPost(`${basis}${path}`, data);
export const simpanKehadiran = (path: string, data: Record<string, any>) => apiPenunjangPut(`${basis}${path}`, data);
export const koreksiKehadiran = (uuid: string, data: Record<string, any>) => apiPenunjangPatch(`${basis}/kehadiran/${uuid}/koreksi`, data);
export const ubahJenisCuti = (uuid: string, data: Record<string, any>) => apiPenunjangPatch(`${basis}/jenis-cuti/${uuid}`, data);
export const bacaBerkas = (berkas: File): Promise<string> => new Promise((resolve, reject) => {
  if (berkas.size > 5 * 1024 * 1024) { reject(new Error("Ukuran berkas maksimal 5 MB")); return; }
  const pembaca = new FileReader();
  pembaca.onload = () => resolve(String(pembaca.result).split(",")[1]);
  pembaca.onerror = () => reject(new Error("Berkas tidak dapat dibaca"));
  pembaca.readAsDataURL(berkas);
});
export const unduhKehadiran = async (path: string, nama: string) => {
  const hasil = await baseInstanceMentah.get(`${String(import.meta.env.VITE_BASE_PENUNJANG).replace(/\/$/, '')}${basis}${path}`, { responseType: "blob" });
  const url = URL.createObjectURL(hasil.data);
  const tautan = document.createElement("a");
  tautan.href = url; tautan.download = nama; tautan.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
