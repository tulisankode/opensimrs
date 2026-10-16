<script setup lang="ts">
import GearFillIcon from "@/components/icons/GearFillIcon.vue";
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { ref } from "vue";

const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      
          { name: "Profil Faskes", type: linkType.LINK, url: '/setting/profil-faskes', icon:'GearFillIcon' },
          { name: "Konfigurasi Integrasi", type: linkType.LINK, url:'/setting/konfigurasi-integrasi', icon:'GearFillIcon' },
          { name: "Print Out", type: linkType.LINK, url:'/setting/print-out', icon:"GearFillIcon" },
          { name: "Manajemen Modul", type: linkType.LINK, url:'/setting/manajemen-modul', icon:'GearFillIcon' },
          { name: "System", type: linkType.LINK, url:'/setting/system', icon:'GearFillIcon' },
          // Ekstensi tanpa kode (impor paket SIMRS Studio): superadmin saja
          ...(JSON.parse(localStorage.getItem("user") ?? "{}").role === "super admin" ? [{ name: "Ekstensi", type: linkType.LINK, url: "/setting/ekstensi", icon: "GearFillIcon" }] : []),
    ],
  },
]);
const filter = ref('')
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="Setting"
      sidebarTitleUrl="/setting/profil-faskes"
      class="flex-none"
      :sidebar-body-list="sidebarBodyList"
      v-model:filter="filter"
    />
    <component
      class="max-h-full overflow-auto grow"
      :is="$route.meta.page || 'div'"
      :filter="filter"
    ></component>
  </div>
</template>
