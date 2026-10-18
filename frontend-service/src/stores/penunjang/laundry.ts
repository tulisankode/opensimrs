// API modul Laundry & Linen (penunjang-service: /api/v3/penunjang/laundry). Request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler).
import { apiPenunjangDelete, apiPenunjangGet, apiPenunjangPatch, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";
export { waktuRingkas as waktuLaundry } from "@/stores/penunjang/cssd";

type Gaya = { label: string; bg: string; text: string };
const kuning = { bg: "bg-[#FEF0C7]", text: "text-[#B54708]" };
const hijau = { bg: "bg-[#D1FADF]", text: "text-[#027A48]" };
const merah = { bg: "bg-[#FDE2E1]", text: "text-[#B42318]" };
const biru = { bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" };
const abu = { bg: "bg-[#F2F4F7]", text: "text-[#344054]" };

export const KATEGORI_LINEN: Record<string, Gaya> = {
  biasa: { label: "Biasa", ...abu },
  infeksius: { label: "Infeksius", ...merah },
  bernoda_berat: { label: "Bernoda Berat", ...kuning },
};
export const STATUS_LAUNDRY: Record<string, Gaya> = {
  menunggu_konfirmasi: { label: "Menunggu Konfirmasi", ...kuning },
  menunggu: { label: "Menunggu", ...kuning },
  sebagian: { label: "Sebagian Terpenuhi", ...biru },
  proses: { label: "Proses", ...biru },
  berjalan: { label: "Berjalan", ...biru },
  belum: { label: "Belum", ...abu },
  selesai: { label: "Selesai", ...hijau },
  dibatalkan: { label: "Dibatalkan", ...merah },
};
export const TAHAP_BATCH: Record<string, string> = { pencucian: "Pencucian", pengeringan: "Pengeringan", setrika_lipat: "Setrika/Lipat" };
export const JENIS_KOREKSI: Record<string, string> = { hilang: "Hilang", rusak: "Rusak", afkir: "Afkir" };
export const SUMBER_TRANSAKSI: Record<string, string> = {
  saldo_awal: "Saldo awal",
  penerimaan_kotor: "Serah terima kotor",
  batch_selesai: "Batch selesai",
  distribusi_kirim: "Distribusi dikirim",
  distribusi_terima: "Distribusi diterima",
  registrasi_unit: "Registrasi unit baru",
  koreksi_unit: "Koreksi unit",
  hilang: "Hilang",
  rusak: "Rusak",
  afkir: "Afkir",
};
export const OPSI_KATEGORI = Object.entries(KATEGORI_LINEN).map(([value, g]) => ({ value, label: g.label }));
export const OPSI_KOREKSI = Object.entries(JENIS_KOREKSI).map(([value, label]) => ({ value, label }));
export const gayaKategori = (k?: string) => KATEGORI_LINEN[k ?? ""] ?? { label: k ?? "-", ...abu };
export const gayaStatusLaundry = (s?: string) => STATUS_LAUNDRY[s ?? ""] ?? { label: s ?? "-", ...abu };

// Izin aksi modul (tanpa daftar izin = super admin → boleh; backend tetap memeriksa izin).
export const izinLaundry = (submodul: string, aksi: string, fitur?: string) =>
  !getStoredPermissions().length || hasPermission("Laundry", submodul, aksi, fitur ?? null);

// Tanggal (awal/akhir hari lokal) → epoch detik untuk filter ?dari=&sampai=.
export const epochAwalHari = (d?: Date | null) => (d ? Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000) : undefined);
export const epochAkhirHari = (d?: Date | null) => (d ? Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime() / 1000) : undefined);

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

// ── Referensi & datamaster
export const referensiLaundry = () => apiPenunjangGet("/laundry/referensi");
export const daftarLinenLaundry = (params: Record<string, any> = {}) => apiPenunjangGet(`/laundry/linen${qs(params)}`);
export const simpanLinenLaundry = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPatch(`/laundry/linen/${uuid}`, data) : apiPenunjangPost("/laundry/linen", data);
export const hapusLinenLaundry = (uuid: string) => apiPenunjangDelete(`/laundry/linen/${uuid}`);

// ── Stok & par level
export const stokLaundry = (params: Record<string, any> = {}) => apiPenunjangGet(`/laundry/stok${qs(params)}`);
export const simpanStokRuanganLaundry = (lokasiUuid: string, jenisLinenUuid: string, data: { parLevel?: number | null; saldoAwal?: number | null }) =>
  apiPenunjangPut(`/laundry/stok/${lokasiUuid}/${jenisLinenUuid}`, data);
