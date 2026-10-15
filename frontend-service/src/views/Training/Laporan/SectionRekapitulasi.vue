<script setup lang="tsx">
import { onMounted, ref } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import HeaderFilterTraining from "../Layout/HeaderFilterTraining.vue";
import FooterPaginationTraining from "../Layout/FooterPaginationTraining.vue";

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
        pageType.value == "rekapitulasi"
          ? "Rekapitulasi Kunjungan Kelas Training"
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

const transaksiKelasPayload = ref([
  {
    tanggalKelas: "4 Juni 2024",
    kelasSesi: "Zumba",
    total: "10",
  },
  {
    tanggalKelas: "6 Juni 2024",
    kelasSesi: "Gym",
    total: "5",
  },
  {
    tanggalKelas: "4 Juni 2024",
    kelasSesi: "Pilates",
    total: "8",
  },
]);
</script>
<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderFilterTraining
        page-type="laporan"
        :dataBreadCrumb="dataBreadCrumb"
      />
    </template>
    <template #content>
      <DataTable
        :value="transaksiKelasPayload"
        tableStyle="min-width: 50rem"
        stripedRows
        scrollable
        scrollHeight="flex"
        class="text-xs"
      >
        <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #header>
            <div class="flex items-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{ slotProps.index + 1 }}
            </div>
          </template>
        </Column>
        <Column
          field="tanggalKelas"
          header="Tanggal"
          class="w-2/12"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="kelasSesi"
          header="Kelas"
          class="w-3/12"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="total"
          class="w-6/12 align-center"
          headerClass="bg-opensimrs-50 w-full text-center"
          body-class="w-full text-center"
        >
          <template #header="slotProps">
            <div
              class="flex items-center justify-center w-full font-semibold text-SM"
            >
              Total
            </div>
          </template>
        </Column>
      </DataTable>
    </template>
    <template #footer>
      <FooterPaginationTraining />
    </template>
  </Card>
</template>
