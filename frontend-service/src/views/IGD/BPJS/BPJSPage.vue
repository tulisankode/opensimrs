<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { onBeforeRouteLeave, useRoute } from "vue-router";

import HeaderFilter from "../Layout/HeaderFilter.vue";
import MonitoringKunjungan from "./MonitoringKunjungan.vue";
import MonitoringObatKunjungan from "./MonitoringObatKunjungan.vue";
import MonitoringRiwayatKunjungan from "./MonitoringRiwayatKunjungan.vue";
import FooterPagination from "../Layout/FooterPagination.vue";
const dataBreadCrumb = ref<MenuItem[]>([]);
const route = useRoute();
const pageType = ref("");

const updatePageType = (path: string) => {
  // resetFilter();
  let tempArrPath = path.split("/");
  pageType.value = tempArrPath[3] ?? "";
  dataBreadCrumb.value = [
    {
      label:
        pageType.value == "monitoring-kunjungan"
          ? "Monitoring Kunjungan"
          : pageType.value == "monitoring-riwayat-kunjungan"
          ? "Monitoring Riwayat Kunjungan"
          : pageType.value == "monitoring-obat-kunjungan"
          ? "Monitoring Obat Kunjungan"
          : "",
    },
  ];
};

onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});
onMounted(() => {
  updatePageType(route.path);
});
const hasData = ref(false);
const handleSearchExecuted = (status: boolean) => {
  hasData.value = status; // Set hasData menjadi true ketika event searchExecuted diemit
};
</script>

<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderFilter :pageType="pageType" :dataBreadCrumb="dataBreadCrumb" />
    </template>
    <template #content>
      <!-- has data true -->
      <MonitoringKunjungan v-if="pageType === 'monitoring-kunjungan'" />
      <MonitoringObatKunjungan
        v-if="pageType === 'monitoring-obat-kunjungan'"
      />
      <MonitoringRiwayatKunjungan
        v-if="pageType === 'monitoring-riwayat-kunjungan'"
      />
      <!-- <NoData v-else/> -->
    </template>
    <template #footer>
      <!-- FIXME -->
      <!-- <FooterPagination/> -->
    </template>
  </Card>
</template>
