// API modul Patologi Anatomi (penunjang-service: /api/v3/penunjang/patologi). Request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler). Kirim waktu sebagai epoch detik (bukan Date).
import { apiPenunjangDelete, apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";

// Izin aksi modul (Setting › Hak Akses › Patologi Anatomi). Tanpa daftar izin = super admin → boleh; backend tetap
// memeriksa login. Submodul: "Order PA" (CREATE/VALIDASI/BATAL/CETAK), "Penerimaan Jaringan" (TERIMA/TOLAK),
// "Pemeriksaan" (MAKROSKOPIS/MIKROSKOPIS/DIAGNOSIS/VERIFIKASI/CETAK HASIL), "Arsip Blok & Slide" (UPDATE/PINJAM),
// "Datamaster" (fitur Pemeriksaan PA / Template Laporan PA), "Laporan PA" (fitur Kunjungan: CETAK LAPORAN).
export const izinPa = (submodul: string, aksi: string, fitur?: string) =>
  !getStoredPermissions().length || hasPermission("Patologi Anatomi", submodul, aksi, fitur ?? null);

export type JenisPa = "histopatologi" | "sitologi" | "potong_beku" | "ihk";
export type StatusOrderPa = "order" | "valid" | "diproses" | "selesai" | "ditolak" | "batal";
export type StatusKasusPa = "menunggu" | "diterima" | "diproses" | "verifikasi" | "selesai" | "ditolak";

type Gaya = { label: string; bg: string; text: string };

export const JENIS_PA: Record<JenisPa, { label: string; singkat: string; prefiks: string }> = {
  histopatologi: { label: "Histopatologi", singkat: "Histo", prefiks: "PA" },
  sitologi: { label: "Sitologi", singkat: "Sitologi", prefiks: "SIT" },
  potong_beku: { label: "Potong Beku (Frozen Section)", singkat: "Potong Beku", prefiks: "FS" },
  ihk: { label: "Imunohistokimia (IHK)", singkat: "IHK", prefiks: "IHK" },
};
export const OPSI_JENIS_PA = Object.entries(JENIS_PA).map(([value, j]) => ({ value, label: j.label }));

export const STATUS_ORDER_PA: Record<StatusOrderPa, Gaya> = {
  order: { label: "Order", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  valid: { label: "Valid", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  diproses: { label: "Diproses", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  selesai: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  ditolak: { label: "Spesimen Ditolak", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  batal: { label: "Batal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_KASUS_PA: Record<StatusKasusPa, Gaya> = {
  menunggu: { label: "Menunggu Jaringan", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  diterima: { label: "Diterima", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  diproses: { label: "Diproses", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  verifikasi: { label: "Menunggu Verifikasi", bg: "bg-[#EBE9FE]", text: "text-[#5925DC]" },
  selesai: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  ditolak: { label: "Ditolak", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const gayaOrderPa = (s?: string) => STATUS_ORDER_PA[s as StatusOrderPa];
export const gayaKasusPa = (s?: string) => STATUS_KASUS_PA[s as StatusKasusPa];

export const SUMBER_PA: Record<string, string> = { rme: "RME", aps: "APS", rujukan: "Rujukan Luar" };
export const PELAYANAN_PA: Record<string, string> = { rajal: "Rawat Jalan", ranap: "Rawat Inap", igd: "IGD", aps: "APS" };
// Label asal order: "RME · Rawat Jalan", "APS", "Rujukan Luar".
export const asalPa = (d: any) => (d?.sumber === "rme" ? `RME · ${PELAYANAN_PA[d.pelayanan] ?? d.pelayanan}` : SUMBER_PA[d?.sumber] ?? d?.sumber ?? "-");
export const FIKSASI_PA: Record<string, string> = {
  formalin_10: "Formalin buffer 10%",
  alkohol_95: "Alkohol 95%",
  tanpa_fiksasi: "Tanpa fiksasi (segar)",
  lainnya: "Lainnya",
};
export const OPSI_FIKSASI_PA = Object.entries(FIKSASI_PA).map(([value, label]) => ({ value, label }));
export const LATERALITAS_PA: Record<string, string> = { kanan: "Kanan (dekstra)", kiri: "Kiri (sinistra)", bilateral: "Bilateral" };
export const STATUS_ARSIP_PA: Record<string, Gaya> = {
  ada: { label: "Ada di arsip", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  dipinjam: { label: "Dipinjam", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  dikembalikan: { label: "Dikembalikan", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
};
export const KEPERLUAN_PINJAM_PA: Record<string, string> = {
  konsultasi: "Konsultasi",
  second_opinion: "Second opinion",
  ihk_luar: "IHK/molekuler di luar",
  pendidikan: "Pendidikan/penelitian",
  lainnya: "Lainnya",
};
export const PERAN_PETUGAS_PA: Record<string, string> = { dokter: "Dokter Sp.PA", teknisi: "Teknisi / Analis PA" };

// Pilihan cepat (datalist) jenis spesimen, cara pengambilan & alasan tolak (praktik instalasi PA).
export const SARAN_SPESIMEN_PA = [
  "Jaringan biopsi", "Jaringan eksisi", "Jaringan operasi", "Kuretase endometrium", "Kepingan TURP", "Appendiks",
  "Kandung empedu", "Uterus", "Mammae", "Kelenjar getah bening", "Sediaan apus serviks (Pap smear)", "Aspirat FNAB (sediaan apus)",
  "Cairan pleura", "Cairan asites", "Urin", "Sputum", "Jaringan segar (potong beku)", "Blok parafin",
];
export const SARAN_CARA_AMBIL_PA = ["Biopsi insisi", "Biopsi eksisi", "Biopsi jarum (core)", "FNAB", "Kuretase", "Operasi/reseksi", "Pungsi", "Apusan (smear)", "TURP"];
export const SARAN_ALASAN_TOLAK_PA = [
  "Identitas pada wadah tidak ada / tidak sesuai formulir",
  "Formulir permintaan tidak lengkap",
  "Wadah bocor / pecah",
  "Jaringan tanpa fiksasi > 1 jam (autolisis)",
  "Volume formalin tidak cukup",
  "Jaringan kering / rusak",
  "Slide pecah / tidak terbaca",
];

// Pilihan cepat ICD-O-3 (topografi & morfologi) yang sering dipakai — kode bebas tetap boleh diketik.
export const ICDO_TOPOGRAFI_PA: [string, string][] = [
  ["C50.9", "Payudara"], ["C53.9", "Serviks uteri"], ["C54.1", "Endometrium"], ["C54.2", "Miometrium"], ["C56.9", "Ovarium"],
  ["C61.9", "Prostat"], ["C73.9", "Tiroid"], ["C18.1", "Appendiks"], ["C18.9", "Kolon"], ["C20.9", "Rektum"], ["C16.9", "Lambung"],
  ["C22.0", "Hati"], ["C23.9", "Kandung empedu"], ["C34.9", "Paru"], ["C44.9", "Kulit"], ["C49.9", "Jaringan lunak"],
  ["C77.0", "KGB kepala & leher"], ["C77.3", "KGB aksila"], ["C11.9", "Nasofaring"], ["C67.9", "Kandung kemih"],
];
export const ICDO_MORFOLOGI_PA: [string, string][] = [
  ["8000/3", "Neoplasma ganas"], ["8010/3", "Karsinoma NOS"], ["8070/3", "Karsinoma sel skuamosa NOS"], ["8140/3", "Adenokarsinoma NOS"],
  ["8500/3", "Karsinoma duktal invasif (NST)"], ["8520/3", "Karsinoma lobular invasif"], ["8260/3", "Karsinoma papiler (tiroid)"],
  ["8380/3", "Adenokarsinoma endometrioid"], ["8441/3", "Karsinoma serosa"], ["8090/3", "Karsinoma sel basal"], ["8720/3", "Melanoma maligna"],
  ["9680/3", "Limfoma sel B besar difus"], ["8000/6", "Neoplasma metastasis"], ["8077/2", "HSIL / CIN 2–3"], ["8500/2", "DCIS"],
  ["9010/0", "Fibroadenoma"], ["8890/0", "Leiomioma"], ["8850/0", "Lipoma"], ["8140/0", "Adenoma NOS"], ["9020/1", "Tumor filodes borderline"],
];

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
    q.append(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const keTanggalPa = (d?: Date | null) => {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const keEpochPa = (d?: Date | null) => (d ? Math.floor(d.getTime() / 1000) : null);
export const dariEpochPa = (n?: number | string | null) => (Number(n) ? new Date(Number(n) * 1000) : null);

// ── Master pemeriksaan
export const daftarPemeriksaanPa = (params: { page?: number; limit?: number; cari?: string; jenis?: string | string[]; status?: string } = {}) =>
  apiPenunjangGet(`/patologi/pemeriksaan${qs(params)}`);
export const simpanPemeriksaanPa = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/patologi/pemeriksaan/${uuid}`, data) : apiPenunjangPost("/patologi/pemeriksaan", data);
export const hapusPemeriksaanPa = (uuid: string) => apiPenunjangDelete(`/patologi/pemeriksaan/${uuid}`);

// ── Template laporan
export const daftarTemplatePa = (params: { page?: number; limit?: number; cari?: string; jenis?: string | string[] } = {}) =>
  apiPenunjangGet(`/patologi/template${qs(params)}`);
export const templateUntukPa = (pemeriksaanUuid: string) => apiPenunjangGet(`/patologi/template${qs({ untuk_pemeriksaan: pemeriksaanUuid })}`);
export const simpanTemplatePa = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/patologi/template/${uuid}`, data) : apiPenunjangPost("/patologi/template", data);
export const hapusTemplatePa = (uuid: string) => apiPenunjangDelete(`/patologi/template/${uuid}`);

// ── Petugas (dokter Sp.PA & teknisi)
export const daftarPetugasPa = (peran?: string) => apiPenunjangGet(`/patologi/petugas${qs({ peran })}`);
export const pilihanPetugasPa = (peran: "dokter" | "teknisi") => apiPenunjangGet(`/patologi/petugas/pilihan${qs({ peran })}`);
export const simpanPetugasPa = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/patologi/petugas/${uuid}`, data) : apiPenunjangPost("/patologi/petugas", data);
export const hapusPetugasPa = (uuid: string) => apiPenunjangDelete(`/patologi/petugas/${uuid}`);

// ── Order
export interface ItemOrderPa {
  pemeriksaanUuid: string;
  kasusIndukUuid?: string | null;
}
export const daftarOrderPa = (params: Record<string, any> = {}) => apiPenunjangGet(`/patologi/order${qs(params)}`);
export const detailOrderPa = (uuid: string) => apiPenunjangGet(`/patologi/order/${uuid}`);
export const orderKunjunganPa = (params: { rekamMedisUuid?: string; noReg?: string; patientUuid?: string }) =>
  apiPenunjangGet(`/patologi/order/kunjungan${qs({ rekam_medis_uuid: params.rekamMedisUuid, no_reg: params.noReg, patient_uuid: params.patientUuid })}`);
export const buatOrderPa = (data: {
  sumber: "rme" | "aps" | "rujukan";
  patientUuid?: string;
  rekamMedisUuid?: string;
  noReg?: string;
  dokterPengirimUuid?: string | null;
  dokterPengirimLuar?: string;
  faskesPerujuk?: string;
  paymentMethod?: number;
  klinis?: string;
  riwayat?: string;
  lokasiAnatomi?: string;
  caraPengambilan?: string;
  catatan?: string;
  cito?: boolean;
  items: ItemOrderPa[];
}) => apiPenunjangPost("/patologi/order", data);
export const validasiOrderPa = (uuid: string, opsi: { kirimLisPa?: boolean; koneksiUuid?: string | null } = {}) =>
  apiPenunjangPost(`/patologi/order/${uuid}/validasi`, opsi.kirimLisPa ? { kirimLisPa: true, koneksiUuid: opsi.koneksiUuid || null } : {});
export const batalOrderPa = (uuid: string, alasan: string) => apiPenunjangPost(`/patologi/order/${uuid}/batal`, { alasan });

// ── Bridging LIS Patologi Anatomi (fitur pa_bridging_lis; pola sama dengan Bridging LIS Laboratorium)
export const daftarKoneksiLisPa = () => apiPenunjangGet("/patologi/lis/koneksi");
export const simpanKoneksiLisPa = (uuid: string | null, data: Record<string, any>) =>
  uuid ? apiPenunjangPut(`/patologi/lis/koneksi/${uuid}`, data) : apiPenunjangPost("/patologi/lis/koneksi", data);
export const jadikanBawaanLisPa = (uuid: string) => apiPenunjangPut(`/patologi/lis/koneksi/${uuid}/bawaan`, {});
export const kunciMasukBaruLisPa = (uuid: string) => apiPenunjangPost(`/patologi/lis/koneksi/${uuid}/kunci-masuk`, {});
// diam=true: pesan sukses generik tidak relevan (hasil uji bisa "tidak terhubung" walau HTTP 200) — tampilkan toast kustom di halaman.
export const ujiKoneksiLisPa = (uuid: string) => apiPenunjangPost(`/patologi/lis/koneksi/${uuid}/uji`, {}, true);
export const hapusKoneksiLisPa = (uuid: string) => apiPenunjangDelete(`/patologi/lis/koneksi/${uuid}`);

export const daftarPemetaanPemeriksaanLisPa = (koneksiUuid: string) => apiPenunjangGet(`/patologi/lis/mapping/pemeriksaan${qs({ koneksi_uuid: koneksiUuid })}`);
export const simpanPemetaanPemeriksaanLisPa = (koneksiUuid: string, items: Record<string, any>[]) => apiPenunjangPut("/patologi/lis/mapping/pemeriksaan", { koneksiUuid, items });
export const daftarPemetaanRefLisPa = (koneksiUuid: string) => apiPenunjangGet(`/patologi/lis/mapping/ref${qs({ koneksi_uuid: koneksiUuid })}`);
export const simpanPemetaanRefLisPa = (koneksiUuid: string, items: Record<string, any>[]) => apiPenunjangPut("/patologi/lis/mapping/ref", { koneksiUuid, items });
export const daftarPemetaanHasilLisPa = (koneksiUuid: string) => apiPenunjangGet(`/patologi/lis/mapping/hasil${qs({ koneksi_uuid: koneksiUuid })}`);
export const simpanPemetaanHasilLisPa = (koneksiUuid: string, items: Record<string, any>[]) => apiPenunjangPut("/patologi/lis/mapping/hasil", { koneksiUuid, items });

// Field laporan yang boleh dipetakan ke nama field vendor LIS PA (lihat penunjang-service lis-pa-peta.js FIELD_HASIL_SIMRS).
export const FIELD_HASIL_LIS_PA: { kode: string; label: string }[] = [
  { kode: "makroskopis", label: "Makroskopis" },
  { kode: "mikroskopis", label: "Mikroskopis" },
  { kode: "diagnosis", label: "Kesimpulan / Diagnosis" },
  { kode: "icd_o_topografi", label: "ICD-O Topografi" },
  { kode: "icd_o_morfologi", label: "ICD-O Morfologi" },
  { kode: "icd10", label: "ICD-10" },
  { kode: "komentar", label: "Komentar" },
];

export const daftarPengirimanLisPa = (params: Record<string, any> = {}) => apiPenunjangGet(`/patologi/lis/kirim${qs(params)}`);
export const statusKirimLisPa = (orderItemUuid: string) => apiPenunjangGet(`/patologi/lis/kirim/${orderItemUuid}`);
export const kirimUlangLisPa = (orderItemUuid: string, koneksiUuid?: string) => apiPenunjangPost(`/patologi/lis/kirim/${orderItemUuid}`, koneksiUuid ? { koneksiUuid } : {});
// diam=true: pesan "Data berhasil ditampilkan" selalu HTTP 200 walau hasilnya tidak_pasti/gagal — tampilkan toast kustom.
export const cekStatusLisPa = (orderItemUuid: string) => apiPenunjangPost(`/patologi/lis/kirim/${orderItemUuid}/cek-status`, {}, true);
export const ambilHasilLisPa = (orderItemUuid: string) => apiPenunjangPost(`/patologi/lis/tarik/${orderItemUuid}`, {});
export const riwayatLaporanLisPa = (orderItemUuid: string) => apiPenunjangGet(`/patologi/lis/riwayat/${orderItemUuid}`);

// ── Kasus: penerimaan jaringan & pemeriksaan
export const worklistPa = (params: Record<string, any> = {}) => apiPenunjangGet(`/patologi/kasus${qs(params)}`);
export const detailKasusPa = (uuid: string) => apiPenunjangGet(`/patologi/kasus/${uuid}`);
export const kasusIndukPa = (patientUuid: string) => apiPenunjangGet(`/patologi/kasus/induk${qs({ patient_uuid: patientUuid })}`);
export const terimaSpesimenPa = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`/patologi/kasus/${uuid}/terima`, data);
export const tolakSpesimenPa = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`/patologi/kasus/${uuid}/tolak`, data);
export const simpanMakroskopisPa = (uuid: string, data: Record<string, any>, diam = false) => apiPenunjangPut(`/patologi/kasus/${uuid}/makroskopis`, data, diam);
export const simpanMikroskopisPa = (uuid: string, data: { mikroskopis: string }, diam = false) => apiPenunjangPut(`/patologi/kasus/${uuid}/mikroskopis`, data, diam);
export const simpanDiagnosisPa = (uuid: string, data: Record<string, any>) => apiPenunjangPut(`/patologi/kasus/${uuid}/diagnosis`, data);
export const verifikasiPa = (uuid: string, dokterPaUuid?: string) => apiPenunjangPost(`/patologi/kasus/${uuid}/verifikasi`, dokterPaUuid ? { dokterPaUuid } : {});
export const revisiPa = (uuid: string, alasan: string) => apiPenunjangPost(`/patologi/kasus/${uuid}/revisi`, { alasan });

// ── Arsip blok & slide
export const daftarArsipPa = (params: Record<string, any> = {}) => apiPenunjangGet(`/patologi/arsip${qs(params)}`);
export const tambahArsipPa = (data: Record<string, any>) => apiPenunjangPost("/patologi/arsip", data);
export const ubahArsipPa = (uuid: string, data: Record<string, any>) => apiPenunjangPut(`/patologi/arsip/${uuid}`, data);
export const hapusArsipPa = (uuid: string) => apiPenunjangDelete(`/patologi/arsip/${uuid}`);
export const lokasiArsipPa = (uuids: string[], lokasiRak: string) => apiPenunjangPost("/patologi/arsip/lokasi", { uuids, lokasiRak });
export const pinjamArsipPa = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`/patologi/arsip/${uuid}/pinjam`, data);
export const kembaliArsipPa = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`/patologi/arsip/${uuid}/kembali`, data);
export const riwayatArsipPa = (uuid: string) => apiPenunjangGet(`/patologi/arsip/${uuid}/riwayat`);

// ── Laporan & referensi
export const laporanKunjunganPa = (tanggalMulai: string, tanggalSelesai: string) =>
  apiPenunjangGet(`/patologi/laporan/kunjungan${qs({ tanggal_mulai: tanggalMulai, tanggal_selesai: tanggalSelesai })}`);
export const cariPasienPa = (cari: string) => apiPenunjangGet(`/patologi/referensi/pasien${qs({ cari })}`);
export const daftarDokterPa = (semua = false) => apiPenunjangGet(`/patologi/referensi/dokter${qs({ semua: semua ? 1 : "" })}`);
export const cariIcd10Pa = (cari: string) => apiPenunjangGet(`/patologi/referensi/icd10${qs({ cari })}`);

// ── Format
export const umurPa = (tglLahir?: string | null) => {
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
export const waktuPa = (epoch?: number | string | null, tanpaJam = false) => {
  const n = Number(epoch);
  if (!n) return "-";
  const d = new Date((n > 1e12 ? n / 1000 : n) * 1000);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", ...(tanpaJam ? {} : { hour: "2-digit", minute: "2-digit" }) });
};
export const rupiahPa = (n?: number | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n) || 0);
// Sisa hari menuju target selesai (negatif = terlambat).
export const sisaHariPa = (target?: number | null) => (Number(target) ? Math.ceil((Number(target) - Date.now() / 1000) / 86400) : null);
export const JK_PA: Record<string, string> = { Male: "L", Female: "P" };
