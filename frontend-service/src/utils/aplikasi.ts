// Instance aplikasi Vue untuk modul non-komponen (mis. toast di apiHandler, pratinjau PDF). Diisi main.ts.
// Jangan mengimpor "@/main" dari modul lain: main → router → halaman → apiHandler → main membentuk import melingkar,
// dan saat Vite memuat main.ts dua kali (cap waktu ?t= berbeda setelah router berubah) aplikasi menjadi layar putih
// "Cannot access 'router' before initialization". Dicegah scripts/cek-integritas.mjs.
import type { App } from "vue";

// Binding hidup (live binding): pengimpor selalu melihat nilai terbaru setelah setAplikasi dipanggil.
export let app: App;

export const setAplikasi = (instance: App) => {
  app = instance;
};
