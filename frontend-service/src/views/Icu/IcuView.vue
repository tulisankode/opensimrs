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
      { name: "Dasbor ICU", icon: "PhGaugeFill", type: linkType.LINK, url: "/icu/dashboard" },
      { name: "Perawatan ICU", icon: "PhHeartbeat", type: linkType.LINK, url: "/icu/perawatan" },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      {
        name: "Laporan",
        icon: "PhChartBar",
        type: linkType.DROPDOWN,
        child: [{ name: "Laporan ICU", type: linkType.LINK, url: "/icu/laporan" }],
      },
    ],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="ICU / Intensif" sidebarTitleUrl="/icu" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
