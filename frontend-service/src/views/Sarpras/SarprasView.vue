<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { ref } from "vue";

// Sarana dan Prasarana (IPSRS): register aset, laporan kerusakan/work order, pemeliharaan preventif, kalibrasi,
// utilitas, laporan, & pengaturan ambang peringatan (STD-0022, penunjang-service).
const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      { name: "Register Aset", icon: "PhBuildings", type: linkType.LINK, url: "/sarpras/aset" },
      { name: "Laporan Kerusakan", icon: "PhWrench", type: linkType.LINK, url: "/sarpras/laporan-kerusakan" },
      { name: "Pemeliharaan Preventif", icon: "PhCalendarCheck", type: linkType.LINK, url: "/sarpras/pemeliharaan" },
      { name: "Kalibrasi Alat", icon: "PhGauge", type: linkType.LINK, url: "/sarpras/kalibrasi" },
      { name: "Utilitas", icon: "PhLightning", type: linkType.LINK, url: "/sarpras/utilitas" },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      { name: "Laporan", icon: "FileReportIcon", type: linkType.LINK, url: "/sarpras/laporan" },
      { name: "Pengaturan", icon: "PhGear", type: linkType.LINK, url: "/sarpras/pengaturan" },
    ],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Sarana & Prasarana" sidebarTitleUrl="/sarpras" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
