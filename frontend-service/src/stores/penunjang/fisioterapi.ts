// Fisioterapi / Rehabilitasi Medik — API penunjang-service (/api/v3/penunjang/fisioterapi/...).
// Permintaan dikirim camelCase → snake_case otomatis; respons snake_case → camelCase otomatis.
// Parameter query ditulis snake_case karena tidak dikonversi.
import { defineStore } from "pinia";
import { apiPenunjangGet, apiPenunjangPost, apiPenunjangPut, apiPenunjangDelete } from "@/utils/apiHandler";

// ── Referensi statis (sama dengan backend) ──────────────────────────────────────────
export const JAM_SLOT = [
  { slot: 1, label: "08.00 - 10.00" },
  { slot: 2, label: "10.00 - 12.00" },
  { slot: 3, label: "12.00 - 14.00" },
  { slot: 4, label: "14.00 - 16.00" },
  { slot: 5, label: "16.00 - 18.00" },
  { slot: 6, label: "18.00 - 20.00" },
];
export const labelJam = (slot?: number | null) => JAM_SLOT.find((j) => j.slot === Number(slot))?.label ?? "-";

export const JENIS_FISIO = [
  { value: "sport", label: "Sport" },
  { value: "saraf", label: "Saraf (Neuro)" },
  { value: "orto", label: "Ortopedi" },
  { value: "anak", label: "Anak (Pediatri)" },
  { value: "geriatri", label: "Geriatri" },
];
export const labelJenis = (v?: string | null) => JENIS_FISIO.find((j) => j.value === v)?.label ?? v ?? "-";

export const FASE_REHAB = [
  { value: "1", label: "Fase 1" },
  { value: "2a", label: "Fase 2a" },
  { value: "2b", label: "Fase 2b" },
  { value: "3a", label: "Fase 3a" },
  { value: "3b", label: "Fase 3b" },
  { value: "4", label: "Fase 4" },
  { value: "5", label: "Fase 5" },
];

export const STATUS_ORDER: Record<string, { label: string; kelas: string }> = {
  order: { label: "Order Baru", kelas: "bg-warning-50 text-warning-400 border-warning-75" },
  valid: { label: "Tervalidasi", kelas: "bg-opensimrs-50 text-opensimrs-400 border-opensimrs-200" },
  terjadwal: { label: "Terjadwal", kelas: "bg-info-50 text-info-400 border-info-75" },
  selesai: { label: "Selesai", kelas: "bg-success-50 text-success-400 border-success-75" },
  batal: { label: "Batal", kelas: "bg-danger-50 text-danger-300 border-danger-75" },
};
export const STATUS_JADWAL: Record<string, { label: string; kelas: string }> = {
  booking: { label: "Booking", kelas: "bg-warning-50 text-warning-400 border-warning-75" },
  terjadwal: { label: "Terjadwal", kelas: "bg-info-50 text-info-400 border-info-75" },
  hadir: { label: "Hadir", kelas: "bg-opensimrs-50 text-opensimrs-400 border-opensimrs-200" },
  selesai: { label: "Selesai", kelas: "bg-success-50 text-success-400 border-success-75" },
  batal: { label: "Batal", kelas: "bg-danger-50 text-danger-300 border-danger-75" },
};
export const SUMBER_ORDER: Record<string, string> = { rme: "Order Dokter (RME)", aps: "APS", booking: "Booking" };

