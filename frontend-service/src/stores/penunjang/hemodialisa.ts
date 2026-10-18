// API modul Unit Hemodialisa (penunjang-service: /api/v3/penunjang/hemodialisa, STD-0033). Request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler).
import { apiPenunjangDelete, apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";

type Gaya = { label: string; bg: string; text: string };
const kuning = { bg: "bg-[#FEF0C7]", text: "text-[#B54708]" };
const hijau = { bg: "bg-[#D1FADF]", text: "text-[#027A48]" };
const merah = { bg: "bg-[#FDE2E1]", text: "text-[#B42318]" };
const biru = { bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" };
const abu = { bg: "bg-[#F2F4F7]", text: "text-[#344054]" };

export const MODUL_HD = "Hemodialisa";
export const JENIS_HD: Record<string, string> = { kronis: "Kronis", akut: "Akut" };
export const HARI: Record<string, string> = { "1": "Senin", "2": "Selasa", "3": "Rabu", "4": "Kamis", "5": "Jumat", "6": "Sabtu", "7": "Minggu" };
export const STATUS_MESIN: Record<string, Gaya> = { aktif: { label: "Aktif", ...hijau }, perawatan: { label: "Perawatan", ...kuning }, nonaktif: { label: "Nonaktif", ...abu } };
export const STATUS_JADWAL: Record<string, Gaya> = {
  terjadwal: { label: "Terjadwal", ...biru },
  hadir: { label: "Hadir", ...kuning },
  berjalan: { label: "Berjalan", ...kuning },
  selesai: { label: "Selesai", ...hijau },
  batal: { label: "Batal", ...abu },
};
export const STATUS_SESI: Record<string, Gaya> = {
  asesmen: { label: "Asesmen Pra-HD", ...biru },
  berjalan: { label: "Berjalan", ...kuning },
  selesai: { label: "Selesai", ...hijau },
  batal: { label: "Batal", ...abu },
};
export const STATUS_TAGIHAN: Record<string, Gaya> = {
  belum: { label: "Belum Dikirim", ...abu },
  terkirim: { label: "Terkirim", ...hijau },
  gagal: { label: "Gagal", ...merah },
  tertunda: { label: "Tertunda (tarif)", ...kuning },
  tanpa_biaya: { label: "Tanpa Biaya", ...abu },
};
export const STATUS_HDIS: Record<string, Gaya> = {
  terkirim: { label: "HDIS: Terkirim", ...hijau },
  sedang_dikirim: { label: "HDIS: Dikirim", ...biru },
  gagal: { label: "HDIS: Gagal", ...merah },
  tidak_pasti: { label: "HDIS: Tidak Pasti", ...kuning },
  diterapkan: { label: "Diterapkan", ...hijau },
  ditolak: { label: "Ditolak", ...merah },
};
export const STATUS_RESEP: Record<string, Gaya> = { draft: { label: "Draf", ...kuning }, sah: { label: "Sah", ...hijau }, nonaktif: { label: "Nonaktif", ...abu } };
const gaya = (daftar: Record<string, Gaya>) => (k?: string | null) => daftar[k ?? ""] ?? { label: k ?? "-", ...abu };
export const gayaMesin = gaya(STATUS_MESIN);
export const gayaJadwal = gaya(STATUS_JADWAL);
export const gayaSesi = gaya(STATUS_SESI);
export const gayaTagihan = gaya(STATUS_TAGIHAN);
export const gayaHdis = gaya(STATUS_HDIS);
export const gayaResep = gaya(STATUS_RESEP);
export const opsi = (obj: Record<string, string | Gaya>) => Object.entries(obj).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label }));

// Izin aksi (tanpa daftar izin = super admin → boleh; backend tetap memeriksa izin).
export const izinHd = (submodul: string, aksi: string, fitur: string | null = null) => !getStoredPermissions().length || hasPermission(MODUL_HD, submodul, aksi, fitur);

// Kode parameter dari referensi bersifat snake_case (nilai, tidak dikonversi); kunci objek respons menjadi camelCase.
export const kunciCamel = (kode: string) => kode.replace(/_([a-z])/g, (_, h) => h.toUpperCase());

