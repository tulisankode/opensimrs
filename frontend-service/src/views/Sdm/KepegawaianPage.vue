<script setup lang="ts">
import { onMounted, ref } from "vue";
import { apiPenunjangGet, apiPenunjangPost } from "@/utils/apiHandler";

const rows=ref<any[]>([]),calon=ref<any[]>([]),q=ref(""),error=ref("");
const form=ref({pegawai_uuid:"",status_kepegawaian:"tetap",jabatan:"",golongan:"",tanggal_mulai:new Date().toISOString().slice(0,10)});
const muat=async()=>{const r=await apiPenunjangGet(`/hr/kepegawaian?q=${encodeURIComponent(q.value)}`);rows.value=r?.payload??[];if(!r)error.value="Data kepegawaian gagal dimuat";};
const muatCalon=async()=>{const r=await apiPenunjangGet("/hr/kepegawaian?belum_tertaut=1");calon.value=r?.payload??[];};
const simpan=async()=>{if(!form.value.pegawai_uuid)return;const r=await apiPenunjangPost("/hr/kepegawaian",{...form.value,tanggal_mulai:Math.floor(new Date(`${form.value.tanggal_mulai}T00:00:00`).getTime()/1000)});if(r){form.value={pegawai_uuid:"",status_kepegawaian:"tetap",jabatan:"",golongan:"",tanggal_mulai:new Date().toISOString().slice(0,10)};await muat();await muatCalon();}};
onMounted(async()=>{await Promise.all([muat(),muatCalon()]);});
</script>

<template>
  <section class="p-4 w-full">
    <h1 class="text-xl font-semibold mb-4">Data Kepegawaian</h1>
    <form class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-5 border rounded p-3" @submit.prevent="simpan">
      <label class="text-sm">Pegawai Data Master<select v-model="form.pegawai_uuid" class="border rounded w-full p-2" required><option value="">Pilih pegawai</option><option v-for="p in calon" :key="p.pegawai_uuid" :value="p.pegawai_uuid">{{ p.nama_pegawai }}</option></select></label>
      <label class="text-sm">Status<select v-model="form.status_kepegawaian" class="border rounded w-full p-2"><option>tetap</option><option>kontrak</option><option>honorer</option><option>magang</option><option>purna_tugas</option></select></label>
      <label class="text-sm">Tanggal mulai<input v-model="form.tanggal_mulai" type="date" class="border rounded w-full p-2" required /></label>
      <label class="text-sm">Jabatan<input v-model="form.jabatan" class="border rounded w-full p-2" /></label>
      <label class="text-sm">Golongan<input v-model="form.golongan" class="border rounded w-full p-2" /></label>
      <button class="border rounded px-3 py-2 self-end">Tambah data kepegawaian</button>
    </form>
    <form class="flex gap-2 mb-4" @submit.prevent="muat"><input v-model="q" class="border rounded px-3 py-2" placeholder="Cari nama atau jabatan" /><button class="border rounded px-3 py-2">Cari</button></form>
    <p v-if="error" class="text-red-600">{{ error }}</p>
    <div class="overflow-auto"><table class="w-full text-sm"><thead><tr class="text-left border-b"><th class="p-2">Nama pegawai</th><th class="p-2">Status</th><th class="p-2">Jabatan</th><th class="p-2">Golongan</th></tr></thead>
      <tbody><tr v-for="row in rows" :key="row.uuid" class="border-b"><td class="p-2">{{ row.nama_pegawai || row.nama }}</td><td class="p-2">{{ row.status_kepegawaian }}</td><td class="p-2">{{ row.jabatan || "—" }}</td><td class="p-2">{{ row.golongan || "—" }}</td></tr><tr v-if="!rows.length"><td colspan="4" class="p-4 text-center text-gray-500">Belum ada data kepegawaian.</td></tr></tbody>
    </table></div>
  </section>
</template>
