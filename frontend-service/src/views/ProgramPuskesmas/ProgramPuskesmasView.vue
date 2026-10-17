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
      { name: "Kohort Ibu (KIA)", icon: "PhBabyCarriage", type: linkType.LINK, url: "/program-puskesmas/kia" },
      { name: "KB", icon: "PhHeartbeat", type: linkType.LINK, url: "/program-puskesmas/kb" },
      { name: "Imunisasi", icon: "PhSyringe", type: linkType.LINK, url: "/program-puskesmas/imunisasi" },
      { name: "MTBS/MTBM", icon: "PhClipboardText", type: linkType.LINK, url: "/program-puskesmas/mtbs" },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      { name: "Sasaran Program", icon: "PhTarget", type: linkType.LINK, url: "/program-puskesmas/sasaran" },
      { name: "Kegiatan UKM", icon: "PhUsersThree", type: linkType.LINK, url: "/program-puskesmas/ukm" },
    ],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [
      {
        name: "Datamaster",
        icon: "DatabaseFill",
        type: linkType.DROPDOWN,
        child: [
          { name: "Jenis Vaksin & Jadwal", type: linkType.LINK, url: "/program-puskesmas/datamaster/jenis-vaksin" },
          { name: "Format Laporan Dinkes", type: linkType.LINK, url: "/program-puskesmas/datamaster/format-laporan" },
        ],
      },
    ],
  },
  {
    name: "4",
    type: linkType.SECTION,
    child: [{ name: "Laporan Dinkes", icon: "FileReportIcon", type: linkType.LINK, url: "/program-puskesmas/laporan" }],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Program Puskesmas" sidebarTitleUrl="/program-puskesmas/kia" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
