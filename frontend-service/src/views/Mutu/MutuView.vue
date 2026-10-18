<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { fiturAktif } from "@/stores/modulFaskes";
import { computed } from "vue";

// Mutu & Akreditasi (penunjang-service). Fitur mutu_dokumen_kredensial (STD-0028): dasbor kesiapan, instrumen
// akreditasi, dokumen akreditasi, kredensial staf, dan dokumen yang dibagikan ke surveior. Fitur mutu_indikator
// (STD-0025): dasbor capaian, master indikator, pengumpulan & validasi data, dan tindak lanjut. Menu disaring izin oleh
// Sidebar; setiap fitur menambah bagian sidebar sendiri dengan syarat fiturnya.
const sidebarBodyList = computed<SidebarBody[]>(() => [
  ...(fiturAktif("mutu_indikator")
    ? [
        {
          name: "Indikator Mutu",
          type: linkType.SECTION,
          child: [
            { name: "Capaian Indikator", icon: "PhChartLineUp", type: linkType.LINK, url: "/mutu/indikator" },
            { name: "Pengumpulan Data", icon: "PhClipboardText", type: linkType.LINK, url: "/mutu/indikator/data" },
            { name: "Tindak Lanjut", icon: "PhArrowsClockwise", type: linkType.LINK, url: "/mutu/indikator/tindak-lanjut" },
            { name: "Master Indikator", icon: "PhListNumbers", type: linkType.LINK, url: "/mutu/indikator/master" },
          ],
        },
      ]
    : []),
  ...(fiturAktif("mutu_dokumen_kredensial")
    ? [
        {
          name: "1",
          type: linkType.SECTION,
          child: [
            { name: "Dasbor Kesiapan", icon: "PhChartBar", type: linkType.LINK, url: "/mutu/dasbor" },
            { name: "Dokumen Akreditasi", icon: "PhFiles", type: linkType.LINK, url: "/mutu/dokumen" },
            { name: "Kredensial Staf", icon: "PhIdentificationCard", type: linkType.LINK, url: "/mutu/kredensial" },
            { name: "Instrumen Akreditasi", icon: "PhListChecks", type: linkType.LINK, url: "/mutu/instrumen" },
          ],
        },
        {
          name: "2",
          type: linkType.SECTION,
          child: [{ name: "Dokumen Surveior", icon: "PhEye", type: linkType.LINK, url: "/mutu/surveior" }],
        },
      ]
    : []),
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Mutu & Akreditasi" sidebarTitleUrl="/mutu" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
