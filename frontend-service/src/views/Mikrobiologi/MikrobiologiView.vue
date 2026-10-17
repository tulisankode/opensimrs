<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { computed, ref } from "vue";
import { fiturAktif } from "@/stores/modulFaskes";

const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      { name: "Order Mikrobiologi", icon: "PhClipboardText", type: linkType.LINK, url: "/mikrobiologi/order" },
      { name: "Pemeriksaan & Hasil", icon: "PhBug", type: linkType.LINK, url: "/mikrobiologi/pemeriksaan" },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      {
        name: "Datamaster",
        icon: "DatabaseFill",
        type: linkType.DROPDOWN,
        child: [
          { name: "Pemeriksaan", type: linkType.LINK, url: "/mikrobiologi/datamaster/pemeriksaan" },
          { name: "Organisme", type: linkType.LINK, url: "/mikrobiologi/datamaster/organisme" },
          { name: "Antibiotik", type: linkType.LINK, url: "/mikrobiologi/datamaster/antibiotik" },
        ],
      },
    ],
  },
  {
    name: "mapping-lis",
    type: linkType.SECTION,
    child: [{ name: "Mapping LIS", icon: "PhArrowsLeftRight", type: linkType.LINK, url: "/mikrobiologi/mapping-lis" }],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [
      {
        name: "Laporan",
        icon: "FileReportIcon",
        type: linkType.DROPDOWN,
        child: [
          { name: "Kunjungan", type: linkType.LINK, url: "/mikrobiologi/laporan/kunjungan" },
          { name: "Antibiogram", type: linkType.LINK, url: "/mikrobiologi/laporan/antibiogram" },
        ],
      },
    ],
  },
]);
// Mapping LIS hanya tampil untuk faskes yang mengaktifkan fitur Bridging LIS Mikrobiologi (Manajemen Modul).
const sidebarTampil = computed(() => sidebarBodyList.value.filter((s) => s.name !== "mapping-lis" || fiturAktif("mikro_bridging_lis")));
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Mikrobiologi" sidebarTitleUrl="/mikrobiologi" class="flex-none" :sidebar-body-list="sidebarTampil" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
