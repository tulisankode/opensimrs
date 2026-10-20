import { defineStore } from "pinia";
import { apiRawatInapGet, apiRawatInapPost } from "@/utils/apiHandler";

export interface KolomPicu { kode: string; nama: string; tipe: "angka" | "teks"; satuan: string; wajib: boolean }
export interface KonfigurasiPicu { uuid: string; nama: string; jenis: string; status: string; definisi: KolomPicu[]; referensiPenetapan?: string }

// Data klinis hanya berada dalam memori halaman. Store menyimpan fungsi API tanpa persistensi.
export const usePicuStore = defineStore("picu", () => {
  async function get(path: string, query: Record<string, string | number> = {}) {
    const params = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
    const res = await apiRawatInapGet(`/picu/${path}${params.size ? `?${params}` : ""}`, {});
    if (!res?.payload) throw new Error("Data PICU belum dapat dimuat.");
    return res.payload;
  }
  async function post(path: string, data: object, kunci: string) {
    const res = await apiRawatInapPost(`/picu/${path}`, data, { headers: { "Idempotency-Key": kunci } });
    if (!res?.payload) throw new Error("Perubahan belum terkonfirmasi. Coba kembali untuk memeriksa hasil permintaan yang sama.");
    return res.payload;
  }
  return { get, post };
});
