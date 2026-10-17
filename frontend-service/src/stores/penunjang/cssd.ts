// API modul CSSD (penunjang-service: /api/v3/penunjang/cssd). Request otomatis snake_case, respons camelCase;
// galat → toast + undefined (lihat apiHandler).
import { apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";

type Gaya = { label: string; bg: string; text: string };

export const STATUS_SET_CSSD: Record<string, Gaya> = {
  kotor: { label: "Kotor", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  dekontaminasi: { label: "Dalam Dekontaminasi", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  dikemas: { label: "Dikemas", bg: "bg-[#EBE9FE]", text: "text-[#5925DC]" },
  menunggu_tindakan: { label: "Menunggu Tindak Lanjut", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  dalam_load: { label: "Dalam Load", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  menunggu_keputusan: { label: "Menunggu Keputusan", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  layak: { label: "Layak/Steril", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  tidak_layak: { label: "Tidak Layak", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  dikarantina: { label: "Dikarantina", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  hilang: { label: "Hilang", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  rusak: { label: "Rusak", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_LOAD_CSSD: Record<string, Gaya> = {
  draf: { label: "Draf", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  menunggu_hasil: { label: "Menunggu Hasil", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  lulus: { label: "Lulus", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  gagal: { label: "Gagal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_PERMINTAAN_CSSD: Record<string, Gaya> = {
  menunggu: { label: "Menunggu", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  disetujui: { label: "Disetujui", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  ditolak: { label: "Ditolak", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  selesai: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
};
export const STATUS_RECALL_CSSD: Record<string, Gaya> = {
  dibuka: { label: "Dibuka", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  ditindaklanjuti: { label: "Ditindaklanjuti", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  selesai: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
};
export const gayaSetCssd = (s?: string) => STATUS_SET_CSSD[s as string];
export const gayaLoadCssd = (s?: string) => STATUS_LOAD_CSSD[s as string];
export const gayaPermintaanCssd = (s?: string) => STATUS_PERMINTAAN_CSSD[s as string];
export const gayaRecallCssd = (s?: string) => STATUS_RECALL_CSSD[s as string];

// Izin aksi modul (tanpa daftar izin = super admin → boleh; backend tetap memeriksa login).
export const izinCssd = (submodul: string, aksi: string, fitur?: string) =>
  !getStoredPermissions().length || hasPermission("CSSD", submodul, aksi, fitur ?? null);

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
    q.append(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};
export const opsi = (obj: Record<string, string>) => Object.entries(obj).map(([value, label]) => ({ value, label }));
export const keEpoch = (d?: Date | string | null) => (d ? Math.floor(new Date(d).getTime() / 1000) : undefined);
export const dariEpoch = (n?: number | null) => (n ? new Date(Number(n) * 1000) : null);
export const waktuRingkas = (n?: number | null) => (n ? new Date(Number(n) * 1000).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-");

// ── Referensi ──────────────────────────────────────────────────────────────
export const referensiPilihanCssd = () => apiPenunjangGet("/cssd/referensi/pilihan");
export const referensiUnitCssd = () => apiPenunjangGet("/cssd/referensi/unit");
export const cariPasienCssd = (cari: string) => apiPenunjangGet(`/cssd/referensi/pasien${qs({ cari })}`);

// ── Master set & instrumen ───────────────────────────────────────────────────
export const daftarMasterSetCssd = (params: Record<string, any> = {}) => apiPenunjangGet(`/cssd/master-set${qs(params)}`);
export const detailMasterSetCssd = (uuid: string) => apiPenunjangGet(`/cssd/master-set/${uuid}`);
export const simpanMasterSetCssd = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/cssd/master-set/${uuid}`, data) : apiPenunjangPost("/cssd/master-set", data);
export const tambahSetFisikCssd = (masterUuid: string, data: { kodeSetFisik?: string; kodeBarcode: string }) => apiPenunjangPost(`/cssd/master-set/${masterUuid}/set`, data);
export const labelSetCssd = (masterUuid: string, setUuid?: string) => apiPenunjangGet(`/cssd/master-set/${masterUuid}/label${qs({ set_uuid: setUuid })}`);

// ── Mesin & Bowie-Dick ────────────────────────────────────────────────────────
export const daftarMesinCssd = (params: Record<string, any> = {}) => apiPenunjangGet(`/cssd/mesin${qs(params)}`);
export const simpanMesinCssd = (data: Record<string, any>, uuid?: string) => (uuid ? apiPenunjangPut(`/cssd/mesin/${uuid}`, data) : apiPenunjangPost("/cssd/mesin", data));
export const catatBowieDickCssd = (mesinUuid: string, data: { tanggal?: string; hasil: string; catatan?: string; petugasUuid?: string }) =>
  apiPenunjangPost(`/cssd/mesin/${mesinUuid}/bowie-dick`, data);
export const riwayatBowieDickCssd = (mesinUuid: string, params: Record<string, any> = {}) => apiPenunjangGet(`/cssd/mesin/${mesinUuid}/bowie-dick${qs(params)}`);

// ── Penerimaan, dekontaminasi & set ───────────────────────────────────────────
export const daftarSetCssd = (params: Record<string, any> = {}) => apiPenunjangGet(`/cssd/set${qs(params)}`);
export const detailSetCssd = (uuid: string) => apiPenunjangGet(`/cssd/set/${uuid}`);
export const ubahStatusSetCssd = (uuid: string, status: string) => apiPenunjangPut(`/cssd/set/${uuid}/status`, { status });
export const penerimaanKotorCssd = (data: Record<string, any>) => apiPenunjangPost("/cssd/penerimaan-kotor", data);
export const catatDekontaminasiCssd = (setUuid: string, data: Record<string, any>) => apiPenunjangPost(`/cssd/set/${setUuid}/dekontaminasi`, data);

// ── Load sterilisasi ─────────────────────────────────────────────────────────
export const daftarLoadCssd = (params: Record<string, any> = {}) => apiPenunjangGet(`/cssd/load${qs(params)}`);
export const detailLoadCssd = (uuid: string) => apiPenunjangGet(`/cssd/load/${uuid}`);
export const buatLoadCssd = (data: Record<string, any>) => apiPenunjangPost("/cssd/load", data);
export const simpanHasilLoadCssd = (uuid: string, data: Record<string, any>) => apiPenunjangPut(`/cssd/load/${uuid}/hasil`, data);

// ── Penyimpanan, distribusi & pemakaian ───────────────────────────────────────
export const stokCssd = (params: Record<string, any> = {}) => apiPenunjangGet(`/cssd/stok${qs(params)}`);
export const daftarPermintaanCssd = (params: Record<string, any> = {}) => apiPenunjangGet(`/cssd/permintaan${qs(params)}`);
export const buatPermintaanCssd = (data: Record<string, any>) => apiPenunjangPost("/cssd/permintaan", data);
export const ubahPermintaanCssd = (uuid: string, data: Record<string, any>) => apiPenunjangPut(`/cssd/permintaan/${uuid}`, data);
export const distribusiCssd = (data: Record<string, any>) => apiPenunjangPost("/cssd/distribusi", data);
export const konfirmasiDistribusiCssd = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`/cssd/distribusi/${uuid}/konfirmasi`, data);
export const pemakaianCssd = (data: Record<string, any>) => apiPenunjangPost("/cssd/pemakaian", data);

// ── Recall ───────────────────────────────────────────────────────────────────
export const daftarRecallCssd = (params: Record<string, any> = {}) => apiPenunjangGet(`/cssd/recall${qs(params)}`);
export const recallLoadCssd = (loadUuid: string) => apiPenunjangGet(`/cssd/load/${loadUuid}/recall`);
export const tindakLanjutRecallCssd = (recallUuid: string, setUuid: string, data: Record<string, any>) =>
  apiPenunjangPut(`/cssd/recall/${recallUuid}/set/${setUuid}`, data);

// ── Laporan ──────────────────────────────────────────────────────────────────
export const laporanVolumeCssd = (params: Record<string, any> = {}) => apiPenunjangGet(`/cssd/laporan/volume${qs(params)}`);
export const laporanKegagalanCssd = (params: Record<string, any> = {}) => apiPenunjangGet(`/cssd/laporan/kegagalan${qs(params)}`);
export const laporanSetBermasalahCssd = (params: Record<string, any> = {}) => apiPenunjangGet(`/cssd/laporan/set-bermasalah${qs(params)}`);