const zona = "Asia/Jakarta";
export const tanggalIso = (d?: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : undefined);
export const hariIniIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
export const dariIso = (s?: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
export const tampilTanggal = (s?: string | null) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "-");
export const tampilWaktu = (e?: number | string | null) => {
  const n = Number(e);
  return n ? new Date(n * 1000).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: zona }) : "-";
};
export const jam = (e?: number | string | null) => {
  const n = Number(e);
  return n ? new Date(n * 1000).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: zona }) : "-";
};
export const epoch = (d?: Date | null) => (d ? Math.floor(d.getTime() / 1000) : undefined);
export const rupiah = (n?: number | string | null) => (n === null || n === undefined || n === "" ? "-" : `Rp${Number(n).toLocaleString("id-ID")}`);

const qs = (params: Record<string, any> = {}) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return p.length ? `?${p.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}` : "";
};

// Referensi & datamaster
export const referensiHd = () => apiPenunjangGet("/hemodialisa/referensi");
export const daftarMesin = () => apiPenunjangGet("/hemodialisa/mesin");
export const simpanMesin = (data: any, uuid?: string) => (uuid ? apiPenunjangPut(`/hemodialisa/mesin/${uuid}`, data) : apiPenunjangPost("/hemodialisa/mesin", data));
export const hapusMesin = (uuid: string) => apiPenunjangDelete(`/hemodialisa/mesin/${uuid}`);
export const daftarShift = () => apiPenunjangGet("/hemodialisa/shift");
export const simpanShift = (data: any, uuid?: string) => (uuid ? apiPenunjangPut(`/hemodialisa/shift/${uuid}`, data) : apiPenunjangPost("/hemodialisa/shift", data));
export const hapusShift = (uuid: string) => apiPenunjangDelete(`/hemodialisa/shift/${uuid}`);
export const daftarAturan = () => apiPenunjangGet("/hemodialisa/dializer-aturan");
export const simpanAturan = (data: any, uuid?: string) => (uuid ? apiPenunjangPut(`/hemodialisa/dializer-aturan/${uuid}`, data) : apiPenunjangPost("/hemodialisa/dializer-aturan", data));
export const hapusAturan = (uuid: string) => apiPenunjangDelete(`/hemodialisa/dializer-aturan/${uuid}`);
export const cariItemMedis = (cari: string) => apiPenunjangGet(`/hemodialisa/item-medis${qs({ cari })}`);

// Registrasi, jadwal, resep
export const cariPasien = (cari: string) => apiPenunjangGet(`/hemodialisa/pasien${qs({ cari })}`);
export const daftarRegistrasi = (params: Record<string, any> = {}) => apiPenunjangGet(`/hemodialisa/registrasi${qs(params)}`);
export const simpanRegistrasi = (data: any, uuid?: string) => (uuid ? apiPenunjangPut(`/hemodialisa/registrasi/${uuid}`, data) : apiPenunjangPost("/hemodialisa/registrasi", data));
export const nonaktifRegistrasi = (uuid: string, alasan: string) => apiPenunjangPost(`/hemodialisa/registrasi/${uuid}/nonaktif`, { alasan });
export const daftarJadwal = (params: Record<string, any> = {}) => apiPenunjangGet(`/hemodialisa/jadwal${qs(params)}`);
export const antreanHarian = (tanggal?: string) => apiPenunjangGet(`/hemodialisa/antrean${qs({ tanggal })}`);
export const pengingatJadwal = (hari = 1) => apiPenunjangGet(`/hemodialisa/pengingat${qs({ hari })}`);
export const buatJadwal = (data: any) => apiPenunjangPost("/hemodialisa/jadwal", data);
export const ubahJadwal = (uuid: string, data: any) => apiPenunjangPut(`/hemodialisa/jadwal/${uuid}`, data);
export const hadirJadwal = (uuid: string, noReg?: string) => apiPenunjangPost(`/hemodialisa/jadwal/${uuid}/hadir`, { noReg: noReg || undefined });
export const batalJadwal = (uuid: string, alasan: string) => apiPenunjangPost(`/hemodialisa/jadwal/${uuid}/batal`, { alasan });
export const daftarResep = (params: Record<string, any> = {}) => apiPenunjangGet(`/hemodialisa/resep${qs(params)}`);
export const simpanResep = (data: any, uuid?: string) => (uuid ? apiPenunjangPut(`/hemodialisa/resep/${uuid}`, data) : apiPenunjangPost("/hemodialisa/resep", data));
export const sahkanResep = (uuid: string) => apiPenunjangPost(`/hemodialisa/resep/${uuid}/sahkan`);

