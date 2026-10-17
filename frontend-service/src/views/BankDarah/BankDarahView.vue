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
      { name: "Permintaan Darah", icon: "PhDrop", type: linkType.LINK, url: "/bank-darah/permintaan" },
      { name: "Uji Silang Serasi", icon: "PhFlask", type: linkType.LINK, url: "/bank-darah/crossmatch" },
      { name: "Stok & Penerimaan", icon: "PhArchive", type: linkType.LINK, url: "/bank-darah/stok" },
      { name: "Serah Terima", icon: "PhHandshake", type: linkType.LINK, url: "/bank-darah/serah-terima" },
      { name: "Pemantauan Transfusi", icon: "PhActivity", type: linkType.LINK, url: "/bank-darah/transfusi" },
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
        child: [{ name: "Komponen Darah", type: linkType.LINK, url: "/bank-darah/datamaster/komponen" }],
      },
      { name: "Pengaturan", icon: "PhGearSix", type: linkType.LINK, url: "/bank-darah/pengaturan" },
    ],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [{ name: "Laporan", icon: "FileReportIcon", type: linkType.LINK, url: "/bank-darah/laporan" }],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Bank Darah RS (BDRS)" sidebarTitleUrl="/bank-darah" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
