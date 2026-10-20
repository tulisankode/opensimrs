<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { ref } from "vue";

const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      { name: "Daftar Tunggu OK", icon: "PhListChecks", type: linkType.LINK, url: "/kamar-operasi/daftar-tunggu" },
      { name: "PACU / Recovery Room", icon: "PhHeartbeat", type: linkType.LINK, url: "/kamar-operasi/pacu" },
      { name: "Jadwal OK", icon: "PhCalendar", type: linkType.LINK, url: "/kamar-operasi/jadwal" },
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
        child: [{ name: "Ruang OK", type: linkType.LINK, url: "/kamar-operasi/datamaster/ruang" }],
      },
    ],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [
      {
        name: "Laporan",
        icon: "FileReportIcon",
        type: linkType.DROPDOWN,
        child: [{ name: "Rekap Operasi", type: linkType.LINK, url: "/kamar-operasi/laporan/rekap" }],
      },
    ],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Kamar Operasi" sidebarTitleUrl="/kamar-operasi" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
