import type { SidebarBody } from "@/utils/Interface";
import { ruteDiizinkanModul } from "@/stores/modulFaskes";

export type PermissionAction = string | string[] | null | undefined;

export interface PermissionRequirement {
  module: string;
  submodule?: string | null;
  action?: PermissionAction;
  feature?: string | string[] | null;
}

export interface PermissionAllow {
  name: string;
  checked?: boolean;
}

export interface PermissionFeature {
  name: string;
  checked?: boolean;
  allows: PermissionAllow[];
}

export interface PermissionSubmodule {
  name: string;
  checked?: boolean;
  features: PermissionFeature[];
  allows: PermissionAllow[];
}

export interface PermissionModule {
  module: string;
  checked?: boolean;
  submodules: PermissionSubmodule[];
}

type LegacyPermissionModule = {
  module?: string;
  checked?: boolean;
  submodules?: unknown[];
  subModules?: unknown[];
  sub_modules?: unknown[];
};

type LegacyPermissionNode = {
  name?: string;
  checked?: boolean;
  features?: unknown[];
  allows?: unknown[];
};

const STORAGE_KEY = "permission";
const STUB_MODULES = ["Training"];

interface PermissionRouteEntry {
  path: string;
  mode?: "exact" | "prefix";
  permission?: PermissionRequirement;
  featureStatus?: "real" | "stub";
}

const read = (
  module: string,
  submodule?: string | null,
  feature?: string | string[] | null,
  action: PermissionAction = "READ"
): PermissionRequirement => ({ module, submodule, feature, action });

const any = (
  module: string,
  submodule: string,
  action: string[]
): PermissionRequirement => ({ module, submodule, action });

