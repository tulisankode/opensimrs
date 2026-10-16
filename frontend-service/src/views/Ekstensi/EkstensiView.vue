<script setup lang="ts">
// Menu "Ekstensi": laporan, template cetak, dan formulir tambahan yang dirakit lewat SIMRS Studio lalu dipasang superadmin.
// Daftar berasal dari laporan-service (hanya ekstensi terpasang untuk faskes ini & yang hak modulnya dimiliki pengguna).
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { muatEkstensi, useEkstensiStore } from "@/stores/ekstensi";

const store = useEkstensiStore();
const route = useRoute();
const router = useRouter();

const IKON: Record<string, string> = { laporan: "PhChartBar", cetak: "PhPrinter", formulir: "PhClipboardText" };
const KELOMPOK: Record<string, string> = { laporan: "Laporan", cetak: "Cetak", formulir: "Formulir" };

const sidebarBodyList = computed<SidebarBody[]>(() =>
  ["laporan", "cetak", "formulir"]
    .map((j) => ({
      name: KELOMPOK[j],
      type: linkType.SECTION,
      child: store.daftar.filter((e) => e.jenis === j).map((e) => ({ name: e.nama, type: linkType.LINK, url: `/ekstensi/${e.kode}`, icon: IKON[j] })),
    }))
    .filter((s) => s.child.length),
);

onMounted(async () => {
  await muatEkstensi();
  if (route.path === "/ekstensi" && store.daftar.length) router.replace(`/ekstensi/${store.daftar[0].kode}`);
});
const filter = ref("");
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Ekstensi" sidebarTitleUrl="/ekstensi" class="flex-none" :sidebar-body-list="sidebarBodyList" v-model:filter="filter" />
    <component v-if="$route.params.kode" class="max-h-full min-w-0 grow overflow-auto" :is="$route.meta.page || 'div'" :key="String($route.params.kode)" />
    <Card v-else class="grow">
      <template #content>
        <div class="py-10 text-center text-SM text-grey-400">{{ store.memuat ? "Memuat…" : "Belum ada ekstensi yang terpasang untuk Anda." }}</div>
      </template>
    </Card>
  </div>
</template>
