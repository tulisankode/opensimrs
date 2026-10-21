// API modul Kamar Operasi (penunjang-service: /api/v3/penunjang/kamar-operasi). Request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler). Kirim waktu sebagai epoch detik (bukan Date).
import { apiPenunjangGet, apiPenunjangPost, apiPenunjangPut, apiPenunjangPatch, apiPenunjangDelete } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";

// Izin aksi modul (Setting › Hak Akses › Kamar Operasi). Tanpa daftar izin = super admin → boleh; backend tetap
// memeriksa login. Submodul: "Order Operasi" (CREATE/UPDATE/KLARIFIKASI), "Jadwal OK" (CREATE/UPDATE/BATAL/VALIDASI),
// "Pra-Operasi", "Checklist Keselamatan", "Laporan Operasi" (UPDATE/FINALISASI), "Laporan Anestesi", "Pemakaian BHP",
// "Datamaster" (fitur Ruang OK), "Laporan Rekap".
export const izinOk = (submodul: string, aksi: string, fitur?: string) =>
  !getStoredPermissions().length || hasPermission("Kamar Operasi", submodul, aksi, fitur ?? null);

export type JenisOperasi = "elektif" | "cito";
export type KelasOperasi = "kecil" | "sedang" | "besar" | "khusus";
export type StatusOrderOk = "menunggu_jadwal" | "perlu_klarifikasi" | "terjadwal" | "batal";
export type StatusJadwalOk = "terjadwal" | "selesai" | "batal";
export type PeranTimOk = "operator" | "asisten" | "anestesi" | "perawat_instrumen" | "perawat_sirkuler";

type Gaya = { label: string; bg: string; text: string };

export const JENIS_OPERASI: Record<JenisOperasi, string> = { elektif: "Elektif", cito: "CITO" };
export const KELAS_OPERASI: Record<KelasOperasi, string> = { kecil: "Kecil", sedang: "Sedang", besar: "Besar", khusus: "Khusus" };
export const PERAN_TIM_OK: Record<PeranTimOk, string> = {
  operator: "Operator",
  asisten: "Asisten",
  anestesi: "Anestesi",
  perawat_instrumen: "Perawat Instrumen",
  perawat_sirkuler: "Perawat Sirkuler",
};
export const OPSI_PERAN_TIM_OK = Object.entries(PERAN_TIM_OK).map(([value, label]) => ({ value, label }));

