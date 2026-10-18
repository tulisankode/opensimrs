// SIMRS Studio (mode pengembang berbasis AI) — lihat docs/rancangan/STUDIO-PENGEMBANG.md.
// Status dibaca dari studio-service (GET /status) lalu disimpan di localStorage agar menu & guard router dapat
// memeriksanya secara sinkron. Penegakan sebenarnya ada di backend.
import { defineStore } from "pinia";
import { apiStudioGet, apiStudioPut } from "@/utils/apiHandler";
import { getStoredPermissions } from "@/utils/permissions";

const KUNCI = "simrs_studio_mode";
export const EVENT_STUDIO = "simrs-studio-berubah";
export const MODUL_IZIN = "SIMRS Studio";

export interface StatusStudio {
  tersedia: boolean;
  modeAktif?: boolean; // hanya untuk superadmin (Setting › System)
  aktif: boolean; // Mode Pengembang aktif DAN pengguna punya akses Studio
  superadmin: boolean;
  beku: boolean;
  lingkungan: string;
  izin: "*" | Record<string, string[]>;
  fitur: Record<string, boolean>;
  diubahOleh: string | null;
  diubahPada: number | null;
  terjangkau: boolean;
}

const KOSONG: StatusStudio = {
  tersedia: false, aktif: false, superadmin: false, beku: false, lingkungan: "", izin: {}, fitur: {}, diubahOleh: null, diubahPada: null, terjangkau: false,
};

const bacaCache = (): StatusStudio => {
  try {
    const s = localStorage.getItem(KUNCI);
    if (s) return { ...KOSONG, ...JSON.parse(s) };
  } catch {
    /* abaikan cache rusak */
  }
  return { ...KOSONG };
};

export const isSuperadmin = () => {
  try {
    return JSON.parse(localStorage.getItem("user") ?? "{}").role === "super admin";
  } catch {
    return false;
  }
};

// Perlu memeriksa studio-service? (superadmin, atau peran yang diberi modul izin SIMRS Studio)
export const mungkinPunyaAkses = () =>
  isSuperadmin() || getStoredPermissions().some((m) => String(m.module).toLowerCase() === MODUL_IZIN.toLowerCase());

// Dipakai guard router & menu atas (sinkron). Cache status hanya dimuat ulang untuk pengguna yang mungkin berakses,
// jadi akses pengguna saat ini diperiksa lagi di sini: cache sisa sesi superadmin sebelumnya di peramban yang sama
// tidak boleh memunculkan menu bagi pengguna lain.
export const studioAktif = () => mungkinPunyaAkses() && bacaCache().aktif;

// Hapus cache status saat login/logout agar status pengguna sebelumnya tidak terbawa.
export const bersihkanStatusStudio = () => {
  try {
    localStorage.removeItem(KUNCI);
  } catch {
    /* abaikan */
  }
};

// Hak aksi Studio dari cache status: boleh("PRD", "SETUJUI")
export const bolehStudio = (submodul: string, aksi: string | string[]) => {
  const izin = bacaCache().izin;
  if (izin === "*") return true;
  const daftar = (izin as Record<string, string[]>)[submodul] ?? [];
  return ([] as string[]).concat(aksi).some((a) => daftar.includes(a.toUpperCase()));
};

export const useSimrsStudioStore = defineStore("simrsStudio", {
  state: () => ({ status: bacaCache() as StatusStudio }),
  getters: {
    boleh: (state) => (submodul: string, aksi: string | string[]) => {
      if (state.status.izin === "*") return true;
      const daftar = (state.status.izin as Record<string, string[]>)[submodul] ?? [];
      return ([] as string[]).concat(aksi).some((a) => daftar.includes(a.toUpperCase()));
    },
  },
  actions: {
    simpanCache(status: StatusStudio) {
      const berubah = status.aktif !== this.status.aktif;
      this.status = status;
      localStorage.setItem(KUNCI, JSON.stringify(status));
      if (berubah) window.dispatchEvent(new Event(EVENT_STUDIO));
    },
    async muat() {
      if (!mungkinPunyaAkses()) return this.simpanCache({ ...KOSONG });
      const res = await apiStudioGet("/status", true);
      this.simpanCache(res?.payload ? { ...KOSONG, ...res.payload, terjangkau: true } : { ...KOSONG });
    },
    async setAktif(aktif: boolean) {
      const res = await apiStudioPut("/status", { aktif });
      if (res) await this.muat();
      return Boolean(res);
    },
  },
});