export const saldoAwalLaundry = (jenisLinenUuid: string, saldoAwal: number) => apiPenunjangPut(`/laundry/stok-laundry/${jenisLinenUuid}`, { saldoAwal });
export const riwayatStokLaundry = (params: Record<string, any>) => apiPenunjangGet(`/laundry/stok/riwayat${qs(params)}`);

// ── Koreksi
export const daftarKoreksiLaundry = (params: Record<string, any> = {}) => apiPenunjangGet(`/laundry/koreksi-stok${qs(params)}`);
export const koreksiStokLaundry = (data: Record<string, any>) => apiPenunjangPost("/laundry/koreksi-stok", data);

// ── Serah terima linen kotor
export const daftarPenerimaanLaundry = (params: Record<string, any> = {}) => apiPenunjangGet(`/laundry/penerimaan${qs(params)}`);
// Jenis per unit: kodeUnit = hasil pindai (jumlah dihitung dari banyaknya kode).
export const buatPenerimaanLaundry = (data: { lokasiUuid: string; catatan?: string; rincian: { jenisLinenUuid: string; kategori: string; jumlahDiserahkan?: number; kodeUnit?: string[] }[] }) =>
  apiPenunjangPost("/laundry/penerimaan", data);
export const konfirmasiPenerimaanLaundry = (uuid: string, rincian: { uuid: string; jumlahDiterima?: number; kodeUnit?: string[]; alasanSelisih?: string }[]) =>
  apiPenunjangPost(`/laundry/penerimaan/${uuid}/konfirmasi`, { rincian });
export const batalPenerimaanLaundry = (uuid: string) => apiPenunjangDelete(`/laundry/penerimaan/${uuid}`);

// ── Batch
export const antreanCuciLaundry = () => apiPenunjangGet("/laundry/penerimaan/antrean");
export const daftarBatchLaundry = (params: Record<string, any> = {}) => apiPenunjangGet(`/laundry/batch${qs(params)}`);
export const buatBatchLaundry = (data: { beratKg: number; kode?: string; catatan?: string; kodeUnit?: string[]; rincianAsal?: { rincianPenerimaanUuid: string; jumlahDiproses?: number; kodeUnit?: string[] }[] }) =>
  apiPenunjangPost("/laundry/batch", data);
export const ubahTahapLaundry = (batchUuid: string, tahap: string, status: "berjalan" | "selesai", catatan?: string, kodeUnit?: string[]) =>
  apiPenunjangPatch(`/laundry/batch/${batchUuid}/tahap/${tahap}`, { status, catatan, kodeUnit });

// ── Permintaan & distribusi
export const daftarPermintaanLaundry = (params: Record<string, any> = {}) => apiPenunjangGet(`/laundry/permintaan${qs(params)}`);
export const buatPermintaanLaundry = (data: { lokasiUuid: string; catatan?: string; rincian: { jenisLinenUuid: string; jumlahDiminta: number }[] }) =>
  apiPenunjangPost("/laundry/permintaan", data);
export const batalPermintaanLaundry = (uuid: string, alasan: string) => apiPenunjangPost(`/laundry/permintaan/${uuid}/batal`, { alasan });
export const daftarDistribusiLaundry = (params: Record<string, any> = {}) => apiPenunjangGet(`/laundry/distribusi${qs(params)}`);
export const kirimDistribusiLaundry = (data: { lokasiTujuanUuid: string; permintaanUuid?: string; catatan?: string; rincian: { jenisLinenUuid: string; jumlahDikirim?: number; kodeUnit?: string[] }[] }) =>
  apiPenunjangPost("/laundry/distribusi", data);
export const konfirmasiDistribusiLaundry = (uuid: string, rincian: { uuid: string; jumlahDiterima?: number; kodeUnit?: string[]; alasanSelisih?: string }[]) =>
  apiPenunjangPost(`/laundry/distribusi/${uuid}/konfirmasi`, { rincian });

// ── Laporan
export const laporanLaundry = (params: Record<string, any> = {}) => apiPenunjangGet(`/laundry/laporan${qs(params)}`);
export const rekonsiliasiLaundry = (params: Record<string, any> = {}) => apiPenunjangGet(`/laundry/laporan/rekonsiliasi${qs(params)}`);
export const eksporLaundry = (params: Record<string, any> = {}) => apiPenunjangGet(`/laundry/laporan/ekspor${qs(params)}`);

