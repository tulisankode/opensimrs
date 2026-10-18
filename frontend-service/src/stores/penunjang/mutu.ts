// API modul Mutu & Akreditasi — fitur Dokumen Akreditasi & Kredensial Staf (penunjang-service: /api/v3/penunjang/mutu,
// STD-0028). Request otomatis snake_case, respons camelCase; galat → toast + undefined (lihat apiHandler).
import { apiPenunjangDelete, apiPenunjangGet, apiPenunjangPatch, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";
export { bacaBerkas, bukaBerkas, epochTanggal, tanggalDariEpoch, tanggalSarpras as tanggalMutu } from "@/stores/penunjang/sarpras";

type Gaya = { label: string; bg: string; text: string };
const kuning = { bg: "bg-[#FEF0C7]", text: "text-[#B54708]" };
const hijau = { bg: "bg-[#D1FADF]", text: "text-[#027A48]" };
const merah = { bg: "bg-[#FDE2E1]", text: "text-[#B42318]" };
const oranye = { bg: "bg-[#FFEAD5]", text: "text-[#C4320A]" };
const biru = { bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" };
const abu = { bg: "bg-[#F2F4F7]", text: "text-[#344054]" };

export const MODUL_MUTU = "Mutu & Akreditasi";
export const JENIS_DOKUMEN: Record<string, string> = { kebijakan: "Kebijakan", pedoman: "Pedoman", spo: "SPO", program: "Program", bukti: "Bukti" };
export const JENIS_KREDENSIAL: Record<string, string> = {
  str: "STR",
  sip: "SIP",
  sertifikat: "Sertifikat Pelatihan",
  sertifikat_kompetensi: "Sertifikat Kompetensi",
  rkk: "RKK",
  spk: "SPK",
  lainnya: "Lainnya",
};
export const STATUS_DOKUMEN: Record<string, Gaya> = {
  draf: { label: "Draf", ...abu },
  disahkan: { label: "Disahkan", ...hijau },
  kedaluwarsa: { label: "Kedaluwarsa", ...kuning },
  dicabut: { label: "Dicabut", ...merah },
};
// Transisi status yang diizinkan backend (dokumen.js): draf → disahkan|dicabut, disahkan → kedaluwarsa|dicabut, kedaluwarsa → dicabut.
export const TRANSISI_DOKUMEN: Record<string, string[]> = { draf: ["disahkan", "dicabut"], disahkan: ["kedaluwarsa", "dicabut"], kedaluwarsa: ["dicabut"], dicabut: [] };
export const MASA_BERLAKU: Record<string, Gaya> = {
  aktif: { label: "Berlaku", ...hijau },
  peringatan_90: { label: "≤ 90 hari", ...kuning },
  peringatan_30: { label: "≤ 30 hari", ...oranye },
  kedaluwarsa: { label: "Kedaluwarsa", ...merah },
};
export const STATUS_KREDENSIAL: Record<string, Gaya> = { aktif: { label: "Aktif", ...biru }, dicabut: { label: "Dicabut", ...abu } };
export const STATUS_VERIFIKASI: Record<string, Gaya> = {
  belum_diverifikasi: { label: "Belum Diverifikasi", ...abu },
  terverifikasi: { label: "Terverifikasi", ...hijau },
  ditolak: { label: "Ditolak", ...merah },
};
const gaya = (daftar: Record<string, Gaya>) => (k?: string | null) => daftar[k ?? ""] ?? { label: k ?? "-", ...abu };
export const gayaStatusDokumen = gaya(STATUS_DOKUMEN);
export const gayaMasaBerlaku = gaya(MASA_BERLAKU);
export const gayaStatusKredensial = gaya(STATUS_KREDENSIAL);
export const gayaVerifikasi = gaya(STATUS_VERIFIKASI);
export const opsi = (obj: Record<string, string | Gaya>) => Object.entries(obj).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label }));

// Izin aksi (tanpa daftar izin = super admin → boleh; backend tetap memeriksa izin).
export const izinMutu = (submodul: string, aksi: string) => !getStoredPermissions().length || hasPermission(MODUL_MUTU, submodul, aksi, null);

