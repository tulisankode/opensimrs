<template>
  <div
    class="relative flex gap-5 justify-between px-5 py-2.5 text-xs leading-5 bg-opensimrs-300 rounded-t-xl shadow-sm max-md:flex-wrap mt-auto mx-3"
  >
    <div class="flex items-center gap-2.5 text-white max-md:flex-wrap">
      <div class="font-semibold">© {{ tahun }} OpenSIMRS</div>
      <div class="text-sm font-semibold leading-5 tracking-normal">|</div>
      <div>v3.0.0</div>
    </div>
    <div
      v-if="namaFaskes"
      class="flex items-center gap-1.5 px-3 font-semibold text-opensimrs-300 bg-white rounded-[50px]"
      title="Faskes aktif"
    >
      <HospitalFillIcon class="h-4 w-4 text-opensimrs-300" aria-hidden="true" />
      {{ namaFaskes }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { profilFaskes } from "@/utils/tema";

// Nama faskes yang sedang aktif (profil diperbarui saat login / pindah faskes / ubah Setting).
const namaFaskes = computed(() => profilFaskes.value?.name ?? "");
const tahun = new Date().getFullYear();
</script>
