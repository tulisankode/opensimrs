<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      {
        name: "Pasien IGD",
        icon: "MonitoringBedIcon",
        type: linkType.LINK,
        url: "/igd/pasien-igd",
      },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      {
        name: "BPJS",
        icon: "BPJSIcon",
        type: linkType.DROPDOWN,
        child: [
          { name: "Monitoring Kunjungan", type: linkType.LINK, url: '/igd/bpjs/monitoring-kunjungan'},
          { name: "Monitoring Riwayat Kunjungan", type: linkType.LINK , url:'/igd/bpjs/monitoring-riwayat-kunjungan'},
          { name: "Monitoring Obat Kunjungan", type: linkType.LINK, url: '/igd/bpjs/monitoring-obat-kunjungan'},
        ],
      },
      {
        name: "Laporan",
        icon: "FileReportIcon",
        type: linkType.DROPDOWN,
        child: [
          { name: "Kunjungan IGD", type: linkType.LINK, url:'/igd/laporan/kunjungan-igd' },
          { name: "Pembatalan Dirawat", type: linkType.LINK, url:'/igd/laporan/pembatalan-dirawat' },
          { name: "Rekap Tindakan Pasien", type: linkType.LINK , url:'/igd/laporan/rekap-tindakan-pasien'},
        ],
      },
    ],
  },
]);
const filter = ref("Semua Poli")


const updateFilterMenu = (newFilter: string) => {
  filter.value = newFilter;

};


onMounted(() => {
  if (route.query.filter) {
    router.replace({ path: "/igd/pasien-igd" });
  }
});
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="IGD"
      sidebarTitleUrl="/igd/pasien-igd"
      class="flex-none"
      :sidebar-body-list="sidebarBodyList"
      showFilterPoli
      showStockBtn
      v-model:filter="filter"
      @filter-changed="updateFilterMenu"
    />
    <component
      class="max-h-full overflow-auto grow"
      :is="$route.meta.page || 'div'"
      :filter="filter"
    ></component>
  </div>
</template>
