// API modul Radiologi (penunjang-service: /api/v3/penunjang/radiologi). Request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler).
import { apiPenunjangDelete, apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";

export type StatusOrderRad = "order" | "valid" | "diperiksa" | "selesai" | "batal";
export type StatusItemRad = "menunggu" | "diperiksa" | "selesai";

export const MODALITAS_RAD: Record<string, string> = {
  XR: "Radiografi (X-Ray)",
  DX: "Radiografi Digital",
  US: "USG",
  CT: "CT Scan",
  MR: "MRI",
  FL: "Fluoroskopi",
  MG: "Mammografi",
  LAIN: "Lainnya",
};
export const OPSI_MODALITAS = Object.entries(MODALITAS_RAD).map(([value, label]) => ({ value, label: `${value} — ${label}` }));

export const STATUS_ORDER_RAD: Record<StatusOrderRad, { label: string; bg: string; text: string }> = {
  order: { label: "Order", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  valid: { label: "Valid", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  diperiksa: { label: "Diperiksa", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  selesai: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  batal: { label: "Batal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_ITEM_RAD: Record<StatusItemRad, { label: string; bg: string; text: string }> = {
  menunggu: { label: "Menunggu", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  diperiksa: { label: "Menunggu Expertise", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  selesai: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
};
export const SUMBER_RAD: Record<string, string> = { rme: "RME", aps: "APS", mcu: "MCU" };
export const PELAYANAN_RAD: Record<string, string> = { rajal: "Rawat Jalan", ranap: "Rawat Inap", igd: "IGD", aps: "APS", mcu: "MCU" };

// Lampiran expertise (gambar disimpan sebagai data URL).
export interface LampiranRad {
  nama: string;
  tipe: string;
  data: string;
}

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
    q.append(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

// Tanggal lokal YYYY-MM-DD (filter backend memakai zona Asia/Jakarta).
export const keTanggal = (d?: Date | null) => {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// ── Master pemeriksaan
export const daftarPemeriksaanRad = (params: { page?: number; limit?: number; cari?: string; modalitas?: string | string[]; status?: string } = {}) =>
  apiPenunjangGet(`/radiologi/pemeriksaan${qs(params)}`);
export const simpanPemeriksaanRad = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/radiologi/pemeriksaan/${uuid}`, data) : apiPenunjangPost("/radiologi/pemeriksaan", data);
export const hapusPemeriksaanRad = (uuid: string) => apiPenunjangDelete(`/radiologi/pemeriksaan/${uuid}`);

// ── Master paket pemeriksaan (isi pemeriksaan + harga paket; saat diorder harga dialokasikan ke item)
export interface ItemPaketRad {
  pemeriksaanUuid: string;
  kode: string;
  nama: string;
  modalitas: string;
  harga: number;
  aktif: boolean;
}
export interface PaketRad {
  uuid: string;
  kode: string;
  nama: string;
  deskripsi?: string | null;
  harga: number;
  status: boolean;
  items: ItemPaketRad[];
  jumlahItem: number;
  totalSatuan: number;
  hemat: number;
}
export const daftarPaketRad = (params: { page?: number; limit?: number; cari?: string; status?: string } = {}) =>
  apiPenunjangGet(`/radiologi/paket${qs(params)}`);
export const simpanPaketRad = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/radiologi/paket/${uuid}`, data) : apiPenunjangPost("/radiologi/paket", data);
export const hapusPaketRad = (uuid: string) => apiPenunjangDelete(`/radiologi/paket/${uuid}`);

// ── Order
export const daftarOrderRad = (params: Record<string, any> = {}) => apiPenunjangGet(`/radiologi/order${qs(params)}`);
export const detailOrderRad = (uuid: string) => apiPenunjangGet(`/radiologi/order/${uuid}`);
export const orderKunjunganRad = (params: { rekamMedisUuid?: string; noReg?: string; patientUuid?: string }) =>
  apiPenunjangGet(
    `/radiologi/order/kunjungan${qs({ rekam_medis_uuid: params.rekamMedisUuid, no_reg: params.noReg, patient_uuid: params.patientUuid })}`
  );
export const buatOrderRad = (data: {
  sumber: "rme" | "aps";
  patientUuid?: string;
  rekamMedisUuid?: string;
  noReg?: string;
  dokterPengirimUuid?: string | null;
  lokasiAsalUuid?: string | null;
  paymentMethod?: number;
  klinis?: string;
  catatan?: string;
  cito?: boolean;
  items: string[];
  paketUuids?: string[];
}) => apiPenunjangPost("/radiologi/order", data);
export const validasiOrderRad = (uuid: string) => apiPenunjangPost(`/radiologi/order/${uuid}/validasi`);
export const batalOrderRad = (uuid: string, alasan: string) => apiPenunjangPost(`/radiologi/order/${uuid}/batal`, { alasan });

// ── Worklist pemeriksaan & expertise
export const worklistRad = (params: Record<string, any> = {}) => apiPenunjangGet(`/radiologi/worklist${qs(params)}`);
export const detailItemRad = (uuid: string) => apiPenunjangGet(`/radiologi/item/${uuid}`);
export const periksaItemRad = (uuid: string, data: { radiografer?: string; radiograferUuid?: string; ruangUuid?: string; waktuPeriksa?: number }) =>
  apiPenunjangPost(`/radiologi/item/${uuid}/periksa`, data);
export const simpanHasilRad = (
  uuid: string,
  data: { hasil: string; kesan: string; dokterRadiologiUuid: string; lampiran?: LampiranRad[] }
) => apiPenunjangPut(`/radiologi/item/${uuid}/hasil`, data);

// ── Laporan & referensi
export const laporanKunjunganRad = (tanggalMulai: string, tanggalSelesai: string) =>
  apiPenunjangGet(`/radiologi/laporan/kunjungan${qs({ tanggal_mulai: tanggalMulai, tanggal_selesai: tanggalSelesai })}`);
export const cariPasienRad = (cari: string) => apiPenunjangGet(`/radiologi/referensi/pasien${qs({ cari })}`);
export const daftarDokterRad = () => apiPenunjangGet("/radiologi/referensi/dokter");

// Umur dari tanggal lahir (YYYY-MM-DD / ISO).
export const umurRad = (tglLahir?: string | null) => {
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

export const waktuRad = (epoch?: number | string | null, tanpaJam = false) => {
  const n = Number(epoch);
  if (!n) return "-";
  const d = new Date((n > 1e12 ? n / 1000 : n) * 1000);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(tanpaJam ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
};

export const rupiahRad = (n?: number | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n) || 0);

// ── Ruang pemeriksaan & alat (jam/hari operasional, durasi slot penjadwalan)
export const HARI_RAD = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
export const OPSI_HARI_RAD = HARI_RAD.map((label, value) => ({ value, label })).filter((h) => h.value);
export interface RuangRad {
  uuid: string;
  kode: string;
  nama: string;
  modalitas: string[];
  namaAlat?: string | null;
  jamBuka: string;
  jamTutup: string;
  hariOperasional: number[];
  durasiSlot: number;
  keterangan?: string | null;
  status: boolean;
  jadwalAktif?: number;
}
export const daftarRuangRad = (params: { page?: number; limit?: number; cari?: string; modalitas?: string | string[]; status?: string } = {}) =>
  apiPenunjangGet(`/radiologi/ruang${qs(params)}`);
export const simpanRuangRad = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/radiologi/ruang/${uuid}`, data) : apiPenunjangPost("/radiologi/ruang", data);
export const hapusRuangRad = (uuid: string) => apiPenunjangDelete(`/radiologi/ruang/${uuid}`);

// ── Template expertise (bacaan normal)
export const daftarTemplateRad = (params: { page?: number; limit?: number; cari?: string; modalitas?: string | string[] } = {}) =>
  apiPenunjangGet(`/radiologi/template${qs(params)}`);
export const templateUntukRad = (pemeriksaanUuid: string) => apiPenunjangGet(`/radiologi/template${qs({ untuk_pemeriksaan: pemeriksaanUuid })}`);
export const simpanTemplateRad = (data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/radiologi/template/${uuid}`, data) : apiPenunjangPost("/radiologi/template", data);
export const hapusTemplateRad = (uuid: string) => apiPenunjangDelete(`/radiologi/template/${uuid}`);

// ── Petugas radiologi (dokter pembaca expertise & radiografer)
export const PERAN_PETUGAS_RAD: Record<string, string> = { dokter: "Dokter Radiologi", radiografer: "Radiografer" };
export const daftarPetugasRad = (peran?: string) => apiPenunjangGet(`/radiologi/petugas${qs({ peran })}`);
export const pilihanPetugasRad = (peran: "dokter" | "radiografer") => apiPenunjangGet(`/radiologi/petugas/pilihan${qs({ peran })}`);
export const tambahPetugasRad = (data: { practitionerUuid: string; peran: string; keterangan?: string }) => apiPenunjangPost("/radiologi/petugas", data);
export const ubahPetugasRad = (uuid: string, data: { keterangan?: string; status?: boolean }) => apiPenunjangPut(`/radiologi/petugas/${uuid}`, data);
export const hapusPetugasRad = (uuid: string) => apiPenunjangDelete(`/radiologi/petugas/${uuid}`);
export const daftarPraktisiRad = () => apiPenunjangGet("/radiologi/referensi/praktisi");

// ── Penjadwalan pemeriksaan per ruang
export type StatusJadwalRad = "terjadwal" | "hadir" | "diperiksa" | "batal";
export const STATUS_JADWAL_RAD: Record<StatusJadwalRad, { label: string; bg: string; text: string; sel: string }> = {
  terjadwal: { label: "Terjadwal", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]", sel: "bg-info-50 border-info-75" },
  hadir: { label: "Hadir", bg: "bg-[#FEF0C7]", text: "text-[#B54708]", sel: "bg-warning-50 border-warning-75" },
  diperiksa: { label: "Diperiksa", bg: "bg-[#D1FADF]", text: "text-[#027A48]", sel: "bg-success-50 border-success-75" },
  batal: { label: "Batal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]", sel: "bg-grey-50 border-grey-100" },
};
export const noAntreanRad = (kodeRuang?: string | null, n?: number | null) => (n ? `${kodeRuang ?? ""}-${String(n).padStart(3, "0")}` : "-");
export const papanJadwalRad = (tanggal: string, modalitas?: string[]) => apiPenunjangGet(`/radiologi/jadwal/papan${qs({ tanggal, modalitas })}`);
export const daftarJadwalRad = (params: Record<string, any> = {}) => apiPenunjangGet(`/radiologi/jadwal${qs(params)}`);
export const menungguJadwalRad = (cari?: string) => apiPenunjangGet(`/radiologi/jadwal/menunggu${qs({ cari })}`);
export const buatJadwalRad = (data: {
  orderUuid: string;
  itemUuids?: string[];
  ruangUuid: string;
  tanggal?: string;
  jamMulai?: string;
  segera?: boolean;
  catatan?: string;
}) => apiPenunjangPost("/radiologi/jadwal", data);
export const ubahJadwalRad = (uuid: string, data: { ruangUuid?: string; tanggal?: string; jamMulai?: string; segera?: boolean; catatan?: string }) =>
  apiPenunjangPut(`/radiologi/jadwal/${uuid}`, data);
export const hadirJadwalRad = (uuid: string) => apiPenunjangPost(`/radiologi/jadwal/${uuid}/hadir`);
export const batalJadwalRad = (uuid: string, alasan: string) => apiPenunjangPost(`/radiologi/jadwal/${uuid}/batal`, { alasan });

// ── Bridging PACS/RIS (fitur rad_bridging_pacs) — pola sama dengan Bridging LIS Laboratorium.
export const STATUS_KIRIM_PACS: Record<string, { label: string; bg: string; text: string }> = {
  baru: { label: "Baru", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  mengirim: { label: "Sedang dikirim", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  terkirim: { label: "Terkirim", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  gagal: { label: "Gagal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  tidak_pasti: { label: "Tidak pasti (perlu Cek Status)", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
};

export const daftarKoneksiPacs = (hanyaAktif = false) => apiPenunjangGet(`/radiologi/pacs/koneksi${qs({ aktif: hanyaAktif ? 1 : undefined })}`);
export const simpanKoneksiPacs = (uuid: string | null, data: Record<string, any>) =>
  uuid ? apiPenunjangPut(`/radiologi/pacs/koneksi/${uuid}`, data) : apiPenunjangPost("/radiologi/pacs/koneksi", data);
export const hapusKoneksiPacs = (uuid: string) => apiPenunjangDelete(`/radiologi/pacs/koneksi/${uuid}`);
export const jadikanBawaanPacs = (uuid: string) => apiPenunjangPost(`/radiologi/pacs/koneksi/${uuid}/bawaan`);
export const kunciMasukBaruPacs = (uuid: string) => apiPenunjangPost(`/radiologi/pacs/koneksi/${uuid}/kunci-masuk`);
export const ujiKoneksiPacs = (uuid: string) => apiPenunjangPost(`/radiologi/pacs/koneksi/${uuid}/uji`);

// ── Mapping PACS: tindakan (pemeriksaan → kode prosedur & modalitas PACS)
export const daftarMappingTindakanPacs = (params: { cari?: string; belumDipetakan?: boolean } = {}) =>
  apiPenunjangGet(`/radiologi/pacs/mapping/tindakan${qs({ cari: params.cari, belum_dipetakan: params.belumDipetakan ? 1 : undefined })}`);
export const simpanMappingTindakanPacs = (pemeriksaanUuid: string, data: { kodeProsedurPacs: string; modalitasPacs: string }) =>
  apiPenunjangPut(`/radiologi/pacs/mapping/tindakan/${pemeriksaanUuid}`, { kode_prosedur_pacs: data.kodeProsedurPacs, modalitas_pacs: data.modalitasPacs });

// ── Mapping PACS: unit asal / dokter pengirim / penjamin → kode PACS
export const daftarMappingRefPacs = () => apiPenunjangGet("/radiologi/pacs/mapping/referensi");
export const simpanMappingRefPacs = (jenis: "unit" | "dokter" | "penjamin", refUuid: string, data: { kodePacs: string; namaPacs?: string | null }) =>
  apiPenunjangPut(`/radiologi/pacs/mapping/referensi/${jenis}/${refUuid}`, { kode_pacs: data.kodePacs, nama_pacs: data.namaPacs ?? null });

// ── Mapping PACS: ruang/alat → AE Title (data referensi worklist)
export const daftarMappingRuangPacs = (params: { cari?: string; belumDipetakan?: boolean } = {}) =>
  apiPenunjangGet(`/radiologi/pacs/mapping/ruang${qs({ cari: params.cari, belum_dipetakan: params.belumDipetakan ? 1 : undefined })}`);
export const simpanMappingRuangPacs = (ruangUuid: string, aeTitle: string | null) =>
  apiPenunjangPut(`/radiologi/pacs/mapping/ruang/${ruangUuid}`, { ae_title: aeTitle });

// ── Riwayat pengiriman & aksi validasi/kirim per order atau item
export const daftarPengirimanPacs = (params: { page?: number; limit?: number; status?: string } = {}) =>
  apiPenunjangGet(`/radiologi/pacs/pengiriman${qs(params)}`);
export const validasiDanKirimPacs = (orderUuid: string, koneksiUuid: string | null = null) =>
  apiPenunjangPost(`/radiologi/pacs/order/${orderUuid}/validasi-kirim`, koneksiUuid ? { koneksi_uuid: koneksiUuid } : {}, true);
export const kirimUlangItemPacs = (itemUuid: string, koneksiUuid: string | null = null) =>
  apiPenunjangPost(`/radiologi/pacs/order-item/${itemUuid}/kirim`, koneksiUuid ? { koneksi_uuid: koneksiUuid } : {}, true);
export const cekStatusItemPacs = (itemUuid: string) => apiPenunjangPost(`/radiologi/pacs/order-item/${itemUuid}/cek-status`);
export const ambilHasilItemPacs = (itemUuid: string) => apiPenunjangPost(`/radiologi/pacs/order-item/${itemUuid}/ambil-hasil`);
