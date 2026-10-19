<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useHduStore, bolehHdu, pesanHdu, waktuHdu } from "@/stores/rawatInap/hdu";
const store = useHduStore();
const route = useRoute();
const detail = ref<any>(null);
const intervalDetik = ref<number | null>(null);
const berlakuMulai = ref("");
const alasan = ref("");
const pesan = ref("");
const sibuk = ref(false);
async function muat() { try { detail.value = await store.baca(`/episode/${route.params.uuid}`); } catch (error) { detail.value = null; pesan.value = pesanHdu(error); } }
async function simpan() {
  sibuk.value = true;
  try {
    await store.tulis(`/episode/${route.params.uuid}/instruksi-observasi`, { intervalDetik: intervalDetik.value,
      berlakuMulai: Math.floor(new Date(berlakuMulai.value).getTime() / 1000), alasan: alasan.value, versi: detail.value.episode.versi });
    pesan.value = "Instruksi observasi dicatat."; await muat();
  } catch (error) { pesan.value = pesanHdu(error); await muat(); }
  finally { sibuk.value = false; }
}
onMounted(muat);
watch(() => route.params.uuid, muat);
</script>

<template>
  <div class="space-y-4">
    <p role="status">{{ pesan }}</p>
    <button class="border rounded p-2" @click="muat">Muat ulang episode</button>
    <template v-if="detail">
      <h2 class="font-semibold">Episode {{ detail.episode.uuid }} · {{ detail.episode.status }}</h2>
      <p>Masuk: {{ waktuHdu(detail.episode.waktuMasuk) }} · Keluar: {{ waktuHdu(detail.episode.waktuKeluar) }}</p>
      <p v-if="detail.instruksiBerlaku">Interval {{ detail.instruksiBerlaku.intervalDetik }} detik · Sumber {{ detail.instruksiBerlaku.sumber }} · Versi {{ detail.instruksiBerlaku.versi }}</p>
      <p v-else>Interval observasi belum ditetapkan.</p>
      <form v-if="detail.episode.status === 'aktif' && bolehHdu('Instruksi Observasi', 'KELOLA')" class="grid gap-3" @submit.prevent="simpan">
        <h3>Instruksi observasi khusus episode</h3>
        <label>Interval (detik) <input v-model.number="intervalDetik" type="number" min="1" max="604800" required class="border rounded p-2" /></label>
        <label>Berlaku mulai <input v-model="berlakuMulai" type="datetime-local" required class="border rounded p-2" /></label>
        <label>Alasan <textarea v-model="alasan" required maxlength="2000" class="border rounded p-2 w-full" /></label>
        <button :disabled="sibuk" class="border rounded p-2">Catat instruksi baru</button>
      </form>
      <h3 class="font-semibold">Riwayat instruksi dan kebijakan</h3>
      <ul><li v-for="item in detail.instruksi" :key="item.uuid">{{ item.episodeUuid ? 'Episode' : 'Unit' }} · {{ item.intervalDetik }} detik · Berlaku {{ waktuHdu(item.berlakuMulai) }} · Dicatat {{ waktuHdu(item.createdAt) }} · {{ item.pencatat }} · {{ item.alasan }}</li></ul>
      <h3 class="font-semibold">Serah terima</h3>
      <ul><li v-for="item in detail.serahTerima" :key="item.uuid">{{ item.arah }} · {{ item.ringkasan.kondisi }} · Kejadian {{ waktuHdu(item.waktuKejadian) }} · Penerimaan {{ waktuHdu(item.waktuPenerimaan) }}</li></ul>
      <p>Asesmen, tindakan, terapi, pemberian obat, order, dan tagihan dilanjutkan melalui detail pasien rawat inap dengan admisi {{ detail.episode.rawatInapUuid }}.</p>
      <RouterLink to="/rawat-inap/ruangan">Buka daftar pasien rawat inap</RouterLink>
    </template>
  </div>
</template>
