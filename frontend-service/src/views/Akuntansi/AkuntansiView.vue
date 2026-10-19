<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { fiturAktif } from "@/stores/modulFaskes";
import { computed } from "vue";

// Akuntansi & Remunerasi (penunjang-service /akuntansi, STD-0031). Menu disaring izin oleh Sidebar dan status fitur katalog
// (akuntansi_jurnal wajib; akuntansi_laporan dapat dimatikan per faskes). Remunerasi (STD-0032) menambah bagian menu di sini.
const sidebarBodyList = computed<SidebarBody[]>(() => [
  {
    name: "Pembukuan",
    type: linkType.SECTION,
    child: [
      { name: "Jurnal", icon: "PhNotebook", type: linkType.LINK, url: "/akuntansi/jurnal" },
      { name: "Persetujuan Jurnal", icon: "PhSealCheck", type: linkType.LINK, url: "/akuntansi/persetujuan" },
      { name: "Buku Besar", icon: "PhBooks", type: linkType.LINK, url: "/akuntansi/buku-besar" },
      { name: "Neraca Saldo", icon: "PhScales", type: linkType.LINK, url: "/akuntansi/neraca-saldo" },
      { name: "Periode & Tutup Buku", icon: "PhCalendarCheck", type: linkType.LINK, url: "/akuntansi/periode" },
    ],
  },
  ...(fiturAktif("akuntansi_laporan")
    ? [{ name: "Pelaporan", type: linkType.SECTION, child: [{ name: "Laporan Keuangan", icon: "PhChartLine", type: linkType.LINK, url: "/akuntansi/laporan" }] }]
    : []),
  {
    name: "Pengaturan",
    type: linkType.SECTION,
    child: [
      { name: "Bagan Akun (COA)", icon: "PhTreeStructure", type: linkType.LINK, url: "/akuntansi/coa" },
      { name: "Pemetaan Akun", icon: "PhArrowsLeftRight", type: linkType.LINK, url: "/akuntansi/pemetaan" },
    ],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Akuntansi" sidebarTitleUrl="/akuntansi" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
