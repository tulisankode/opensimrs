<script setup lang="ts">
import { bolehHdu } from "@/stores/rawatInap/hdu";
import { fiturAktif } from "@/stores/modulFaskes";
</script>

<template>
  <section v-if="fiturAktif('rawat_inap_hdu')" class="w-full overflow-auto p-4 space-y-4">
    <h1 class="text-xl font-semibold">HDU (High Dependency Unit)</h1>
    <nav class="flex gap-4">
      <RouterLink v-if="bolehHdu('Episode')" to="/rawat-inap/hdu/daftar">Episode dan tempat tidur</RouterLink>
      <RouterLink v-if="bolehHdu('Konfigurasi')" to="/rawat-inap/hdu/konfigurasi">Konfigurasi</RouterLink>
      <RouterLink to="/rawat-inap/perpindahan-bangsal">Perpindahan rawat inap</RouterLink>
    </nav>
    <component :is="$route.meta.page || 'div'" />
  </section>
</template>
