<script setup lang="ts">
import { ref } from "vue";
import { useHduStore, bolehHdu, pesanHdu, waktuHdu } from "@/stores/rawatInap/hdu";
const emit = defineEmits(["tersimpan"]);
const store = useHduStore();
const perpindahanUuid = ref("");
const arah = ref("masuk");
const waktuKejadian = ref("");
const kondisi = ref("");
const terapiBerjalan = ref("");
const tindakLanjut = ref("");
const tujuanIcu = ref(false);
const daftar = ref<any[]>([]);
const pesan = ref("");
const sibuk = ref(false);
async function muat() {
  if (!bolehHdu("Serah Terima")) return;
  try { daftar.value = await store.baca("/serah-terima"); } catch (error) { pesan.value = pesanHdu(error); }
}
async function simpan() {
  sibuk.value = true; pesan.value = "";
  try {
    await store.tulis("/serah-terima", { perpindahanUuid: perpindahanUuid.value, arah: arah.value,
      waktuKejadian: Math.floor(new Date(waktuKejadian.value).getTime() / 1000), tujuanIcu: arah.value === "keluar" && tujuanIcu.value,
      ringkasan: { kondisi: kondisi.value, terapiBerjalan: terapiBerjalan.value, tindakLanjut: tindakLanjut.value } });
    pesan.value = "Serah terima dicatat. Petugas penerima perlu mengonfirmasi.";
    await muat(); emit("tersimpan");
  } catch (error) { pesan.value = pesanHdu(error); }
  finally { sibuk.value = false; }
}
async function konfirmasi(item: any) {
  if (!waktuKejadian.value) { pesan.value = "Isi waktu penerimaan sebelum mengonfirmasi."; return; }
  sibuk.value = true; pesan.value = "";
  try {
    await store.tulis(`/serah-terima/${item.uuid}/konfirmasi`, { versi: item.versi, waktuKejadian: Math.floor(new Date(waktuKejadian.value).getTime() / 1000) });
    pesan.value = "Penerimaan dan perpindahan berhasil dicatat."; await muat(); emit("tersimpan");
  } catch (error) { pesan.value = pesanHdu(error); await muat(); }
  finally { sibuk.value = false; }
}
muat();
</script>

<template>
  <section class="space-y-3 border rounded p-4">
    <h2 class="font-semibold">Serah terima masuk dan keluar</h2>
    <p>Buat permintaan perpindahan pada rawat inap. Konfirmasi oleh petugas penerima akan memproses perpindahan dan episode bersama-sama.</p>
    <p role="status">{{ pesan }}</p>
    <label class="block">Waktu kejadian atau penerimaan <input v-model="waktuKejadian" type="datetime-local" required class="border rounded p-2" /></label>
    <form v-if="bolehHdu('Serah Terima', 'CREATE')" class="grid gap-3" @submit.prevent="simpan">
      <label>UUID permintaan perpindahan <input v-model="perpindahanUuid" required class="border rounded p-2 w-full" /></label>
      <label>Arah <select v-model="arah" class="border rounded p-2"><option value="masuk">Masuk HDU</option><option value="keluar">Keluar HDU</option></select></label>
      <label v-if="arah === 'keluar'"><input v-model="tujuanIcu" type="checkbox" /> Tujuan ICU; penerima harus memiliki izin penerimaan ICU</label>
      <label>Kondisi pasien <textarea v-model="kondisi" required maxlength="2000" class="border rounded p-2 w-full" /></label>
      <label>Terapi berjalan <textarea v-model="terapiBerjalan" required maxlength="2000" class="border rounded p-2 w-full" /></label>
      <label>Tindak lanjut <textarea v-model="tindakLanjut" required maxlength="2000" class="border rounded p-2 w-full" /></label>
      <button :disabled="sibuk" class="border rounded p-2">Catat serah terima</button>
    </form>
    <button :disabled="sibuk" class="border rounded p-2" @click="muat">Muat ulang serah terima</button>
    <article v-for="item in daftar" :key="item.uuid" class="border rounded p-3 space-y-1">
      <p>{{ item.arah }} · Perpindahan {{ item.perpindahanUuid }} · {{ item.statusPindah }}</p>
      <p>Kondisi: {{ item.ringkasan.kondisi }} · Terapi: {{ item.ringkasan.terapiBerjalan }} · Tindak lanjut: {{ item.ringkasan.tindakLanjut }}</p>
      <p>Pengirim: {{ item.pengirim }} · Kejadian: {{ waktuHdu(item.waktuKejadian) }} · Dicatat: {{ waktuHdu(item.createdAt) }}</p>
      <p v-if="item.penerima">Penerima: {{ item.penerima }} · Penerimaan: {{ waktuHdu(item.waktuPenerimaan) }} · Dicatat: {{ waktuHdu(item.waktuKonfirmasi) }}</p>
      <button v-else-if="item.statusPindah === 'pending' && bolehHdu('Serah Terima', 'KONFIRMASI')" :disabled="sibuk" class="border rounded p-2" @click="konfirmasi(item)">Konfirmasi penerimaan</button>
    </article>
  </section>
</template>
