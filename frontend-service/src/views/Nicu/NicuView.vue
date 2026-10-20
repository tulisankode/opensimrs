<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { computed } from "vue";
import { hasPermission } from "@/utils/permissions";

const menu = [
  ["Dasbor", "/nicu/dashboard", "Dasbor"],
  ["Penerimaan", "/nicu/penerimaan", "Penerimaan"],
  ["Episode", "/nicu/episode", "Episode"],
  ["Tempat dan alat", "/nicu/tempat", "Tempat"],
  ["Konfigurasi", "/nicu/konfigurasi", "Konfigurasi"],
  ["Laporan", "/nicu/laporan", "Laporan"],
];
const sidebarBodyList = computed<SidebarBody[]>(() => [{ name: "nicu", type: linkType.SECTION,
  child: menu.filter((m) => hasPermission("NICU", m[2], "READ")).map((m) => ({ name: m[0], url: m[1], type: linkType.LINK, icon: "PhHeartbeat" })),
}]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="NICU" sidebarTitleUrl="/nicu" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'" />
  </div>
</template>
