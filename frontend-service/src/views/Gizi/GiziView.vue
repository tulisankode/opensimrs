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
      { name: "Skrining Gizi", icon: "PhClipboardText", type: linkType.LINK, url: "/gizi/skrining" },
      { name: "Asuhan Gizi (PAGT)", icon: "PhNotebook", type: linkType.LINK, url: "/gizi/asuhan" },
      { name: "Order Diet", icon: "PhForkKnife", type: linkType.LINK, url: "/gizi/order" },
      { name: "Distribusi Makan", icon: "PhBowlFood", type: linkType.LINK, url: "/gizi/distribusi" },
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
          { name: "Master Diet", type: linkType.LINK, url: "/gizi/master/diet" },
          { name: "Bentuk Makanan", type: linkType.LINK, url: "/gizi/master/bentuk-makanan" },
          { name: "Standar Porsi", type: linkType.LINK, url: "/gizi/master/standar-porsi" },
        ],
      },
    ],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [{ name: "Laporan", icon: "FileReportIcon", type: linkType.LINK, url: "/gizi/laporan" }],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Gizi" sidebarTitleUrl="/gizi" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