export const STATUS_ORDER_OK: Record<StatusOrderOk, Gaya> = {
  menunggu_jadwal: { label: "Menunggu Jadwal", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  perlu_klarifikasi: { label: "Perlu Klarifikasi", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  terjadwal: { label: "Terjadwal", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  batal: { label: "Batal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_JADWAL_OK: Record<StatusJadwalOk, Gaya> = {
  terjadwal: { label: "Terjadwal", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  selesai: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  batal: { label: "Batal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const gayaOrderOk = (s?: string) => STATUS_ORDER_OK[s as StatusOrderOk];
export const gayaJadwalOk = (s?: string) => STATUS_JADWAL_OK[s as StatusJadwalOk];

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
    q.append(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const keTanggalOk = (d?: Date | null) => {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const keEpochOk = (d?: Date | null) => (d ? Math.floor(d.getTime() / 1000) : null);
export const dariEpochOk = (n?: number | string | null) => (Number(n) ? new Date(Number(n) * 1000) : null);
export const waktuOk = (epoch?: number | string | null, tanpaJam = false) => {
  const n = Number(epoch);
  if (!n) return "-";
  const d = new Date((n > 1e12 ? n / 1000 : n) * 1000);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", ...(tanpaJam ? {} : { hour: "2-digit", minute: "2-digit" }) });
};
export const umurOk = (tglLahir?: string | null) => {
  if (!tglLahir) return "-";
  const lahir = new Date(tglLahir);
  if (Number.isNaN(lahir.getTime())) return "-";
  const now = new Date();
  let th = now.getFullYear() - lahir.getFullYear();
  if (now.getMonth() < lahir.getMonth() || (now.getMonth() === lahir.getMonth() && now.getDate() < lahir.getDate())) th--;
  return `${th} th`;
};
export const JK_OK: Record<string, string> = { Male: "L", Female: "P" };

// ── Ruang OK (Datamaster)
export const daftarRuangOk = (aktif?: boolean) => apiPenunjangGet(`/kamar-operasi/ruang${qs({ aktif: aktif ? 1 : "" })}`);
export const simpanRuangOk = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/kamar-operasi/ruang/${uuid}`, data) : apiPenunjangPost("/kamar-operasi/ruang", data);
export const hapusRuangOk = (uuid: string) => apiPenunjangDelete(`/kamar-operasi/ruang/${uuid}`);

// ── Order (daftar tunggu)
export const daftarOrderOk = (params: Record<string, any> = {}) => apiPenunjangGet(`/kamar-operasi/orders${qs(params)}`);
export const detailOrderOk = (uuid: string) => apiPenunjangGet(`/kamar-operasi/orders/${uuid}`);
export const buatOrderOk = (data: {
  noReg?: string;
  rekamMedisUuid?: string;
  sumber: "rajal" | "ranap" | "igd";
  diagnosisKode?: string;
  diagnosisNama?: string;
  jenisOperasi: JenisOperasi;
  durasiEstimasiMenit: number;
  tindakan: { kodeIcd9cm: string; nama: string; kelasOperasi?: KelasOperasi | null }[];
}) => apiPenunjangPost("/kamar-operasi/orders", data);
export const klarifikasiOrderOk = (uuid: string, catatan: string) => apiPenunjangPatch(`/kamar-operasi/orders/${uuid}/klarifikasi`, { catatan });
export const lengkapiOrderOk = (uuid: string, data: Record<string, any>) => apiPenunjangPatch(`/kamar-operasi/orders/${uuid}/lengkapi`, data);

// ── Jadwal
export const daftarJadwalOk = (params: Record<string, any> = {}) => apiPenunjangGet(`/kamar-operasi/jadwal${qs(params)}`);
export const detailJadwalOk = (uuid: string) => apiPenunjangGet(`/kamar-operasi/jadwal/${uuid}`);
export const buatJadwalOk = (
  orderUuid: string,
  data: { ruangUuid: string; waktuMulai: number; waktuSelesai: number; tim: { practitionerUuid: string; peran: PeranTimOk }[] },
) => apiPenunjangPost(`/kamar-operasi/orders/${orderUuid}/jadwal`, data);
export const jadwalUlangOk = (uuid: string, data: Record<string, any>) => apiPenunjangPatch(`/kamar-operasi/jadwal/${uuid}/jadwal-ulang`, data);
export const batalJadwalOk = (uuid: string, alasan: string) => apiPenunjangPatch(`/kamar-operasi/jadwal/${uuid}/batal`, { alasan });
export const selesaiJadwalOk = (uuid: string, serahTerima?: string) => apiPenunjangPatch(`/kamar-operasi/jadwal/${uuid}/selesai`, { serah_terima: serahTerima });

// ── Pra-operasi
export const praOperasiOk = (jadwalUuid: string) => apiPenunjangGet(`/kamar-operasi/jadwal/${jadwalUuid}/praoperasi`);
export const simpanPraOperasiOk = (jadwalUuid: string, data: Record<string, any>) => apiPenunjangPut(`/kamar-operasi/jadwal/${jadwalUuid}/praoperasi`, data);
// Daftar persetujuan (inform consent) pasien pada jadwal ini, untuk dipilih — bukan mengetik UUID (KF-1).
export const referensiPersetujuanOk = (jadwalUuid: string) => apiPenunjangGet(`/kamar-operasi/jadwal/${jadwalUuid}/praoperasi/referensi-persetujuan`);

// ── Checklist keselamatan bedah WHO
export const checklistOk = (jadwalUuid: string) => apiPenunjangGet(`/kamar-operasi/jadwal/${jadwalUuid}/checklist`);
export const referensiChecklistOk = () => apiPenunjangGet(`/kamar-operasi/checklist/referensi`);
export const simpanChecklistOk = (jadwalUuid: string, tahap: "sign-in" | "time-out" | "sign-out", item: Record<string, any>[]) =>
  apiPenunjangPut(`/kamar-operasi/jadwal/${jadwalUuid}/checklist/${tahap}`, { item });

// ── Laporan operasi & anestesi
export const laporanOperasiOk = (jadwalUuid: string) => apiPenunjangGet(`/kamar-operasi/jadwal/${jadwalUuid}/laporan-operasi`);
export const simpanLaporanOperasiOk = (jadwalUuid: string, data: Record<string, any>) => apiPenunjangPut(`/kamar-operasi/jadwal/${jadwalUuid}/laporan-operasi`, data);
export const finalisasiLaporanOperasiOk = (jadwalUuid: string) => apiPenunjangPost(`/kamar-operasi/jadwal/${jadwalUuid}/laporan-operasi/finalisasi`);
export const revisiLaporanOperasiOk = (jadwalUuid: string, alasan: string) => apiPenunjangPost(`/kamar-operasi/jadwal/${jadwalUuid}/laporan-operasi/revisi`, { alasan });
export const laporanAnestesiOk = (jadwalUuid: string) => apiPenunjangGet(`/kamar-operasi/jadwal/${jadwalUuid}/laporan-anestesi`);
export const simpanLaporanAnestesiOk = (jadwalUuid: string, data: Record<string, any>) => apiPenunjangPut(`/kamar-operasi/jadwal/${jadwalUuid}/laporan-anestesi`, data);

// ── Pemakaian BHP/obat depo OK
export const pemakaianOk = (jadwalUuid: string) => apiPenunjangGet(`/kamar-operasi/jadwal/${jadwalUuid}/pemakaian`);
export const tambahPemakaianOk = (jadwalUuid: string, data: { itemMedisUuid: string; qty: number; lokasiStokUuid: string }) =>
  apiPenunjangPost(`/kamar-operasi/jadwal/${jadwalUuid}/pemakaian`, data);

// ── Laporan rekap
export const rekapOk = (params: { tanggalDari?: string; tanggalSampai?: string } = {}) =>
  apiPenunjangGet(`/kamar-operasi/laporan/rekap${qs({ tanggal_dari: params.tanggalDari, tanggal_sampai: params.tanggalSampai })}`);

// ── Referensi
export const daftarDokterOk = (semua = false) => apiPenunjangGet(`/kamar-operasi/referensi/dokter${qs({ semua: semua ? 1 : "" })}`);
export const cariIcd9cmOk = (cari: string) => apiPenunjangGet(`/kamar-operasi/referensi/icd9cm${qs({ cari })}`);
export const cariIcd10Ok = (cari: string) => apiPenunjangGet(`/kamar-operasi/referensi/icd10${qs({ cari })}`);
// Item medis & lokasi stok (Depo OK) untuk dipilih pada pemakaian BHP/obat — bukan mengetik UUID (KF-1/KF-4).
export const cariItemMedisOk = (cari: string) => apiPenunjangGet(`/kamar-operasi/referensi/item-medis${qs({ cari })}`);
export const daftarLokasiStokOk = () => apiPenunjangGet(`/kamar-operasi/referensi/lokasi-stok`);
