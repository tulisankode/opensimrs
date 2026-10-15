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
      { name: "Peserta MCU", icon: "PhUsersThree", type: linkType.LINK, url: "/mcu/peserta" },
      { name: "Pemeriksaan Stasiun", icon: "PhClipboardText", type: linkType.LINK, url: "/mcu/pemeriksaan" },
      { name: "Tagihan Korporasi", icon: "PhReceipt", type: linkType.LINK, url: "/mcu/tagihan-korporasi" },
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
          { name: "Paket MCU", type: linkType.LINK, url: "/mcu/datamaster/paket" },
          { name: "Perusahaan", type: linkType.LINK, url: "/mcu/datamaster/perusahaan" },
        ],
      },
    ],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [
      { name: "Laporan MCU", icon: "FileReportIcon", type: linkType.LINK, url: "/mcu/laporan" },
      { name: "Rekap Hasil (HRD)", icon: "PhIdentificationCard", type: linkType.LINK, url: "/mcu/rekap-hrd" },
    ],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="MCU" sidebarTitleUrl="/mcu" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
