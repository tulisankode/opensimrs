<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { fiturAktif } from "@/stores/modulFaskes";
import { computed } from "vue";

// Mutu & Akreditasi (penunjang-service). Fitur mutu_dokumen_kredensial (STD-0028): dasbor kesiapan, instrumen
// akreditasi, dokumen akreditasi, kredensial staf, dan dokumen yang dibagikan ke surveior. Menu disaring izin oleh
// Sidebar; fitur mutu berikutnya menambah bagian sidebar sendiri dengan syarat fiturnya.
const sidebarBodyList = computed<SidebarBody[]>(() =>
  fiturAktif("mutu_dokumen_kredensial")
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
    : []
);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Mutu & Akreditasi" sidebarTitleUrl="/mutu" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
