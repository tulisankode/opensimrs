// API modul Medical Check Up (penunjang-service: /api/v3/penunjang/mcu). Request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler).
import { apiPenunjangDelete, apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";

// Izin aksi modul MCU (Setting › Hak Akses › MCU). Tanpa daftar izin = super admin → boleh; backend menegakkan izin
// yang sama (403). Submodul: "Peserta" (CREATE/IMPOR/UPDATE/KIRIM LIS/BATAL/HAPUS/KESIMPULAN/CETAK), "Pemeriksaan" (INPUT HASIL),
// "Datamaster" (fitur Paket MCU / Perusahaan: CREATE/UPDATE/DELETE), "Tagihan Korporasi" (CREATE/UPDATE/PEMBAYARAN/CETAK),
// "Laporan MCU" (READ/CETAK LAPORAN).
export const izinMcu = (submodul: string, aksi: string, fitur?: string) =>
  !getStoredPermissions().length || hasPermission("MCU", submodul, aksi as any, fitur ?? null);

export type StatusPeserta = "terdaftar" | "proses" | "selesai" | "batal";
export type Kesimpulan = "fit" | "fit_catatan" | "unfit";
export type StatusInvoice = "draft" | "terbit" | "sebagian" | "lunas" | "batal";

type Lencana = { label: string; bg: string; text: string };
export const STATUS_PESERTA: Record<StatusPeserta, Lencana> = {
  terdaftar: { label: "Terdaftar", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  proses: { label: "Proses", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  selesai: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  batal: { label: "Batal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const KESIMPULAN_MCU: Record<Kesimpulan, Lencana> = {
  fit: { label: "Fit", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  fit_catatan: { label: "Fit dengan Catatan", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  unfit: { label: "Unfit", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const LABEL_KESIMPULAN_PANJANG: Record<Kesimpulan, string> = {
  fit: "FIT — Layak bekerja / sehat untuk melakukan aktivitas sesuai peruntukan",
  fit_catatan: "FIT DENGAN CATATAN — Layak dengan catatan / tindak lanjut medis",
  unfit: "UNFIT — Untuk sementara tidak layak",
};
export const STATUS_INVOICE: Record<StatusInvoice, Lencana> = {
  draft: { label: "Draft", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  terbit: { label: "Terbit", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  sebagian: { label: "Dibayar Sebagian", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  lunas: { label: "Lunas", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  batal: { label: "Batal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const JENIS_MCU: Record<string, string> = {
  umum: "Umum / Perorangan",
  pra_kerja: "Pra-Kerja (Pre-Employment)",
  berkala: "Berkala (Annual)",
  khusus: "Khusus",
  purna_kerja: "Purna Kerja",
};
export const OPSI_JENIS_MCU = Object.entries(JENIS_MCU).map(([value, label]) => ({ value, label }));
export const JENIS_PAKET: Record<string, string> = { semua: "Perorangan & Korporasi", perorangan: "Perorangan", korporasi: "Korporasi" };
export const JENIS_ITEM: Record<string, string> = { lab: "Laboratorium", radiologi: "Radiologi", tindakan: "Tindakan / Lainnya" };

// Stasiun MCU (sama dengan backend). Kesimpulan selalu ada; laboratorium/radiologi otomatis bila paket berisi item tsb.
export const STASIUN_MCU = [
  { kode: "anamnesis", nama: "Anamnesis & Riwayat" },
  { kode: "tanda_vital", nama: "Tanda Vital & Antropometri" },
  { kode: "fisik", nama: "Pemeriksaan Fisik" },
  { kode: "visus", nama: "Visus & Buta Warna" },
  { kode: "audiometri", nama: "Audiometri" },
  { kode: "laboratorium", nama: "Laboratorium" },
  { kode: "radiologi", nama: "Radiologi" },
  { kode: "ekg", nama: "EKG" },
  { kode: "spirometri", nama: "Spirometri" },
  { kode: "gigi", nama: "Pemeriksaan Gigi" },
  { kode: "kesimpulan", nama: "Kesimpulan Dokter" },
];
export const namaStasiun = (kode: string) => STASIUN_MCU.find((s) => s.kode === kode)?.nama ?? kode;

// Sistem organ pemeriksaan fisik.
export const SISTEM_FISIK = [
  { kode: "kepala", nama: "Kepala & Leher" },
  { kode: "mata", nama: "Mata" },
  { kode: "tht", nama: "Telinga, Hidung, Tenggorok" },
  { kode: "thoraks", nama: "Thoraks (Jantung & Paru)" },
  { kode: "abdomen", nama: "Abdomen" },
  { kode: "ekstremitas", nama: "Ekstremitas" },
  { kode: "kulit", nama: "Kulit" },
  { kode: "neurologis", nama: "Neurologis" },
  { kode: "muskuloskeletal", nama: "Muskuloskeletal / Tulang Belakang" },
];

const qs = (params: Record<string, any> = {}) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return p.length ? "?" + p.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&") : "";
};

// Referensi & pasien
export const referensiMcu = () => apiPenunjangGet("/mcu/referensi");
export const cariPasienMcu = (cari: string, limit = 20) => apiPenunjangGet(`/mcu/pasien${qs({ cari, limit })}`);
// Daftarkan pasien baru dari MCU (lewat Admisi); NIK yang sudah terdaftar → pasien lama dipakai tanpa diubah.
export const daftarPasienBaruMcu = (data: {
  nama: string; jenisIdentitas: string; noIdentitas: string; jenisKelamin: string; tglLahir: string; noTelp?: string;
  alamat?: string; prov?: string; city?: string; district?: string;
}) => apiPenunjangPost("/mcu/pasien", data);

// Perusahaan
export const daftarPerusahaanMcu = (params: Record<string, any> = {}) => apiPenunjangGet(`/mcu/perusahaan${qs(params)}`);
export const simpanPerusahaanMcu = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/mcu/perusahaan/${uuid}`, data) : apiPenunjangPost("/mcu/perusahaan", data);
export const hapusPerusahaanMcu = (uuid: string) => apiPenunjangDelete(`/mcu/perusahaan/${uuid}`);
export const hargaKontrakMcu = (perusahaanUuid: string) => apiPenunjangGet(`/mcu/perusahaan/${perusahaanUuid}/harga-kontrak`);
export const simpanHargaKontrakMcu = (perusahaanUuid: string, data: Record<string, any>, uuid?: string) =>
  uuid
    ? apiPenunjangPut(`/mcu/perusahaan/${perusahaanUuid}/harga-kontrak/${uuid}`, data)
    : apiPenunjangPost(`/mcu/perusahaan/${perusahaanUuid}/harga-kontrak`, data);
export const hapusHargaKontrakMcu = (perusahaanUuid: string, uuid: string) =>
  apiPenunjangDelete(`/mcu/perusahaan/${perusahaanUuid}/harga-kontrak/${uuid}`);

// Paket
export const daftarPaketMcu = (params: Record<string, any> = {}) => apiPenunjangGet(`/mcu/paket${qs(params)}`);
export const detailPaketMcu = (uuid: string) => apiPenunjangGet(`/mcu/paket/${uuid}`);
export const simpanPaketMcu = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/mcu/paket/${uuid}`, data) : apiPenunjangPost("/mcu/paket", data);
export const hapusPaketMcu = (uuid: string) => apiPenunjangDelete(`/mcu/paket/${uuid}`);

// Peserta
export const daftarPesertaMcu = (params: Record<string, any> = {}) => apiPenunjangGet(`/mcu/peserta${qs(params)}`);
export const detailPesertaMcu = (uuid: string) => apiPenunjangGet(`/mcu/peserta/${uuid}`);
export const daftarkanPesertaMcu = (data: {
  caraBayar: "perorangan" | "korporasi";
  perusahaanUuid?: string | null;
  paketUuid: string;
  tanggal: string;
  jenisMcu: string;
  paymentMethod?: number;
  peserta: { patientUuid: string; nikKaryawan?: string; jabatan?: string; bagian?: string }[];
}) => apiPenunjangPost("/mcu/peserta", data);
export const ubahPesertaMcu = (uuid: string, data: Record<string, any>) => apiPenunjangPut(`/mcu/peserta/${uuid}`, data);
export const batalPesertaMcu = (uuid: string, alasan: string) => apiPenunjangPost(`/mcu/peserta/${uuid}/batal`, { alasan });
// Pembatalan massal: peserta terpilih (uuids) atau semua sesuai filter daftar (filter).
export const batalMassalPesertaMcu = (data: { uuids?: string[]; filter?: Record<string, any>; alasan: string }) =>
  apiPenunjangPost(`/mcu/peserta/batal-massal`, data);
// Hapus permanen (soft delete) peserta yang belum diproses, mis. salah impor.
export const hapusMassalPesertaMcu = (data: { uuids?: string[]; filter?: Record<string, any>; alasan: string }) =>
  apiPenunjangPost(`/mcu/peserta/hapus-massal`, data);
export const buatOrderLabMcu = (uuid: string) => apiPenunjangPost(`/mcu/peserta/${uuid}/order-lab`, {});

// Impor Excel rombongan korporasi
export const referensiImporMcu = (denganIcd = false) => apiPenunjangGet(`/mcu/impor/referensi${denganIcd ? "?dengan_icd=1" : ""}`);
export type DataImporMcu = {
  perusahaanUuid: string;
  paketUuid?: string | null;
  tanggal: string;
  jenisMcu: string;
  header: any[];
  baris: any[][];
  nomorBaris: number[];
};
export const pratinjauImporMcu = (data: DataImporMcu) => apiPenunjangPost("/mcu/impor/pratinjau", data, true);
export const simpanImporMcu = (data: DataImporMcu) => apiPenunjangPost("/mcu/impor/simpan", data);

// ── Kirim order lab peserta ke LIS secara massal (batch diproses di server, lab-service) ──
export type StatusLis = "belum" | "mengirim" | "terkirim" | "gagal" | "tidak_pasti" | "hasil_sebagian" | "hasil_lengkap" | "tanpa_order";
export const STATUS_LIS: Record<StatusLis, Lencana> = {
  belum: { label: "Belum dikirim", bg: "bg-[#EAECF0]", text: "text-[#475467]" },
  mengirim: { label: "Sedang dikirim", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  terkirim: { label: "Terkirim", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  gagal: { label: "Gagal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  tidak_pasti: { label: "Tidak pasti", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  hasil_sebagian: { label: "Hasil sebagian", bg: "bg-[#E0EAFF]", text: "text-[#3538CD]" },
  hasil_lengkap: { label: "Hasil lengkap", bg: "bg-[#D1FADF]", text: "text-[#05603A]" },
  tanpa_order: { label: "Tanpa order lab", bg: "bg-[#F2F4F7]", text: "text-[#98A2B3]" },
};
// Filter daftar: "hasil" = hasil sebagian + lengkap.
export const FILTER_STATUS_LIS: { value: string; label: string }[] = [
  { value: "belum", label: "Belum dikirim" },
  { value: "mengirim", label: "Sedang dikirim" },
  { value: "terkirim", label: "Terkirim" },
  { value: "gagal", label: "Gagal" },
  { value: "tidak_pasti", label: "Tidak pasti" },
  { value: "hasil", label: "Hasil masuk" },
  { value: "tanpa_order", label: "Tanpa order lab" },
];
export type AksiLis = "kirim" | "ulang" | "hasil" | "cek" | "tandai";
export const AKSI_LIS: Record<AksiLis, { label: string; ket: string }> = {
  kirim: { label: "Kirim ke LIS", ket: "Peserta berstatus belum dikirim / gagal. Yang sudah terkirim, sedang dikirim atau tidak pasti dilewati." },
  ulang: { label: "Kirim Ulang yang Gagal", ket: "Hanya peserta berstatus gagal. Yang sudah terkirim tidak pernah dikirim ulang." },
  hasil: { label: "Ambil Hasil LIS", ket: "Menarik hasil dari LIS (URL Ambil Hasil koneksi) untuk peserta yang sudah terkirim." },
  cek: { label: "Cek Status di LIS", ket: "Untuk peserta berstatus tidak pasti (respons LIS tidak diterima): memastikan apakah order sudah terdaftar di LIS sebelum dikirim ulang." },
  tandai: { label: "Tandai Belum Terdaftar", ket: "Gunakan hanya setelah memastikan langsung di aplikasi LIS bahwa order peserta TIDAK terdaftar; peserta lalu boleh dikirim ulang." },
};
// Petunjuk perbaikan dari pesan galat LIS (+ tautan ke Laboratorium › Mapping LIS yang relevan).
export const petunjukGalatLis = (pesan?: string | null): { teks: string; rute?: string; label?: string } | null => {
  const p = String(pesan ?? "");
  if (!p) return null;
  if (/tindakan|belum dimapping/i.test(p)) return { teks: "Petakan Kode Tindakan LIS pada tarif pemeriksaan terkait, lalu kirim ulang.", rute: "/laboratorium/mapping/tindakan-lis", label: "Mapping Tindakan LIS" };
  if (/unit asal|unit/i.test(p) && !/RM/i.test(p)) return { teks: "Petakan unit asal (MCU / poli) ke kode unit di LIS.", rute: "/laboratorium/mapping/referensi-lis", label: "Mapping Unit, Dokter & Penjamin" };
  if (/dokter/i.test(p)) return { teks: "Petakan dokter pengirim (atau Dokter MCU bawaan) ke kode dokter di LIS.", rute: "/laboratorium/mapping/referensi-lis", label: "Mapping Unit, Dokter & Penjamin" };
  if (/penjamin|perusahaan/i.test(p)) return { teks: "Petakan penjamin / perusahaan MCU ke kode penjamin di LIS.", rute: "/laboratorium/mapping/referensi-lis", label: "Mapping Unit, Dokter & Penjamin" };
  if (/RM duplikat|duplikat nomer RM/i.test(p)) return { teks: "LIS menolak karena No. RM pasien sudah ada di data LIS. Konfirmasi ke petugas/tim LIS; peserta lain tetap terkirim." };
  if (/tidak boleh kosong|harus/i.test(p)) return { teks: "Lengkapi data pasien/peserta yang wajib diisi LIS, lalu kirim ulang." };
  if (/belum pasti|cek status|waktu habis|terputus|bad gateway/i.test(p)) return { teks: "Respons LIS tidak diterima. Jalankan Cek Status sebelum mengirim ulang agar tidak terdaftar dua kali." };
  if (/coba lagi setelah|sibuk/i.test(p)) return { teks: "LIS sedang gagal memproses. Kirim ulang beberapa menit lagi." };
  if (/tidak dapat dihubungi|koneksi lis|x-api-key|kode rs|kode lab/i.test(p)) return { teks: "Periksa koneksi LIS (URL, API key, Kode RS/Lab).", rute: "/setting/konfigurasi-integrasi", label: "Konfigurasi LIS" };
  if (/tidak ditemukan di LIS|aman dikirim ulang/i.test(p)) return { teks: "Belum terdaftar di LIS — aman dikirim ulang." };
  return null;
};
export const koneksiLisMcu = () => apiPenunjangGet("/mcu/lis/koneksi");
export const prosesLisMcu = (data: {
  aksi: AksiLis; pesertaUuids?: string[]; filter?: Record<string, any>; koneksiUuid?: string | null; periksaNow?: boolean;
}) => apiPenunjangPost("/mcu/lis/proses", data);
export const daftarBatchLisMcu = (params: Record<string, any> = {}) => apiPenunjangGet(`/mcu/lis/batch${qs(params)}`);
export const detailBatchLisMcu = (uuid: string, denganItem = true) => apiPenunjangGet(`/mcu/lis/batch/${uuid}${denganItem ? "" : "?item=0"}`);
export const ulangBatchLisMcu = (uuid: string) => apiPenunjangPost(`/mcu/lis/batch/${uuid}/ulang`, {});
export const hentikanBatchLisMcu = (uuid: string) => apiPenunjangPost(`/mcu/lis/batch/${uuid}/hentikan`, {});

// Pemeriksaan per stasiun
export const pemeriksaanMcu = (pesertaUuid: string) => apiPenunjangGet(`/mcu/pemeriksaan/${pesertaUuid}`);
export const simpanStasiunMcu = (pesertaUuid: string, stasiun: string, data: Record<string, any>, status: "selesai" | "belum" = "selesai") =>
  apiPenunjangPut(`/mcu/pemeriksaan/${pesertaUuid}/${stasiun}`, { data, status });
export const simpanKesimpulanMcu = (
  pesertaUuid: string,
  data: { kesimpulan: Kesimpulan; saran?: string; catatan?: string; dokterPemeriksaUuid: string; paksa?: boolean },
) => apiPenunjangPut(`/mcu/pemeriksaan/${pesertaUuid}/kesimpulan`, data);
export const bukaKesimpulanMcu = (pesertaUuid: string) => apiPenunjangDelete(`/mcu/pemeriksaan/${pesertaUuid}/kesimpulan`);

// Invoice korporasi
export const daftarInvoiceMcu = (params: Record<string, any> = {}) => apiPenunjangGet(`/mcu/invoice${qs(params)}`);
export const kandidatInvoiceMcu = (params: { perusahaan_uuid: string; periode_mulai: string; periode_selesai: string }) =>
  apiPenunjangGet(`/mcu/invoice/kandidat${qs(params)}`);
export const detailInvoiceMcu = (uuid: string) => apiPenunjangGet(`/mcu/invoice/${uuid}`);
export const buatInvoiceMcu = (data: Record<string, any>) => apiPenunjangPost("/mcu/invoice", data);
export const ubahStatusInvoiceMcu = (uuid: string, aksi: "terbit" | "batal", data: Record<string, any> = {}) =>
  apiPenunjangPost(`/mcu/invoice/${uuid}/${aksi}`, data);
export const METODE_BAYAR_MCU: Record<string, string> = { transfer: "Transfer Bank", tunai: "Tunai", giro: "Giro", cek: "Cek", lainnya: "Lainnya" };
export const catatPembayaranMcu = (
  uuid: string,
  data: { tanggal: string; jumlah: number; metode: string; noReferensi?: string; catatan?: string },
) => apiPenunjangPost(`/mcu/invoice/${uuid}/pembayaran`, data);
export const batalPembayaranMcu = (uuid: string, bayarUuid: string, alasan: string) =>
  apiPenunjangPost(`/mcu/invoice/${uuid}/pembayaran/${bayarUuid}/batal`, { alasan });

// Laporan
export const laporanMcu = (params: Record<string, any> = {}) => apiPenunjangGet(`/mcu/laporan${qs(params)}`);
export const rekapHrdMcu = (params: { perusahaan_uuid: string; tanggal_mulai?: string; tanggal_selesai?: string; invoice_uuid?: string }) =>
  apiPenunjangGet(`/mcu/laporan/rekap-hrd${qs(params)}`);

// Flag hasil laboratorium (lab-service).
export const LABEL_FLAG_LAB: Record<string, string> = {
  N: "Normal", TN: "Tidak normal", L: "Rendah", H: "Tinggi", KL: "Kritis rendah", KH: "Kritis tinggi", A: "Abnormal",
};

// Utilitas tampilan
export const tglIso = (d: Date | null | undefined) => {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const tglIndo = (iso?: string | null) => {
  if (!iso) return "-";
  const [y, m, d] = String(iso).substring(0, 10).split("-");
  return `${Number(d)} ${BULAN[Number(m) - 1] ?? m} ${y}`;
};
export const rupiah = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n) || 0);
export const jenisKelamin = (g?: string) => (g === "Male" ? "Laki-laki" : g === "Female" ? "Perempuan" : g || "-");
