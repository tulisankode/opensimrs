<script setup lang="ts">
import { onMounted, ref } from "vue";
import { apiPenunjangGet, apiPenunjangPost } from "@/utils/apiHandler";
const nama=ref(""); const alamat=ref(""); const kunci=ref(""); const pesan=ref(""); const daftar=ref<any[]>([]);
const muat=async()=>{const r:any=await apiPenunjangGet("/hemodialisa/hdis/koneksi");daftar.value=r?.payload??[];};
const simpan=async()=>{const r:any=await apiPenunjangPost("/hemodialisa/hdis/koneksi",{nama:nama.value,url_kirim_jadwal:alamat.value});kunci.value=r?.payload?.kunci_masuk??"";pesan.value=kunci.value?"Koneksi disimpan. Salin kunci masuk sekarang; kunci tidak ditampilkan kembali.":"Koneksi belum dapat disimpan.";await muat();};
onMounted(muat);
</script>
<template>
  <section class="space-y-4 rounded border p-4">
    <h2 class="font-semibold">Koneksi HDIS per faskes</h2>
    <label class="block">Nama koneksi<input v-model="nama" class="mt-1 block w-full rounded border p-2" /></label>
    <label class="block">Alamat penerima jadwal<input v-model="alamat" class="mt-1 block w-full rounded border p-2" placeholder="http://localhost:8097/jadwal" /></label>
    <button class="rounded bg-blue-700 px-4 py-2 text-white" @click="simpan">Simpan koneksi</button>
    <p v-if="pesan" role="status">{{ pesan }}</p><p v-if="kunci" class="break-all rounded bg-amber-50 p-3">Kunci masuk (tampilkan sekali): <code>{{ kunci }}</code></p>
    <ul class="divide-y"><li v-for="item in daftar" :key="item.uuid" class="py-2">{{ item.nama }} — {{ item.url_kirim_jadwal }} ({{ item.aktif ? 'aktif' : 'nonaktif' }})</li></ul>
  </section>
</template>
