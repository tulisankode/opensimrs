<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import { useIgdLaporanStore } from "@/stores/igd/laporan";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { utilsStore } from "@/stores/utils";
import { useAdmisiReportStore } from "@/stores/admisi/laporan";
import { dateToEpoch, setTimeForDate } from "@/utils/Helpers";
import HeaderFilter from "../Layout/HeaderFilter.vue";
import KunjunganIgd from "./KunjunganIgd.vue";
import PembatalanDirawat from "./PembatalanDirawat.vue";
import RekapTindakanPasien from "./RekapTindakanPasien.vue";
import FooterPagination from "../Layout/FooterPagination.vue";
import NoData from "@/components/section/NoData.vue";
import {
  downloadExportExcelKunjunganIGD,
  downloadExportExcelBatalIGD,
  downloadExportExcelRekapTindakanPasien
} from "@/stores/igd/exportexceligd";
import { useRekapTindakanStore } from "@/stores/rawatJalan/laporan/rekapTindakan";

//Bread Crumb
const dataBreadCrumb = ref<MenuItem[]>([]);
const route = useRoute();
const pageType = ref("");

// Store
const rekapTindakanStore = useRekapTindakanStore();
const praktisiStore = usePraktisiStore();
const IgdLaporanStore = useIgdLaporanStore();
const admisiLaporanStore = useAdmisiReportStore();
const UseUtilsStore = utilsStore();
const reportType = ref("");
const reportData = ref<any[]>([]);
const searchQuery = ref("");
const selectedTimestamp = ref<number>(0);
const praktisiPayload = ref<any>([]);
const selectedFilterValue = ref("");
const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const properties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

const updatePageType = async (path: string) => {
  let tempArrPath = path.split("/");
  pageType.value = tempArrPath[3] ?? "";
  dataBreadCrumb.value = [
    {
      label: pageType.value
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    },
  ];
  reportType.value = pageType.value;
  properties.value.page = 1;
  let filter = {} as Filter;
  filter = setFilter();
  reportData.value = await fetchLaporanData(filter);
};

const setFilter = () => {
  let filter = {} as Filter;
  filter.page = properties.value.page;
  filter.limit = properties.value.page_size;
  filter.q = searchQuery.value;
  filter.name = searchQuery.value;
  filter.practitionerUuid = selectedFilterValue.value ?? "";

  if (pageType.value == "rekap-tindakan-pasien") {
    filter.pelayanan = "igd";
    if (valueBulanFilter.value) {
      filter.timestamp = dateToEpoch(valueBulanFilter.value);
    } else {
      filter.timestamp = undefined;
    }
  } else {
    filter.jenisKunjungan = "IGD";
    filter.startDate = `${dateToEpoch(
      setTimeForDate(startDateFilter.value, 0, 0, 0)
    )}`;
    filter.endDate = `${dateToEpoch(
      setTimeForDate(endDateFilter.value, 23, 59, 59)
    )}`;
  }
  
  return filter;
};

const resetFormRef = ref();
const resetFilter = () => {
  searchQuery.value = "";
  selectedFilterValue.value = "";
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  resetFormRef.value.resetForm();
 selectedTimestamp.value = 0;
};
const handleReset = () => {
  resetFilter();
  reloadData();
};

const handleExport = () => {
  const filter = setFilter();
  if (pageType.value === 'kunjungan-igd') {
    downloadExportExcelKunjunganIGD(filter);
  } else if (pageType.value === 'pembatalan-dirawat') {
    downloadExportExcelBatalIGD(filter);
  } else if (pageType.value === 'rekap-tindakan-pasien') {
    downloadExportExcelRekapTindakanPasien(filter);
  }
};

const valueBulanFilter = ref<Date | null>(new Date());

const handleSelectedPraktisi = (value: any) => {
  selectedFilterValue.value = value;
};
const handleSearchQuery = (value: string) => {
  searchQuery.value = value;
};
const handleSelectedBulan = (value: Date | null) => {
  valueBulanFilter.value = value;
};
const handleStartDate = (value: any) => {
  startDateFilter.value = value;
};
const handleEndDate = (value: any) => {
  endDateFilter.value = value;
};

onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});

interface Filter {
  pelayanan: string;
  timestamp: number | undefined;
  page?: number;
  limit?: number;
  q?: string;
  practitionerUuid?: string;
  jenisKunjungan?: string;
  penjamin?: string;
  ruangan?: string;
  startDate?: string;
  endDate?: string;
  name?: string;
  lokasiUuid?: string;
  month?: number;
}

const praktisiProperties = ref({
  page: 1,
  page_size: 9999,
  total: 0,
});

const searchDoctor = ref<string>("");

const fetchLaporanData = async (filter: Filter = {
  timestamp: undefined,
  pelayanan: ""
}) => {
  UseUtilsStore.setLoading(true);
  let response;
  try {
    if (pageType.value == "kunjungan-igd") {
      response = await IgdLaporanStore.getKunjunganIGD(filter);
    } else if (pageType.value == "pembatalan-dirawat") {
      response = await IgdLaporanStore.getBatalIGD(filter);
    } else if (pageType.value == "rekap-tindakan-pasien") {
      response = await rekapTindakanStore.getTindakanPasien(filter);
    }
    if (response && response.payload) {
      const paging = response.payload.pagination;
      properties.value.total = paging.total_data || paging.totalData || 0;
      const serverPageSize = paging.page_size || paging.pageSize;
      if (serverPageSize) {
        properties.value.page_size = serverPageSize;
      }
      return response.payload.data;
    } else return [];
  } catch (error) {
    console.error("Failed to fetch data", error);
    return [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const handlePage = (event: any) => {
  properties.value.page = event.page + 1;
  properties.value.page_size = event.rows;
  reloadData();
};

onMounted(() => {
  updatePageType(route.path);
  fetchPraktisi();
});
const fetchPraktisi = async () => {
  try {
    let isDoctor: boolean | undefined = true;
    if (pageType.value === "rekap-tindakan-pasien") {
      isDoctor = undefined;
    }
    const response = await praktisiStore.getApi({
      page: praktisiProperties.value.page,
      limit: praktisiProperties.value.page_size,
      name: searchDoctor.value,
      isDoctor: isDoctor,
    });

    if (response && response.payload) {
      praktisiPayload.value = response.payload;
    } else {
      praktisiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kategori ruangan", error);
    praktisiPayload.value = [];
  }
};

const reloadData = async () => {
  let filter = {} as Filter;
  filter = setFilter();
  reportData.value = await fetchLaporanData(filter);
};


const dokterDJP = ref([
  {
    uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a60f9",
    name: "Rudi tabuti",
  },
  { uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a6089", name: "dr. Ali" },
  { uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a6067", name: "dr. Doom" },
]);

</script>

<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderFilter
        :value-bulan-filter="valueBulanFilter"
        :pageType="pageType"
        :dataBreadCrumb="dataBreadCrumb"
        @update:valueSearch="handleSearchQuery"
        @reload-data="reloadData()"
        @update:selectedFilter="handleSelectedPraktisi"
        @search="reloadData()"
        @update:selectedMonth="handleSelectedBulan"
        @reset="handleReset()"
        @update:startDateFilter="handleStartDate"
        @update:endDateFilter="handleEndDate"
        :filterSelect="praktisiPayload"
        ref="resetFormRef"
        />
        <!-- :filterSelect="pageType === 'rekap-tindakan-pasien' ? praktisiPayload : dokterDJP" -->
    </template>
    <template #content>
      <!-- has data true -->
      <div v-if="reportData.length">
        <KunjunganIgd
          :payload="reportData"
          v-if="pageType === 'kunjungan-igd'"
        />
        <PembatalanDirawat
          :payload="reportData"
          v-if="pageType === 'pembatalan-dirawat'"
        />
        <RekapTindakanPasien
          :payload="reportData"
          v-if="pageType === 'rekap-tindakan-pasien'"
        />
      </div>

      <NoData v-else />
    </template>
    <template #footer>
      <FooterPagination
        :key="pageType"
        :rows="properties.page_size"
        :totalRecords="properties.total"
        @page="handlePage"
        @export="handleExport"
      />
    </template>
  </Card>
</template>
