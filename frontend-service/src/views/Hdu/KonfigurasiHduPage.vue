<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useHduStore, bolehHdu, pesanHdu, waktuHdu } from "@/stores/rawatInap/hdu";
const store = useHduStore();
const daftar = ref<any[]>([]);
const riwayat = ref<any[]>([]);
const terpilih = ref<any>(null);
const nama = ref("");
const ruanganUuid = ref("");
const intervalDetik = ref<number | null>(null);
const berlakuMulai = ref("");
const alasan = ref("");
const pesan = ref("");
const sibuk = ref(false);
async function muat() { try { daftar.value = await store.baca("/konfigurasi"); } catch (error) { pesan.value = pesanHdu(error); } }
async function pilih(item: any) { terpilih.value = item; try { riwayat.value = await store.baca(`/konfigurasi/${item.uuid}/kebijakan-observasi`); } catch (error) { pesan.value = pesanHdu(error); } }
async function simpan() {
  sibuk.value = true;
  try { await store.tulis("/konfigurasi", { ruanganUuid: ruanganUuid.value, nama: nama.value, aktif: true }); await muat(); pesan.value = "Konfigurasi HDU dicatat."; }
  catch (error) { pesan.value = pesanHdu(error); } finally { sibuk.value = false; }
}
async function ubah(item: any) {
  sibuk.value = true;
  try { await store.tulis(`/konfigurasi/${item.uuid}`, { nama: item.nama, aktif: !item.aktif, versi: item.versi }, "patch"); await muat(); }
  catch (error) { pesan.value = pesanHdu(error); await muat(); } finally { sibuk.value = false; }
}
async function kebijakan() {
  sibuk.value = true;
  try {
    const hasil = await store.tulis(`/konfigurasi/${terpilih.value.uuid}/kebijakan-observasi`, { intervalDetik: intervalDetik.value,
      berlakuMulai: Math.floor(new Date(berlakuMulai.value).getTime() / 1000), alasan: alasan.value, versi: terpilih.value.versi });
    await muat(); await pilih(hasil); pesan.value = "Kebijakan observasi dicatat.";
  } catch (error) { pesan.value = pesanHdu(error); await muat(); terpilih.value = null; }
  finally { sibuk.value = false; }
}
onMounted(muat);
</script>

<template>
  <div class="space-y-4">
    <p>HDU dipetakan ke ruangan yang sudah ada. Kapasitas dan status tempat tidur dikelola melalui <RouterLink to="/admisi/monitoring-kamar">Monitoring Kamar</RouterLink> dan <RouterLink to="/datamaster/ruangan">Data Master Ruangan</RouterLink>.</p>
    <p role="status">{{ pesan }}</p>
    <form v-if="bolehHdu('Konfigurasi', 'KELOLA')" class="grid gap-3" @submit.prevent="simpan">
      <label>Nama unit HDU <input v-model="nama" required maxlength="150" class="border p-2 rounded w-full" /></label>
      <label>UUID ruangan <input v-model="ruanganUuid" required class="border p-2 rounded w-full" /></label>
      <button :disabled="sibuk" class="border rounded p-2">Tambahkan konfigurasi</button>
    </form>
    <article v-for="item in daftar" :key="item.uuid" class="border p-3 rounded flex gap-4">
      <span>{{ item.nama }} · {{ item.namaRuangan }} · {{ item.aktif ? 'Aktif' : 'Nonaktif' }} · Versi {{ item.versi }}</span>
      <button @click="pilih(item)">Kebijakan observasi</button>
      <button v-if="bolehHdu('Konfigurasi', 'KELOLA')" :disabled="sibuk" @click="ubah(item)">{{ item.aktif ? 'Nonaktifkan' : 'Aktifkan' }}</button>
    </article>
    <section v-if="terpilih" class="space-y-3">
      <h2>Kebijakan {{ terpilih.nama }}</h2>
      <p>Interval tidak memiliki nilai bawaan klinis. Instruksi khusus episode memiliki prioritas pada waktu pengukuran.</p>
      <form v-if="bolehHdu('Kebijakan Observasi', 'KELOLA')" class="grid gap-3" @submit.prevent="kebijakan">
        <label>Interval (detik) <input v-model.number="intervalDetik" type="number" min="1" max="604800" required class="border rounded p-2" /></label>
        <label>Berlaku mulai <input v-model="berlakuMulai" type="datetime-local" required class="border rounded p-2" /></label>
        <label>Alasan <textarea v-model="alasan" required maxlength="2000" class="border rounded p-2 w-full" /></label>
        <button :disabled="sibuk" class="border rounded p-2">Catat kebijakan baru</button>
      </form>
      <ul><li v-for="item in riwayat" :key="item.uuid">{{ item.intervalDetik }} detik · Berlaku {{ waktuHdu(item.berlakuMulai) }} · {{ item.pencatat }} · {{ item.alasan }}</li></ul>
    </section>
  </div>
</template>
