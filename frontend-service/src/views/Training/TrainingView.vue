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
        name: "Daftar Kelas",
        icon: "TrainingIcon",
        type: linkType.LINK,
        url: "/training/daftar-kelas",
      },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      {
        name: "Booking Kelas",
        icon: "PhAddressBook",
        type: linkType.LINK,
        url: "/training/booking-kelas",
      },
    ],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [
      {
        name: "Datamaster",
        icon: "PhDatabase",
        type: linkType.DROPDOWN,
        child: [
          { name: "Kelas", type: linkType.LINK, url: '/training/datamaster/kelas'},
        ],
      }
    ],
  },
  {
    name: "4",
    type: linkType.SECTION,
    child: [
      {
        name: "Laporan",
        icon: "FileReportIcon",
        type: linkType.DROPDOWN,
        child: [
          { name: "Rekapitulasi Kunjungan Kelas Training", type: linkType.LINK, url: '/training/laporan/rekapitulasi'},
        ],
      }
    ],
  },
]);
const filter = ref("Semua Poli")


const updateFilterMenu = (newFilter: string) => {
  filter.value = newFilter;

};


onMounted(() => {
  if (route.query.filter) {
    router.replace({ path: "/training/daftar-kelas" });
  }
});
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="Training"
      sidebarTitleUrl="/training/daftar-kelas"
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