export const permissionRouteRegistry: PermissionRouteEntry[] = [
  { path: "/setting/profil-faskes", permission: read("Setting", "Profile Faskes") },
  { path: "/setting/konfigurasi-integrasi", permission: read("Setting", "Konfigurasi Integrasi") },
  { path: "/setting/permission-menu", permission: read("Setting", "Profile Faskes") },
  { path: "/setting/print-out", permission: read("Setting", "Print Out") },
  { path: "/setting/profil-akun", permission: read("Setting", "Profile Saya") },
  { path: "/setting/manajemen-modul", permission: read("Setting", "System") },
  { path: "/setting/system", permission: read("Setting", "System") },

  { path: "/datamaster/user", permission: read("Datamaster", "User") },
  { path: "/datamaster/role", permission: read("Datamaster", "Role") },
  { path: "/datamaster/ruangan", permission: read("Datamaster", "Ruangan") },
  { path: "/datamaster/kategori-ruangan", permission: read("Datamaster", "Kategori Ruangan") },
  { path: "/datamaster/tarif", permission: read("Datamaster", "Tarif") },
  { path: "/datamaster/komponen-tarif", permission: read("Datamaster", "Komponen Tarif") },
  { path: "/datamaster/tindakan", permission: read("Datamaster", "Tindakan") },
  { path: "/datamaster/icd9-cm", permission: read("Datamaster", "ICD-9 CM") },
  { path: "/datamaster/snomed-ct", permission: read("Datamaster", "Snomed-CT") },
  { path: "/datamaster/loinc", permission: read("Datamaster", "LOINC") },
  { path: "/datamaster/diagnosis-icd10", permission: read("Datamaster", "Diagnosis ICD-10") },
  { path: "/datamaster/praktisi", permission: read("Datamaster", "Praktisioner") },
  { path: "/datamaster/pegawai", permission: read("Datamaster", "Pegawai") },
  { path: "/datamaster/penjamin", permission: read("Datamaster", "Penjamin") },
  { path: "/datamaster/voucher", permission: read("Datamaster", "Voucher") },
  { path: "/datamaster/faskes", permission: read("Datamaster", "Faskes") },
  { path: "/datamaster/lokasi", permission: read("Datamaster", "Lokasi") },
  { path: "/datamaster/organisasi", permission: read("Datamaster", "Organisasi") },
  { path: "/datamaster/general-consent", permission: read("Datamaster", "General Consent") },
  { path: "/datamaster/super-admin/gigi-fdi", permission: read("Datamaster", "Gigi FDI") },
  { path: "/datamaster/super-admin/kategori-gigi", permission: read("Datamaster", "Kategori Gigi") },
  { path: "/datamaster/super-admin/item-gigi", permission: read("Datamaster", "Item Gigi") },
  { path: "/datamaster/super-admin/oklusi", permission: read("Datamaster", "Oklusi") },

  { path: "/admisi/rawat-jalan", permission: read("Admisi", "Admisi RJ") },
  { path: "/admisi/rawat-inap", permission: read("Admisi", "Admisi RI") },
  { path: "/admisi/igd", permission: any("Admisi", "Admisi IGD", ["READ", "CREATE PASIEN IGD", "UPDATE ADMISI IGD"]) },
  { path: "/admisi/sep", mode: "prefix", permission: read("Admisi", "SEP") },
  { path: "/admisi/data-pasien", permission: read("Admisi", "Data Pasien") },
  { path: "/admisi/monitoring-kamar", permission: read("Admisi", "Monitoring Kamar") },
  { path: "/admisi/laporan/kunjungan", permission: read("Admisi", "Laporan Admisi", "Kunjungan") },
  { path: "/admisi/laporan/penjamin", permission: read("Admisi", "Laporan Admisi", "Penjamin") },
  { path: "/admisi/laporan/batal-kunjungan", permission: read("Admisi", "Laporan Admisi", "Batal Kunjungan") },
  { path: "/admisi/laporan/status-kamar", permission: read("Admisi", "Laporan Admisi", "Status kamar") },
  { path: "/admisi/laporan/keperawatan-inap-pasien", permission: read("Admisi", "Laporan Admisi", "Keperawatan Inap Pasien") },
  { path: "/admisi/laporan/bayi-baru-lahir", permission: read("Admisi", "Laporan Admisi", "Bayi Baru Lahir") },
  { path: "/admisi/laporan/rekap-kunjungan", permission: read("Admisi", "Laporan Admisi", "Rekap Kunjungan") },

  { path: "/antrian/konfigurasi", mode: "prefix", permission: read("Antrian", "Konfigurasi") },
  { path: "/antrian/data-antrian", permission: read("Antrian", "Data Antrian") },
  { path: "/antrian/layar", permission: read("Antrian", "Layar") },
  { path: "/antrian/apm", mode: "prefix", permission: any("Antrian", "Apm", ["READ", "CHECKIN", "PRINT", "CREATE PASIEN JKN", "CREATE PASIEN NON-JKN"]) },

  { path: "/rawat-jalan/poli", permission: read("Rawat Jalan", "Poli") },
  { path: "/rawat-jalan/bpjs/monitoring-kunjungan", featureStatus: "stub", permission: read("Rawat Jalan", "BPJS-PCARE", "Monitoring Kunjungan") },
  { path: "/rawat-jalan/bpjs/monitoring-riwayat-kunjungan", featureStatus: "stub", permission: read("Rawat Jalan", "BPJS-PCARE", "Monitoring Riwayat Kunjungan") },
  { path: "/rawat-jalan/bpjs/monitoring-obat-kunjungan", featureStatus: "stub", permission: read("Rawat Jalan", "BPJS-PCARE", "Monitoring Obat Kunjungan") },
  { path: "/rawat-jalan/laporan/kunjungan-rawat-jalan", permission: read("Rawat Jalan", "Laporan Rawat Jalan", "Kunjungan") },
  { path: "/rawat-jalan/laporan/pembatalan-poli", permission: read("Rawat Jalan", "Laporan Rawat Jalan", "Pembatalan Poli") },
  { path: "/rawat-jalan/laporan/rekap-tindakan-pasien", permission: read("Rawat Jalan", "Laporan Rawat Jalan", "Rekap Pembatalan Pasien") },

  { path: "/rawat-inap/ruangan", permission: read("Rawat Inap", "Rawat Inap") },
  { path: "/rawat-inap/perpindahan-bangsal", permission: read("Rawat Inap", "Perpindahan Bangsal") },
  { path: "/rawat-inap/bpjs/monitoring-kunjungan", featureStatus: "stub", permission: read("Rawat Inap", "BPJS-PCARE", "Monitoring Kunjungan") },
  { path: "/rawat-inap/bpjs/monitoring-riwayat-kunjungan", featureStatus: "stub", permission: read("Rawat Inap", "BPJS-PCARE", "Monitoring Riwayat Kunjungan") },
  { path: "/rawat-inap/bpjs/monitoring-obat-kunjungan", featureStatus: "stub", permission: read("Rawat Inap", "BPJS-PCARE", "Monitoring Obat Kunjungan") },
  { path: "/rawat-inap/laporan/kunjungan-rawat-inap", permission: read("Rawat Inap", "Laporan", "Monitoring Rawat Inap") },
  { path: "/rawat-inap/laporan/perpindahan-pasien", permission: read("Rawat Inap", "Laporan", "Perpindahan Pasien") },
  { path: "/rawat-inap/laporan/pembatalan-dirawat", permission: read("Rawat Inap", "Laporan", "Pembatalan Berobat") },
  { path: "/rawat-inap/laporan/rekap-tindakan-pasien", permission: read("Rawat Inap", "Laporan", "Rekap Tindakan Pasien") },

  { path: "/igd/pasien-igd", permission: read("IGD", "IGD") },
  { path: "/igd/bpjs", mode: "prefix", featureStatus: "stub", permission: read("IGD", "BPJS-PCARE") },
  { path: "/igd/laporan/kunjungan-igd", permission: read("IGD", "Laporan IGD", "Kunjungan") },
  { path: "/igd/laporan/pembatalan-dirawat", permission: read("IGD", "Laporan IGD", "Pembatalan Berobat") },
  { path: "/igd/laporan/rekap-tindakan-pasien", permission: read("IGD", "Laporan IGD", "Rekap Tindakan Pasien") },

  { path: "/laboratorium/order-lab", permission: read("Laboratorium", "Order Lab") },
  { path: "/laboratorium/hasil-pemeriksaan", permission: read("Laboratorium", "Hasil Pemeriksaan") },
  { path: "/laboratorium/expertise", permission: read("Laboratorium", "Expertise") },
  { path: "/laboratorium/datamaster/kategori-pemeriksaan", permission: read("Laboratorium", "Datamaster", "Kategori Pemeriksaan") },
  { path: "/laboratorium/datamaster/kelompok-pemeriksaan", permission: read("Laboratorium", "Datamaster", "Kelompok Pemeriksaan") },
  { path: "/laboratorium/datamaster/item-pemeriksaan", permission: read("Laboratorium", "Datamaster", "Item Pemeriksaan") },
  { path: "/laboratorium/datamaster/spesimen", permission: read("Laboratorium", "Datamaster", "Spesimen") },
  { path: "/laboratorium/datamaster/tarif-lab", permission: read("Laboratorium", "Datamaster", "Tarif Lab") },
  // Mapping LIS memakai izin datamaster terkait (tarif → kode tindakan, item → kode hasil)
  { path: "/laboratorium/mapping/tindakan-lis", permission: read("Laboratorium", "Datamaster", "Tarif Lab") },
  { path: "/laboratorium/mapping/hasil-lis", permission: read("Laboratorium", "Datamaster", "Item Pemeriksaan") },
  { path: "/laboratorium/mapping/referensi-lis", permission: read("Laboratorium", "Datamaster", "Tarif Lab") },
  { path: "/laboratorium/laporan/kunjungan", permission: read("Laboratorium", "Laporan", "Kunjungan") },
  { path: "/laboratorium/laporan/waktu-tunggu", permission: read("Laboratorium", "Laporan", "Waktu Tunggu TAT") },
  { path: "/laboratorium/laporan/rekap-jumlah", permission: read("Laboratorium", "Laporan", "Rekap Jumlah Pemeriksaan") },

  { path: "/pembayaran/kasir", permission: read("Pembayaran", "Kasir") },
  { path: "/pembayaran/transaksi", mode: "prefix", permission: read("Pembayaran", "Transaksi") },
  { path: "/pembayaran/closed-bill", mode: "prefix", permission: read("Pembayaran", "Closed Bill") },
  { path: "/pembayaran/laporan/pendapatan", permission: read("Pembayaran", "Laporan Pembayaran", "Pendapatan") },
  { path: "/pembayaran/laporan/pembayaran", permission: read("Pembayaran", "Laporan Pembayaran", "Kunjungan") },
  { path: "/pembayaran/laporan/closing", permission: read("Pembayaran", "Laporan Pembayaran", "Closing Kasir") },

  { path: "/farmasi/resep-dokter", permission: read("Farmasi", "Resep Dokter") },
  { path: "/farmasi/penjualan-obat", permission: read("Farmasi", "Penjualan Obat") },
  { path: "/farmasi/retur-obat-&-material", permission: read("Farmasi", "Retur Obat dan Material") },
  { path: "/farmasi/farmasi-ruangan", permission: read("Farmasi", "Farmasi Ruangan") },
  { path: "/farmasi/riwayat-transaksi", permission: read("Farmasi", "Riwayat Transaksi") },
  { path: "/farmasi/datamaster/aturan-pakai", permission: read("Farmasi", "Datamaster", "Aturan Pakai") },
  { path: "/farmasi/datamaster/satuan", permission: read("Farmasi", "Datamaster", "Satuan") },
  { path: "/farmasi/datamaster/bentuk-sediaan", permission: read("Farmasi", "Datamaster", "Bentuk Sediaan") },
  { path: "/farmasi/datamaster/kategori-obat", permission: read("Farmasi", "Datamaster", "Kategori Obat") },
  { path: "/farmasi/datamaster/manufaktur", permission: read("Farmasi", "Datamaster", "Manufaktur") },
  { path: "/farmasi/datamaster/jenis-stok", permission: read("Farmasi", "Datamaster", "Jenis Stok") },
  { path: "/farmasi/datamaster/lokasi-stok", permission: read("Farmasi", "Datamaster", "Lokasi Stok") },
  { path: "/farmasi/datamaster/item-medis", permission: read("Farmasi", "Datamaster", "Item Medis") },
  { path: "/farmasi/datamaster/cara-pakai", permission: read("Farmasi", "Datamaster", "Cara Pakai") },
  { path: "/farmasi/datamaster/komposisi", permission: read("Farmasi", "Datamaster", "Komposisi") },
  { path: "/farmasi/datamaster/konfigurasi-harga", permission: read("Farmasi", "Datamaster", "Konfigurasi Harga") },
  { path: "/farmasi/laporan/pendapatan", permission: read("Farmasi", "Riwayat Transaksi", "Pendapatan") },
  { path: "/farmasi/laporan/waktu-tunggu", permission: read("Farmasi", "Riwayat Transaksi", "Waktu Tunggu") },
  { path: "/farmasi/laporan/rekap-pendapatan-dokter-resep-per-apotik", permission: read("Farmasi", "Riwayat Transaksi", "Rekap Pendapatan Per Apotik") },

  // Fisioterapi / Rehabilitasi Medik (penunjang-service)
  { path: "/fisioterapi/order-fisioterapi", permission: read("Fisioterapi", "Order Fisioterapi") },
  { path: "/fisioterapi/penjadwalan-fisioterapi", permission: read("Fisioterapi", "Penjadwalan Terapi") },
  { path: "/fisioterapi/evaluasi-terapi", permission: read("Fisioterapi", "Evaluasi Terapi") },
  { path: "/fisioterapi/booking-terapi", permission: read("Fisioterapi", "Booking Terapi") },
  { path: "/fisioterapi/datamaster/bed-ruangan", permission: read("Fisioterapi", "Datamaster", "Bed Ruangan") },
  { path: "/fisioterapi/datamaster/tindakan", permission: read("Fisioterapi", "Datamaster", "Tindakan Terapi") },
  { path: "/fisioterapi/datamaster/paket", permission: read("Fisioterapi", "Datamaster", "Paket Terapi") },
  { path: "/fisioterapi/laporan/kunjungan", permission: read("Fisioterapi", "Laporan Fisio", "Kunjungan") },
  { path: "/fisioterapi/laporan/rekapitulasi-kunjungan-jenis-fisioterapi", permission: read("Fisioterapi", "Laporan Fisio", "Rekapitulasi Kunjungan Jenis Fisioterapi") },
  { path: "/fisioterapi/laporan/rekapitulasi-terapi", permission: read("Fisioterapi", "Laporan Fisio", "Rekapitulasi Terapi") },
  { path: "/fisioterapi/laporan/rekapitulasi-pendapatan-fisioterapi", permission: read("Fisioterapi", "Laporan Fisio", "Rekapitulasi Pendapatan Fisioterapi") },
  { path: "/fisioterapi", mode: "prefix", permission: read("Fisioterapi", null, null, null) },

  // Radiologi (penunjang-service)
  { path: "/radiologi/order", permission: read("Radiologi", "Order Radiologi") },
  { path: "/radiologi/penjadwalan", permission: read("Radiologi", "Penjadwalan") },
  { path: "/radiologi/pemeriksaan", permission: read("Radiologi", "Pemeriksaan") },
  { path: "/radiologi/datamaster/pemeriksaan", permission: read("Radiologi", "Datamaster", "Pemeriksaan Radiologi") },
  { path: "/radiologi/datamaster/paket", permission: read("Radiologi", "Datamaster", "Paket Radiologi") },
  { path: "/radiologi/datamaster/ruang", permission: read("Radiologi", "Datamaster", "Ruang & Alat") },
  { path: "/radiologi/datamaster/template", permission: read("Radiologi", "Datamaster", "Template Expertise") },
  { path: "/radiologi/datamaster/petugas", permission: read("Radiologi", "Datamaster", "Petugas Radiologi") },
  // Mapping PACS (Bridging PACS/RIS, fitur rad_bridging_pacs) memakai izin datamaster "Mapping PACS"
  { path: "/radiologi/mapping/tindakan-pacs", permission: read("Radiologi", "Datamaster", "Mapping PACS") },
  { path: "/radiologi/mapping/referensi-pacs", permission: read("Radiologi", "Datamaster", "Mapping PACS") },
  { path: "/radiologi/mapping/ruang-pacs", permission: read("Radiologi", "Datamaster", "Mapping PACS") },
  { path: "/radiologi/laporan/kunjungan", permission: read("Radiologi", "Laporan Radiologi", "Kunjungan") },
  { path: "/radiologi", mode: "prefix", permission: read("Radiologi", null, null, null) },

  // Medical Check Up (penunjang-service)
  { path: "/mcu/peserta", permission: read("MCU", "Peserta") },
  { path: "/mcu/pemeriksaan", permission: read("MCU", "Pemeriksaan") },
  { path: "/mcu/datamaster/paket", permission: read("MCU", "Datamaster", "Paket MCU") },
  { path: "/mcu/datamaster/perusahaan", permission: read("MCU", "Datamaster", "Perusahaan") },
  { path: "/mcu/tagihan-korporasi", permission: read("MCU", "Tagihan Korporasi") },
  { path: "/mcu/laporan", permission: read("MCU", "Laporan MCU") },
  { path: "/mcu/rekap-hrd", permission: read("MCU", "Laporan MCU") },
  { path: "/mcu", mode: "prefix", permission: read("MCU", null, null, null) },
  { path: "/patologi-anatomi/order", permission: read("Patologi Anatomi", "Order PA") },
  { path: "/patologi-anatomi/penerimaan", permission: read("Patologi Anatomi", "Penerimaan Jaringan") },
  { path: "/patologi-anatomi/pemeriksaan", permission: read("Patologi Anatomi", "Pemeriksaan") },
  { path: "/patologi-anatomi/arsip", permission: read("Patologi Anatomi", "Arsip Blok & Slide") },
  { path: "/patologi-anatomi/datamaster/pemeriksaan", permission: read("Patologi Anatomi", "Datamaster", "Pemeriksaan PA") },
  { path: "/patologi-anatomi/datamaster/template", permission: read("Patologi Anatomi", "Datamaster", "Template Laporan PA") },
  { path: "/patologi-anatomi/laporan/kunjungan", permission: read("Patologi Anatomi", "Laporan PA", "Kunjungan") },
  { path: "/patologi-anatomi", mode: "prefix", permission: read("Patologi Anatomi", null, null, null) },
  { path: "/mikrobiologi/order", permission: read("Mikrobiologi", "Order Mikrobiologi") },
  { path: "/mikrobiologi/pemeriksaan", permission: read("Mikrobiologi", "Pemeriksaan") },
  { path: "/mikrobiologi/datamaster/pemeriksaan", permission: read("Mikrobiologi", "Datamaster", "Pemeriksaan Mikrobiologi") },
  { path: "/mikrobiologi/datamaster/organisme", permission: read("Mikrobiologi", "Datamaster", "Organisme") },
  { path: "/mikrobiologi/datamaster/antibiotik", permission: read("Mikrobiologi", "Datamaster", "Antibiotik") },
  { path: "/mikrobiologi/laporan/kunjungan", permission: read("Mikrobiologi", "Laporan Mikrobiologi", "Kunjungan") },
  { path: "/mikrobiologi/laporan/antibiogram", permission: read("Mikrobiologi", "Laporan Mikrobiologi", "Antibiogram") },
  { path: "/mikrobiologi", mode: "prefix", permission: read("Mikrobiologi", null, null, null) },
  // Gizi (penunjang-service): skrining, asuhan gizi (PAGT), order diet, distribusi makan & rekap porsi.
  { path: "/gizi/skrining", permission: read("Gizi", "Skrining") },
  { path: "/gizi/asuhan", permission: read("Gizi", "Asesmen Gizi") },
  { path: "/gizi/order", permission: read("Gizi", "Order Diet") },
  { path: "/gizi/distribusi", permission: read("Gizi", "Distribusi") },
  { path: "/gizi/master/diet", permission: read("Gizi", "Datamaster", "Master Diet") },
  { path: "/gizi/master/bentuk-makanan", permission: read("Gizi", "Datamaster", "Bentuk Makanan") },
  { path: "/gizi/master/standar-porsi", permission: read("Gizi", "Datamaster", "Standar Porsi") },
  { path: "/gizi/laporan", permission: read("Gizi", "Laporan Gizi") },
  { path: "/gizi", mode: "prefix", permission: read("Gizi", null, null, null) },
  { path: "/icu/dashboard", permission: read("ICU", "Dasbor") },
  { path: "/icu/perawatan", permission: read("ICU", "Perawatan") },
  { path: "/icu/laporan", permission: read("ICU", "Laporan ICU") },
  { path: "/icu", mode: "prefix", permission: read("ICU", null, null, null) },

  // CSSD — Sterilisasi Alat & Pelacakan Set Instrumen (penunjang-service)
  { path: "/cssd/dashboard", permission: read("CSSD", "Penyimpanan & Distribusi") },
  { path: "/cssd/penerimaan", permission: read("CSSD", "Penerimaan & Dekontaminasi") },
  { path: "/cssd/pemrosesan", permission: read("CSSD", "Penerimaan & Dekontaminasi") },
  { path: "/cssd/load", permission: read("CSSD", "Siklus Sterilisasi") },
  { path: "/cssd/distribusi", permission: read("CSSD", "Penyimpanan & Distribusi") },
  { path: "/cssd/recall", permission: read("CSSD", "Recall") },
  { path: "/cssd/datamaster/master-set", permission: read("CSSD", "Master Set & Mesin") },
  { path: "/cssd/datamaster/mesin", permission: read("CSSD", "Master Set & Mesin") },
  { path: "/cssd/laporan", permission: read("CSSD", "Laporan CSSD") },
  { path: "/cssd", mode: "prefix", permission: read("CSSD", null, null, null) },

  // Bank Darah RS (BDRS) — penunjang-service
  { path: "/bank-darah/permintaan", permission: read("Bank Darah RS (BDRS)", "Permintaan Darah") },
  { path: "/bank-darah/crossmatch", permission: read("Bank Darah RS (BDRS)", "Uji Silang Serasi") },
  { path: "/bank-darah/stok", permission: read("Bank Darah RS (BDRS)", "Stok & Penerimaan") },
  { path: "/bank-darah/serah-terima", permission: read("Bank Darah RS (BDRS)", "Serah Terima") },
  { path: "/bank-darah/transfusi", permission: read("Bank Darah RS (BDRS)", "Pemantauan Transfusi") },
  { path: "/bank-darah/datamaster/komponen", permission: read("Bank Darah RS (BDRS)", "Datamaster", "Komponen Darah") },
  { path: "/bank-darah/pengaturan", permission: read("Bank Darah RS (BDRS)", "Pengaturan") },
  { path: "/bank-darah/laporan", permission: read("Bank Darah RS (BDRS)", "Laporan BDRS", ["Pemakaian Darah", "Rasio Crossmatch-Transfusi", "Hemovigilans"]) },
  { path: "/bank-darah", mode: "prefix", permission: read("Bank Darah RS (BDRS)", null, null, null) },

  // UTD / UPTD Produksi Darah — penunjang-service (Pengaturan memakai Donor: backend menyimpan dengan izin Donor › UPDATE)
  { path: "/utd/donor", permission: read("UTD", "Donor") },
  { path: "/utd/aftap", permission: read("UTD", "Aftap") },
  { path: "/utd/imltd", permission: read("UTD", "IMLTD") },
  { path: "/utd/komponen", permission: read("UTD", "Komponen") },
  { path: "/utd/distribusi", permission: read("UTD", "Distribusi", ["Permintaan", "Distribusi", "Pemusnahan"]) },
  { path: "/utd/pengaturan", permission: read("UTD", "Donor") },
  { path: "/utd/laporan", permission: read("UTD", "Laporan UTD") },
  { path: "/utd", mode: "prefix", permission: read("UTD", null, null, null) },

  { path: "/training/daftar-kelas", featureStatus: "stub", permission: read("Training", "Daftar Kelas") },
  { path: "/training/booking-kelas", featureStatus: "stub", permission: read("Training", "Booking Kelas") },
  { path: "/training/datamaster/kelas", featureStatus: "stub", permission: read("Training", "Datamaster") },
  { path: "/training/laporan/rekapitulasi", featureStatus: "stub", permission: read("Training", "Laporan") },
  { path: "/training", mode: "prefix", featureStatus: "stub", permission: read("Training", null, null, null) },

  { path: "/inventory/pengadaan-barang/pembelian-barang-supplier", permission: read("Inventory", "Pengadaan Barang", "Verifikasi Pembelian Barang Supplier") },
  { path: "/inventory/pengadaan-barang/verifikasi-pembelian-barang-supplier", permission: read("Inventory", "Verifikasi Pembelian Barang Supplier") },
  { path: "/inventory/pengadaan-barang/retur-penggantian-barang-supplier", permission: read("Inventory", "Retur dan Penggantian Supplier") },
  { path: "/inventory/pengeluaran-barang/verifikasi-pengiriman-unit", permission: read("Inventory", "Pengeluaran Barang", "Verifikasi dan Penerimaan Barang Unit") },
  { path: "/inventory/pengeluaran-barang/pengeluaran-unit", permission: read("Inventory", "Pengeluaran Barang", "Pengeluaran Barang Unit") },
  { path: "/inventory/penerimaan-barang/penerimaan-pembelian", permission: read("Inventory", "Penerimaan Barang", "Penerimaan Pembelian") },
  { path: "/inventory/penerimaan-barang/penerimaan-retur-unit", permission: read("Inventory", "Penerimaan Barang", "Penerimaan Retur Unit") },
  { path: "/inventory/datamaster/supplier", permission: read("Inventory", "Datamaster Supplier") },
  { path: "/inventory/riwayat-tarif", permission: read("Inventory", "Riwayat Tarif") },
  { path: "/inventory/kartustok-mutasi", permission: read("Inventory", "Kartu Stok dan Mutasi") },
  { path: "/inventory/stok-opname", permission: read("Inventory", "Stok Opname") },
  { path: "/inventory/stok-adjustment", permission: read("Inventory", "Stok Adjustment") },
  { path: "/inventory/laporan/obat-expired", permission: read("Inventory", "Laporan Inventory", "Obat Expired") },
  { path: "/inventory/laporan/persediaan", permission: read("Inventory", "Laporan Inventory", "Persediaan") },

  { path: "/laporan/jumlah-kunjungan", permission: read("Laporan", "Jumlah Kunjungan Berdasarkan Status Rawat") },
  { path: "/laporan/rekapitulasi-tindakan", permission: read("Laporan", "Rekapitulasi Tindakan") },
  { path: "/laporan/rekapitulasi-pemeriksaan-lab", permission: read("Laporan", "Rekapitulasi Pemeriksaan Lab") },
  { path: "/laporan/rekapitulasi-pendapatan", featureStatus: "stub", permission: read("Laporan", "Rekapitulasi Pendapatan") },
  { path: "/laporan/rekapitulasi-diagnosis", permission: read("Laporan", "Rekapitulasi Diagnosis berdasarkan Umur Pasien") },
];

