// API modul Bank Darah RS / BDRS (penunjang-service: /api/v3/penunjang/bank-darah). Body request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler). Parameter query (qs) TIDAK dikonversi: pemanggil
// menulis kunci snake_case (mis. { tanggal_mulai, komponen_uuid }).
import { apiPenunjangDelete, apiPenunjangGet, apiPenunjangPatch, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";
export { keTanggal, rupiahRad as rupiahBdrs, umurRad as umurBdrs, waktuRad as waktuBdrs } from "@/stores/penunjang/radiologi";

export const GOLONGAN_ABO: Record<string, string> = { A: "A", B: "B", AB: "AB", O: "O" };
export const RHESUS: Record<string, string> = { positif: "Rhesus Positif (+)", negatif: "Rhesus Negatif (-)" };
export const SUMBER_KUNJUNGAN_BDRS: Record<string, string> = { rajal: "Rawat Jalan", ranap: "Rawat Inap", igd: "IGD" };
export const HASIL_UJI: Record<string, string> = { kompatibel: "Kompatibel", inkompatibel: "Inkompatibel" };
export const SKRINING_ANTIBODI: Record<string, string> = { negatif: "Negatif", positif: "Positif" };
export const SUMBER_STOK: Record<string, string> = { utd_manual: "UTD (manual)", utd_otomatis: "UTD (otomatis)" };
export const STATUS_IMLTD: Record<string, string> = { belum_diperiksa: "Belum Diperiksa", non_reaktif: "Non-Reaktif", reaktif: "Reaktif" };
export const KELOMPOK_KOMPONEN: Record<string, string> = { sel_darah_merah: "Sel Darah Merah", plasma: "Plasma", trombosit: "Trombosit", lainnya: "Lainnya" };

type Gaya = { label: string; bg: string; text: string };

export const STATUS_PERMINTAAN_BDRS: Record<string, Gaya> = {
  baru: { label: "Baru", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  diproses: { label: "Diproses BDRS", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  perlu_dilengkapi: { label: "Perlu Dilengkapi", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  dipenuhi_sebagian: { label: "Dipenuhi Sebagian", bg: "bg-[#EBE9FE]", text: "text-[#5925DC]" },
  diserahkan: { label: "Diserahkan", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  dibatalkan: { label: "Dibatalkan", bg: "bg-grey-50", text: "text-grey-400" },
  ditolak: { label: "Ditolak", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_STOK_BDRS: Record<string, Gaya> = {
  tersedia: { label: "Tersedia", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  dialokasikan: { label: "Dialokasikan", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  diserahkan: { label: "Diserahkan", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  kedaluwarsa: { label: "Kedaluwarsa", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  dimusnahkan: { label: "Dimusnahkan", bg: "bg-grey-50", text: "text-grey-400" },
  dikembalikan: { label: "Dikembalikan", bg: "bg-grey-50", text: "text-grey-400" },
};
export const STATUS_IMLTD_BDRS: Record<string, Gaya> = {
  belum_diperiksa: { label: "Belum Diperiksa", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  non_reaktif: { label: "Non-Reaktif", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  reaktif: { label: "Reaktif", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_SERAH_TERIMA_BDRS: Record<string, Gaya> = {
  menunggu: { label: "Menunggu Konfirmasi", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  selesai: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  batal: { label: "Batal", bg: "bg-grey-50", text: "text-grey-400" },
};
export const STATUS_TAGIHAN_ST_BDRS: Record<string, Gaya> = {
  belum: { label: "Belum Dikirim", bg: "bg-grey-50", text: "text-grey-400" },
  terkirim: { label: "Terkirim", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  gagal: { label: "Gagal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_TRANSFUSI_BDRS: Record<string, Gaya> = {
  berlangsung: { label: "Berlangsung", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  selesai_tanpa_reaksi: { label: "Selesai Tanpa Reaksi", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  reaksi: { label: "Reaksi", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_TINDAK_LANJUT_REAKSI: Record<string, Gaya> = {
  baru: { label: "Baru Dilaporkan", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  ditindaklanjuti: { label: "Ditindaklanjuti", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  selesai: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
};

export const gayaPermintaanBdrs = (s?: string) => STATUS_PERMINTAAN_BDRS[s as string];
export const gayaStokBdrs = (s?: string) => STATUS_STOK_BDRS[s as string];
export const gayaImltdBdrs = (s?: string) => STATUS_IMLTD_BDRS[s as string];
export const gayaSerahTerimaBdrs = (s?: string) => STATUS_SERAH_TERIMA_BDRS[s as string];
export const gayaTagihanStBdrs = (s?: string) => STATUS_TAGIHAN_ST_BDRS[s as string];
export const gayaTransfusiBdrs = (s?: string) => STATUS_TRANSFUSI_BDRS[s as string];
export const gayaReaksiBdrs = (s?: string) => STATUS_TINDAK_LANJUT_REAKSI[s as string];

export const opsi = (obj: Record<string, string>) => Object.entries(obj).map(([value, label]) => ({ value, label }));

export const JK_BDRS: Record<string, string> = { Male: "L", Female: "P" };
// Golongan + rhesus ringkas, mis. "O+" / "AB-".
export const golonganRh = (golongan?: string | null, rhesus?: string | null) =>
  golongan ? `${golongan}${rhesus === "positif" ? "+" : rhesus === "negatif" ? "-" : ""}` : "-";
// Sisa hari menuju kedaluwarsa (bisa negatif) dari epoch detik.
export const sisaHariBdrs = (epoch?: number | string | null) => (epoch ? Math.floor((Number(epoch) * 1000 - Date.now()) / 86400000) : null);

// Izin aksi modul (tanpa daftar izin = super admin → boleh; backend tetap memeriksa login).
export const izinBdrs = (submodul: string, aksi: string, fitur?: string) =>
  !getStoredPermissions().length || hasPermission("Bank Darah RS (BDRS)", submodul, aksi, fitur ?? null);

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
    q.append(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

// ── Permintaan darah
export const daftarPermintaanBdrs = (params: Record<string, any> = {}) => apiPenunjangGet(`/bank-darah/permintaan${qs(params)}`);
export const detailPermintaanBdrs = (uuid: string) => apiPenunjangGet(`/bank-darah/permintaan/${uuid}`);
// Riwayat permintaan satu kunjungan/pasien (array, maks. 100): salah satu dari no_reg / rekam_medis_uuid / patient_uuid wajib.
export const permintaanKunjunganBdrs = (params: { no_reg?: string; rekam_medis_uuid?: string; patient_uuid?: string }) =>
  apiPenunjangGet(`/bank-darah/permintaan/kunjungan${qs(params)}`);
export const buatPermintaanBdrs = (data: {
  noReg?: string;
  rekamMedisUuid?: string;
  lokasiAsalUuid?: string | null;
  komponenUuid: string;
  golonganDiminta: string;
  rhesusDiminta: string;
  jumlahDiminta: number;
  indikasi: string;
  cito?: boolean;
  dokterPemintaUuid: string;
}) => apiPenunjangPost("/bank-darah/permintaan", data);
export const ubahStatusPermintaanBdrs = (uuid: string, aksi: "proses" | "kembalikan" | "tolak" | "batalkan", alasan?: string) =>
  apiPenunjangPatch(`/bank-darah/permintaan/${uuid}/status`, { aksi, alasan });
export const lengkapiPermintaanBdrs = (uuid: string, data: Record<string, any>) => apiPenunjangPatch(`/bank-darah/permintaan/${uuid}/lengkapi`, data);

// ── Pemeriksaan & crossmatch
export const catatPemeriksaanBdrs = (permintaanUuid: string, data: { golonganAbo: string; rhesus: string; hasilSkriningAntibodi: string; catatan?: string }) =>
  apiPenunjangPost(`/bank-darah/permintaan/${permintaanUuid}/pemeriksaan`, data);
export const catatCrossmatchBdrs = (
  permintaanUuid: string,
  data: { stokUuid: string; hasilMayor: string; hasilMinor: string; catatan?: string; overrideDarurat?: boolean; alasanOverride?: string },
) => apiPenunjangPost(`/bank-darah/permintaan/${permintaanUuid}/crossmatch`, data);

// ── Stok
// Respons: { data, pagination, ambangKedaluwarsaHari, ringkasan[] } — tiap baris diberi flag kedaluwarsa & peringatanKedaluwarsa.
// Filter: komponen_uuid, golongan_abo, rhesus, status (boleh dipisah koma), cari (no. kantong), kedaluwarsa_dalam_hari, page, limit.
export const daftarStokBdrs = (params: Record<string, any> = {}) => apiPenunjangGet(`/bank-darah/stok${qs(params)}`);
export const detailStokBdrs = (uuid: string) => apiPenunjangGet(`/bank-darah/stok/${uuid}`);
export const terimaStokBdrs = (data: {
  noKantong: string;
  komponenUuid: string;
  golonganAbo: string;
  rhesus: string;
  volumeMl?: number | null;
  tanggalProduksi?: number;
  tanggalKedaluwarsa: number;
  lokasiPenyimpanan?: string;
  sumber?: string;
  utdReferensiUuid?: string;
  statusImltd?: string;
}) => apiPenunjangPost("/bank-darah/stok/penerimaan", data);
export const pengeluaranStokBdrs = (uuid: string, aksi: "kembalikan" | "musnahkan", alasan: string) =>
  apiPenunjangPost(`/bank-darah/stok/${uuid}/pengeluaran`, { aksi, alasan });
export const ubahImltdStokBdrs = (uuid: string, statusImltd: string) => apiPenunjangPatch(`/bank-darah/stok/${uuid}/imltd`, { statusImltd });

// ── Serah terima
// Backend hanya membaca stok_uuids; verifikasi identitas & nomor kantong ditegakkan saat konfirmasi.
export const buatSerahTerimaBdrs = (permintaanUuid: string, stokUuids: string[], override?: { overrideDarurat: boolean; alasanOverride: string }) =>
  apiPenunjangPost(`/bank-darah/permintaan/${permintaanUuid}/serah-terima`, { stokUuids, ...override });
export const daftarSerahTerimaBdrs = (params: Record<string, any> = {}) => apiPenunjangGet(`/bank-darah/serah-terima${qs(params)}`);
export const detailSerahTerimaBdrs = (uuid: string) => apiPenunjangGet(`/bank-darah/serah-terima/${uuid}`);
// Verifikasi diteruskan apa adanya dari centang di layar (backend menolak bila salah satunya bukan true).
export const konfirmasiSerahTerimaBdrs = (
  uuid: string,
  peran: "penyerah" | "penerima",
  verifikasi: { pasien: boolean; nomorKantong: boolean } = { pasien: false, nomorKantong: false },
) =>
  apiPenunjangPost(`/bank-darah/serah-terima/${uuid}/konfirmasi`, {
    peran,
    verifikasiPasien: verifikasi.pasien === true,
    verifikasiNomorKantong: verifikasi.nomorKantong === true,
  });
export const batalSerahTerimaBdrs = (uuid: string, alasan: string) => apiPenunjangPost(`/bank-darah/serah-terima/${uuid}/batal`, { alasan });
export const kirimUlangTagihanSerahTerimaBdrs = (uuid: string) => apiPenunjangPost(`/bank-darah/serah-terima/${uuid}/tagihan/kirim-ulang`);

// ── Pemantauan transfusi & reaksi
export const daftarTransfusiBdrs = (params: Record<string, any> = {}) => apiPenunjangGet(`/bank-darah/transfusi${qs(params)}`);
export const catatTransfusiBdrs = (
  serahTerimaItemUuid: string,
  data: { waktuMulai?: number; waktuSelesai?: number | null; status?: string; hasilPemantauan?: string },
) => apiPenunjangPost(`/bank-darah/serah-terima-item/${serahTerimaItemUuid}/transfusi`, data);
export const laporReaksiBdrs = (transfusiUuid: string, data: { jenisReaksi: string; gejala: string; tindakLanjut?: string }) =>
  apiPenunjangPost(`/bank-darah/transfusi/${transfusiUuid}/reaksi`, data);
export const daftarReaksiBdrs = (params: Record<string, any> = {}) => apiPenunjangGet(`/bank-darah/reaksi${qs(params)}`);
export const tindakLanjutReaksiBdrs = (uuid: string, data: { statusTindakLanjut: string; tindakLanjut?: string }) =>
  apiPenunjangPatch(`/bank-darah/reaksi/${uuid}/tindak-lanjut`, data);

// ── Laporan
export const laporanPemakaianBdrs = (tanggalMulai: string, tanggalSelesai: string) =>
  apiPenunjangGet(`/bank-darah/laporan/pemakaian${qs({ tanggal_mulai: tanggalMulai, tanggal_selesai: tanggalSelesai })}`);
export const laporanRasioCtBdrs = (tanggalMulai: string, tanggalSelesai: string) =>
  apiPenunjangGet(`/bank-darah/laporan/rasio-crossmatch-transfusi${qs({ tanggal_mulai: tanggalMulai, tanggal_selesai: tanggalSelesai })}`);
export const laporanStokKeluarBdrs = (tanggalMulai: string, tanggalSelesai: string) =>
  apiPenunjangGet(`/bank-darah/laporan/stok-keluar${qs({ tanggal_mulai: tanggalMulai, tanggal_selesai: tanggalSelesai })}`);
export const laporanReaksiBdrs = (tanggalMulai: string, tanggalSelesai: string) =>
  apiPenunjangGet(`/bank-darah/laporan/reaksi${qs({ tanggal_mulai: tanggalMulai, tanggal_selesai: tanggalSelesai })}`);

// ── Datamaster komponen darah
export const daftarKomponenBdrs = (params: Record<string, any> = {}) => apiPenunjangGet(`/bank-darah/komponen${qs(params)}`);
export const simpanKomponenBdrs = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/bank-darah/komponen/${uuid}`, data) : apiPenunjangPost("/bank-darah/komponen", data);
export const hapusKomponenBdrs = (uuid: string) => apiPenunjangDelete(`/bank-darah/komponen/${uuid}`);

// ── Pengaturan
export const ambilPengaturanBdrs = () => apiPenunjangGet("/bank-darah/pengaturan");
export const simpanPengaturanBdrs = (data: {
  ambangKedaluwarsaHari?: number;
  tarifPengolahan?: number;
  tarifCrossmatch?: number;
  overrideDaruratAktif?: boolean;
  overrideOPosAktif?: boolean;
}) => apiPenunjangPatch("/bank-darah/pengaturan", data);

// ── Referensi
export const referensiPilihanBdrs = () => apiPenunjangGet("/bank-darah/referensi/pilihan");
export const cariPasienBdrs = (cari: string) => apiPenunjangGet(`/bank-darah/referensi/pasien${qs({ cari })}`);
export const daftarDokterBdrs = () => apiPenunjangGet("/bank-darah/referensi/dokter");
export const daftarLokasiBdrs = (params: { pelayanan?: string; cari?: string } = {}) => apiPenunjangGet(`/bank-darah/referensi/lokasi${qs(params)}`);

// ── Bridging UTD (STD-0017) — fitur bdrs_bridging, aktif per faskes. Status validasi & transport pakai gaya yang
// sama dengan modul BDRS lain di atas.
export const STATUS_KIRIM_UTD: Record<string, Gaya> = {
  sedang_dikirim: { label: "Sedang Dikirim", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  terkirim: { label: "Terkirim", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  gagal: { label: "Gagal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  tidak_pasti: { label: "Tidak Pasti", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  kantong_diterima: { label: "Kantong Diterima", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  diterima_sebagian: { label: "Diterima Sebagian", bg: "bg-[#EBE9FE]", text: "text-[#5925DC]" },
};
export const STATUS_VALIDASI_KANTONG_UTD: Record<string, Gaya> = {
  menunggu: { label: "Menunggu", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  diterima: { label: "Diterima", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  ditolak: { label: "Ditolak", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const gayaKirimUtd = (s?: string) => STATUS_KIRIM_UTD[s as string];
export const gayaValidasiKantongUtd = (s?: string) => STATUS_VALIDASI_KANTONG_UTD[s as string];
export const JENIS_MAPPING_UTD: Record<string, string> = { komponen: "Komponen Darah", unit: "Unit Asal", dokter: "Dokter Peminta", penjamin: "Penjamin" };

// Koneksi
export const daftarKoneksiUtd = () => apiPenunjangGet("/bank-darah/utd/koneksi");
export const simpanKoneksiUtd = (
  data: {
    nama: string; kodeRs?: string; urlRegistrasi: string; urlStatus?: string; urlStok?: string;
    apiKey?: string; aktif?: boolean; bawaan?: boolean; maksParalel?: number; jedaMs?: number;
  },
  uuid?: string,
) => (uuid ? apiPenunjangPut(`/bank-darah/utd/koneksi/${uuid}`, data) : apiPenunjangPost("/bank-darah/utd/koneksi", data));
export const hapusKoneksiUtd = (uuid: string) => apiPenunjangDelete(`/bank-darah/utd/koneksi/${uuid}`);
export const jadikanBawaanKoneksiUtd = (uuid: string) => apiPenunjangPost(`/bank-darah/utd/koneksi/${uuid}/bawaan`);
export const buatKunciMasukUtd = (uuid: string) => apiPenunjangPost(`/bank-darah/utd/koneksi/${uuid}/kunci-masuk`);
export const ujiKoneksiUtd = (uuid: string) => apiPenunjangPost(`/bank-darah/utd/koneksi/${uuid}/uji`);

// Mapping — jenis: komponen | unit | dokter | penjamin
export const daftarMappingUtd = (jenis: string, params: { koneksi_uuid: string; belum_dipetakan?: boolean }) => apiPenunjangGet(`/bank-darah/utd/peta/${jenis}${qs(params)}`);
export const simpanMappingUtd = (jenis: string, data: { koneksiUuid: string; refUuid: string; kodeUtd: string }) => apiPenunjangPut(`/bank-darah/utd/peta/${jenis}`, data);

// Cek stok UTD (opsional, hanya bila koneksi menyediakan url_stok)
export const cekStokUtd = (params: { koneksi_uuid?: string; golongan_abo?: string; rhesus?: string; kode_komponen?: string } = {}) =>
  apiPenunjangGet(`/bank-darah/utd/stok${qs(params)}`);

// Aksi pada permintaan darah. Kirim/kirim ulang memakai mode diam: halaman menampilkan toast sesuai status pengiriman
// (terkirim/tidak_pasti); penolakan UTD (status gagal) dijawab backend 502 sehingga tampil sebagai toast galat.
export const kirimPermintaanKeUtd = (permintaanUuid: string, koneksiUuid?: string) =>
  apiPenunjangPost(`/bank-darah/permintaan/${permintaanUuid}/kirim-utd`, { koneksiUuid }, true);
export const ambilStatusUtdPermintaan = (permintaanUuid: string, koneksiUuid?: string) =>
  apiPenunjangPost(`/bank-darah/permintaan/${permintaanUuid}/ambil-status-utd`, { koneksiUuid });
export const daftarKantongUtdPermintaan = (permintaanUuid: string) => apiPenunjangGet(`/bank-darah/utd/permintaan/${permintaanUuid}/kantong`);
export const terimaKantongUtd = (kantongUuid: string) => apiPenunjangPost(`/bank-darah/utd/kantong/${kantongUuid}/terima`);

// Riwayat pengiriman (Setting › Konfigurasi Integrasi › Pengiriman Bank Darah)
export const daftarPengirimanUtd = (params: Record<string, any> = {}) => apiPenunjangGet(`/bank-darah/utd/pengiriman${qs(params)}`);
export const detailPengirimanUtd = (uuid: string) => apiPenunjangGet(`/bank-darah/utd/pengiriman/${uuid}`);
export const kirimUlangUtd = (uuid: string) => apiPenunjangPost(`/bank-darah/utd/pengiriman/${uuid}/kirim-ulang`, {}, true);
export const cekStatusUtd = (uuid: string) => apiPenunjangPost(`/bank-darah/utd/pengiriman/${uuid}/cek-status`);

// Epoch detik ⇄ Date untuk input waktu.
export const keEpoch = (d?: Date | null) => (d ? Math.floor(d.getTime() / 1000) : undefined);
export const dariEpoch = (n?: number | null) => (n ? new Date(Number(n) * 1000) : null);
