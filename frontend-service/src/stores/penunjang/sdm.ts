// API modul HR / SDM — kepegawaian (penunjang-service: /api/v3/penunjang/hr, STD-0035 fase 1). Request otomatis
// snake_case, respons camelCase; galat → toast + undefined (lihat apiHandler). Kredensial pegawai memakai API kredensial
// staf di stores/penunjang/mutu.ts dengan basis "/hr" (satu sumber data dengan Mutu & Akreditasi).
import { apiPenunjangDelete, apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";

export const MODUL_SDM = "HR / SDM";
export const STATUS_KEPEGAWAIAN: Record<string, string> = { tetap: "Pegawai Tetap", kontrak: "Kontrak", honorer: "Honorer", magang: "Magang", purna_tugas: "Purna Tugas" };
export const JENJANG_PENDIDIKAN: Record<string, string> = {
  sd: "SD",
  smp: "SMP",
  sma: "SMA/SMK",
  d1: "D1",
  d2: "D2",
  d3: "D3",
  d4: "D4 / Sarjana Terapan",
  s1: "S1",
  profesi: "Profesi",
  s2: "S2",
  spesialis: "Spesialis",
  s3: "S3",
  subspesialis: "Subspesialis",
};
// Label kolom riwayat (jenis_perubahan berisi nama kolom yang berubah, dipisah koma).
export const LABEL_PERUBAHAN: Record<string, string> = {
  awal: "Awal",
  aktif_kembali: "Aktif kembali",
  status_kepegawaian: "Status",
  unit_uuid: "Unit",
  jabatan: "Jabatan",
  golongan: "Golongan",
};
export const labelPerubahan = (jenis?: string | null) =>
  (jenis ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => LABEL_PERUBAHAN[x] ?? x)
    .join(", ") || "-";

// Izin aksi (tanpa daftar izin = super admin → boleh; backend tetap memeriksa izin).
export const izinSdm = (submodul: string, aksi: string) => !getStoredPermissions().length || hasPermission(MODUL_SDM, submodul, aksi, null);

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.append(k.replace(/[A-Z]/g, (h) => `_${h.toLowerCase()}`), String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const referensiSdm = () => apiPenunjangGet("/hr/referensi");
export const daftarKepegawaian = (params: Record<string, any> = {}) => apiPenunjangGet(`/hr/kepegawaian${qs(params)}`);
export const calonKepegawaian = (cari = "") => apiPenunjangGet(`/hr/kepegawaian/calon${qs({ cari })}`);
export const detailKepegawaian = (uuid: string) => apiPenunjangGet(`/hr/kepegawaian/${uuid}`);
export const buatKepegawaian = (data: Record<string, any>) => apiPenunjangPost("/hr/kepegawaian", data);
export const ubahKepegawaian = (uuid: string, data: Record<string, any>) => apiPenunjangPut(`/hr/kepegawaian/${uuid}`, data);
export const hapusKepegawaian = (uuid: string) => apiPenunjangDelete(`/hr/kepegawaian/${uuid}`);
export const simpanPendidikan = (uuid: string, data: Record<string, any>, pendidikanUuid?: string) =>
  pendidikanUuid ? apiPenunjangPut(`/hr/kepegawaian/${uuid}/pendidikan/${pendidikanUuid}`, data) : apiPenunjangPost(`/hr/kepegawaian/${uuid}/pendidikan`, data);
export const hapusPendidikan = (uuid: string, pendidikanUuid: string) => apiPenunjangDelete(`/hr/kepegawaian/${uuid}/pendidikan/${pendidikanUuid}`);
export const tautkanAkun = (uuid: string, username: string) => apiPenunjangPost(`/hr/kepegawaian/${uuid}/akun`, { username });
export const lepasAkun = (uuid: string, akunUuid: string) => apiPenunjangDelete(`/hr/kepegawaian/${uuid}/akun/${akunUuid}`);