const sidebarLabelRegistry: Record<string, PermissionRequirement> = {
  "rawat jalan::poli": read("Rawat Jalan", "Poli"),
  "rawat inap::ruang rawatan": read("Rawat Inap", "Rawat Inap"),
  "fisioterapi::fisioterapi": read("Fisioterapi", null, null, null),
  "training::training": read("Training", null, null, null),
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const normalizeAllow = (allow: unknown): PermissionAllow | null => {
  if (typeof allow === "string") {
    return { name: allow, checked: true };
  }

  if (allow && typeof allow === "object") {
    const candidate = allow as Partial<PermissionAllow>;
    if (candidate.name) {
      return {
        name: String(candidate.name),
        checked: candidate.checked ?? true,
      };
    }
  }

  return null;
};

const normalizeAllows = (allows: unknown) =>
  toArray(allows).map(normalizeAllow).filter(Boolean) as PermissionAllow[];

const normalizeFeature = (feature: unknown): PermissionFeature | null => {
  if (!feature || typeof feature !== "object") return null;

  const candidate = feature as LegacyPermissionNode;
  if (!candidate.name) return null;

  return {
    name: String(candidate.name),
    checked: candidate.checked ?? true,
    allows: normalizeAllows(candidate.allows),
  };
};

const normalizeSubmodule = (submodule: unknown): PermissionSubmodule | null => {
  if (!submodule || typeof submodule !== "object") return null;

  const candidate = submodule as LegacyPermissionNode;
  if (!candidate.name) return null;

  return {
    name: String(candidate.name),
    checked: candidate.checked ?? true,
    features: toArray(candidate.features)
      .map(normalizeFeature)
      .filter(Boolean) as PermissionFeature[],
    allows: normalizeAllows(candidate.allows),
  };
};

export const normalizePermissions = (permissions: unknown): PermissionModule[] => {
  return toArray(permissions)
    .map((module) => {
      if (!module || typeof module !== "object") return null;

      const candidate = module as LegacyPermissionModule;
      if (!candidate.module) return null;

      return {
        module: String(candidate.module),
        checked: candidate.checked ?? true,
        submodules: toArray(
          candidate.submodules ?? candidate.subModules ?? candidate.sub_modules
        )
          .map(normalizeSubmodule)
          .filter(Boolean) as PermissionSubmodule[],
      };
    })
    .filter(Boolean) as PermissionModule[];
};

export const getStoredPermissions = () => {
  const rawPermissions = localStorage.getItem(STORAGE_KEY);
  if (!rawPermissions) return [];

  try {
    return normalizePermissions(JSON.parse(rawPermissions));
  } catch {
    return [];
  }
};

// Username pengguna login (klaim `username` pada token akses), mis. untuk membandingkan dengan pembuat order.
export const getLoginUsername = (): string => {
  try {
    const token = String(localStorage.getItem("access_token") ?? "").replace(/^Bearer\s+/i, "");
    const isi = token.split(".")[1];
    if (!isi) return "";
    const json = atob(isi.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(isi.length / 4) * 4, "="));
    return String(JSON.parse(json)?.username ?? "");
  } catch {
    return "";
  }
};

