<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { computed, ref } from "vue";
import { fiturAktif } from "@/stores/modulFaskes";

const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      { name: "Order PA", icon: "PhClipboardText", type: linkType.LINK, url: "/patologi-anatomi/order" },
      { name: "Penerimaan Jaringan", icon: "PhFlask", type: linkType.LINK, url: "/patologi-anatomi/penerimaan" },
      { name: "Pemeriksaan & Diagnosis", icon: "PhMicroscope", type: linkType.LINK, url: "/patologi-anatomi/pemeriksaan" },
      { name: "Arsip Blok & Slide", icon: "PhArchive", type: linkType.LINK, url: "/patologi-anatomi/arsip" },
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
          { name: "Pemeriksaan PA", type: linkType.LINK, url: "/patologi-anatomi/datamaster/pemeriksaan" },
          { name: "Template Laporan", type: linkType.LINK, url: "/patologi-anatomi/datamaster/template" },
        ],
      },
    ],
  },
  {
    name: "mapping-lis",
    type: linkType.SECTION,
    child: [
      { name: "Mapping LIS PA", icon: "PhArrowsLeftRight", type: linkType.LINK, url: "/patologi-anatomi/mapping/lis" },
    ],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [
      {
        name: "Laporan",
        icon: "FileReportIcon",
        type: linkType.DROPDOWN,
        child: [
          { name: "Kunjungan PA", type: linkType.LINK, url: "/patologi-anatomi/laporan/kunjungan" },
        ],
      },
    ],
  },
]);
// Mapping LIS PA hanya tampil bila fitur Bridging LIS Patologi Anatomi aktif (Manajemen Modul).
const sidebarTampil = computed(() => sidebarBodyList.value.filter((s) => s.name !== "mapping-lis" || fiturAktif("pa_bridging_lis")));
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Patologi Anatomi" sidebarTitleUrl="/patologi-anatomi" class="flex-none" :sidebar-body-list="sidebarTampil" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
