// API modul Bank Darah RS / BDRS (penunjang-service: /api/v3/penunjang/bank-darah). Request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler).
import { apiPenunjangDelete, apiPenunjangGet, apiPenunjangPatch, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";
export { keTanggal, rupiahRad as rupiahBdrs, umurRad as umurBdrs, waktuRad as waktuBdrs } from "@/stores/penunjang/radiologi";

export const GOLONGAN_ABO: Record<string, string> = { A: "A", B: "B", AB: "AB", O: "O" };
export const RHESUS: Record<string, string> = { positif: "Rhesus Positif (+)", negatif: "Rhesus Negatif (-)" };
export const SUMBER_KUNJUNGAN_BDRS: Record<string, string> = { rajal: "Rawat Jalan", ranap: "Rawat Inap", igd: "IGD" };
export const HASIL_UJI: Record<string, string> = { kompatibel: "Kompatibel", inkompatibel: "Inkompatibel" };
export const SKRINING_ANTIBODI: Record<string, string> = { negatif: "Negatif", positif: "Positif" };
export const SUMBER_STOK: Record<string, string> = { utd_manual: "UTD (manual)", utd_otomatis: "UTD (otomatis)" };

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
export const gayaSerahTerimaBdrs = (s?: string) => STATUS_SERAH_TERIMA_BDRS[s as string];
export const gayaTagihanStBdrs = (s?: string) => STATUS_TAGIHAN_ST_BDRS[s as string];
export const gayaTransfusiBdrs = (s?: string) => STATUS_TRANSFUSI_BDRS[s as string];
export const gayaReaksiBdrs = (s?: string) => STATUS_TINDAK_LANJUT_REAKSI[s as string];

export const opsi = (obj: Record<string, string>) => Object.entries(obj).map(([value, label]) => ({ value, label }));

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
}) => apiPenunjangPost("/bank-darah/permintaan", data);
export const ubahStatusPermintaanBdrs = (uuid: string, aksi: "proses" | "kembalikan" | "tolak" | "batalkan", alasan?: string) =>
  apiPenunjangPatch(`/bank-darah/permintaan/${uuid}/status`, { aksi, alasan });
export const lengkapiPermintaanBdrs = (uuid: string, data: Record<string, any>) => apiPenunjangPatch(`/bank-darah/permintaan/${uuid}/lengkapi`, data);

// ── Pemeriksaan & crossmatch
export const catatPemeriksaanBdrs = (permintaanUuid: string, data: { golonganAbo: string; rhesus: string; hasilSkriningAntibodi: string; catatan?: string }) =>
  apiPenunjangPost(`/bank-darah/permintaan/${permintaanUuid}/pemeriksaan`, data);
export const catatCrossmatchBdrs = (permintaanUuid: string, data: { stokUuid: string; hasilMayor: string; hasilMinor: string; catatan?: string }) =>
  apiPenunjangPost(`/bank-darah/permintaan/${permintaanUuid}/crossmatch`, data);

// ── Stok
export const daftarStokBdrs = (params: Record<string, any> = {}) => apiPenunjangGet(`/bank-darah/stok${qs(params)}`);
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
}) => apiPenunjangPost("/bank-darah/stok/penerimaan", data);
export const pengeluaranStokBdrs = (uuid: string, aksi: "kembalikan" | "musnahkan", alasan: string) =>
  apiPenunjangPost(`/bank-darah/stok/${uuid}/pengeluaran`, { aksi, alasan });

// ── Serah terima
export const buatSerahTerimaBdrs = (permintaanUuid: string, stokUuids: string[]) =>
  apiPenunjangPost(`/bank-darah/permintaan/${permintaanUuid}/serah-terima`, { stokUuids, verifikasiPasien: true, verifikasiNomorKantong: true });
export const daftarSerahTerimaBdrs = (params: Record<string, any> = {}) => apiPenunjangGet(`/bank-darah/serah-terima${qs(params)}`);
export const detailSerahTerimaBdrs = (uuid: string) => apiPenunjangGet(`/bank-darah/serah-terima/${uuid}`);
export const konfirmasiSerahTerimaBdrs = (uuid: string, peran: "penyerah" | "penerima") =>
  apiPenunjangPost(`/bank-darah/serah-terima/${uuid}/konfirmasi`, { peran, verifikasiPasien: true, verifikasiNomorKantong: true });
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
export const simpanPengaturanBdrs = (data: { ambangKedaluwarsaHari?: number; tarifPengolahan?: number; tarifCrossmatch?: number }) =>
  apiPenunjangPatch("/bank-darah/pengaturan", data);

// ── Referensi
export const referensiPilihanBdrs = () => apiPenunjangGet("/bank-darah/referensi/pilihan");
export const cariPasienBdrs = (cari: string) => apiPenunjangGet(`/bank-darah/referensi/pasien${qs({ cari })}`);
export const daftarDokterBdrs = () => apiPenunjangGet("/bank-darah/referensi/dokter");
export const daftarLokasiBdrs = (params: { pelayanan?: string; cari?: string } = {}) => apiPenunjangGet(`/bank-darah/referensi/lokasi${qs(params)}`);

// Epoch detik ⇄ Date untuk input waktu.
export const keEpoch = (d?: Date | null) => (d ? Math.floor(d.getTime() / 1000) : undefined);
export const dariEpoch = (n?: number | null) => (n ? new Date(Number(n) * 1000) : null);
