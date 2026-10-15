import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Host tambahan (mis. domain staging) lewat env ALLOWED_HOSTS="a.example.com,b.example.com"
const extraHosts = (process.env.ALLOWED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean)

// https://vitejs.dev/config/
export default defineConfig({
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
})
