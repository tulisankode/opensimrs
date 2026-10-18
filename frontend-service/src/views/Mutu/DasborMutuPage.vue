<script setup lang="ts">
import { onMounted, ref } from "vue";
import { apiMutuGet } from "@/utils/apiHandler";
const indikator = ref<any[]>([]);
onMounted(async () => { const hasil = await apiMutuGet("/indikator"); indikator.value = hasil?.payload?.data ?? []; });
</script>
<template><section class="p-4"><h1 class="text-xl font-semibold">Indikator Mutu</h1><p class="my-3">Daftar profil INM, IMP-RS, dan IMPU untuk fasilitas ini.</p><div v-if="!indikator.length" class="rounded border p-4">Belum ada profil indikator. Data INM bawaan belum disediakan sebelum regulasi acuan ditetapkan.</div><table v-else class="w-full"><thead><tr><th class="text-left">Kode</th><th class="text-left">Indikator</th><th>Jenis</th><th>Target</th></tr></thead><tbody><tr v-for="item in indikator" :key="item.uuid"><td>{{ item.kode }}</td><td>{{ item.judul }}</td><td>{{ item.jenis }}</td><td>{{ item.targetNilai ?? "Belum ditetapkan" }}</td></tr></tbody></table></section></template>