// ── Tipe data ──────────────────────────────────────────────────────────────────────
export interface Halaman<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPage: number };
}
export interface BedFisio {
  uuid: string;
  kode: string;
  nama: string;
  ruangan?: string | null;
  keterangan?: string | null;
  status: boolean;
}
export interface TindakanFisio {
  uuid: string;
  kode: string;
  nama: string;
  harga: number;
  jenisFisio?: string | null;
  status: boolean;
}
export interface OrderTindakan {
  uuid?: string;
  tindakanUuid: string;
  nama: string;
  harga: number;
  qty: number;
  kode?: string;
  // Order paket: bagian harga paket untuk tindakan ini (seluruh sesi). null = tarif satuan.
  nilaiPaket?: number | null;
}
// Paket terapi: tindakan (qty per sesi) + jumlah sesi + harga paket (seluruh sesi).
export interface PaketTindakanFisio {
  tindakanUuid: string;
  kode: string;
  nama: string;
  jenisFisio?: string | null;
  harga: number;
  qty: number;
  aktif: boolean;
}
export interface PaketFisio {
  uuid: string;
  kode: string;
  nama: string;
  jenisFisio: string;
  jumlahSesi: number;
  harga: number;
  deskripsi?: string | null;
  status: boolean;
  tindakan: PaketTindakanFisio[];
  jumlahTindakan: number;
  tarifPerSesi: number;
  totalSatuan: number;
  hemat: number;
}
export interface JadwalFisio {
  uuid: string;
  orderUuid?: string | null;
  patientUuid?: string | null;
  tanggal: string;
  jamSlot: number;
  bedUuid: string;
  bedKode?: string;
  bed?: string;
  ruangan?: string | null;
  sesiKe?: number | null;
  status: string;
  catatan?: string | null;
  namaPasien?: string | null;
  noHp?: string | null;
  noRm?: string | null;
  gender?: string | null;
  tanggalLahir?: string | null;
  noOrder?: string | null;
  jenisFisio?: string | null;
  jumlahSesi?: number | null;
  statusOrder?: string | null;
  diagnosis?: string | null;
  evaluasiUuid?: string | null;
}
export interface EvaluasiFisio {
  uuid: string;
  orderUuid: string;
  jadwalUuid?: string | null;
  subjektif?: string | null;
  objektif?: string | null;
  asesmen?: string | null;
  intervensi?: string | null;
  evaluasi?: string | null;
  edukasi?: string | null;
  faseRehabilitasi?: string | null;
  persetujuan?: Persetujuan | null;
  terapis?: string | null;
  tanggal?: string | null;
  jamSlot?: number | null;
  sesiKe?: number | null;
  bed?: string | null;
  noOrder?: string;
  jenisFisio?: string;
  createdAt?: number;
}
export interface Persetujuan {
  jenis?: "persetujuan" | "penolakan";
  nama?: string;
  hubungan?: string;
  tindakan?: string;
  risiko?: string;
  saksi?: string;
  alasan?: string;
}
export interface OrderFisio {
  uuid: string;
  noOrder: string;
  patientUuid: string;
  noRm?: string | null;
  noReg?: string | null;
  rekamMedisUuid?: string | null;
  sumber: string;
  pelayanan: string;
  paymentMethod: number;
  jenisFisio: string;
  diagnosis?: string | null;
  keluhan?: string | null;
  catatan?: string | null;
  jumlahSesi: number;
  paketUuid?: string | null;
  paketKode?: string | null;
  paketNama?: string | null;
  paketHarga?: number | null;
  totalSatuan?: number;
  status: string;
  alasanBatal?: string | null;
  divalidasiOleh?: string | null;
  divalidasiPada?: number | null;
  dibuatOleh?: string | null;
  createdAt: number;
  namaPasien?: string | null;
  gender?: string | null;
  noHp?: string | null;
  tanggalLahir?: string | null;
  dokterPengirim?: string | null;
  tindakanRingkas?: string | null;
  totalBiaya: number;
  sesiTerjadwal: number;
  sesiSelesai: number;
  jadwalBerikutnya?: { uuid: string; tanggal: string; jamSlot: number; bed: string; status: string; sesiKe: number } | null;
  tindakan?: OrderTindakan[];
  jadwal?: JadwalFisio[];
  evaluasi?: EvaluasiFisio[];
}
export interface PasienRingkas {
  uuid: string;
  noRm: string;
  name: string;
  gender?: string | null;
  phone?: string | null;
  birthDate?: string | null;
}
export interface SlotJam {
  slot: number;
  label: string;
  totalBed: number;
  terisi: number;
  tersedia: number;
  bed: (BedFisio & { jadwal: JadwalFisio | null })[];
}

