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
      { name: "Order Radiologi", icon: "PhClipboardText", type: linkType.LINK, url: "/radiologi/order" },
      { name: "Penjadwalan", icon: "PhCalendarCheck", type: linkType.LINK, url: "/radiologi/penjadwalan" },
      { name: "Pemeriksaan & Hasil", icon: "PhScan", type: linkType.LINK, url: "/radiologi/pemeriksaan" },
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
          { name: "Pemeriksaan Radiologi", type: linkType.LINK, url: "/radiologi/datamaster/pemeriksaan" },
          { name: "Paket Radiologi", type: linkType.LINK, url: "/radiologi/datamaster/paket" },
          { name: "Ruang & Alat", type: linkType.LINK, url: "/radiologi/datamaster/ruang" },
          { name: "Template Expertise", type: linkType.LINK, url: "/radiologi/datamaster/template" },
          { name: "Petugas Radiologi", type: linkType.LINK, url: "/radiologi/datamaster/petugas" },
        ],
      },
    ],
  },
  {
    name: "mapping-pacs",
    type: linkType.SECTION,
    child: [
      {
        name: "Mapping PACS",
        icon: "PhArrowsLeftRight",
        type: linkType.DROPDOWN,
        child: [
          { name: "Tindakan", type: linkType.LINK, url: "/radiologi/mapping/tindakan-pacs" },
          { name: "Unit, Dokter & Penjamin", type: linkType.LINK, url: "/radiologi/mapping/referensi-pacs" },
          { name: "Ruang/Alat (AE Title)", type: linkType.LINK, url: "/radiologi/mapping/ruang-pacs" },
        ],
      },
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
        child: [{ name: "Kunjungan Radiologi", type: linkType.LINK, url: "/radiologi/laporan/kunjungan" }],
      },
    ],
  },
]);
// Mapping PACS hanya untuk faskes yang mengaktifkan fitur Bridging PACS/RIS (Manajemen Modul).
const sidebarTampil = computed(() => sidebarBodyList.value.filter((s) => s.name !== "mapping-pacs" || fiturAktif("rad_bridging_pacs")));
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Radiologi" sidebarTitleUrl="/radiologi" class="flex-none" :sidebar-body-list="sidebarTampil" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
