<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { ref } from "vue";

// Daftar sidebar disaring otomatis oleh Sidebar.vue (filterSidebarByPermission): izin per rute dari
// permissionRouteRegistry (utils/permissions.ts) dan status fitur dari katalog modul (Virtual Office &
// Dashboard Eksekutif, STD-0049).
const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      { name: "Ringkasan", icon: "PhChartLine", type: linkType.LINK, url: "/dashboard" },
      { name: "Virtual Office", icon: "PhBuildingOffice", type: linkType.LINK, url: "/dashboard/virtual-office" },
      { name: "Dashboard Eksekutif", icon: "PhPresentationChart", type: linkType.LINK, url: "/dashboard/eksekutif" },
    ],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Dashboard" sidebarTitleUrl="/dashboard" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
