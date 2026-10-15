<script lang="ts" setup>
import type { MenuItem } from "primevue/menuitem";
import { onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import DataLaporanHeader from "../Layout/Header/DataLaporanHeader.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import DataKunjunganRawatJalan from "../Layout/Tabel/Laporan/DataKunjunganRawatJalan.vue";
import DataPembatalanPoli from "../Layout/Tabel/Laporan/DataPembatalanPoli.vue";
import DataRekapTindakanPasien from "../Layout/Tabel/Laporan/DataRekapTindakanPasien.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import { utilsStore } from "@/stores/utils";
import { useRekapTindakanStore } from "@/stores/rawatJalan/laporan/rekapTindakan";
import { useAdmisiReportStore } from "@/stores/admisi/laporan";
import { dateToEpoch, setTimeForDate } from "@/utils/Helpers";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import { useRJStore } from "@/stores/rawatJalan/laporanrajal";
import { downloadExportExcelKunjunganRajal, downloadExportExcelBatalRawatJalan, downloadExportExcelRekapTindakanPasien } from "@/stores/rawatJalan/exportexcelrajal";


const properties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

const praktisiProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

const lokasiProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Search Dokter
const searchDoctor = ref<string>("");


// STORE
const RJStore = useRJStore();
const useUtilsStore = utilsStore();
const rekapTindakanPasienStore = useRekapTindakanStore();
const kunjunganRawatJalanStore = useAdmisiReportStore();
const praktisiStore = usePraktisiStore();
const lokasiStore = useLokasiStore();


// Data from Fetch API
const reportData = ref([]);
const praktisiPayload = ref<any[]>([]);
const lokasiPayload = ref<any[]>([]);

const fetchLaporanData = async (filter: Filter = {
  polyclinic: "",
  timestamp: 0
}) => {
  useUtilsStore.setLoading(true);
  let response;
  try {
    if (pageType.value == "kunjungan-rawat-jalan") {
      response = await RJStore.getKunjunganRajal(filter);
    } else if (pageType.value == "pembatalan-poli") {
      response = await RJStore.getBatalPoli(filter);
    } else if (pageType.value == "rekap-tindakan-pasien") {
      response = await rekapTindakanPasienStore.getTindakanPasien(filter);
    }

    if (response && response.payload) {
      properties.value.total = response.payload.pagination.totalData;
      return response.payload.data;
    } else return [];
  } catch (error) {
    console.error("Failed to fetch data", error);
    return [];
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const searchQuery = ref<string>("");

const fetchPraktisiData = async () => {
  useUtilsStore.setLoading(true);
  try {
    let isDoctor: boolean | undefined = true;
    if (pageType.value === "rekap-tindakan-pasien") {
      isDoctor = undefined;
    }
    const response = await praktisiStore.getApi({
      page: 1,
      limit: 9999,
      name: searchDoctor.value,
      isDoctor: isDoctor,
    });
    if (response && response.payload) {
      praktisiPayload.value = response.payload;
    } else {
      praktisiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch praktisi data", error);
    praktisiPayload.value = [];
  } finally {
    useUtilsStore.setLoading(false);
  }
};
const fetchLokasiData = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await lokasiStore.getApi(0, 9999);
  if (response && response.payload) {
    lokasiPayload.value = response.payload.filter((lokasi: any) => {
      return (
        lokasi.locationType?.toLowerCase() === "ward" &&
        Boolean(lokasi.isPoli) === true
      );
    });
  } else {
    lokasiPayload.value = [];
  }
  } catch (error) {
    console.error("Failed to fetch data", error);
    lokasiPayload.value = [];
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const handleExport = () => {
  const filter = setFilter();
  if (pageType.value === 'kunjungan-rawat-jalan') {
    downloadExportExcelKunjunganRajal(filter);
  } else if (pageType.value === 'pembatalan-poli') {
    downloadExportExcelBatalRawatJalan(filter);
  } else if (pageType.value === 'rekap-tindakan-pasien') {
    downloadExportExcelRekapTindakanPasien(filter);
  }
};

const dataBreadCrumb = ref<MenuItem[]>([]);
const route = useRoute();
const pageType = ref("");

const searchPoliklinikFilter = ref<string>("");
const searchDokterDPJPFilter = ref<string>("");
const searchPraktisiFilter = ref<string>("");


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
  let filter = {} as Filter;
  filter = setFilter();
  reportData.value = await fetchLaporanData(filter);
};

onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});
onMounted(() => {
  updatePageType(route.path);
  fetchPraktisiData();
  fetchLokasiData()
});

interface Filter {
  timestamp: number;
  polyclinic: string;
  page?: number;
  limit?: number;
  q?: string;
  practitionerUuid?: string;
  pelayanan?: string;
  jenisKunjungan?: string;
  penjamin?: string;
  ruangan?: string;
  startDate?: string;
  endDate?: string;
  name?: string;
  lokasiUuid?: string;
  month?: number;
}

const searchData = async () => {
  let filter = {} as Filter;
  filter = setFilter();
  reportData.value = await fetchLaporanData(filter);
};

const handlePage = (event: any) => {
  properties.value.page = event.page + 1;
  properties.value.page_size = event.rows;
  searchData();
};



const setFilter = () => {
  let filter = {} as Filter;

  
  filter.page = properties.value.page;
  filter.limit = properties.value.page_size;
  filter.q = valueSearchRM.value;
  filter.name = valueSearchRM.value;
 


  if (pageType.value == "kunjungan-rawat-jalan") {
    filter.practitionerUuid = valueSearchDPJP.value ?? "";
    filter.jenisKunjungan = "RJ"
  } else if (pageType.value == "pembatalan-poli") {
    filter.practitionerUuid = searchDokterDPJPFilter.value ?? "";
    filter.pelayanan = "RJ"
    filter.polyclinic = searchPoliklinikFilter.value ?? ""; 
  } else if (pageType.value == "rekap-tindakan-pasien") {
    filter.practitionerUuid = searchPraktisiFilter.value ?? "";
    filter.pelayanan = "rj"
  }

  filter.startDate = `${dateToEpoch(
    setTimeForDate(valueStartedDate.value, 0, 0, 0)
  )}`;
  filter.endDate = `${dateToEpoch(
    setTimeForDate(valueEndedDate.value, 23, 59, 59)
  )}`;
  if (valueBulan.value) {
    filter.timestamp = dateToEpoch(valueBulan.value);
  }
  filter.lokasiUuid = searchPoliklinikFilter.value ?? ""

  return filter;
};

const valueSearchRM = ref();
const valueSearchDPJP = ref();
const valueStartedDate = ref<Date>(new Date());
const valueEndedDate = ref<Date>(new Date());


const valueBulan = ref<Date | null>(new Date());
const handleSearchRM = (searchRM: string) => {
  valueSearchRM.value = searchRM;
};

const handleSearchDPJP = (searchDPJP: string) => {
  valueSearchDPJP.value = searchDPJP;
};

const handleStartedDate = (startedDate: any) => {
  valueStartedDate.value = startedDate;
};
const handleEndedDate = (endedDate: any) => {
  valueEndedDate.value = endedDate;
};

const handleBulan = (bulan: any) => {
  valueBulan.value = bulan;
};
const resetFormRef = ref();


const resetForm = () => {
  valueSearchRM.value = "";
  searchPoliklinikFilter.value = "";
  searchPraktisiFilter.value = "";
  valueBulan.value = null;
  valueSearchDPJP.value = "";
  searchDokterDPJPFilter.value = "";

  let date = new Date(),
    y = date.getFullYear(),
    m = date.getMonth();
  valueStartedDate.value = new Date(y, m, 1);
  valueEndedDate.value = new Date(y, m + 1, 0);

  if (resetFormRef.value) {
    resetFormRef.value.resetForm();
  }
};

// Reset filter fields
const handleReset = () => {
  resetForm();
  searchData();
};

const handleRefreshPage = () => {
  searchData();
};
</script>

<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <DataLaporanHeader
        :value-bulan-filter="valueBulan"
        @update:value-r-m-filter="handleSearchRM"
        @update:selected-dokter-d-p-j-p="handleSearchDPJP"
        @update:started-date-filter="handleStartedDate"
        @update:ended-date-filter="handleEndedDate"
        @update:value-bulan-filter="handleBulan"
        @search="searchData"
        @reset="handleReset"
        @refresh-page="handleRefreshPage"
        :current-route-name="pageType"
        :data-bread-crumb="dataBreadCrumb"
        :praktisi-payload="praktisiPayload"
        ref="resetFormRef"
      >
        <template
          #before-content
          v-if="
            pageType === 'pembatalan-poli' ||
            pageType === 'rekap-tindakan-pasien'
          "
        >
          <div class="contents">
            <CustomSelect
              v-if="
                pageType === 'pembatalan-poli' ||
                pageType === 'rekap-tindakan-pasien'
              "
              v-model="searchPoliklinikFilter"
              label="Poliklinik"
              class=""
              optionLabel="name"
              optionValue="uuid"
              place-holder="Pilih Poliklinik"
              :options="lokasiPayload"
            />
            <CustomSelect
              v-if="pageType === 'pembatalan-poli'"
              v-model="searchDokterDPJPFilter"
              label="Dokter DPJP"
              class=""
              optionLabel="pegawai.name"
              optionValue="uuid"
              :options="praktisiPayload"
              place-holder="Pilih Dokter"
            />
            <CustomSelect
              v-if="pageType === 'rekap-tindakan-pasien'"
              v-model="searchPraktisiFilter"
              label="Praktisi"
              class=""
              optionLabel="pegawai.name"
              optionValue="uuid"
              place-holder="Semua"
              :options="praktisiPayload"
            />
          </div>
        </template>
      </DataLaporanHeader>
    </template>
    <template #content>
      <DataKunjunganRawatJalan
        v-if="pageType === 'kunjungan-rawat-jalan'"
        :kunjunganData="reportData"
      />
      <DataPembatalanPoli v-if="pageType === 'pembatalan-poli'"  :pembatalanPoliData="reportData"/>
      <DataRekapTindakanPasien :rekapTindakanPasienData="reportData" v-if="pageType === 'rekap-tindakan-pasien'"/>
    </template>
    <template #footer>
      <div class="flex justify-between">
        <CustomButton
          icon="PhPrinter"
          icon-pos="left"
          icon-type="fill"
          class="my-auto bg-opensimrs-300"
          label="Cetak"
          @click="handleExport"
        />
        <CustomPaginator
          :rows="properties.page_size"
          :totalRecords="properties.total"
          @page="handlePage"
        />
      </div>
    </template>
  </Card>
</template>
