<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import AntrianHeader from "../Layout/AntrianHeader.vue";
import SectionAntrianAdmisi from "./SectionAntrianAdmisi.vue";
import SectionAntrianRawatJalan from "./SectionAntrianRawatJalan.vue";
import SectionAntrianFarmasi from "./SectionAntrianFarmasi.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";

const value = ref("0");

const dataAntrianRjProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
  name: "",
  start_date: undefined as number | undefined,
  end_date: undefined as number | undefined,
  status_panggilan: [] as number[],
  pelayanan: "poli",
});

const dataAntrianAdmisiProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
  name: "",
  start_date: undefined as number | undefined,
  end_date: undefined as number | undefined,
  status_panggilan: [] as number[],
  pelayanan: "admisi",
});

const dataAntrianFarmasiProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
  name: "",
  start_date: undefined as number | undefined,
  end_date: undefined as number | undefined,
  status_panggilan: [] as number[],
  pelayanan: "farmasi",
});

const currentPaginationProperties = computed(() => {
  switch (value.value) {
    case "0":
      return dataAntrianAdmisiProperties.value;
    case "1":
      return dataAntrianRjProperties.value;
    case "2":
      return dataAntrianFarmasiProperties.value;
    default:
      return dataAntrianAdmisiProperties.value;
  }
});

const currentStartDateEpoch = computed(() => {
  switch (value.value) {
    case "0":
      return dataAntrianAdmisiProperties.value.start_date;
    case "1":
      return dataAntrianRjProperties.value.start_date;
    case "2":
      return dataAntrianFarmasiProperties.value.start_date;
    default:
      return undefined;
  }
});

const currentEndDateEpoch = computed(() => {
  switch (value.value) {
    case "0":
      return dataAntrianAdmisiProperties.value.end_date;
    case "1":
      return dataAntrianRjProperties.value.end_date;
    case "2":
      return dataAntrianFarmasiProperties.value.end_date;
    default:
      return undefined;
  }
});

// Handler untuk pagination rawat jalan
const handlePage = (event: any) => {
  const newPage = event.page + 1;
  const newLimit = event.rows;

  switch (value.value) {
    case "0":
      // Admisi
      dataAntrianAdmisiProperties.value.page = newPage;
      dataAntrianAdmisiProperties.value.page_size = newLimit;
      break;
    case "1":
      // Rawat Jalan
      dataAntrianRjProperties.value.page = newPage;
      dataAntrianRjProperties.value.page_size = newLimit;
      break;
    case "2":
      // Farmasi
      dataAntrianFarmasiProperties.value.page = newPage;
      dataAntrianFarmasiProperties.value.page_size = newLimit;
      break;
  }
};

// const handleUpdateTotalData = (totalData: number) => {
//   if (value.value === "0") {
//     dataAntrianAdmisiProperties.value.totalData = totalData;
//   } else if (value.value === "1") {
//     dataAntrianRjProperties.value.totalData = totalData;
//   } else if (value.value === "2") {
//     dataAntrianFarmasiProperties.value.totalData = totalData;
//   }
// };

// Handler terpisah untuk setiap tab
const handleUpdateTotalDataAdmisi = (totalData: number) => {
  dataAntrianAdmisiProperties.value.total = totalData;
};

const handleUpdateTotalDataRawatJalan = (totalData: number) => {
  dataAntrianRjProperties.value.total = totalData;
};

const handleUpdateTotalDataFarmasi = (totalData: number) => {
  dataAntrianFarmasiProperties.value.total = totalData;
};

// Tangkap event search dari header: hanya berlaku saat tab Rawat Jalan aktif
const handleHeaderSearch = (q: string, statuses?: string[]) => {
  switch (value.value) {
    case "0":
      dataAntrianAdmisiProperties.value.name = q;
      dataAntrianAdmisiProperties.value.status_panggilan =
        statuses?.map((status) => Number(status)) ?? [];
      dataAntrianAdmisiProperties.value.page = 1;
      break;
    case "1":
      dataAntrianRjProperties.value.name = q;
      dataAntrianRjProperties.value.status_panggilan =
        statuses?.map((status) => Number(status)) ?? [];
      dataAntrianRjProperties.value.page = 1;
      break;
    case "2":
      dataAntrianFarmasiProperties.value.name = q;
      dataAntrianFarmasiProperties.value.status_panggilan =
        statuses?.map((status) => Number(status)) ?? [];
      dataAntrianFarmasiProperties.value.page = 1;
      break;
  }
};