// Sesi
export const daftarSesi = (params: Record<string, any> = {}) => apiPenunjangGet(`/hemodialisa/sesi${qs(params)}`);
export const detailSesi = (uuid: string) => apiPenunjangGet(`/hemodialisa/sesi/${uuid}`);
export const bukaSesi = (jadwalUuid: string) => apiPenunjangPost("/hemodialisa/sesi/buka", { jadwalUuid });
export const simpanAsesmen = (uuid: string, asesmenPra: any) => apiPenunjangPost(`/hemodialisa/sesi/${uuid}/asesmen`, { asesmenPra });
export const mulaiSesi = (uuid: string) => apiPenunjangPost(`/hemodialisa/sesi/${uuid}/mulai`);
export const catatObservasi = (uuid: string, data: any) => apiPenunjangPost(`/hemodialisa/sesi/${uuid}/observasi`, data);
export const daftarObservasi = (uuid: string, semua = false) => apiPenunjangGet(`/hemodialisa/sesi/${uuid}/observasi${semua ? "?semua=1" : ""}`);
export const koreksiObservasi = (uuid: string, obsUuid: string, data: any) => apiPenunjangPost(`/hemodialisa/sesi/${uuid}/observasi/${obsUuid}/koreksi`, data);
export const tinjauObservasi = (uuid: string, obsUuid: string) => apiPenunjangPost(`/hemodialisa/sesi/${uuid}/observasi/${obsUuid}/tinjau`);
export const tutupSesi = (uuid: string, data: any) => apiPenunjangPost(`/hemodialisa/sesi/${uuid}/tutup`, data);
export const hitungAdekuasi = (uuid: string, data: any) => apiPenunjangPost(`/hemodialisa/sesi/${uuid}/adekuasi`, data);
export const kirimUlangTagihanSesi = (uuid: string) => apiPenunjangPost(`/hemodialisa/sesi/${uuid}/tagihan/kirim-ulang`);
export const batalSesi = (uuid: string, alasan: string) => apiPenunjangPost(`/hemodialisa/sesi/${uuid}/batal`, { alasan });

// Dializer & pemakaian
export const daftarDializer = (params: Record<string, any> = {}) => apiPenunjangGet(`/hemodialisa/dializer${qs(params)}`);
export const daftarkanDializer = (data: any) => apiPenunjangPost("/hemodialisa/dializer", data);
export const hentikanDializer = (uuid: string, alasan: string) => apiPenunjangPost(`/hemodialisa/dializer/${uuid}/berhenti`, { alasan });
export const catatPemakaian = (sesiUuid: string, data: any) => apiPenunjangPost(`/hemodialisa/sesi/${sesiUuid}/pemakaian`, data);
export const kirimUlangTagihanPemakaian = (uuid: string) => apiPenunjangPost(`/hemodialisa/pemakaian/${uuid}/tagihan/kirim-ulang`);
export const daftarLokasiStok = () => apiPenunjangGet("/hemodialisa/lokasi-stok");

// Laporan
export const laporanHd = (dari?: string, sampai?: string) => apiPenunjangGet(`/hemodialisa/laporan${qs({ dari, sampai })}`);

// Bridging HDIS
export const daftarKoneksiHdis = () => apiPenunjangGet("/hemodialisa/hdis/koneksi");
export const simpanKoneksiHdis = (data: any, uuid?: string) => (uuid ? apiPenunjangPut(`/hemodialisa/hdis/koneksi/${uuid}`, data) : apiPenunjangPost("/hemodialisa/hdis/koneksi", data));
export const hapusKoneksiHdis = (uuid: string) => apiPenunjangDelete(`/hemodialisa/hdis/koneksi/${uuid}`);
export const bawaanKoneksiHdis = (uuid: string) => apiPenunjangPost(`/hemodialisa/hdis/koneksi/${uuid}/bawaan`);
export const kunciMasukHdis = (uuid: string) => apiPenunjangPost(`/hemodialisa/hdis/koneksi/${uuid}/kunci-masuk`);
export const ujiKoneksiHdis = (uuid: string) => apiPenunjangPost(`/hemodialisa/hdis/koneksi/${uuid}/uji`);
export const daftarPetaMesin = (koneksiUuid: string) => apiPenunjangGet(`/hemodialisa/hdis/peta-mesin${qs({ koneksi_uuid: koneksiUuid })}`);
export const simpanPetaMesin = (data: any) => apiPenunjangPut("/hemodialisa/hdis/peta-mesin", data);
export const daftarPesanHdis = (params: Record<string, any> = {}) => apiPenunjangGet(`/hemodialisa/hdis/pesan${qs(params)}`);
export const kirimUlangPesanHdis = (uuid: string) => apiPenunjangPost(`/hemodialisa/hdis/pesan/${uuid}/kirim-ulang`, {}, true);
