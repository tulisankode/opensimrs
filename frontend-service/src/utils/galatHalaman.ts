// Penampung galat terakhir per halaman untuk Asisten Pengembang (superadmin + Mode Pengembang): galat API (metode, path
// tanpa query, status, pesan respons) dan galat console. Tanpa body permintaan/respons maupun nilai parameter; hanya
// dikumpulkan saat Asisten bisa dipakai. Rancangan: docs/rancangan/STUDIO-ASISTEN-KONTEKS.md.
import { ref } from "vue";
import { isSuperadmin, studioAktif } from "@/stores/simrsStudio";
import * as Api from "@/utils/Api";

export interface GalatHalaman {
  jenis: "api" | "console";
  halaman: string;
  metode?: string;
  path?: string;
  status?: number | null;
  pesan: string;
  sumber?: string;
  waktu: number;
}

const BATAS = 30;
export const daftarGalat = ref<GalatHalaman[]>([]);

const aktif = () => {
  try {
    return isSuperadmin() && studioAktif();
  } catch {
    return false;
  }
};
const halamanSekarang = () => window.location.pathname;
const pathTanpaQuery = (url?: string) => {
  if (!url) return "";
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return String(url).split(/[?#]/)[0];
  }
};
const simpan = (g: GalatHalaman) => {
  daftarGalat.value = [...daftarGalat.value, g].slice(-BATAS);
};
const pathPanggilan = (cfg: any) =>
  pathTanpaQuery(cfg?.baseURL && cfg?.url && !/^https?:/i.test(cfg.url) ? `${cfg.baseURL.replace(/\/$/, "")}/${String(cfg.url).replace(/^\//, "")}` : cfg?.url);

// Endpoint yang dipanggil tiap halaman (metode, path tanpa query dengan UUID/angka disamarkan, status terakhir) untuk
// Audit cepat: menautkan halaman ke berkas backend dan menandai 404/403/5xx. Tanpa body maupun parameter.
export interface PanggilanApi {
  halaman: string;
  metode: string;
  path: string;
  status: number | null;
  jumlah: number;
}
const BATAS_PANGGILAN = 300;
const daftarPanggilan: PanggilanApi[] = [];
const samarkan = (p: string) => p.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":uuid").replace(/\/\d{4,}(?=\/|$)/g, "/:id");
export const catatPanggilanApi = (cfg: any, status: number | null) => {
  if (!cfg?.url || !aktif()) return;
  const halaman = halamanSekarang(), metode = String(cfg.method ?? "get").toUpperCase(), path = samarkan(pathPanggilan(cfg));
  const ada = daftarPanggilan.find((p) => p.halaman === halaman && p.metode === metode && p.path === path);
  if (ada) {
    ada.status = status;
    ada.jumlah++;
    return;
  }
  daftarPanggilan.push({ halaman, metode, path, status, jumlah: 1 });
  if (daftarPanggilan.length > BATAS_PANGGILAN) daftarPanggilan.shift();
};
export const panggilanUntukHalaman = (halaman: string) => daftarPanggilan.filter((p) => p.halaman === halaman);

// Dipanggil errorApiHandler (utils/apiHandler.ts) untuk setiap galat API.
export const catatGalatApi = (error: any) => {
  if (!aktif()) return;
  const cfg = error?.config ?? {};
  const pesan = error?.response?.data?.message ?? error?.message ?? "Galat tanpa pesan";
  simpan({
    jenis: "api",
    halaman: halamanSekarang(),
    metode: String(cfg.method ?? "").toUpperCase() || undefined,
    path: pathPanggilan(cfg),
    status: error?.response?.status ?? null,
    pesan: String(pesan).slice(0, 300),
    waktu: Math.floor(Date.now() / 1000),
  });
};

let terpasang = false;
export const pasangPenangkapGalat = () => {
  if (terpasang) return;
  terpasang = true;
  // Pencatat endpoint di semua instance layanan (kecuali Studio sendiri & instance mentah).
  for (const [nama, inst] of Object.entries(Api) as Array<[string, any]>) {
    if (!inst?.interceptors || ["baseInstanceStudio", "baseInstanceMentah"].includes(nama)) continue;
    inst.interceptors.response.use(
      (r: any) => {
        catatPanggilanApi(r.config, r.status);
        return r;
      },
      (e: any) => {
        catatPanggilanApi(e?.config, e?.response?.status ?? null);
        return Promise.reject(e);
      },
    );
  }
  window.addEventListener("error", (e) => {
    if (!aktif() || !e.message) return;
    simpan({ jenis: "console", halaman: halamanSekarang(), pesan: String(e.message).slice(0, 300), sumber: e.filename ? `${pathTanpaQuery(e.filename)}:${e.lineno}` : undefined, waktu: Math.floor(Date.now() / 1000) });
  });
  window.addEventListener("unhandledrejection", (e) => {
    if (!aktif()) return;
    const alasan = e.reason?.message ?? String(e.reason ?? "");
    // Galat axios sudah dicatat lewat errorApiHandler.
    if (!alasan || e.reason?.isAxiosError) return;
    simpan({ jenis: "console", halaman: halamanSekarang(), pesan: alasan.slice(0, 300), waktu: Math.floor(Date.now() / 1000) });
  });
};

export const galatUntukHalaman = (halaman: string) => daftarGalat.value.filter((g) => g.halaman === halaman);
export const hapusGalatHalaman = (halaman: string) => {
  daftarGalat.value = daftarGalat.value.filter((g) => g.halaman !== halaman);
};
