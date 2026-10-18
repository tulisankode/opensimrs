<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { ref } from "vue";

// Kerangka modul Manajemen Ambulans (STD-0024): permintaan & penugasan, perjalanan, master armada/kru, tarif, serta laporan.
const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      { name: "Permintaan Layanan", icon: "PhClipboardText", type: linkType.LINK, url: "/ambulans/permintaan" },
      { name: "Penugasan Armada & Kru", icon: "PhUsers", type: linkType.LINK, url: "/ambulans/penugasan" },
      { name: "Perjalanan", icon: "PhTruck", type: linkType.LINK, url: "/ambulans/perjalanan" },
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
          { name: "Master Armada", type: linkType.LINK, url: "/ambulans/master/armada" },
          { name: "Master Kru", type: linkType.LINK, url: "/ambulans/master/kru" },
          { name: "Tarif", type: linkType.LINK, url: "/ambulans/tarif" },
        ],
      },
    ],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [
      { name: "Kuitansi Umum", icon: "PhMoneyWavy", type: linkType.LINK, url: "/ambulans/kuitansi" },
      { name: "Laporan", icon: "FileReportIcon", type: linkType.LINK, url: "/ambulans/laporan" },
    ],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Manajemen Ambulans" sidebarTitleUrl="/ambulans" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
