<script setup lang="ts">
// Pratinjau modul yang termasuk segmen faskes tetapi masih dalam pengembangan (katalog: tersedia = false).
import { computed } from "vue";
import { useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import { useModulFaskesStore } from "@/stores/modulFaskes";

const route = useRoute();
const modulStore = useModulFaskesStore();

const modul = computed(() => modulStore.konfigurasi?.katalog.find((m) => m.kode === route.params.kode));
const fitur = computed(() => (modulStore.konfigurasi?.katalogFitur ?? []).filter((f) => f.modul === route.params.kode));
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full">
    <template #header>
      <PageToolbar>
        <h1 class="toolbar-heading text-opensimrs-300">{{ modul?.nama ?? "Modul" }}</h1>
        <span class="rounded-full bg-danger-300 px-2 py-[1px] text-[10px] font-bold uppercase text-white">Soon</span>
      </PageToolbar>
    </template>
    <template #content>
      <div v-if="modul" class="mx-auto flex max-w-3xl flex-col items-center gap-4 py-10 text-center">
        <PhRocketLaunch :size="56" weight="duotone" class="text-opensimrs-300" aria-hidden="true" />
        <div>
          <h2 class="text-heading font-semibold text-grey-500">{{ modul.nama }} segera hadir</h2>
          <p class="mt-1 text-normal text-grey-400">{{ modul.deskripsi }}</p>
        </div>
        <p class="text-SM text-grey-400">
          Modul ini termasuk paket segmen faskes Anda dan sedang dikembangkan. Menu sudah disiapkan supaya alur
          kerjanya bisa direncanakan sejak sekarang; data belum bisa diinput.
        </p>
        <div v-if="fitur.length" class="w-full rounded-lg border border-grey-200 p-4 text-left">
          <div class="mb-2 text-SM font-semibold text-grey-500">Fitur yang direncanakan</div>
          <ul class="flex flex-col gap-2">
            <li v-for="f in fitur" :key="f.kode" class="flex items-start gap-2">
              <PhCheckCircle :size="18" class="mt-[1px] shrink-0 text-opensimrs-300" aria-hidden="true" />
              <div>
                <div class="text-normal font-semibold text-grey-500">{{ f.nama }}</div>
                <div class="text-SM text-grey-400">{{ f.deskripsi }}</div>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <div v-else class="py-10 text-center text-grey-400">Modul tidak ditemukan di katalog.</div>
    </template>
  </Card>
</template>
