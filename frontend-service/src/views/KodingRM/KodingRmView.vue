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
      { name: "Worklist Koding", icon: "PhListChecks", type: linkType.LINK, url: "/koding-rm/worklist" },
      { name: "Checklist & Rekap DPJP", icon: "PhListPlus", type: linkType.LINK, url: "/koding-rm/checklist" },
      { name: "Peminjaman Berkas", icon: "PhHandCoins", type: linkType.LINK, url: "/koding-rm/peminjaman" },
      { name: "Retensi & Pemusnahan", icon: "PhArchive", type: linkType.LINK, url: "/koding-rm/retensi" },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      { name: "Laporan Koding", icon: "FileReportIcon", type: linkType.LINK, url: "/koding-rm/laporan" },
    ],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Koding Rekam Medis" sidebarTitleUrl="/koding-rm" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
