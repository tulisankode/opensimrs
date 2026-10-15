<script setup lang="ts">
import { onBeforeRouteLeave, useRoute } from "vue-router";
import DataPoliBPJSHeader from "../Layout/Header/DataPoliBPJSHeader.vue";
import { onMounted, ref } from "vue";
import type { MenuItem } from "primevue/menuitem";
import NoData from "@/components/section/NoData.vue";
import DataMonitoringKunjungan from "../Layout/Tabel/BPJS/DataMonitoringKunjungan.vue";
import DataMonitoringRiwayatKunjungan from "../Layout/Tabel/BPJS/DataMonitoringRiwayatKunjungan.vue";
import DataMonitoringObatKunjungan from "../Layout/Tabel/BPJS/DataMonitoringObatKunjungan.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";

const dataBreadCrumb = ref<MenuItem[]>([]);
const route = useRoute();
const pageType = ref("");

// Untuk mengetahui sekarang ada di rute mana

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
          : "Monitoring Obat Kunjungan",
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
      <DataPoliBPJSHeader
        :current-route-name="pageType"
        :dataBreadCrumb="dataBreadCrumb"
        @search-executed="handleSearchExecuted"
      >
      </DataPoliBPJSHeader>
    </template>
    <template #content>
      <!-- has data true -->
      <DataMonitoringKunjungan v-if="pageType === 'monitoring-kunjungan'" />
      <DataMonitoringRiwayatKunjungan
        v-if="pageType === 'monitoring-riwayat-kunjungan'"
      />
      <DataMonitoringObatKunjungan
        v-if="pageType === 'monitoring-obat-kunjungan'"
      />

      <!-- <NoData v-else/> -->
    </template>
    <template #footer>
      <div class="flex justify-between">
        <CustomButton
          icon="PhPrinter"
          icon-pos="left"
          icon-type="fill"
          class="my-auto bg-opensimrs-300"
          label="Cetak"
        />
        <CustomPaginator :rows="10" :totalRecords="120" @page="() => {}" />
      </div>
    </template>
  </Card>
</template>
