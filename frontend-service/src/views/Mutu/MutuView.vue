<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { ref } from "vue";
const sidebarBodyList = ref<SidebarBody[]>([{ name: "Mutu & Akreditasi", type: linkType.SECTION, child: [
  { name: "Dasbor & Indikator", icon: "PhChartLine", type: linkType.LINK, url: "/mutu" },
  { name: "Pengumpulan Data", icon: "PhClipboardText", type: linkType.LINK, url: "/mutu/pengumpulan" },
] }]);
</script>
<template><div class="flex h-full gap-3"><Sidebar sidebarTitle="Mutu & Akreditasi" sidebarTitleUrl="/mutu" class="flex-none" :sidebar-body-list="sidebarBodyList"/><component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component></div></template>
