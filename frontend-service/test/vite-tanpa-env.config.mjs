import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

// Khusus verifikasi kompilasi; tidak membaca berkas lingkungan atau menggantikan konfigurasi penerapan.
export default defineConfig({
  envDir: false,
  plugins: [vue()],
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
});
