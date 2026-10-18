<script setup lang="ts">
import { onMounted, ref } from "vue";
import { apiPenunjangGet, apiPenunjangPost } from "@/utils/apiHandler";

const rows=ref<any[]>([]),pegawai=ref<any[]>([]),error=ref("");
const form=ref({kepegawaian_uuid:"",jenis:"sip",nomor:"",penerbit:"",tanggal_terbit:"",tanggal_berakhir:""});
const muat=async()=>{const r=await apiPenunjangGet("/hr/kredensial");rows.value=r?.payload??[];if(!r)error.value="Data kredensial gagal dimuat";};
const muatPegawai=async()=>{const r=await apiPenunjangGet("/hr/kepegawaian");pegawai.value=r?.payload??[];};
const simpan=async()=>{if(!form.value.kepegawaian_uuid)return;const epoch=(x:string)=>x?Math.floor(new Date(`${x}T00:00:00`).getTime()/1000):null;const payload={...form.value,tanggal_terbit:epoch(form.value.tanggal_terbit),tanggal_berakhir:epoch(form.value.tanggal_berakhir)};const r=await apiPenunjangPost("/hr/kredensial",payload);if(r){form.value={kepegawaian_uuid:"",jenis:"sip",nomor:"",penerbit:"",tanggal_terbit:"",tanggal_berakhir:""};await muat();}};
onMounted(async()=>{await Promise.all([muat(),muatPegawai()]);});
</script>

<template>
  <section class="p-4 w-full">
    <h1 class="text-xl font-semibold mb-4">Kredensial Pegawai</h1>
    <form class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-5 border rounded p-3" @submit.prevent="simpan">
      <label class="text-sm">Pegawai<select v-model="form.kepegawaian_uuid" class="border rounded w-full p-2" required><option value="">Pilih pegawai</option><option v-for="p in pegawai" :key="p.uuid" :value="p.uuid">{{ p.nama_pegawai || p.nama }}</option></select></label>
      <label class="text-sm">Jenis<select v-model="form.jenis" class="border rounded w-full p-2"><option value="str">STR</option><option value="sip">SIP</option><option value="sertifikat_kompetensi">Sertifikat kompetensi</option><option value="lainnya">Lainnya</option></select></label>
      <label class="text-sm">Nomor<input v-model="form.nomor" class="border rounded w-full p-2" required /></label>
      <label class="text-sm">Penerbit<input v-model="form.penerbit" class="border rounded w-full p-2" /></label>
      <label class="text-sm">Tanggal terbit<input v-model="form.tanggal_terbit" type="date" class="border rounded w-full p-2" /></label>
      <label class="text-sm">Tanggal berakhir<input v-model="form.tanggal_berakhir" type="date" class="border rounded w-full p-2" /></label>
      <button class="border rounded px-3 py-2">Tambah kredensial</button>
    </form>
    <p v-if="error" class="text-red-600">{{ error }}</p>
    <div class="overflow-auto"><table class="w-full text-sm"><thead><tr class="text-left border-b"><th class="p-2">Nama pegawai</th><th class="p-2">Jenis</th><th class="p-2">Nomor</th><th class="p-2">Tanggal berakhir</th><th class="p-2">Verifikasi</th></tr></thead>
      <tbody><tr v-for="row in rows" :key="row.uuid" class="border-b"><td class="p-2">{{ row.nama_pegawai }}</td><td class="p-2">{{ row.jenis }}</td><td class="p-2">{{ row.nomor }}</td><td class="p-2">{{ row.tanggal_berakhir ? new Date(Number(row.tanggal_berakhir)*1000).toLocaleDateString("id-ID") : "—" }}</td><td class="p-2">{{ row.status_verifikasi }}</td></tr><tr v-if="!rows.length"><td colspan="5" class="p-4 text-center text-gray-500">Belum ada kredensial pegawai.</td></tr></tbody>
    </table></div>
  </section>
</template>
