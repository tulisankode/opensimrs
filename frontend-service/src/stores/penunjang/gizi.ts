// API modul Gizi (penunjang-service: /api/v3/penunjang/gizi). Request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler).
import { apiPenunjangDelete, apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";
export { keTanggal, waktuRad as waktuGizi } from "@/stores/penunjang/radiologi";

export const WAKTU_MAKAN_GIZI: Record<string, string> = { pagi: "Pagi", siang: "Siang", sore: "Sore", snack: "Snack" };
export const RUTE_DIET_GIZI: Record<string, string> = { oral: "Oral", enteral: "Enteral", parenteral: "Parenteral" };
export const OPSI_WAKTU_MAKAN = Object.entries(WAKTU_MAKAN_GIZI).map(([value, label]) => ({ value, label }));
export const OPSI_RUTE_DIET = Object.entries(RUTE_DIET_GIZI).map(([value, label]) => ({ value, label }));

export const BELUM_KONFIRMASI_ALERGI = "Belum tercatat/perlu konfirmasi";

type Gaya = { label: string; bg: string; text: string };
export const KATEGORI_RISIKO_GIZI: Record<string, Gaya> = {
  berisiko: { label: "Berisiko", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  tidak_berisiko: { label: "Tidak berisiko", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
};
export const STATUS_ORDER_DIET: Record<string, Gaya> = {
  aktif: { label: "Aktif", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  dibatalkan: { label: "Dibatalkan", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const gayaRisikoGizi = (s?: string) => KATEGORI_RISIKO_GIZI[s ?? ""] ?? KATEGORI_RISIKO_GIZI.tidak_berisiko;
export const gayaOrderDiet = (s?: string) => STATUS_ORDER_DIET[s ?? ""] ?? STATUS_ORDER_DIET.aktif;

// Izin aksi modul (tanpa daftar izin = super admin → boleh; backend tetap memeriksa login).
export const izinGizi = (submodul: string, aksi: string, fitur?: string) =>
  !getStoredPermissions().length || hasPermission("Gizi", submodul, aksi, fitur ?? null);

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

// ── Referensi (instrumen skrining, waktu makan, ruangan berisi pasien aktif)
export const referensiGizi = () => apiPenunjangGet("/gizi/referensi");

// ── Rawat inap: pasien aktif, belum skrining & daftar kerja ahli gizi
export const pasienAktifGizi = (params: Record<string, any> = {}) => apiPenunjangGet(`/gizi/rawat-inap/aktif${qs(params)}`);
export const belumSkriningGizi = (params: Record<string, any> = {}) => apiPenunjangGet(`/gizi/rawat-inap/belum-skrining${qs(params)}`);
export const daftarKerjaAsesmenGizi = (params: Record<string, any> = {}) => apiPenunjangGet(`/gizi/asesmen/daftar-kerja${qs(params)}`);

// ── Skrining
export const simpanSkriningGizi = (
  admissionRiUuid: string,
  data: { instrumen: string; jawaban: { kode: string; nilai: string }[]; waktuSkrining?: number },
) => apiPenunjangPost(`/gizi/rawat-inap/${admissionRiUuid}/skrining`, data);
export const detailSkriningGizi = (uuid: string) => apiPenunjangGet(`/gizi/skrining/${uuid}`);

// ── Asesmen & asuhan gizi (PAGT)
export const riwayatAsesmenGizi = (admissionRiUuid: string) => apiPenunjangGet(`/gizi/rawat-inap/${admissionRiUuid}/asesmen`);
export const simpanAsesmenGizi = (
  admissionRiUuid: string,
  data: { asesmen: string; diagnosisGizi: string; intervensi: string; monitoringEvaluasi?: string },
) => apiPenunjangPost(`/gizi/rawat-inap/${admissionRiUuid}/asesmen`, data);
export const ubahAsesmenGizi = (uuid: string, data: Record<string, any>) => apiPenunjangPut(`/gizi/asesmen/${uuid}`, data);

// ── Order diet
export const orderDietGizi = (admissionRiUuid: string) => apiPenunjangGet(`/gizi/rawat-inap/${admissionRiUuid}/order-diet`);
export const buatOrderDietGizi = (
  admissionRiUuid: string,
  data: { dietUuid: string; bentukMakananUuid: string; kalori?: number; rute?: string; pantangan?: string; waktuMulai?: number },
) => apiPenunjangPost(`/gizi/rawat-inap/${admissionRiUuid}/order-diet`, data);
export const ubahOrderDietGizi = (uuid: string, data: Record<string, any>) => apiPenunjangPut(`/gizi/order-diet/${uuid}`, data);
export const batalOrderDietGizi = (uuid: string, alasanBatal: string) =>
  apiPenunjangPut(`/gizi/order-diet/${uuid}`, { status: "dibatalkan", alasanBatal });

// ── Datamaster: diet / bentuk makanan / standar porsi
export const daftarDietGizi = (params: Record<string, any> = {}) => apiPenunjangGet(`/gizi/master/diet${qs(params)}`);
export const simpanDietGizi = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/gizi/master/diet/${uuid}`, data) : apiPenunjangPost("/gizi/master/diet", data);
export const hapusDietGizi = (uuid: string) => apiPenunjangDelete(`/gizi/master/diet/${uuid}`);

export const daftarBentukMakananGizi = (params: Record<string, any> = {}) => apiPenunjangGet(`/gizi/master/bentuk-makanan${qs(params)}`);
export const simpanBentukMakananGizi = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/gizi/master/bentuk-makanan/${uuid}`, data) : apiPenunjangPost("/gizi/master/bentuk-makanan", data);
export const hapusBentukMakananGizi = (uuid: string) => apiPenunjangDelete(`/gizi/master/bentuk-makanan/${uuid}`);

export const daftarStandarPorsiGizi = (params: Record<string, any> = {}) => apiPenunjangGet(`/gizi/master/standar-porsi${qs(params)}`);
export const simpanStandarPorsiGizi = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/gizi/master/standar-porsi/${uuid}`, data) : apiPenunjangPost("/gizi/master/standar-porsi", data);
export const hapusStandarPorsiGizi = (uuid: string) => apiPenunjangDelete(`/gizi/master/standar-porsi/${uuid}`);

// ── Distribusi makan & rekap porsi
type FilterDistribusi = { tanggal: string; ruanganUuid: string; waktuMakan: string };
const qsDistribusi = (p: FilterDistribusi) => qs({ tanggal: p.tanggal, ruangan_uuid: p.ruanganUuid, waktu_makan: p.waktuMakan });
export const lihatDistribusiGizi = (params: FilterDistribusi) => apiPenunjangGet(`/gizi/distribusi${qsDistribusi(params)}`);
export const bentukDistribusiGizi = (data: FilterDistribusi) => apiPenunjangPost("/gizi/distribusi", data);
export const cetakDistribusiGizi = (uuid: string) => apiPenunjangPost(`/gizi/distribusi/${uuid}/cetak`);
export const rekapPorsiGizi = (params: FilterDistribusi) => apiPenunjangGet(`/gizi/distribusi/rekap-porsi${qsDistribusi(params)}`);

// ── Laporan
export const laporanJumlahDietGizi = (params: Record<string, any> = {}) => apiPenunjangGet(`/gizi/laporan/jumlah-diet${qs(params)}`);
export const laporanCakupanSkriningGizi = (params: Record<string, any> = {}) => apiPenunjangGet(`/gizi/laporan/cakupan-skrining${qs(params)}`);
