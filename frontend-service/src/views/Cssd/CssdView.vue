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
      { name: "Dasbor", icon: "PhGauge", type: linkType.LINK, url: "/cssd/dashboard" },
      { name: "Penerimaan Alat Kotor", icon: "PhArrowDown", type: linkType.LINK, url: "/cssd/penerimaan" },
      { name: "Dekontaminasi & Pengemasan", icon: "PhDrop", type: linkType.LINK, url: "/cssd/pemrosesan" },
      { name: "Siklus Sterilisasi (Load)", icon: "PhThermometer", type: linkType.LINK, url: "/cssd/load" },
      { name: "Distribusi & Pemakaian", icon: "PhArrowsLeftRight", type: linkType.LINK, url: "/cssd/distribusi" },
      { name: "Recall", icon: "PhWarningCircle", type: linkType.LINK, url: "/cssd/recall" },
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
          { name: "Master Set Instrumen", type: linkType.LINK, url: "/cssd/datamaster/master-set" },
          { name: "Mesin & Bowie-Dick", type: linkType.LINK, url: "/cssd/datamaster/mesin" },
        ],
      },
    ],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [{ name: "Laporan", icon: "FileReportIcon", type: linkType.LINK, url: "/cssd/laporan" }],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="CSSD" sidebarTitleUrl="/cssd" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
