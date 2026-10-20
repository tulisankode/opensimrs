<script setup lang="ts">
// Pesan hasil, galat, dan status proses halaman PICU.
defineProps<{ gagal?: string; pesan?: string; sibuk?: boolean }>();
</script>

<template>
  <div v-if="gagal || pesan || sibuk" class="flex flex-col gap-2">
    <p v-if="gagal" role="alert" class="px-3 py-2 text-sm font-semibold rounded-lg bg-danger-50 text-danger-400">{{ gagal }}</p>
    <p v-if="pesan" role="status" class="px-3 py-2 text-sm font-semibold rounded-lg bg-success-50 text-success-400">{{ pesan }}</p>
    <p v-if="sibuk" role="status" class="text-sm text-grey-400">Sedang memproses permintaan…</p>
  </div>
</template>
