<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useHduStore, pesanHdu, waktuHdu, bolehHdu } from "@/stores/rawatInap/hdu";
import SerahTerimaHduForm from "./components/SerahTerimaHduForm.vue";
const store = useHduStore();
const episode = ref<any[]>([]);
const tempatTidur = ref<any[]>([]);
const pesan = ref("");
const halaman = ref(1);
const jumlah = ref(0);
async function muat() {
  try {
    const [daftar, bed] = await Promise.all([store.baca(`/episode?status=aktif&halaman=${halaman.value}`), store.baca("/tempat-tidur")]);
    episode.value = daftar.items; jumlah.value = daftar.paginasi.jumlah; tempatTidur.value = bed; pesan.value = "";
  } catch (error) { pesan.value = pesanHdu(error); }
}
async function pindah(arah: number) { halaman.value += arah; await muat(); }
onMounted(muat);
</script>

<template>
  <div class="space-y-4">
    <p role="status">{{ pesan }}</p>
    <button class="border rounded p-2" @click="muat">Muat ulang</button>
    <h2 class="font-semibold">Episode HDU aktif</h2>
    <p v-if="!episode.length">Belum ada episode aktif.</p>
    <table class="w-full text-left"><thead><tr><th>Pasien</th><th>No. RM</th><th>Waktu masuk</th><th>Perawatan</th></tr></thead>
      <tbody><tr v-for="item in episode" :key="item.uuid"><td>{{ item.namaPasien }}</td><td>{{ item.noRm }}</td><td>{{ waktuHdu(item.waktuMasuk) }}</td><td><RouterLink :to="`/rawat-inap/hdu/${item.uuid}`">Buka perawatan</RouterLink></td></tr></tbody>
    </table>
    <div class="flex gap-3"><button :disabled="halaman <= 1" @click="pindah(-1)">Sebelumnya</button><span>Halaman {{ halaman }} · {{ jumlah }} episode</span><button :disabled="halaman * 25 >= jumlah" @click="pindah(1)">Berikutnya</button></div>
    <h2 class="font-semibold">Kapasitas: {{ tempatTidur.length }} tempat tidur · {{ tempatTidur.filter(b => b.tersedia).length }} tersedia</h2>
    <ul><li v-for="bed in tempatTidur" :key="bed.uuid">{{ bed.namaUnit }} · {{ bed.noBed }} · {{ bed.tersedia ? 'Tersedia' : bed.statusOperasional || 'Tidak tersedia' }}</li></ul>
    <SerahTerimaHduForm v-if="bolehHdu('Serah Terima')" @tersimpan="muat" />
  </div>
</template>