// ── Pelacakan per unit linen (STD-0030). Jenis per unit tetap memakai buku stok yang sama: perpindahan alur dicatat
// lewat fungsi serah terima/batch/distribusi di atas dengan kodeUnit hasil pindai.
export const STATUS_UNIT: Record<string, Gaya> = {
  aktif: { label: "Aktif", ...hijau },
  rusak: { label: "Rusak", ...kuning },
  hilang: { label: "Hilang", ...merah },
  dimusnahkan: { label: "Dimusnahkan", ...abu },
};
export const SIKLUS_UNIT: Record<string, Gaya> = {
  normal: { label: "Normal", ...abu },
  mendekati: { label: "Mendekati batas", ...kuning },
  tercapai: { label: "Mencapai batas", ...merah },
};
export const POSISI_UNIT: Record<string, string> = {
  ruangan: "Di ruangan",
  serah_kotor: "Diserahkan (menunggu laundry)",
  kotor: "Antrean cuci",
  batch: "Dalam batch",
  laundry: "Stok bersih laundry",
  dalam_perjalanan: "Dalam distribusi",
};
export const PERISTIWA_UNIT: Record<string, string> = {
  registrasi: "Registrasi",
  serah_kotor: "Serah terima kotor",
  serah_dibatalkan: "Kembali ke ruangan",
  terima_kotor: "Diterima laundry",
  masuk_batch: "Masuk batch",
  selesai_cuci: "Selesai dicuci",
  distribusi: "Didistribusikan",
  terima_ruangan: "Diterima ruangan",
  selisih_distribusi: "Tidak diterima (selisih)",
  ubah_status: "Ubah status",
  koreksi_lokasi: "Koreksi lokasi",
  tautan_bed: "Tautan bed/kamar",
};
export const gayaStatusUnit = (s?: string) => STATUS_UNIT[s ?? ""] ?? { label: s ?? "-", ...abu };
export const gayaSiklusUnit = (s?: string) => SIKLUS_UNIT[s ?? ""] ?? SIKLUS_UNIT.normal;
// Posisi unit yang mudah dibaca: "Di ruangan Bangsal Melati", "Stok bersih laundry", dst.
export const posisiUnit = (u: any) => (u?.lokasiTipe === "laundry" ? POSISI_UNIT.laundry : `${POSISI_UNIT[u?.lokasiTipe] ?? u?.lokasiTipe ?? "-"}${u?.namaLokasi ? ` · ${u.namaLokasi}` : ""}`);

export const referensiUnitLaundry = () => apiPenunjangGet("/laundry/unit/referensi");
export const jenisUnitLaundry = () => apiPenunjangGet("/laundry/unit/jenis");
export const aturJenisUnitLaundry = (uuid: string, data: { caraPencatatan?: "per_unit" | "per_jumlah"; batasSiklus?: number | null; peringatanSiklus?: number | null }) =>
  apiPenunjangPatch(`/laundry/unit/jenis/${uuid}`, data);
export const daftarUnitLaundry = (params: Record<string, any> = {}) => apiPenunjangGet(`/laundry/unit${qs(params)}`);
export const registrasiUnitLaundry = (data: { jenisLinenUuid: string; jumlah?: number; kodeAwal?: string; kodeUnit?: string; lokasiTipe: "ruangan" | "laundry"; lokasiUuid?: string; sumber: "stok_ada" | "baru" }) =>
  apiPenunjangPost("/laundry/unit", data);
export const pindaiUnitLaundry = (kode: string) => apiPenunjangGet(`/laundry/unit/pindai${qs({ kode })}`);
export const unitDokumenLaundry = (dokumenUuid: string) => apiPenunjangGet(`/laundry/unit/dokumen/${dokumenUuid}`);
export const labelUnitLaundry = (uuid: string[]) => apiPenunjangGet(`/laundry/unit/label${qs({ uuid: uuid.join(",") })}`);
export const bedUnitLaundry = (lokasiUuid: string) => apiPenunjangGet(`/laundry/unit/bed${qs({ lokasi_uuid: lokasiUuid })}`);
export const detailUnitLaundry = (uuid: string) => apiPenunjangGet(`/laundry/unit/${uuid}`);
export const ubahStatusUnitLaundry = (uuid: string, data: { status: string; alasan: string; lokasiTipe?: string; lokasiUuid?: string }) => apiPenunjangPatch(`/laundry/unit/${uuid}/status`, data);
export const koreksiLokasiUnitLaundry = (uuid: string, data: { lokasiTipe: string; lokasiUuid?: string; alasan: string }) => apiPenunjangPut(`/laundry/unit/${uuid}/lokasi`, data);
export const tautkanBedUnitLaundry = (uuid: string, data: { bedUuid: string | null; alasan?: string }) => apiPenunjangPut(`/laundry/unit/${uuid}/bed`, data);
export const laporanUnitLaundry = (jenis: "riwayat" | "status" | "siklus" | "perputaran", params: Record<string, any> = {}) =>
  apiPenunjangGet(`/laundry/unit/laporan/${jenis}${qs(params)}`);
