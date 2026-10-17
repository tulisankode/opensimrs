// API modul Mikrobiologi Klinik (penunjang-service: /api/v3/penunjang/mikrobiologi). Request otomatis snake_case,
// respons camelCase; galat → toast + undefined (lihat apiHandler).
import { apiPenunjangDelete, apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";
export { keTanggal, rupiahRad as rupiahMikro, umurRad as umurMikro, waktuRad as waktuMikro } from "@/stores/penunjang/radiologi";

export type StatusOrderMikro = "order" | "valid" | "diproses" | "selesai" | "batal";
export type StatusItemMikro = "menunggu" | "diterima" | "ditolak" | "diproses" | "sementara" | "selesai";
type Gaya = { label: string; bg: string; text: string };

export const STATUS_ORDER_MIKRO: Record<StatusOrderMikro, Gaya> = {
  order: { label: "Order", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  valid: { label: "Valid", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  diproses: { label: "Diproses", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  selesai: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  batal: { label: "Batal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_ITEM_MIKRO: Record<StatusItemMikro, Gaya> = {
  menunggu: { label: "Menunggu Spesimen", bg: "bg-[#D4D8DC]", text: "text-[#475467]" },
  diterima: { label: "Spesimen Diterima", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  ditolak: { label: "Spesimen Ditolak", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  diproses: { label: "Diproses", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  sementara: { label: "Laporan Sementara", bg: "bg-[#EBE9FE]", text: "text-[#5925DC]" },
  selesai: { label: "Final", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
};
export const gayaOrderMikro = (s?: string) => STATUS_ORDER_MIKRO[s as StatusOrderMikro];
export const gayaItemMikro = (s?: string) => STATUS_ITEM_MIKRO[s as StatusItemMikro];

export const SUMBER_MIKRO: Record<string, string> = { rme: "RME", aps: "APS" };
export const PELAYANAN_MIKRO: Record<string, string> = { rajal: "Rawat Jalan", ranap: "Rawat Inap", igd: "IGD", aps: "APS" };

// Sama dengan penunjang-service src/mikrobiologi/bersama.js.
export const SPESIMEN_MIKRO: Record<string, string> = {
  darah: "Darah",
  urin: "Urin",
  sputum: "Sputum",
  pus: "Pus",
  swab_luka: "Swab Luka",
  feses: "Feses / Rectal Swab",
  lcs: "Cairan Otak (LCS)",
  cairan_tubuh: "Cairan Tubuh Steril (pleura, asites, sendi)",
  swab_tenggorok: "Swab Tenggorok",
  swab_nasofaring: "Swab Nasofaring",
  bilasan_bronkus: "Bilasan Bronkus (BAL)",
  jaringan: "Jaringan / Biopsi",
  ujung_kateter: "Ujung Kateter",
  swab_vagina: "Swab Vagina / Serviks",
  swab_uretra: "Swab Uretra",
  kerokan_kulit: "Kerokan Kulit / Kuku / Rambut",
  swab_mata: "Swab Mata / Konjungtiva",
  swab_telinga: "Swab Telinga",
  lain: "Lainnya",
};
export const KELOMPOK_MIKRO: Record<string, string> = {
  ENTEROBACTERALES: "Enterobacterales",
  PSEUDOMONAS: "Pseudomonas aeruginosa",
  ACINETOBACTER: "Acinetobacter spp.",
  NONFERMENTER: "Batang Gram negatif non-fermenter lain",
  STAPHYLOCOCCUS: "Staphylococcus spp.",
  ENTEROCOCCUS: "Enterococcus spp.",
  STREPTOCOCCUS: "Streptococcus spp.",
  PNEUMOCOCCUS: "Streptococcus pneumoniae",
  HAEMOPHILUS: "Haemophilus spp.",
  ANAEROB: "Anaerob",
  JAMUR: "Jamur (Candida/kapang)",
  MIKOBAKTERIA: "Mycobacterium",
  LAIN: "Lainnya",
};
export const GRAM_MIKRO: Record<string, string> = { positif: "Gram positif", negatif: "Gram negatif", jamur: "Jamur", bta: "Bakteri tahan asam", lain: "Lainnya" };
export const BENTUK_MIKRO: Record<string, string> = { batang: "Batang", kokus: "Kokus", kokobasil: "Kokobasil", spiral: "Spiral", ragi: "Ragi (yeast)", kapang: "Kapang (mold)", lain: "Lainnya" };
export const JENIS_MIKRO: Record<string, string> = { kultur: "Kultur", pewarnaan: "Pewarnaan / Mikroskopis", molekuler: "Molekuler", serologi: "Serologi / Antigen", lain: "Lainnya" };
export const PEWARNAAN_MIKRO: Record<string, string> = { gram: "Pewarnaan Gram", bta: "Pewarnaan BTA (Ziehl-Neelsen)", koh: "Sediaan KOH", tinta_india: "Tinta India", lain: "Pewarnaan lain" };
export const KULTUR_MIKRO: Record<string, string> = {
  dalam_proses: "Dalam proses inkubasi",
  tidak_tumbuh: "Tidak tumbuh",
  tumbuh: "Tumbuh",
  kontaminan: "Kontaminan",
  flora_normal: "Flora normal",
};
export const PENANDA_MIKRO: Record<string, string> = {
  ESBL: "Extended-Spectrum β-Lactamase",
  MRSA: "Methicillin-Resistant S. aureus",
  MRCNS: "Methicillin-Resistant CoNS",
  CRE: "Carbapenem-Resistant Enterobacterales",
  CRAB: "Carbapenem-Resistant A. baumannii",
  CRPA: "Carbapenem-Resistant P. aeruginosa",
  VRE: "Vancomycin-Resistant Enterococcus",
  MDR: "Multidrug-Resistant",
  XDR: "Extensively Drug-Resistant",
  PDR: "Pandrug-Resistant",
};
// Skala semikuantitatif sel/organisme pada sediaan langsung.
export const SKALA_SEL = ["Tidak ditemukan", "Jarang (<1/LPB)", "+1", "+2", "+3", "+4"];
export const SKALA_BTA = ["Negatif", "Scanty (1–9/100 LP)", "+1", "+2", "+3"];
export const JUMLAH_KOLONI = ["<10^3 CFU/mL", "10^3 CFU/mL", "10^4 CFU/mL", "≥10^5 CFU/mL", "Sedikit (+1)", "Sedang (+2)", "Banyak (+3)", "Sangat banyak (+4)"];

export const opsi = (obj: Record<string, string>) => Object.entries(obj).map(([value, label]) => ({ value, label }));
export const namaSpesimen = (kode?: string | null) => (kode ? SPESIMEN_MIKRO[kode] ?? kode : "-");

// Izin aksi modul (tanpa daftar izin = super admin → boleh; backend tetap memeriksa login).
export const izinMikro = (submodul: string, aksi: string, fitur?: string) =>
  !getStoredPermissions().length || hasPermission("Mikrobiologi", submodul, aksi, fitur ?? null);

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
    q.append(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

// ── Master (pemeriksaan / organisme / antibiotik)
export type MasterMikro = "pemeriksaan" | "organisme" | "antibiotik";
export const daftarMasterMikro = (jenis: MasterMikro, params: Record<string, any> = {}) => apiPenunjangGet(`/mikrobiologi/${jenis}${qs(params)}`);
export const simpanMasterMikro = (jenis: MasterMikro, data: Record<string, any>, uuid?: string) =>
  uuid ? apiPenunjangPut(`/mikrobiologi/${jenis}/${uuid}`, data) : apiPenunjangPost(`/mikrobiologi/${jenis}`, data);
export const hapusMasterMikro = (jenis: MasterMikro, uuid: string) => apiPenunjangDelete(`/mikrobiologi/${jenis}/${uuid}`);

// ── Panel antibiotik per kelompok organisme
export const ringkasanPanelMikro = () => apiPenunjangGet("/mikrobiologi/panel");
export const panelKelompokMikro = (kelompok: string) => apiPenunjangGet(`/mikrobiologi/panel${qs({ kelompok })}`);
export const panelOrganismeMikro = (organismeUuid: string) => apiPenunjangGet(`/mikrobiologi/panel/organisme/${organismeUuid}`);
export const simpanPanelMikro = (kelompok: string, items: Record<string, any>[]) => apiPenunjangPut(`/mikrobiologi/panel/${kelompok}`, { items });

// ── Order
export interface ItemOrderMikroInput {
  pemeriksaanUuid: string;
  jenisSpesimen: string;
  lokasiSpesimen?: string;
}
export const daftarOrderMikro = (params: Record<string, any> = {}) => apiPenunjangGet(`/mikrobiologi/order${qs(params)}`);
export const detailOrderMikro = (uuid: string) => apiPenunjangGet(`/mikrobiologi/order/${uuid}`);
export const orderKunjunganMikro = (params: { rekamMedisUuid?: string; noReg?: string; patientUuid?: string }) =>
  apiPenunjangGet(`/mikrobiologi/order/kunjungan${qs({ rekam_medis_uuid: params.rekamMedisUuid, no_reg: params.noReg, patient_uuid: params.patientUuid })}`);
export const buatOrderMikro = (data: {
  sumber: "rme" | "aps";
  patientUuid?: string;
  rekamMedisUuid?: string;
  noReg?: string;
  dokterPengirimUuid?: string | null;
  paymentMethod?: number;
  klinis?: string;
  antibiotikSedang?: string;
  catatan?: string;
  cito?: boolean;
  items: ItemOrderMikroInput[];
}) => apiPenunjangPost("/mikrobiologi/order", data);
export const validasiOrderMikro = (uuid: string, aksi: "validasi_saja" | "validasi_kirim" = "validasi_saja", koneksiUuid?: string) =>
  apiPenunjangPost(`/mikrobiologi/order/${uuid}/validasi`, { aksi, koneksi_uuid: koneksiUuid });
export const batalOrderMikro = (uuid: string, alasan: string) => apiPenunjangPost(`/mikrobiologi/order/${uuid}/batal`, { alasan });

// ── Pemeriksaan (worklist per spesimen) & hasil
export const worklistMikro = (params: Record<string, any> = {}) => apiPenunjangGet(`/mikrobiologi/worklist${qs(params)}`);
export const detailItemMikro = (uuid: string) => apiPenunjangGet(`/mikrobiologi/item/${uuid}`);
export const terimaSpesimenMikro = (uuid: string, data: Record<string, any>) => apiPenunjangPost(`/mikrobiologi/item/${uuid}/terima`, data);
export const tolakSpesimenMikro = (uuid: string, alasan: string) => apiPenunjangPost(`/mikrobiologi/item/${uuid}/tolak`, { alasan });
export const simpanHasilMikro = (uuid: string, data: Record<string, any>, diam = false) => apiPenunjangPut(`/mikrobiologi/item/${uuid}/hasil`, data, diam);
export const laporanSementaraMikro = (uuid: string, laporanSementara: string) => apiPenunjangPost(`/mikrobiologi/item/${uuid}/sementara`, { laporanSementara });
export const verifikasiMikro = (uuid: string, data: { dokterMikroUuid: string; kesimpulan?: string }) => apiPenunjangPost(`/mikrobiologi/item/${uuid}/verifikasi`, data);
export const bukaVerifikasiMikro = (uuid: string, alasan: string) => apiPenunjangPost(`/mikrobiologi/item/${uuid}/buka-verifikasi`, { alasan });

// ── Laporan & referensi
export const laporanKunjunganMikro = (tanggalMulai: string, tanggalSelesai: string) =>
  apiPenunjangGet(`/mikrobiologi/laporan/kunjungan${qs({ tanggal_mulai: tanggalMulai, tanggal_selesai: tanggalSelesai })}`);
export const laporanAntibiogramMikro = (params: Record<string, any>) => apiPenunjangGet(`/mikrobiologi/laporan/antibiogram${qs(params)}`);
export const cariPasienMikro = (cari: string) => apiPenunjangGet(`/mikrobiologi/referensi/pasien${qs({ cari })}`);
export const daftarDokterMikro = () => apiPenunjangGet("/mikrobiologi/referensi/dokter");

// ── Bridging LIS Mikrobiologi (STD-0014) — fitur mikro_bridging_lis, /mikrobiologi/lis/...
export const daftarKoneksiLisMikro = () => apiPenunjangGet("/mikrobiologi/lis/koneksi");
export const simpanKoneksiLisMikro = (uuid: string | null, data: Record<string, any>) =>
  uuid ? apiPenunjangPut(`/mikrobiologi/lis/koneksi/${uuid}`, data) : apiPenunjangPost("/mikrobiologi/lis/koneksi", data);
export const jadikanBawaanLisMikro = (uuid: string) => apiPenunjangPut(`/mikrobiologi/lis/koneksi/${uuid}/bawaan`);
export const buatUlangKunciMasukLisMikro = (uuid: string) => apiPenunjangPost(`/mikrobiologi/lis/koneksi/${uuid}/kunci-masuk`);
export const hapusKoneksiLisMikro = (uuid: string) => apiPenunjangDelete(`/mikrobiologi/lis/koneksi/${uuid}`);
export const ujiKoneksiLisMikro = (uuid: string) => apiPenunjangPost(`/mikrobiologi/lis/koneksi/${uuid}/uji`);

export type JenisPemetaanLisMikro = "pemeriksaan" | "spesimen" | "organisme" | "antibiotik" | "unit" | "dokter" | "penjamin";
export const daftarPemetaanLisMikro = (jenis: JenisPemetaanLisMikro) => apiPenunjangGet(`/mikrobiologi/lis/pemetaan${qs({ jenis })}`);
export const simpanPemetaanLisMikro = (jenis: JenisPemetaanLisMikro, items: Record<string, any>[]) =>
  apiPenunjangPut(`/mikrobiologi/lis/pemetaan/${jenis}`, { items });

export const daftarPengirimanLisMikro = (params: Record<string, any> = {}) => apiPenunjangGet(`/mikrobiologi/lis/pengiriman${qs(params)}`);
export const statusKirimOrderMikro = (orderUuid: string) => apiPenunjangGet(`/mikrobiologi/lis/kirim/${orderUuid}`);
export const kirimOrderMikroLis = (orderUuid: string, koneksiUuid?: string) => apiPenunjangPost(`/mikrobiologi/lis/kirim/${orderUuid}`, { koneksi_uuid: koneksiUuid });
export const cekStatusKirimOrderMikro = (orderUuid: string) => apiPenunjangPost(`/mikrobiologi/lis/kirim/${orderUuid}/cek-status`);
export const tarikHasilLisMikro = (orderUuid: string) => apiPenunjangPost(`/mikrobiologi/lis/tarik/${orderUuid}`);

// Epoch detik ⇄ Date untuk input waktu.
export const keEpoch = (d?: Date | null) => (d ? Math.floor(d.getTime() / 1000) : undefined);
export const dariEpoch = (n?: number | null) => (n ? new Date(Number(n) * 1000) : null);