// Tanggal akhir hari perangkat (batas berbagi surveior) — epoch detik.
export const epochAkhirHari = (d?: Date | null) => (d ? Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime() / 1000) : undefined);
export const sisaHariTeks = (n?: number | null) => (n === null || n === undefined ? "Tanpa batas" : n < 0 ? `Lewat ${-n} hari` : n === 0 ? "Berakhir hari ini" : `${n} hari lagi`);
export const persenTeks = (p?: number | null) => (p === null || p === undefined ? "-" : `${p.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`);
export const ukuranBerkas = (b?: number | null) => (b ? (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`) : "-");

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.append(k.replace(/[A-Z]/g, (h) => `_${h.toLowerCase()}`), String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

// ── Referensi & dasbor
export const referensiMutu = () => apiPenunjangGet("/mutu/referensi");
export const dasborMutu = (params: Record<string, any> = {}) => apiPenunjangGet(`/mutu/dasbor${qs(params)}`);

// ── Instrumen (bab → standar → elemen)
export const daftarInstrumen = (params: Record<string, any> = {}) => apiPenunjangGet(`/mutu/instrumen${qs(params)}`);
export const simpanInstrumen = (data: Record<string, any>, uuid?: string) => (uuid ? apiPenunjangPut(`/mutu/instrumen/${uuid}`, data) : apiPenunjangPost("/mutu/instrumen", data));
export const hapusInstrumen = (uuid: string) => apiPenunjangDelete(`/mutu/instrumen/${uuid}`);
export const strukturInstrumen = (uuid: string) => apiPenunjangGet(`/mutu/instrumen/${uuid}/struktur`);
export const imporInstrumen = (uuid: string, isiCsv: string, hanyaValidasi = false) => apiPenunjangPost(`/mutu/instrumen/${uuid}/impor`, { isiCsv, hanyaValidasi });
// tingkat: bab (induk instrumen) | standar (induk bab) | elemen (induk standar)
const INDUK: Record<string, string> = { bab: "instrumen", standar: "bab", elemen: "standar" };
export const tambahSimpul = (tingkat: string, indukUuid: string, data: Record<string, any>) => apiPenunjangPost(`/mutu/${INDUK[tingkat]}/${indukUuid}/${tingkat}`, data);
export const ubahSimpul = (tingkat: string, uuid: string, data: Record<string, any>) => apiPenunjangPut(`/mutu/${tingkat}/${uuid}`, data);
export const hapusSimpul = (tingkat: string, uuid: string) => apiPenunjangDelete(`/mutu/${tingkat}/${uuid}`);

// ── Dokumen akreditasi
export const daftarDokumen = (params: Record<string, any> = {}) => apiPenunjangGet(`/mutu/dokumen${qs(params)}`);
export const detailDokumen = (uuid: string) => apiPenunjangGet(`/mutu/dokumen/${uuid}`);
export const buatDokumen = (data: Record<string, any>) => apiPenunjangPost("/mutu/dokumen", data);
export const ubahDokumen = (uuid: string, data: Record<string, any>) => apiPenunjangPut(`/mutu/dokumen/${uuid}`, data);
export const revisiDokumen = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`/mutu/dokumen/${uuid}/revisi`, data);
export const ubahStatusDokumen = (uuid: string, status: string, catatan?: string) => apiPenunjangPatch(`/mutu/dokumen/${uuid}/status`, { status, catatan });
export const tinjauDokumen = (uuid: string, tanggalTinjauUlang: number, catatanTinjauan: string) => apiPenunjangPatch(`/mutu/dokumen/${uuid}/tinjau`, { tanggalTinjauUlang, catatanTinjauan });
export const petakanElemen = (uuid: string, elemenUuid: string[]) => apiPenunjangPut(`/mutu/dokumen/${uuid}/elemen`, { elemenUuid });
export const bagikanSurveior = (uuid: string, dibagikan: boolean, sampai?: number) => apiPenunjangPatch(`/mutu/dokumen/${uuid}/bagikan-surveior`, { dibagikan, sampai });
export const unduhBerkasDokumen = (uuid: string) => apiPenunjangGet(`/mutu/dokumen/${uuid}/berkas`);
export const hapusDokumen = (uuid: string) => apiPenunjangDelete(`/mutu/dokumen/${uuid}`);

// ── Kredensial staf — SATU sumber data (mutu_kredensial) yang juga dipakai HR / SDM › Kredensial (STD-0035). basis
// "/mutu" (izin Mutu & Akreditasi › Kredensial Staf) atau "/hr" (izin HR / SDM › Kredensial); isi & perilaku sama.
export type BasisKredensial = "/mutu" | "/hr";
export const daftarKredensial = (params: Record<string, any> = {}, basis: BasisKredensial = "/mutu") => apiPenunjangGet(`${basis}/kredensial${qs(params)}`);
export const detailKredensial = (uuid: string, basis: BasisKredensial = "/mutu") => apiPenunjangGet(`${basis}/kredensial/${uuid}`);
export const simpanKredensial = (data: Record<string, any>, uuid?: string, basis: BasisKredensial = "/mutu") =>
  uuid ? apiPenunjangPut(`${basis}/kredensial/${uuid}`, data) : apiPenunjangPost(`${basis}/kredensial`, data);
export const unggahBerkasKredensial = (uuid: string, berkas: Record<string, any>, basis: BasisKredensial = "/mutu") =>
  apiPenunjangPost(`${basis}/kredensial/${uuid}/berkas`, { berkas });
export const unduhBerkasKredensial = (uuid: string, basis: BasisKredensial = "/mutu") => apiPenunjangGet(`${basis}/kredensial/${uuid}/berkas`);
export const verifikasiKredensial = (uuid: string, statusVerifikasi: string, catatanVerifikasi: string, basis: BasisKredensial = "/mutu") =>
  apiPenunjangPatch(`${basis}/kredensial/${uuid}/verifikasi`, { statusVerifikasi, catatanVerifikasi });
export const cabutKredensial = (uuid: string, alasan: string, basis: BasisKredensial = "/mutu") => apiPenunjangPatch(`${basis}/kredensial/${uuid}/cabut`, { alasan });
export const hapusKredensial = (uuid: string, basis: BasisKredensial = "/mutu") => apiPenunjangDelete(`${basis}/kredensial/${uuid}`);

// ── Surveior (baca saja)
export const daftarDokumenSurveior = (params: Record<string, any> = {}) => apiPenunjangGet(`/mutu/surveior/dokumen${qs(params)}`);
export const unduhBerkasSurveior = (uuid: string) => apiPenunjangGet(`/mutu/surveior/dokumen/${uuid}/berkas`);

// ── Indikator Mutu (STD-0025, fitur mutu_indikator; izin "Mutu & Akreditasi › Indikator Mutu")
export const SUB_INDIKATOR = "Indikator Mutu";
export const JENIS_INDIKATOR: Record<string, string> = { inm: "INM", imp_rs: "IMP-RS", impu: "IMPU" };
export const STATUS_DATA_INDIKATOR: Record<string, Gaya> = {
  draf: { label: "Draf", ...abu },
  diajukan: { label: "Diajukan", ...biru },
  tervalidasi: { label: "Tervalidasi", ...hijau },
  dikembalikan: { label: "Dikembalikan", ...oranye },
};
export const STATUS_CAPAIAN: Record<string, Gaya> = {
  tercapai: { label: "Tercapai", ...hijau },
  tidak_tercapai: { label: "Tidak Tercapai", ...merah },
  belum_lengkap: { label: "Data Belum Lengkap", ...kuning },
  tanpa_target: { label: "Target Belum Ditetapkan", ...abu },
  belum_ada_data: { label: "Belum Ada Data", ...abu },
};
export const STATUS_TINDAK_LANJUT: Record<string, Gaya> = {
  rencana: { label: "Rencana", ...abu },
  berjalan: { label: "Berjalan", ...biru },
  selesai: { label: "Selesai", ...hijau },
};
export const gayaStatusData = gaya(STATUS_DATA_INDIKATOR);
export const gayaCapaian = gaya(STATUS_CAPAIAN);
export const gayaTindakLanjut = gaya(STATUS_TINDAK_LANJUT);

const angkaId = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
export const capaianTeks = (nilai?: number | string | null, satuan = "persen") =>
  nilai === null || nilai === undefined || nilai === "" ? "-" : `${angkaId(Number(nilai))}${satuan === "persen" ? "%" : ""}`;
export const targetTeks = (target?: number | string | null, arah = "naik", satuan = "persen") =>
  target === null || target === undefined || target === "" ? "Belum ditetapkan" : `${arah === "turun" ? "≤" : "≥"} ${capaianTeks(target, satuan)}`;
// Capaian satu data di sisi klien (pratinjau formulir); pembagi nol → null, sama dengan backend.
export const hitungCapaianIndikator = (num: any, den: any, satuan = "persen") => {
  const n = Number(String(num ?? "").replace(",", "."));
  const d = Number(String(den ?? "").replace(",", "."));
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return Math.round((n / d) * (satuan === "persen" ? 100 : 1) * 100) / 100;
};

// Periode Asia/Jakarta: "YYYY-MM" (bulanan) atau "YYYY-Qn" (triwulan).
const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ROMAWI = ["I", "II", "III", "IV"];
const bulanWib = (d = new Date()) => {
  const w = new Date(d.getTime() + 7 * 3600 * 1000);
  return { tahun: w.getUTCFullYear(), bulan: w.getUTCMonth() + 1 };
};
export const bulanIni = () => {
  const { tahun, bulan } = bulanWib();
  return `${tahun}-${String(bulan).padStart(2, "0")}`;
};
export const labelPeriode = (kode?: string | null) => {
  const q = String(kode ?? "").match(/^(\d{4})-Q([1-4])$/);
  if (q) return `Triwulan ${ROMAWI[Number(q[2]) - 1]} ${q[1]}`;
  const m = String(kode ?? "").match(/^(\d{4})-(\d{2})$/);
  return m ? `${NAMA_BULAN[Number(m[2]) - 1]} ${m[1]}` : kode || "-";
};
// Pilihan periode mundur dari bulan/triwulan berjalan.
export const opsiBulan = (n = 24) => {
  const { tahun, bulan } = bulanWib();
  return Array.from({ length: n }, (_, i) => {
    const total = tahun * 12 + (bulan - 1) - i;
    const kode = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
    return { value: kode, label: labelPeriode(kode) };
  });
};
export const opsiTriwulan = (n = 8) => {
  const { tahun, bulan } = bulanWib();
  return Array.from({ length: n }, (_, i) => {
    const total = tahun * 4 + Math.ceil(bulan / 3) - 1 - i;
    const kode = `${Math.floor(total / 4)}-Q${(total % 4) + 1}`;
    return { value: kode, label: labelPeriode(kode) };
  });
};
// "YYYY-MM" mundur n-1 bulan (awal rentang n bulan yang berakhir di `sampai`).
export const bulanMundur = (sampai: string, n: number) => {
  const [t, b] = sampai.split("-").map(Number);
  const total = t * 12 + (b - 1) - (n - 1);
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};

export const izinIndikator = (aksi: string) => izinMutu(SUB_INDIKATOR, aksi);
export const referensiIndikator = () => apiPenunjangGet("/mutu/indikator/referensi");
export const daftarIndikator = (params: Record<string, any> = {}) => apiPenunjangGet(`/mutu/indikator${qs(params)}`);
export const detailIndikator = (uuid: string) => apiPenunjangGet(`/mutu/indikator/${uuid}`);
export const simpanIndikator = (data: Record<string, any>, uuid?: string) => (uuid ? apiPenunjangPut(`/mutu/indikator/${uuid}`, data) : apiPenunjangPost("/mutu/indikator", data));
export const hapusIndikator = (uuid: string) => apiPenunjangDelete(`/mutu/indikator/${uuid}`);
export const pasangInm = (kodeBawaan: string[]) => apiPenunjangPost("/mutu/indikator/pasang-inm", { kodeBawaan });
export const daftarDataIndikator = (params: Record<string, any> = {}) => apiPenunjangGet(`/mutu/indikator/data${qs(params)}`);
export const detailDataIndikator = (uuid: string) => apiPenunjangGet(`/mutu/indikator/data/${uuid}`);
export const simpanDataIndikator = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/mutu/indikator/data/${uuid}`, data) : apiPenunjangPost("/mutu/indikator/data", data);
export const hitungOtomatisIndikator = (data: Record<string, any>) => apiPenunjangPost("/mutu/indikator/data/hitung-otomatis", data, !data.simpan);
export const ajukanDataIndikator = (uuid: string) => apiPenunjangPost(`/mutu/indikator/data/${uuid}/ajukan`);
export const validasiDataIndikator = (uuid: string, keputusan: "setujui" | "kembalikan", catatan?: string) => apiPenunjangPost(`/mutu/indikator/data/${uuid}/validasi`, { keputusan, catatan });
export const bukaDataIndikator = (uuid: string, alasan: string) => apiPenunjangPost(`/mutu/indikator/data/${uuid}/buka`, { alasan });
export const hapusDataIndikator = (uuid: string) => apiPenunjangDelete(`/mutu/indikator/data/${uuid}`);
export const dasborIndikator = (params: Record<string, any> = {}) => apiPenunjangGet(`/mutu/indikator/dasbor${qs(params)}`);
export const trenIndikator = (uuid: string, params: Record<string, any> = {}) => apiPenunjangGet(`/mutu/indikator/${uuid}/tren${qs(params)}`);
export const laporanIndikator = (params: Record<string, any> = {}) => apiPenunjangGet(`/mutu/indikator/laporan${qs(params)}`);
export const daftarTindakLanjut = (params: Record<string, any> = {}) => apiPenunjangGet(`/mutu/indikator/tindak-lanjut${qs(params)}`);
export const simpanTindakLanjut = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/mutu/indikator/tindak-lanjut/${uuid}`, data) : apiPenunjangPost("/mutu/indikator/tindak-lanjut", data);
export const hapusTindakLanjut = (uuid: string) => apiPenunjangDelete(`/mutu/indikator/tindak-lanjut/${uuid}`);
