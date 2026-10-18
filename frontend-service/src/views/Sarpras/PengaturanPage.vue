<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { utilsStore } from "@/stores/utils";
import { izinSarpras, pengaturanSarpras, simpanPengaturanSarpras, waktuSarpras } from "@/stores/penunjang/sarpras";

// Pengaturan Sarana & Prasarana per faskes: ambang peringatan kalibrasi (hari sebelum masa berlaku habis, bawaan 30).
const storeUtils = utilsStore();
const bolehUbah = izinSarpras("Pengaturan", "UPDATE");
const ambang = ref("30");
const info = ref<any>(null);
const galat = ref("");

const muat = async () => {
  const res = await pengaturanSarpras();
  if (res?.payload) {
    info.value = res.payload;
    ambang.value = String(res.payload.ambangKalibrasiHari ?? 30);
  }
};
const simpan = async () => {
  galat.value = "";
  const n = Number(ambang.value);
  if (!Number.isInteger(n) || n < 1 || n > 3650) return (galat.value = "Ambang harus bilangan bulat 1–3650 hari");
  storeUtils.setLoading(true);
  try {
    if (await simpanPengaturanSarpras(n)) muat();
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="pt-0">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Pengaturan Sarana & Prasarana</h1>
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col max-w-xl gap-3 text-sm">
          <CustomTextfield v-model="ambang" label="Ambang peringatan kalibrasi (hari)" type="number" :maxLength="4" :disabled="!bolehUbah" />
          <div class="text-xs text-grey-400">
            Alat ditandai <b>mendekati jatuh tempo</b> bila masa berlaku kalibrasinya habis dalam jumlah hari ini, dan <b>kedaluwarsa</b> setelah tanggal berlaku lewat
            (dihitung per hari kalender WIB). Jadwal pemeliharaan ditandai terlambat setelah tanggal jatuh temponya lewat.
          </div>
          <div v-if="info?.updatedAt" class="text-xs text-grey-400">Terakhir diubah {{ waktuSarpras(info.updatedAt) }} oleh {{ info.diubahOleh ?? "-" }}</div>
          <div v-if="galat" class="text-danger-300">{{ galat }}</div>
          <div v-if="bolehUbah"><CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" /></div>
        </div>
      </template>
    </Card>
  </div>
</template>
