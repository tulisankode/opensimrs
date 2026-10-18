import { defineStore } from "pinia";
import { apiBpjsDelete, apiBpjsGet, apiBpjsPost, apiBpjsPut } from "@/utils/apiHandler";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";

// Integrasi BPJS VClaim / SEP (bpjs-service, /api/v3/bpjs/vclaim)
export type JenisSuratVclaim = "rencana-kontrol" | "spri";

// Status pemantauan surat (bpjs-service/src/vclaim-surat.js#statusPemantauan) → label & warna chip
export const STATUS_SURAT: Record<string, { label: string; bg: string; teks: string }> = {
  aktif: { label: "Aktif", bg: "bg-[#D1FADF]", teks: "text-[#027A48]" },
  jatuh_tempo: { label: "Jatuh tempo", bg: "bg-[#FEF0C7]", teks: "text-[#B54708]" },
  digunakan: { label: "Sudah dipakai SEP", bg: "bg-opensimrs-50", teks: "text-opensimrs-300" },
  diajukan: { label: "Diajukan", bg: "bg-[#F2F4F7]", teks: "text-[#344054]" },
  gagal: { label: "Gagal", bg: "bg-[#FDE2E1]", teks: "text-[#B42318]" },
  tidak_pasti: { label: "Tidak pasti", bg: "bg-[#FEF0C7]", teks: "text-[#B42318]" },
  dihapus: { label: "Dihapus", bg: "bg-[#FDE2E1]", teks: "text-[#B42318]" },
};

// Izin Admisi › Rencana Kontrol & SPRI. Tanpa daftar izin (super admin) tombol ditampilkan; bpjs-service tetap memeriksa.
export const bolehSurat = (aksi: string) => !getStoredPermissions().length || hasPermission("Admisi", "Rencana Kontrol & SPRI", aksi);
export const useBpjsVclaimStore = defineStore({
  id: "bpjsVclaim",
  state: () => ({}),
  actions: {
    async getKonfigurasi() {
      return apiBpjsGet("/vclaim/konfigurasi");
    },
    async simpanKonfigurasi(payload: Record<string, unknown>) {
      return apiBpjsPut("/vclaim/konfigurasi", payload);
    },
    async ujiKoneksi() {
      return apiBpjsPost("/vclaim/uji-koneksi");
    },
    async cekPeserta(nomor: string, tgl = "") {
      return apiBpjsGet(`/vclaim/peserta/${encodeURIComponent(nomor)}${tgl ? `?tgl=${tgl}` : ""}`);
    },
    async getRujukan(noKartu: string) {
      return apiBpjsGet(`/vclaim/rujukan/${encodeURIComponent(noKartu)}`);
    },
    async getReferensi(jenis: "diagnosa" | "poli" | "dokter", params: Record<string, string> = {}) {
      const query = new URLSearchParams(params).toString();
      return apiBpjsGet(`/vclaim/referensi/${jenis}${query ? `?${query}` : ""}`);
    },
    async getPasien(noKartu: string) {
      return apiBpjsGet(`/vclaim/pasien/${encodeURIComponent(noKartu)}`);
    },
    async getSep({ page = 1, limit = 10, q = "", status = "aktif", sumber = "" }) {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), q, status, sumber });
      return apiBpjsGet(`/vclaim/sep?${params.toString()}`);
    },
    async buatSep(payload: Record<string, unknown>) {
      return apiBpjsPost("/vclaim/sep", payload);
    },
    async hapusSep(noSep: string) {
      return apiBpjsDelete(`/vclaim/sep/${encodeURIComponent(noSep)}`);
    },
    async getPemetaanPoli() {
      return apiBpjsGet("/vclaim/pemetaan-poli");
    },
    async simpanPemetaanPoli(poli: { uuid: string; kdPoliVclaim: string | null }[]) {
      return apiBpjsPut("/vclaim/pemetaan-poli", { poli });
    },
    // --- Rencana Kontrol & SPRI (STD-0021, fitur vclaim_rencana_kontrol) ---------------------------------
    // jenis: "rencana-kontrol" | "spri" (segmen URL bpjs-service)
    async getSurat(jenis: JenisSuratVclaim, filter: Record<string, string | number | undefined> = {}) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filter)) if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
      return apiBpjsGet(`/vclaim/${jenis}${params.toString() ? `?${params.toString()}` : ""}`);
    },
    async getDetailSurat(jenis: JenisSuratVclaim, uuid: string) {
      return apiBpjsGet(`/vclaim/${jenis}/${encodeURIComponent(uuid)}`);
    },
    async buatSurat(jenis: JenisSuratVclaim, payload: Record<string, unknown>) {
      return apiBpjsPost(`/vclaim/${jenis}`, payload);
    },
    async ubahSurat(jenis: JenisSuratVclaim, uuid: string, payload: Record<string, unknown>) {
      return apiBpjsPut(`/vclaim/${jenis}/${encodeURIComponent(uuid)}`, payload);
    },
    async hapusSurat(jenis: JenisSuratVclaim, uuid: string) {
      return apiBpjsDelete(`/vclaim/${jenis}/${encodeURIComponent(uuid)}`);
    },
    // Rekonsiliasi surat berstatus tidak pasti; noSurat dipilih operator bila VClaim mengembalikan beberapa kandidat
    async cekStatusSurat(jenis: JenisSuratVclaim, uuid: string, noSurat = "") {
      return apiBpjsPost(`/vclaim/${jenis}/${encodeURIComponent(uuid)}/cek-status`, noSurat ? { noSurat } : {});
    },
  },
});
