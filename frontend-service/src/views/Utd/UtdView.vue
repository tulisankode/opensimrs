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
      { name: "Donor & Seleksi", icon: "PhUserPlus", type: linkType.LINK, url: "/utd/donor" },
      { name: "Aftap", icon: "PhSyringe", type: linkType.LINK, url: "/utd/aftap" },
      { name: "Uji Saring IMLTD", icon: "PhTestTube", type: linkType.LINK, url: "/utd/imltd" },
      { name: "Pengolahan Komponen", icon: "PhStack", type: linkType.LINK, url: "/utd/komponen" },
      { name: "Penyimpanan & Distribusi", icon: "PhTruck", type: linkType.LINK, url: "/utd/distribusi" },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [{ name: "Pengaturan", icon: "PhGearSix", type: linkType.LINK, url: "/utd/pengaturan" }],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [{ name: "Pelaporan", icon: "FileReportIcon", type: linkType.LINK, url: "/utd/laporan" }],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="UTD / UPTD Produksi Darah" sidebarTitleUrl="/utd" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
