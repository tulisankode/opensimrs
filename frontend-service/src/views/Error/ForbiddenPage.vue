<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";

const router = useRouter();
const route = useRoute();
// ?modul=… dikirim guard router bila halaman milik modul yang tidak aktif untuk faskes ini.
const modul = typeof route.query.modul === "string" ? route.query.modul : "";
</script>

<template>
  <main class="flex h-screen items-center justify-center bg-slate-50 px-6">
    <section class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
      <p class="text-sm font-semibold text-opensimrs-300">403</p>
      <h1 class="mt-2 text-xl font-semibold text-slate-900">{{ modul ? "Modul tidak aktif" : "Akses ditolak" }}</h1>
      <p v-if="modul" class="mt-2 text-sm text-slate-600">
        Modul <b>{{ modul }}</b> tidak aktif untuk faskes ini. Superadmin dapat mengaktifkannya di
        Setting › Manajemen Modul.
      </p>
      <p v-else class="mt-2 text-sm text-slate-600">
        Akun Anda tidak memiliki permission untuk membuka halaman ini.
      </p>
      <button
        class="mt-5 rounded-md bg-opensimrs-300 px-4 py-2 text-sm font-semibold text-white"
        type="button"
        @click="router.push('/dashboard')"
      >
        Kembali ke Dashboard
      </button>
    </section>
  </main>
</template>
