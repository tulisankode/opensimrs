// API modul Koding Rekam Medis (penunjang-service: /api/v3/penunjang/koding). Request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler). Kirim waktu sebagai epoch detik (bukan Date).
import { apiPenunjangDelete, apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";

// Izin aksi modul (Setting › Hak Akses › Koding Rekam Medis). Tanpa daftar izin = super admin → boleh; backend
// tetap memeriksa login. Submodul: "Worklist" (READ), "Koding" (READ/CREATE/UPDATE), "Klarifikasi"
// (READ/CREATE/UPDATE), "Checklist" (READ/CREATE/UPDATE), "Peminjaman" (READ/CREATE/UPDATE/HAPUS), "Retensi"
// (READ/CREATE/UPDATE), "Laporan Koding" (READ).
export const izinKoding = (submodul: string, aksi: string, fitur?: string) =>
  !getStoredPermissions().length || hasPermission("Koding Rekam Medis", submodul, aksi, fitur ?? null);

export type JenisKunjungan = "rj" | "ri" | "igd";
export const JENIS_KUNJUNGAN: Record<JenisKunjungan, string> = { rj: "Rawat Jalan", ri: "Rawat Inap", igd: "IGD" };
export const OPSI_JENIS_KUNJUNGAN = Object.entries(JENIS_KUNJUNGAN).map(([value, label]) => ({ value, label }));

type Gaya = { label: string; bg: string; text: string };
export const STATUS_KODING: Record<string, Gaya> = {
  belum: { label: "Belum Dikoding", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  proses: { label: "Dalam Proses", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  siap_klaim: { label: "Siap Klaim", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
};
export const gayaKoding = (s?: string) => STATUS_KODING[s ?? "belum"];

export const STATUS_CHECKLIST: Record<string, Gaya> = {
  lengkap: { label: "Lengkap", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  tidak_lengkap: { label: "Tidak Lengkap", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  tidak_berlaku: { label: "Tidak Berlaku", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
};
export const OPSI_STATUS_CHECKLIST = Object.entries(STATUS_CHECKLIST).map(([value, s]) => ({ value, label: s.label }));

export const STATUS_KLARIFIKASI: Record<string, Gaya> = {
  menunggu: { label: "Menunggu Jawaban", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  terjawab: { label: "Terjawab", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  ditutup: { label: "Ditutup", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
};

export const KEPUTUSAN_RETENSI: Record<string, Gaya> = {
  disetujui: { label: "Disetujui", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  ditolak: { label: "Ditolak", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  ditunda: { label: "Ditunda", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
};
export const OPSI_KEPUTUSAN_RETENSI = Object.entries(KEPUTUSAN_RETENSI).map(([value, s]) => ({ value, label: s.label }));

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
    q.append(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const keTanggalKoding = (d?: Date | null) => {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const waktuKoding = (epoch?: number | string | null, tanpaJam = false) => {
  const n = Number(epoch);
  if (!n) return "-";
  const d = new Date((n > 1e12 ? n / 1000 : n) * 1000);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", ...(tanpaJam ? {} : { hour: "2-digit", minute: "2-digit" }) });
};
export const umurKoding = (tglLahir?: string | null) => {
  if (!tglLahir) return "-";
  const lahir = new Date(tglLahir);
  if (Number.isNaN(lahir.getTime())) return "-";
  const now = new Date();
  let th = now.getFullYear() - lahir.getFullYear();
  let bl = now.getMonth() - lahir.getMonth();
  if (now.getDate() < lahir.getDate()) bl--;
  if (bl < 0) {
    th--;
    bl += 12;
  }
  return `${th} th ${bl} bl`;
};
export const labelPenjamin = (p?: number | null) => (p === 2 ? "Asuransi" : "Tunai");
export const detikKeJam = (detik?: number | null) => (detik || detik === 0 ? `${(detik / 3600).toFixed(1)} jam` : "-");

// ── Worklist & koding kunjungan
export const worklistKoding = (params: Record<string, any> = {}) => apiPenunjangGet(`/koding/worklist${qs(params)}`);
export const detailKunjunganKoding = (tipe: string, uuid: string) => apiPenunjangGet(`/koding/kunjungan/${tipe}/${uuid}`);
export const riwayatKoding = (tipe: string, uuid: string) => apiPenunjangGet(`/koding/kunjungan/${tipe}/${uuid}/riwayat-koding`);
export const simpanKoding = (
  tipe: string,
  uuid: string,
  data: { diagnosis: Record<string, any>[]; tindakan: Record<string, any>[]; catatan?: string },
) => apiPenunjangPut(`/koding/kunjungan/${tipe}/${uuid}/koding`, data);
export const finalisasiKoding = (tipe: string, uuid: string) => apiPenunjangPost(`/koding/kunjungan/${tipe}/${uuid}/finalisasi`, { konfirmasi: true });

// ── Klarifikasi DPJP
export const klarifikasiKunjungan = (tipe: string, uuid: string, status?: string) => apiPenunjangGet(`/koding/kunjungan/${tipe}/${uuid}/klarifikasi${qs({ status })}`);
export const kirimKlarifikasi = (tipe: string, uuid: string, data: { practitionerUuid?: string; pertanyaan: string; menghalangi?: boolean }) =>
  apiPenunjangPost(`/koding/kunjungan/${tipe}/${uuid}/klarifikasi`, data);
export const jawabKlarifikasi = (uuid: string, jawaban: string) => apiPenunjangPost(`/koding/klarifikasi/${uuid}/jawaban`, { jawaban });
export const tutupKlarifikasi = (uuid: string, catatan?: string) => apiPenunjangPost(`/koding/klarifikasi/${uuid}/tutup`, { catatan });

// ── Checklist
export const masterChecklist = () => apiPenunjangGet("/koding/checklist/master");
export const simpanMasterChecklist = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/koding/checklist/master/${uuid}`, data) : apiPenunjangPost("/koding/checklist/master", data);
export const checklistKunjunganKoding = (tipe: string, uuid: string) => apiPenunjangGet(`/koding/kunjungan/${tipe}/${uuid}/checklist`);
export const simpanChecklistKunjungan = (tipe: string, uuid: string, items: Record<string, any>[]) =>
  apiPenunjangPut(`/koding/kunjungan/${tipe}/${uuid}/checklist`, { items });
export const rekapDpjp = (params: Record<string, any> = {}) => apiPenunjangGet(`/koding/checklist/rekap-dpjp${qs(params)}`);

// ── Peminjaman berkas
export const daftarPeminjaman = (params: Record<string, any> = {}) => apiPenunjangGet(`/koding/peminjaman${qs(params)}`);
export const buatPeminjaman = (data: Record<string, any>) => apiPenunjangPost("/koding/peminjaman", data);
export const kembalikanPeminjaman = (uuid: string, data: { waktuKembali?: number; kondisiKembali?: string }) =>
  apiPenunjangPost(`/koding/peminjaman/${uuid}/pengembalian`, data);
export const batalkanPeminjaman = (uuid: string, alasan: string) => apiPenunjangDelete(`/koding/peminjaman/${uuid}`, { alasan } as any);

// ── Retensi & pemusnahan
export const daftarJenisBerkas = (params: Record<string, any> = {}) => apiPenunjangGet(`/koding/retensi/jenis-berkas${qs(params)}`);
export const simpanJenisBerkas = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/koding/retensi/jenis-berkas/${uuid}`, data) : apiPenunjangPost("/koding/retensi/jenis-berkas", data);
export const daftarRetensi = (params: Record<string, any> = {}) => apiPenunjangGet(`/koding/retensi/daftar${qs(params)}`);
export const daftarUsulanRetensi = (params: Record<string, any> = {}) => apiPenunjangGet(`/koding/retensi/usulan${qs(params)}`);
export const ajukanUsulanRetensi = (data: { noRm: string; jenisBerkasUuid: string; alasan?: string }) => apiPenunjangPost("/koding/retensi/usulan", data);
export const keputusanUsulanRetensi = (uuid: string, data: { keputusan: string; alasan?: string; beritaAcaraRef?: string }) =>
  apiPenunjangPost(`/koding/retensi/usulan/${uuid}/keputusan`, data);

// ── Laporan
export const laporanIndeksKoding = (params: Record<string, any> = {}) => apiPenunjangGet(`/koding/laporan/indeks${qs(params)}`);
export const laporanSepuluhBesarKoding = (params: Record<string, any> = {}) => apiPenunjangGet(`/koding/laporan/sepuluh-besar${qs(params)}`);
export const laporanRlKoding = (params: Record<string, any> = {}) => apiPenunjangGet(`/koding/laporan/rl${qs(params)}`);
export const laporanProduktivitasKoder = (params: Record<string, any> = {}) => apiPenunjangGet(`/koding/laporan/produktivitas-koder${qs(params)}`);
export const laporanDasborKoding = (params: Record<string, any> = {}) => apiPenunjangGet(`/koding/laporan/dasbor${qs(params)}`);
