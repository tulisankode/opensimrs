// API modul UTD / UPTD Produksi Darah (penunjang-service: /api/v3/penunjang/utd). Body request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler). Parameter query (qs) TIDAK dikonversi: pemanggil
// menulis kunci snake_case (mis. { status_aktif, golongan_darah, tersedia_saja }).
// Catatan respons: kolom BIGINT (created_at, waktu_*) & NUMERIC (hb, suhu) dari pg datang sebagai string, kolom DATE
// (tanggal_lahir, tanggal_kedaluwarsa, tanggal_layak_berikutnya) sebagai string ISO — pakai helper di bawah.
import { apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";
export { keTanggal, umurRad as umurUtd, waktuRad as waktuUtd } from "@/stores/penunjang/radiologi";

export const GOLONGAN_DARAH_UTD: Record<string, string> = { A: "A", B: "B", AB: "AB", O: "O" };
export const RHESUS_UTD: Record<string, string> = { positif: "Rhesus Positif (+)", negatif: "Rhesus Negatif (-)" };
export const JENIS_KELAMIN_UTD: Record<string, string> = { L: "Laki-laki", P: "Perempuan" };
export const REAKSI_DONOR_UTD: Record<string, string> = { tidak_ada: "Tidak ada reaksi", ringan: "Reaksi ringan", sedang: "Reaksi sedang", berat: "Reaksi berat" };
export const PARAMETER_IMLTD: Record<string, string> = { hiv: "HIV", hbsag: "HBsAg", hcv: "HCV", sifilis: "Sifilis" };
export const HASIL_IMLTD: Record<string, string> = { reaktif: "Reaktif", non_reaktif: "Non-Reaktif" };
export const JENIS_KOMPONEN_UTD: Record<string, string> = {
  PRC: "Packed Red Cells (PRC)",
  TC: "Thrombocyte Concentrate (TC)",
  FFP: "Fresh Frozen Plasma (FFP)",
  CRYO: "Cryoprecipitate",
};
export const PENERIMA_TIPE_UTD: Record<string, string> = { bdrs_internal: "BDRS Internal", eksternal: "Eksternal (RS/Faskes lain)" };
export const ALASAN_MUSNAH_UTD: Record<string, string> = { reaktif: "Reaktif", kedaluwarsa: "Kedaluwarsa", lain: "Lainnya" };
export const JENIS_LAPORAN_UTD: Record<string, string> = {
  donor: "Donor",
  produksi: "Produksi",
  uji_saring: "Uji Saring IMLTD",
  distribusi: "Distribusi",
  pemusnahan: "Pemusnahan",
  bulanan: "Bulanan (Lengkap)",
};
// Saran masa simpan bawaan saat pengolahan komponen (hari sejak hari ini). Hanya isian awal yang dapat diubah petugas;
// sesuaikan dengan SOP/pedoman UTD setempat.
export const SARAN_MASA_SIMPAN_HARI: Record<string, number> = { PRC: 35, TC: 5, FFP: 365, CRYO: 365 };

type Gaya = { label: string; bg: string; text: string };

export const STATUS_AKTIF_DONOR_UTD: Record<string, Gaya> = {
  aktif: { label: "Aktif", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  ditahan: { label: "Ditahan", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_SELEKSI_UTD: Record<string, Gaya> = {
  proses: { label: "Dalam Proses", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  layak: { label: "Layak", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  tunda: { label: "Tunda", bg: "bg-[#EBE9FE]", text: "text-[#5925DC]" },
  tolak: { label: "Tolak", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_KANTONG_UTD: Record<string, Gaya> = {
  karantina: { label: "Karantina", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  karantina_reaktif: { label: "Karantina/Reaktif", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  tersedia: { label: "Tersedia", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  dimusnahkan: { label: "Dimusnahkan", bg: "bg-grey-50", text: "text-grey-400" },
};
// Pengganti "karantina_reaktif" bagi pengguna tanpa izin Lihat Hasil Reaktif (hasil tidak diperlihatkan).
const KANTONG_DITAHAN: Gaya = { label: "Karantina (Ditahan)", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" };
export const STATUS_IMLTD_UTD: Record<string, Gaya> = {
  belum: { label: "Belum Diperiksa", bg: "bg-grey-50", text: "text-grey-400" },
  pending: { label: "Menunggu Hasil", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  non_reaktif: { label: "Non-Reaktif", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  reaktif: { label: "Reaktif", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
const IMLTD_DISEMBUNYIKAN: Gaya = { label: "Hasil Disembunyikan", bg: "bg-grey-50", text: "text-grey-400" };
export const STATUS_KOMPONEN_UTD: Record<string, Gaya> = {
  karantina: { label: "Karantina", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  tersedia: { label: "Tersedia", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  dialokasikan: { label: "Dialokasikan", bg: "bg-[#EBE9FE]", text: "text-[#5925DC]" },
  didistribusikan: { label: "Didistribusikan", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  dimusnahkan: { label: "Dimusnahkan", bg: "bg-grey-50", text: "text-grey-400" },
  kedaluwarsa: { label: "Kedaluwarsa", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_PERMINTAAN_UTD: Record<string, Gaya> = {
  menunggu: { label: "Menunggu", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  sebagian: { label: "Terpenuhi Sebagian", bg: "bg-[#EBE9FE]", text: "text-[#5925DC]" },
  terpenuhi: { label: "Terpenuhi", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  ditolak: { label: "Ditolak", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_DISTRIBUSI_UTD: Record<string, Gaya> = {
  terkirim: { label: "Terkirim", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  menunggu_integrasi: { label: "Menunggu Integrasi BDRS", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  gagal_integrasi: { label: "Integrasi Gagal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const GAYA_REAKSI_DONOR_UTD: Record<string, Gaya> = {
  tidak_ada: { label: "Tidak ada", bg: "bg-grey-50", text: "text-grey-400" },
  ringan: { label: "Ringan", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  sedang: { label: "Sedang", bg: "bg-[#FEE4E2]", text: "text-[#B42318]" },
  berat: { label: "Berat", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};

export const gayaDonorUtd = (s?: string) => STATUS_AKTIF_DONOR_UTD[s as string];
export const gayaSeleksiUtd = (s?: string) => STATUS_SELEKSI_UTD[s as string];
export const gayaKomponenUtd = (s?: string) => STATUS_KOMPONEN_UTD[s as string];
export const gayaPermintaanUtd = (s?: string) => STATUS_PERMINTAAN_UTD[s as string];
export const gayaDistribusiUtd = (s?: string) => STATUS_DISTRIBUSI_UTD[s as string];
export const gayaReaksiUtd = (s?: string) => GAYA_REAKSI_DONOR_UTD[s as string];
// Status kantong/IMLTD: "reaktif" hanya diperlihatkan kepada pemilik izin Lihat Hasil Reaktif.
export const gayaKantongUtd = (s?: string, bolehReaktif = false) =>
  s === "karantina_reaktif" && !bolehReaktif ? KANTONG_DITAHAN : STATUS_KANTONG_UTD[s as string];
export const gayaImltdUtd = (s?: string | null, bolehReaktif = false) =>
  s === "reaktif" && !bolehReaktif ? IMLTD_DISEMBUNYIKAN : STATUS_IMLTD_UTD[(s || "belum") as string];

export const opsi = (obj: Record<string, string>) => Object.entries(obj).map(([value, label]) => ({ value, label }));

// Golongan + rhesus ringkas, mis. "O+" / "AB-".
export const golonganRhUtd = (golongan?: string | null, rhesus?: string | null) =>
  golongan ? `${golongan}${rhesus === "positif" ? "+" : rhesus === "negatif" ? "-" : ""}` : "-";

// Kolom DATE: "YYYY-MM-DD" atau ISO (Date pg → JSON) → "YYYY-MM-DD" lokal.
export const tglIsoUtd = (v?: string | null) => {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return String(v);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const tglUtd = (v?: string | null) => {
  const iso = tglIsoUtd(v);
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};
// Sisa hari kalender menuju tanggal (bisa negatif).
export const sisaHariUtd = (v?: string | null) => {
  const iso = tglIsoUtd(v);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - hariIni.getTime()) / 86400000);
};
export const tambahHari = (hari: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + hari);
  return d;
};

// Epoch detik ⇄ Date untuk input waktu.
export const keEpoch = (d?: Date | null) => (d ? Math.floor(d.getTime() / 1000) : undefined);
export const dariEpoch = (n?: number | string | null) => (Number(n) ? new Date(Number(n) * 1000) : null);

// Nama modul izin (auth-service utdPermission.module; juga dipakai penunjang izinUtd & utils/permissions.ts).
export const MODUL_IZIN_UTD = "UTD";
// Izin aksi modul (tanpa daftar izin = super admin → boleh; backend tetap memeriksa).
export const izinUtd = (submodul: string, aksi: string, fitur?: string) =>
  !getStoredPermissions().length || hasPermission(MODUL_IZIN_UTD, submodul, aksi, fitur ?? null);
// Hasil IMLTD reaktif & identitas donor terkait (izin terpisah dari IMLTD › READ).
export const bolehLihatReaktifUtd = () => izinUtd("Lihat Hasil Reaktif", "READ");

// Cetak sederhana di jendela baru (kartu donor, laporan). Isi HTML disusun pemanggil dengan escHtml.
export const escHtml = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
export const cetakHtmlUtd = (judul: string, isi: string) => {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(judul)}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;color:#101828;margin:24px}h1{font-size:16px;margin:0 0 4px}h2{font-size:13px;margin:16px 0 6px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #D0D5DD;padding:4px 6px;text-align:left}th{background:#F2F4F7}
.kartu{border:2px solid #B42318;border-radius:10px;padding:14px;width:340px}.muted{color:#667085}</style></head>
<body>${isi}<script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
  return true;
};

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
    q.append(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

// ── Referensi (daftar enum dari backend)
export const referensiPilihanUtd = () => apiPenunjangGet("/utd/referensi/pilihan");

// ── Donor & seleksi
// Filter: cari (no. donor/NIK/nama), status_aktif (aktif|ditahan), page, limit.
export const daftarDonorUtd = (params: Record<string, any> = {}) => apiPenunjangGet(`/utd/donor${qs(params)}`);
// Detail + aftapTerakhir, jumlahAftap, pernahReaktif (null bila tanpa izin Lihat Hasil Reaktif).
export const detailDonorUtd = (uuid: string) => apiPenunjangGet(`/utd/donor/${uuid}`);
export const simpanDonorUtd = (
  data: {
    nama?: string;
    nik?: string | null;
    tanggalLahir?: string | null;
    jenisKelamin?: string | null;
    golonganDarah?: string | null;
    rhesus?: string | null;
    telepon?: string | null;
    alamat?: string | null;
  },
  uuid?: string,
) => (uuid ? apiPenunjangPut(`/utd/donor/${uuid}`, data) : apiPenunjangPost("/utd/donor", data));
export const riwayatDonorUtd = (uuid: string, params: Record<string, any> = {}) => apiPenunjangGet(`/utd/donor/${uuid}/riwayat${qs(params)}`);
// Kunjungan seleksi baru. status "layak" dialihkan backend menjadi "tolak" bila interval donor belum terpenuhi.
export const seleksiDonorUtd = (
  uuid: string,
  data: {
    kuesioner?: Record<string, any>;
    hb?: number | null;
    tekananSistolik?: number | null;
    tekananDiastolik?: number | null;
    beratBadan?: number | null;
    nadi?: number | null;
    suhu?: number | null;
    status?: string;
    alasan?: string | null;
  },
) => apiPenunjangPost(`/utd/donor/${uuid}/seleksi`, data);
export const putuskanSeleksiUtd = (uuid: string, riwayatUuid: string, data: { status: string; alasan?: string | null }) =>
  apiPenunjangPut(`/utd/donor/${uuid}/seleksi/${riwayatUuid}`, data);
export const notifikasiDonorUtd = (uuid: string, catatan?: string) => apiPenunjangPut(`/utd/donor/${uuid}/notifikasi`, { catatan });

// ── Aftap
// Filter: cari (no. kantong/no. donor/nama), status (status kantong, boleh dipisah koma), page, limit.
export const daftarAftapUtd = (params: Record<string, any> = {}) => apiPenunjangGet(`/utd/aftap${qs(params)}`);
// Jejak vein-to-vein: aftap + riwayat + imltd (disamarkan tanpa izin) + komponen.
export const detailAftapUtd = (uuid: string) => apiPenunjangGet(`/utd/aftap/${uuid}`);
export const buatAftapUtd = (data: {
  riwayatUuid: string;
  noKantong: string;
  volumeMl: number;
  golonganDarah?: string;
  rhesus?: string;
  waktuMulai?: number;
  waktuSelesai?: number;
  reaksiDonor?: string;
  catatanReaksi?: string;
  kegiatan?: string;
  lokasiMobile?: string;
}) => apiPenunjangPost("/utd/aftap", data);

// ── Uji saring IMLTD
export const worklistImltdUtd = (params: Record<string, any> = {}) => apiPenunjangGet(`/utd/imltd/worklist${qs(params)}`);
// Body: { hivHasil?, hivMetode?, hivWaktu?, hbsag*, hcv*, sifilis* } (hanya kunci yang dikirim yang diubah).
export const simpanImltdUtd = (aftapUuid: string, data: Record<string, any>) => apiPenunjangPut(`/utd/aftap/${aftapUuid}/imltd`, data);
export const konfirmasiImltdUtd = (aftapUuid: string, data: { parameter: string; hasil: string; metode?: string; waktu?: number }) =>
  apiPenunjangPost(`/utd/aftap/${aftapUuid}/imltd/konfirmasi`, data);
export const pelepasanKantongUtd = (aftapUuid: string) => apiPenunjangPost(`/utd/aftap/${aftapUuid}/pelepasan`);

// ── Komponen
// Filter: golongan_darah, jenis_komponen, status (koma), tersedia_saja=1, cari (label/no. kantong), page, limit (maks. 9999).
export const daftarKomponenUtd = (params: Record<string, any> = {}) => apiPenunjangGet(`/utd/komponen${qs(params)}`);
export const jejakKomponenUtd = (uuid: string) => apiPenunjangGet(`/utd/komponen/${uuid}/jejak`);
export const olahKomponenUtd = (
  aftapUuid: string,
  items: { jenisKomponen: string; volumeMl: number; tanggalKedaluwarsa: string; golonganDarah?: string; rhesus?: string }[],
) => apiPenunjangPost(`/utd/aftap/${aftapUuid}/komponen`, { items });

// ── Permintaan, distribusi, pemusnahan
export const daftarPermintaanUtd = (params: Record<string, any> = {}) => apiPenunjangGet(`/utd/permintaan${qs(params)}`);
export const detailPermintaanUtd = (uuid: string) => apiPenunjangGet(`/utd/permintaan/${uuid}`);
export const buatPermintaanUtd = (data: {
  penerimaTipe: string;
  namaPenerima: string;
  golonganDarah: string;
  jenisKomponen: string;
  jumlahDiminta: number;
  keteranganKlinis?: string;
}) => apiPenunjangPost("/utd/permintaan", data);
export const daftarDistribusiUtd = (params: Record<string, any> = {}) => apiPenunjangGet(`/utd/distribusi${qs(params)}`);
export const distribusikanUtd = (data: { permintaanUuid: string; komponenUuid: string[]; waktuSerahTerima?: number }) =>
  apiPenunjangPost("/utd/distribusi", data);
export const kirimUlangBdrsUtd = (uuid: string) => apiPenunjangPost(`/utd/distribusi/${uuid}/kirim-penerimaan-bdrs`);
export const daftarPemusnahanUtd = (params: Record<string, any> = {}) => apiPenunjangGet(`/utd/pemusnahan${qs(params)}`);
// { kantongReaktif: [...], komponenKedaluwarsa: [...] } — belum dimusnahkan.
export const tindakLanjutPemusnahanUtd = () => apiPenunjangGet("/utd/pemusnahan/tindak-lanjut");
export const musnahkanUtd = (data: { kantongUuid?: string; komponenUuid?: string; alasan: string; catatan?: string }) =>
  apiPenunjangPost("/utd/pemusnahan", data);

// ── Pelaporan
export const laporanUtd = (jenis: string, periodeAwal: string, periodeAkhir: string) =>
  apiPenunjangGet(`/utd/laporan${qs({ jenis, periode_awal: periodeAwal, periode_akhir: periodeAkhir })}`);
// Membentuk & mencatat laporan (utd_pelaporan_log); hasil sama dengan GET + log.
export const bentukLaporanUtd = (jenis: string, periodeAwal: string, periodeAkhir: string) =>
  apiPenunjangPost("/utd/laporan", { jenis, periodeAwal, periodeAkhir });
export const riwayatLaporanUtd = () => apiPenunjangGet("/utd/laporan/riwayat");

// ── Pengaturan
export const ambilPengaturanUtd = () => apiPenunjangGet("/utd/pengaturan");
export const simpanPengaturanUtd = (data: { intervalMinimalHari: number }) => apiPenunjangPut("/utd/pengaturan", data);