const includesAction = (allows: PermissionAllow[], action: PermissionAction) => {
  const actions = Array.isArray(action) ? action : [action ?? "READ"];
  return actions.some((item) =>
    allows.some((allow) => normalizeText(allow.name) === normalizeText(item))
  );
};

export const hasPermission = (
  moduleName: string,
  submoduleName?: string | null,
  action: PermissionAction = "READ",
  featureName?: string | string[] | null
) => {
  const module = getStoredPermissions().find(
    (item) => normalizeText(item.module) === normalizeText(moduleName)
  );

  if (!module) return false;
  if (!submoduleName) return true;

  const matchingSubmodules = module.submodules.filter(
    (item) => normalizeText(item.name) === normalizeText(submoduleName)
  );
  if (!matchingSubmodules.length) return false;

  if (featureName) {
    const featureNames = Array.isArray(featureName) ? featureName : [featureName];
    return matchingSubmodules.some((submodule) => {
      const feature = submodule.features.find(
        (item) =>
          featureNames.some((name) => normalizeText(item.name) === normalizeText(name))
      );
      return feature ? includesAction(feature.allows, action) : false;
    });
  }

  return matchingSubmodules.some((submodule) =>
    action ? includesAction(submodule.allows, action) : true
  );
};

// Data order alkes pasien di rekam medis: sama dengan aturan farmasi-service (Farmasi Ruangan READ atau
// fitur "Alkes dan Penunjang" RME/Detail Pasien). Tanpa daftar izin (super admin) biarkan backend memutuskan.
export const bolehLihatAlkesRm = () => {
  if (!getStoredPermissions().length) return true;
  return (
    hasPermission("Farmasi", "Farmasi Ruangan", "READ") ||
    hasPermission("Rawat Jalan", "RME", "READ", ["Akses Dan Penunjang", "Alkes Dan Penunjang"]) ||
    hasPermission("Rawat Inap", "Detail Pasien", "READ", "Alkes Dan Penunjang") ||
    hasPermission("IGD", "Detail Pasien", "READ", "Alkes Dan Penunjang")
  );
};