// Isian form order (IsianOrderFisio.vue).
export interface IsianOrder {
  // Paket terapi terpilih (null = tindakan satuan). Bila diisi, tindakan & jumlah sesi mengikuti paket.
  paketUuid: string | null;
  jenisFisio: string;
  tindakan: { tindakanUuid: string; nama: string; harga: number; qty: number }[];
  jumlahSesi: number;
  diagnosis: string;
  keluhan: string;
  catatan: string;
}
export const isianKosong = (): IsianOrder => ({ paketUuid: null, jenisFisio: "", tindakan: [], jumlahSesi: 1, diagnosis: "", keluhan: "", catatan: "" });
export const isianDariOrder = (o: OrderFisio): IsianOrder => ({
  paketUuid: o.paketUuid ?? null,
  jenisFisio: o.jenisFisio,
  tindakan: (o.tindakan ?? []).map((t) => ({ tindakanUuid: t.tindakanUuid, nama: t.nama, harga: Number(t.harga), qty: Number(t.qty) || 1 })),
  jumlahSesi: o.jumlahSesi,
  diagnosis: o.diagnosis ?? "",
  keluhan: o.keluhan ?? "",
  catatan: o.catatan ?? "",
});

// ── Format ─────────────────────────────────────────────────────────────────────────
export const rupiah = (n?: number | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n) || 0);

