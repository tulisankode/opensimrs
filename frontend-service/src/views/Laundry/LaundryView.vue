<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { ref } from "vue";

// Laundry & Linen: siklus linen kotor → cuci (batch) → bersih → distribusi ke ruangan, stok per ruangan.
const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      { name: "Stok & Par Level", icon: "PhPackage", type: linkType.LINK, url: "/laundry/stok" },
      { name: "Serah Terima Kotor", icon: "PhHandArrowDown", type: linkType.LINK, url: "/laundry/penerimaan" },
      { name: "Batch Cuci", icon: "PhWashingMachine", type: linkType.LINK, url: "/laundry/batch" },
      { name: "Permintaan & Distribusi", icon: "PhTruck", type: linkType.LINK, url: "/laundry/distribusi" },
      { name: "Koreksi Stok", icon: "PhWarningCircle", type: linkType.LINK, url: "/laundry/koreksi" },
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
        child: [{ name: "Jenis Linen", type: linkType.LINK, url: "/laundry/master" }],
      },
    ],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [{ name: "Laporan", icon: "FileReportIcon", type: linkType.LINK, url: "/laundry/laporan" }],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Laundry & Linen" sidebarTitleUrl="/laundry" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