export const canAccessPermission = (permission?: PermissionRequirement | null) => {
  if (!permission) return true;
  return hasPermission(
    permission.module,
    permission.submodule,
    permission.action ?? "READ",
    permission.feature
  );
};

export const hasModulePermission = (moduleName: string) =>
  hasPermission(moduleName, null, null);

const isRouteMatch = (entry: PermissionRouteEntry, path: string) => {
  if (entry.mode === "prefix") {
    return path === entry.path || path.startsWith(`${entry.path}/`);
  }

  return path === entry.path;
};

const findRoutePermissionEntry = (path?: string | null) => {
  if (!path) return null;

  const cleanPath = path.split("?")[0].replace(/\/$/, "") || "/";

  return permissionRouteRegistry
    .filter((entry) => isRouteMatch(entry, cleanPath))
    .sort((a, b) => b.path.length - a.path.length)[0] ?? null;
};

export const resolveRoutePermission = (path?: string | null) =>
  findRoutePermissionEntry(path)?.permission ?? null;

export const resolveRouteFeatureStatus = (path?: string | null) =>
  findRoutePermissionEntry(path)?.featureStatus ?? "real";

const resolveSidebarPermission = (
  item: SidebarBody,
  moduleName?: string,
  inheritedPermission?: PermissionRequirement | null
) => {
  if (item.permission) return item.permission;

  const pathPermission = resolveRoutePermission(item.url);
  if (pathPermission) return pathPermission;

  if (moduleName) {
    const labelPermission =
      sidebarLabelRegistry[`${normalizeText(moduleName)}::${normalizeText(item.name)}`];
    if (labelPermission) return labelPermission;
  }

  return inheritedPermission ?? null;
};