// Date lokal → "YYYY-MM-DD" (tanpa geser zona waktu).
export const keIso = (d?: Date | string | null) => {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const dariIso = (s?: string | null) => {
  if (!s) return new Date();
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const tglIndo = (s?: string | null, hari = false) => {
  if (!s) return "-";
  const d = dariIso(s);
  return `${hari ? HARI[d.getDay()] + ", " : ""}${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};
export const waktuEpoch = (e?: number | string | null) => {
  const n = Number(e);
  if (!n) return "-";
  const d = new Date(n * 1000);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const umur = (lahir?: string | null) => {
  if (!lahir) return "-";
  const l = dariIso(lahir);
  const n = new Date();
  let th = n.getFullYear() - l.getFullYear();
  if (n.getMonth() < l.getMonth() || (n.getMonth() === l.getMonth() && n.getDate() < l.getDate())) th--;
  return `${th} th`;
};
export const labelGender = (g?: string | null) => (g === "Male" ? "Laki-laki" : g === "Female" ? "Perempuan" : g ?? "-");

const qs = (obj: Record<string, unknown>) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(Array.isArray(v) ? v.join(",") : String(v))}`)
    .join("&");

// ── API ────────────────────────────────────────────────────────────────────────────
const B = "/fisioterapi";
export const apiFisio = {
  cariPasien: (cari: string) => apiPenunjangGet(`${B}/pasien?${qs({ cari })}`),

  daftarBed: (q: { page?: number; limit?: number; cari?: string; status?: string } = {}) => apiPenunjangGet(`${B}/bed?${qs(q)}`),
  simpanBed: (data: Partial<BedFisio>, uuid?: string) => (uuid ? apiPenunjangPut(`${B}/bed/${uuid}`, data) : apiPenunjangPost(`${B}/bed`, data)),
  hapusBed: (uuid: string) => apiPenunjangDelete(`${B}/bed/${uuid}`),

  daftarTindakan: (q: { page?: number; limit?: number; cari?: string; status?: string; jenis_fisio?: string } = {}) =>
    apiPenunjangGet(`${B}/tindakan?${qs(q)}`),
  simpanTindakan: (data: Partial<TindakanFisio>, uuid?: string) =>
    uuid ? apiPenunjangPut(`${B}/tindakan/${uuid}`, data) : apiPenunjangPost(`${B}/tindakan`, data),
  hapusTindakan: (uuid: string) => apiPenunjangDelete(`${B}/tindakan/${uuid}`),

  daftarPaket: (q: { page?: number; limit?: number; cari?: string; status?: string; jenis_fisio?: string } = {}) => apiPenunjangGet(`${B}/paket?${qs(q)}`),
  simpanPaket: (data: Record<string, unknown>, uuid?: string) => (uuid ? apiPenunjangPut(`${B}/paket/${uuid}`, data) : apiPenunjangPost(`${B}/paket`, data)),
  hapusPaket: (uuid: string) => apiPenunjangDelete(`${B}/paket/${uuid}`),

  daftarOrder: (q: Record<string, unknown> = {}) => apiPenunjangGet(`${B}/order?${qs(q)}`),
  ringkasanOrder: () => apiPenunjangGet(`${B}/order/ringkasan`),
  detailOrder: (uuid: string) => apiPenunjangGet(`${B}/order/${uuid}`),
  buatOrder: (data: Record<string, unknown>) => apiPenunjangPost(`${B}/order`, data),
  ubahOrder: (uuid: string, data: Record<string, unknown>) => apiPenunjangPut(`${B}/order/${uuid}`, data),
  validasiOrder: (uuid: string) => apiPenunjangPut(`${B}/order/${uuid}/validasi`),
  batalOrder: (uuid: string, alasan: string) => apiPenunjangPut(`${B}/order/${uuid}/batal`, { alasan }),

  slot: (tanggal: string) => apiPenunjangGet(`${B}/slot?${qs({ tanggal })}`),
  ketersediaan: (mulai: string, selesai: string) => apiPenunjangGet(`${B}/ketersediaan?${qs({ tanggal_mulai: mulai, tanggal_selesai: selesai })}`),
  detailJadwal: (uuid: string) => apiPenunjangGet(`${B}/jadwal/${uuid}`),
  daftarJadwal: (q: Record<string, unknown> = {}) => apiPenunjangGet(`${B}/jadwal?${qs(q)}`),
  buatJadwal: (data: { orderUuid: string; tanggal: string; jamSlot: number; bedUuid: string; catatan?: string }) => apiPenunjangPost(`${B}/jadwal`, data),
  ubahJadwal: (uuid: string, data: { tanggal?: string; jamSlot?: number; bedUuid?: string; catatan?: string }) => apiPenunjangPut(`${B}/jadwal/${uuid}`, data),
  batalJadwal: (uuid: string, alasan?: string) => apiPenunjangPut(`${B}/jadwal/${uuid}/batal`, { alasan }),
  hadir: (uuid: string) => apiPenunjangPut(`${B}/jadwal/${uuid}/hadir`),

  daftarBooking: (q: Record<string, unknown> = {}) => apiPenunjangGet(`${B}/booking?${qs(q)}`),
  buatBooking: (data: Record<string, unknown>) => apiPenunjangPost(`${B}/booking`, data),
  batalBooking: (uuid: string, alasan?: string) => apiPenunjangPut(`${B}/booking/${uuid}/batal`, { alasan }),
  lanjutBooking: (uuid: string, data: Record<string, unknown>) => apiPenunjangPut(`${B}/booking/${uuid}/lanjut`, data),

  daftarEvaluasi: (q: Record<string, unknown> = {}) => apiPenunjangGet(`${B}/evaluasi?${qs(q)}`),
  detailEvaluasi: (uuid: string) => apiPenunjangGet(`${B}/evaluasi/${uuid}`),
  riwayat: (patientUuid: string) => apiPenunjangGet(`${B}/evaluasi/riwayat/${patientUuid}`),
  simpanEvaluasi: (data: Record<string, unknown>) => apiPenunjangPost(`${B}/evaluasi`, data),
  ubahEvaluasi: (uuid: string, data: Record<string, unknown>) => apiPenunjangPut(`${B}/evaluasi/${uuid}`, data),

  laporan: (jenis: "kunjungan" | "rekap-jenis" | "rekap-tindakan" | "rekap-pendapatan", q: Record<string, unknown>) =>
    apiPenunjangGet(`${B}/laporan/${jenis}?${qs(q)}`),
};

// Store ringan: cache master tindakan, paket & bed aktif (dipakai form order, penjadwalan, booking).
export const useFisioterapiStore = defineStore("penunjangFisioterapi", {
  state: () => ({
    tindakan: [] as TindakanFisio[],
    paket: [] as PaketFisio[],
    bed: [] as BedFisio[],
  }),
  actions: {
    async muatPaket(paksa = false) {
      if (this.paket.length && !paksa) return this.paket;
      const r = await apiFisio.daftarPaket({ limit: 9999, status: "aktif" });
      this.paket = r?.payload?.data ?? [];
      return this.paket;
    },
    async muatTindakan(paksa = false) {
      if (this.tindakan.length && !paksa) return this.tindakan;
      const r = await apiFisio.daftarTindakan({ limit: 9999, status: "aktif" });
      this.tindakan = r?.payload?.data ?? [];
      return this.tindakan;
    },
    async muatBed(paksa = false) {
      if (this.bed.length && !paksa) return this.bed;
      const r = await apiFisio.daftarBed({ limit: 9999, status: "aktif" });
      this.bed = r?.payload?.data ?? [];
      return this.bed;
    },
  },
});