// Event dari header untuk rentang tanggal (epoch seconds)
const handleHeaderDateRange = (start?: number | null, end?: number | null) => {
  switch (value.value) {
    case "0":
      dataAntrianAdmisiProperties.value.start_date = start ?? undefined;
      dataAntrianAdmisiProperties.value.end_date = end ?? undefined;
      dataAntrianAdmisiProperties.value.page = 1;
      break;
    case "1":
      dataAntrianRjProperties.value.start_date = start ?? undefined;
      dataAntrianRjProperties.value.end_date = end ?? undefined;
      dataAntrianRjProperties.value.page = 1;
      break;
    case "2":
      dataAntrianFarmasiProperties.value.start_date = start ?? undefined;
      dataAntrianFarmasiProperties.value.end_date = end ?? undefined;
      dataAntrianFarmasiProperties.value.page = 1;
      break;
  }
};

// Reset q ketika berpindah tab ke selain Rawat Jalan
watch(
  () => value.value,
  (newVal) => {
    // Reset page ke 1 untuk semua tab saat berpindah
    switch (newVal) {
      case "0":
        dataAntrianAdmisiProperties.value.page = 1;
        break;
      case "1":
        dataAntrianRjProperties.value.page = 1;
        break;
      case "2":
        dataAntrianFarmasiProperties.value.page = 1;
        break;
    }

    if (newVal === "1") {
      // start_date/end_date undefined saat pertama kali
    } else {
      // Selain Rawat Jalan: dikosongkan agar tidak ditampilkan di header
      dataAntrianRjProperties.value.start_date = undefined;
      dataAntrianRjProperties.value.end_date = undefined;
      dataAntrianRjProperties.value.name = "";
      dataAntrianRjProperties.value.status_panggilan = [];
    }

    if (newVal === "2") {
      dataAntrianFarmasiProperties.value.name = "";
      dataAntrianFarmasiProperties.value.status_panggilan = [];
      dataAntrianFarmasiProperties.value.start_date = undefined;
      dataAntrianFarmasiProperties.value.end_date = undefined;
      // optional: reset total agar paginator sinkron, akan diperbarui oleh updateTotalData
      dataAntrianFarmasiProperties.value.total = 0;
    }
  },

  { immediate: true }
);
</script>

<template>
  <Card
    pt:body:class="overflow-auto pt-0 h-full"
    pt:content:class="overflow-auto h-full"
  >
    <template #header>
      <AntrianHeader
        :activeTab="value"
        title="Data Antrian"
        :filter="false"
        :search="false"
        :startDateEpoch="currentStartDateEpoch"
        :endDateEpoch="currentEndDateEpoch"
        @search="handleHeaderSearch"
        @dateRange="handleHeaderDateRange"
      >
        <template #header>
          <div class="flex flex-row gap-2 justify-end items-center">
            <CustomButton
              label="Admisi"
              class="w-[200px]"
              :text-color="value === '0' ? 'text-white' : 'text-opensimrs-300'"
              :border-color="
                value === '0' ? 'border-none' : 'border-opensimrs-300'
              "
              :class="value === '0' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="value = '0'"
              :outlined="value !== '0'"
            />
            <CustomButton
              label="Rawat Jalan"
              class="w-[200px]"
              :text-color="value === '1' ? 'text-white' : 'text-opensimrs-300'"
              :border-color="
                value === '1' ? 'border-none' : 'border-opensimrs-300'
              "
              :class="value === '1' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="value = '1'"
              :outlined="value !== '1'"
            />
            <CustomButton
              label="Farmasi"
              class="w-[200px]"
              :text-color="value === '2' ? 'text-white' : 'text-opensimrs-300'"
              :border-color="
                value === '2' ? 'border-none' : 'border-opensimrs-300'
              "
              :class="value === '2' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="value = '2'"
              :outlined="value !== '2'"
            />
          </div>
        </template>
      </AntrianHeader>
    </template>
    <template #content>
      <Tabs v-model:value="value" class="flex flex-col h-full">
        <TabPanels class="flex flex-col flex-1">
          <TabPanel value="0" class="flex flex-col flex-1">
            <SectionAntrianAdmisi
              :paginationProperties="dataAntrianAdmisiProperties"
              @updateTotalData="handleUpdateTotalDataAdmisi"
              class="flex flex-col flex-1"
            />
          </TabPanel>
          <TabPanel value="1" class="flex flex-col flex-1">
            <SectionAntrianRawatJalan
              :paginationProperties="dataAntrianRjProperties"
              @updateTotalData="handleUpdateTotalDataRawatJalan"
              class="flex flex-col flex-1"
            />
          </TabPanel>
          <TabPanel value="2" class="flex flex-col flex-1">
            <SectionAntrianFarmasi
              :paginationProperties="dataAntrianFarmasiProperties"
              @updateTotalData="handleUpdateTotalDataFarmasi"
              class="flex flex-col flex-1"
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
    <template #footer>
      <div class="flex justify-between px-5 py-2.5">
        <CustomPaginator
          class="ml-auto"
          :key="`paginator-${value}`"
          :rows="currentPaginationProperties.page_size"
          :totalRecords="currentPaginationProperties.total"
          :rowsPerPageOptions="[10, 20, 30]"
          @page="handlePage"
        />
      </div>
    </template>
  </Card>
</template>
