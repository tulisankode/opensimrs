import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Host tambahan (mis. domain staging/tunnel) lewat ALLOWED_HOSTS="a.example.com,b.example.com", dari environment
  // atau dari berkas .env* frontend (install.sh --domain menulisnya ke .env.local).
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')
  const extraHosts = (process.env.ALLOWED_HOSTS ?? env.ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean)

  return {
    plugins: [
      vue(),
    ],
    server: {
      host: '0.0.0.0',
      port: 5520,
      allowedHosts: ["localhost", "127.0.0.1", ...extraHosts]
    },
    preview: {
      host: "0.0.0.0",   // sama juga untuk preview
      port: 5520,
      allowedHosts: ["localhost", "127.0.0.1", ...extraHosts],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }
})
