// Pembantu tampilan Jadwal Dinas (STD-0038): warna lencana shift/status dan adaptor tanggal untuk komponen Base.
// Hanya untuk tampilan; nilai yang dikirim ke API tetap memakai string tanggal "YYYY-MM-DD"/"YYYY-MM" seperti semula.

const PALET_SHIFT = [
  "bg-info-50 text-info-400 border-info-75",
  "bg-warning-50 text-warning-400 border-warning-75",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-success-50 text-success-400 border-success-75",
  "bg-teal-50 text-teal-700 border-teal-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-orange-50 text-orange-700 border-orange-200",
  "bg-sky-50 text-sky-700 border-sky-200",
];
const SHIFT_DIKENAL: Record<string, number> = { P: 0, PAGI: 0, S: 1, SIANG: 1, SORE: 1, M: 2, MALAM: 2 };
export const KELAS_LIBUR = "bg-grey-75 text-grey-500 border-grey-200";

// Warna lencana per kode shift: kode umum (P/S/M) memakai warna tetap, kode lain di-hash agar konsisten antarhalaman.
export const warnaShift = (kode?: string | null, libur?: boolean) => {
  if (libur) return KELAS_LIBUR;
  const k = String(kode ?? "").trim().toUpperCase();
  if (!k) return "bg-white text-grey-300 border-grey-100";
  if (k in SHIFT_DIKENAL) return PALET_SHIFT[SHIFT_DIKENAL[k]];
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALET_SHIFT[h % PALET_SHIFT.length];
};

export const jamMenit = (m?: number | null) => m == null ? "—" : `${String(Math.floor(m / 60)).padStart(2, "0")}.${String(m % 60).padStart(2, "0")}`;

const STATUS: Record<string, [string, string]> = {
  draf: ["Draf", "bg-grey-75 text-grey-500"],
  diajukan: ["Diajukan", "bg-info-50 text-info-400"],
  disetujui: ["Disetujui", "bg-success-50 text-success-400"],
  terbit: ["Terbit", "bg-opensimrs-50 text-opensimrs-300"],
  ditolak: ["Ditolak", "bg-danger-50 text-danger-400"],
  dibatalkan: ["Dibatalkan", "bg-grey-75 text-grey-400"],
  menunggu_pengganti: ["Menunggu pengganti", "bg-warning-50 text-warning-400"],
  menunggu_kepala: ["Menunggu kepala ruangan", "bg-info-50 text-info-400"],
};
export const labelStatus = (s?: string | null) => STATUS[s ?? ""]?.[0] ?? (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "—");
export const kelasStatus = (s?: string | null) => STATUS[s ?? ""]?.[1] ?? "bg-grey-75 text-grey-500";

// Adaptor string tanggal lokal <-> Date untuk CustomDatePicker.
const dua = (n: number) => String(n).padStart(2, "0");
export const keDate = (tanggal?: string | null) => tanggal ? new Date(`${tanggal.length === 7 ? `${tanggal}-01` : tanggal}T00:00:00`) : null;
export const keTanggal = (d?: Date | null) => d ? `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}` : "";
export const keBulan = (d?: Date | null) => d ? `${d.getFullYear()}-${dua(d.getMonth() + 1)}` : "";

// Gaya elemen native yang tetap dipakai agar validasi bawaan (required/min/max) berjalan.
export const KELAS_INPUT = "w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM disabled:bg-grey-100 disabled:text-grey-300";
export const KELAS_LABEL = "block font-semibold mb-[5px] text-normal";