export const filterSidebarByPermission = (
  items: SidebarBody[],
  moduleName?: string,
  inheritedPermission?: PermissionRequirement | null
): SidebarBody[] => {
  return items
    .map((item) => {
      const itemPermission = resolveSidebarPermission(
        item,
        moduleName,
        inheritedPermission
      );
      const child = item.child
        ? filterSidebarByPermission(item.child, moduleName, itemPermission)
        : undefined;
      const hasAllowedChild = Boolean(child?.length);
      const hasOwnAccess = itemPermission
        ? canAccessPermission(itemPermission)
        : !item.child?.length;
      const isStub = item.featureStatus === "stub" || resolveRouteFeatureStatus(item.url) === "stub";

      if (isStub && !canShowStubFeatures()) return null;
      // Tautan milik modul yang tidak aktif untuk faskes (Setting › Manajemen Modul) disembunyikan.
      if (item.url && !ruteDiizinkanModul(item.url).boleh) return null;
      if (!hasOwnAccess && !hasAllowedChild) return null;

      return {
        ...item,
        child,
      };
    })
    .filter(Boolean) as SidebarBody[];
};

export const isStubModule = (moduleName: string) =>
  STUB_MODULES.some((item) => normalizeText(item) === normalizeText(moduleName));

export const canShowStubFeatures = () =>
  import.meta.env.VITE_SHOW_STUB_MENU === "true";

export const canShowModuleInProduction = (moduleName: string) =>
  !isStubModule(moduleName) || canShowStubFeatures();
