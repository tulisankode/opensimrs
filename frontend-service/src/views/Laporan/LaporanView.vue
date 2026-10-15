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
        name: "Jumlah Kunjungan Berdasarkan Status Rawat",
        icon: "FileReportIcon",
        type: linkType.LINK,
        url: "/laporan/jumlah-kunjungan",
      },
      {
        name: "Rekapitulasi Tindakan",
        icon: "FileReportIcon",
        type: linkType.LINK,
        url: "/laporan/rekapitulasi-tindakan",
      },
      {
        name: "Rekapitulasi Pemeriksaan Lab",
        icon: "FileReportIcon",
        type: linkType.LINK,
        url: "/laporan/rekapitulasi-pemeriksaan-lab",
      },
      {
        name: "Rekapitulasi Pendapatan",
        icon: "FileReportIcon",
        type: linkType.LINK,
        url: "/laporan/rekapitulasi-pendapatan",
      },
      {
        name: "Rekapitulasi Diagnosis berdasarkan Umur Pasien",
        icon: "FileReportIcon",
        type: linkType.LINK,
        url: "/laporan/rekapitulasi-diagnosis",
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
    router.replace({ path: "/laporan/jumlah-kunjungan" });
  }
});
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="Laporan"
      sidebarTitleUrl="/laporan/jumlah-kunjungan"
      class="flex-none"
      :sidebar-body-list="sidebarBodyList"
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
