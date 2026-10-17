<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useIcuStore } from "@/stores/rawatInap/icu";

// Laporan ICU: BOR, ALOS, angka kematian & hari ventilator (KF-21/KT-15). Definisi operasional sementara — lihat
// catatan di rawat-inap-service/src/repositories/icu-repository.js — menunggu ketetapan final pemilik klinis/manajemen.
const storeUtils = utilsStore();
const icuStore = useIcuStore();

const dari = ref<Date>(new Date(new Date().setDate(new Date().getDate() - 30)));
const sampai = ref<Date>(new Date());
const laporan = ref<any>(null);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await icuStore.getLaporan(Math.floor(dari.value.getTime() / 1000), Math.floor(sampai.value.getTime() / 1000));
    laporan.value = res?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Laporan ICU</h1>
          <CustomDatePicker v-model="dari" label="Dari" />
          <CustomDatePicker v-model="sampai" label="Sampai" />
          <CustomButton label="Tampilkan" icon="PhMagnifyingGlass" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!laporan" />
        <div v-else class="flex flex-col gap-4 p-4">
          <div class="grid grid-cols-4 gap-3">
            <div class="p-4 text-center border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">BOR Ruang Intensif</div>
              <div class="text-2xl font-semibold">{{ laporan.bor ?? "-" }}{{ laporan.bor !== null ? "%" : "" }}</div>
            </div>
            <div class="p-4 text-center border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">ALOS (hari)</div>
              <div class="text-2xl font-semibold">{{ laporan.alos ?? "-" }}</div>
            </div>
            <div class="p-4 text-center border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">Angka Kematian</div>
              <div class="text-2xl font-semibold">{{ laporan.angkaKematian ?? "-" }}{{ laporan.angkaKematian !== null ? "%" : "" }}</div>
            </div>
            <div class="p-4 text-center border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">Hari Ventilator</div>
              <div class="text-2xl font-semibold">{{ laporan.hariVentilator }}</div>
            </div>
          </div>
          <div class="text-xs text-grey-400">
            {{ laporan.jumlahBedIcu }} bed ICU teridentifikasi · {{ laporan.jumlahEpisodeSelesai }} episode selesai pada periode ini.
          </div>
          <div class="p-3 text-xs rounded-lg text-grey-400 bg-grey-25">{{ laporan.definisi }}</div>
        </div>
      </template>
    </Card>
  </div>
</template>
