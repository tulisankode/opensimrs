// Ekstensi tanpa kode yang terpasang (laporan-service GET /ekstensi). Disimpan di localStorage agar menu atas tahu
// apakah perlu menampilkan menu "Ekstensi" tanpa menunggu permintaan.
import { defineStore } from "pinia";
import { apiEkstensi } from "@/utils/apiHandler";

const KUNCI = "ekstensi_terpasang";
export const EVENT_EKSTENSI = "ekstensi-berubah";

const bacaCache = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem(KUNCI) ?? "[]");
  } catch {
    return [];
  }
};

export const adaEkstensi = () => bacaCache().length > 0;

export const useEkstensiStore = defineStore("ekstensi", {
  state: () => ({ daftar: bacaCache() as any[], memuat: false }),
});

export const muatEkstensi = async () => {
  const store = useEkstensiStore();
  store.memuat = true;
  const res = await apiEkstensi("laporan", "get", "/ekstensi", {}, true);
  store.memuat = false;
  if (!res) return store.daftar;
  const sebelum = store.daftar.length;
  store.daftar = res.payload ?? [];
  localStorage.setItem(KUNCI, JSON.stringify(store.daftar));
  if (Boolean(sebelum) !== Boolean(store.daftar.length)) window.dispatchEvent(new Event(EVENT_EKSTENSI));
  return store.daftar;
};
