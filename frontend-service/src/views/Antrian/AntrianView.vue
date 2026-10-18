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
      {
        name: "Konfigurasi",
        icon: "PhSliders",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Jadwal Dokter",
            icon: "",
            type: linkType.LINK,
            url: "/antrian/konfigurasi/jadwal-dokter",
          },
          {
            name: "Layar Antrian",
            icon: "",
            type: linkType.LINK,
            url: "/antrian/konfigurasi/layar-antrian",
          },
        ],
      },
      {
        name: "Data antrian",
        icon: "PhUserList",
        type: linkType.LINK,
        url: "/antrian/data-antrian",
      },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      {
        name: "Layar",
        icon: "PhScreencast",
        type: linkType.LINK,
        url: "/antrian/layar",
      },
      {
        name: "APM",
        icon: "PhAirplay",
        type: linkType.LINK,
        url: "/antrian/apm",
      },
    ],
  },
  {
    name: "antrean-bpjs",
    type: linkType.SECTION,
    child: [
      {
        name: "Antrean Online BPJS",
        icon: "PhWifiHigh",
        type: linkType.LINK,
        url: "/antrian/monitoring-bpjs",
      },
    ],
  },
]);
// Antrean Online BPJS (Mobile JKN) hanya untuk faskes yang mengaktifkan fitur antrian_online_bpjs (Manajemen Modul).
const sidebarTampil = computed(() => sidebarBodyList.value.filter((s) => s.name !== "antrean-bpjs" || fiturAktif("antrian_online_bpjs")));
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="Antrian"
      sidebarTitleUrl="/antrian"
      class="flex-none"
      :sidebar-body-list="sidebarTampil"
      showStockBtn
    />
    <component
      class="max-h-full overflow-auto grow"
      :is="$route.meta.page || 'div'"
    ></component>
  </div>
</template>
