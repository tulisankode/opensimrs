<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { ref } from "vue";

// Unit Hemodialisa (STD-0033, penunjang-service): jadwal & antrean, registrasi, resep, sesi (asesmen, lembar
// intradialitik, pasca-HD, adekuasi, pemakaian BHP, tagihan), dializer, datamaster, mapping HDIS, laporan.
const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      { name: "Jadwal & Antrean", icon: "PhCalendar", type: linkType.LINK, url: "/hemodialisa/jadwal" },
      { name: "Registrasi", icon: "PhClipboardText", type: linkType.LINK, url: "/hemodialisa/registrasi" },
      { name: "Resep HD", icon: "PhPrescription", type: linkType.LINK, url: "/hemodialisa/resep" },
      { name: "Sesi HD", icon: "PhHeartbeat", type: linkType.LINK, url: "/hemodialisa/sesi" },
      { name: "Dializer", icon: "PhPackage", type: linkType.LINK, url: "/hemodialisa/dializer" },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      { name: "Mesin & Shift", icon: "PhGear", type: linkType.LINK, url: "/hemodialisa/datamaster/mesin-shift" },
      { name: "Aturan Reuse Dializer", icon: "PhRecycle", type: linkType.LINK, url: "/hemodialisa/datamaster/aturan-reuse" },
      { name: "Mapping HDIS", icon: "PhPlugsConnected", type: linkType.LINK, url: "/hemodialisa/datamaster/mapping-hdis" },
      { name: "Laporan", icon: "FileReportIcon", type: linkType.LINK, url: "/hemodialisa/laporan" },
    ],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Hemodialisa" sidebarTitleUrl="/hemodialisa" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
