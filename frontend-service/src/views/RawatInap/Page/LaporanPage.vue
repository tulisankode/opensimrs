<script lang="ts" setup>
import type { MenuItem } from "primevue/menuitem";
import { onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import DataLaporanHeader from "../Layout/Header/DataLaporanHeader.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import DataKunjunganRawatInap from "../Layout/Tabel/Laporan/DataKunjunganRawatInap.vue";
import DataPerpindahanPasien from "../Layout/Tabel/Laporan/DataPerpindahanPasien.vue";
import DataPembatalanDirawat from "../Layout/Tabel/Laporan/DataPembatalanDirawat.vue";
import DataRekapTindakanPasien from "../Layout/Tabel/Laporan/DataRekapTindakanPasien.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import { utilsStore } from "@/stores/utils";
import { useRekapTindakanStore } from "@/stores/rawatJalan/laporan/rekapTindakan";
import { useAdmisiReportStore } from "@/stores/admisi/laporan";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { useRuanganStore } from "@/stores/datamaster/ruangan";
import { dateToEpoch, setTimeForDate } from "@/utils/Helpers";
import { useRIStore } from "@/stores/rawatInap/laporanranap";
import { useMonitoringKamarStore } from "@/stores/admisi/monitoringKamar";
import { downloadExportExcelBatalRawatRanap, downloadExportExcelKunjunganRanap, downloadExportExcelRekapTindakanPasien, downloadExportExcelPerpindahanPasien } from "@/stores/rawatInap/exportexcelranap";

// Filter 
interface Filter {
  timestamp: number;
  kelas: string;
  page?: number;
  limit?: number;
  q?: string;
  practitionerUuid?: string;
  pelayanan?: string;
  penjamin?: string;
  jenisKunjungan?: string;
  room?: string;
  startDate?: string;
  endDate?: string;
  name?: string;
  lokasiUuid?: string;
  month?: number;
}

// Pagination Properties
const properties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// STORE
const RIStore = useRIStore();
const useUtilsStore = utilsStore();
const rekapTindakanPasienStore = useRekapTindakanStore()
const kunjunganRawatInap = useAdmisiReportStore()
const dokterStore = usePraktisiStore()
const ruanganStore = useRuanganStore();
const monitoringKamarStore = useMonitoringKamarStore();

// Data From API
const reportData = ref([])
const dokterPayload = ref<any[]>([])
const ruanganPayload = ref<any[]>([])

const fetchLaporanData = async (filter: Filter = {
  kelas: "",
  timestamp: 0
}) => {
  useUtilsStore.setLoading(true);
  let response;
  try {
  if (pageType.value === "kunjungan-rawat-inap") {
    response = await RIStore.getKunjunganRanap(filter);
  } else if (pageType.value === "perpindahan-pasien") {
    response = await RIStore.getPerpindahan(filter);
  } else if (pageType.value === "pembatalan-dirawat") {
    response = await RIStore.getBatalRawat(filter)
  } else {
    response = await rekapTindakanPasienStore.getTindakanPasien(filter)
  }
   if(response && response.payload.data){
    properties.value.total = response.payload.pagination.totalData;
     return response.payload.data
   } else {
    return [];
   }
  } catch (error) {
    console.error("Failed to fetch data", error);
    return [];
  } finally {
    useUtilsStore.setLoading(false);
  }
}

// FETCH Dokter DPJP
const fetchDokterData = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await dokterStore.getAktifApi();
    if (response && response.payload) {
      if (pageType.value === "rekap-tindakan-pasien") {
        dokterPayload.value = response.payload;
      } else {
        dokterPayload.value = response.payload.filter((item: { isDoctor: boolean }) => item.isDoctor);
      }
    } else {
      dokterPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kategori ruangan", error);
    dokterPayload.value = [];
  } finally {
    useUtilsStore.setLoading(false);
  }
};

// FETCH RUANGAN
const fetchRuangan = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await monitoringKamarStore.getMonitoringKamar({ page: 1, limit: 9999 });
    if (response && response.payload) {
      ruanganPayload.value = response.payload;
    } else {
      ruanganPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    ruanganPayload.value = [];
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const handleExport = () => {
  const filter = setFilter();
  if (pageType.value === 'kunjungan-rawat-inap') {
    downloadExportExcelKunjunganRanap(filter);
  } else if (pageType.value === 'pembatalan-dirawat') {
    downloadExportExcelBatalRawatRanap(filter);
  } else if (pageType.value === 'rekap-tindakan-pasien') {
    downloadExportExcelRekapTindakanPasien(filter);
  } else if (pageType.value === 'perpindahan-pasien') {
    downloadExportExcelPerpindahanPasien(filter);
  }
};

const optionsKelas = ref([
  { label: "Kelas 1", value: "Kelas 1" },
  { label: "Kelas 2", value: "Kelas 2" },
  { label: "Kelas 3", value: "Kelas 3" },
  { label: "VIP", value: "VIP" },
  { label: "VVIP", value: "VVIP" },
]);

const searchData = async () => {
  let filter = {} as Filter;
  filter = setFilter();
  reportData.value = await fetchLaporanData(filter);
};

const setFilter = () => {
  let filter = {} as Filter;

  filter.page = properties.value.page;
  filter.limit = properties.value.page_size;
  filter.q = valueSearchRM.value;
  filter.room = searchRuanganFilter.value ?? "";

  if (
    pageType.value === "kunjungan-rawat-inap" ||
    pageType.value === "pembatalan-dirawat"
  ) {
    filter.practitionerUuid = searchDokterDPJPFilter.value ?? "";
    filter.jenisKunjungan = "RI";
    filter.kelas = searchKelasFilter.value ?? "";

    filter.startDate = `${dateToEpoch(
      setTimeForDate(valueStartedDate.value, 0, 0, 0)
    )}`;
    filter.endDate = `${dateToEpoch(
      setTimeForDate(valueEndedDate.value, 23, 59, 59)
    )}`;

  } else if (pageType.value === "rekap-tindakan-pasien") {
    filter.name = valueSearchRM.value;
    filter.pelayanan = "ri";
    filter.practitionerUuid = valueSearchPraktisi.value ?? "";
    if (valueBulan.value) {
      filter.timestamp = dateToEpoch(valueBulan.value);
    }
  } else if (pageType.value === "perpindahan-pasien") {
    filter.jenisKunjungan = "RI";
     filter.startDate = `${dateToEpoch(
      setTimeForDate(valueStartedDate.value, 0, 0, 0)
    )}`;
    filter.endDate = `${dateToEpoch(
      setTimeForDate(valueEndedDate.value, 23, 59, 59)
    )}`;
  }

  return filter;
};

const valueSearchRM = ref();
const valueSearchPraktisi = ref();
const valueStartedDate = ref<Date>(new Date());
const valueEndedDate = ref<Date>(new Date());

const valueBulan = ref<Date | null>(new Date());
const handleSearchRM = (searchRM: string) => {
  valueSearchRM.value = searchRM;
};
const handleSearchPraktisi = (searchDPJP: string) => {
  valueSearchPraktisi.value = searchDPJP;
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
  valueSearchPraktisi.value = "";
  valueStartedDate.value = new Date();
  valueEndedDate.value = new Date();
  valueBulan.value = new Date();
  searchRuanganFilter.value = "";
  searchKelasFilter.value = "";
  searchDokterDPJPFilter.value = "";
  
  resetFormRef.value.resetForm();
}

const handleReset = () => {
  resetForm();
  searchData();
};

const handleRefreshPage = () => {
  searchData();
};

const dataBreadCrumb = ref<MenuItem[]>([]);
const route = useRoute();
const pageType = ref("");

const searchRuanganFilter = ref<string>("");
const searchKelasFilter = ref<string>("");
const searchDokterDPJPFilter = ref<string>("");


const updatePageType = async (path: string) => {
  let tempArrPath = path.split("/");
  pageType.value = tempArrPath[3] ?? "";
  dataBreadCrumb.value = [
    {
      label:
        pageType.value == "kunjungan-rawat-inap"
          ? "Kunjungan Rawat Inap"
          : pageType.value == "perpindahan-pasien"
          ? "Perpindahan Pasien"
          : pageType.value == "pembatalan-dirawat"
          ? "Pembatalan Dirawat"
          : "Rekap Tindakan Pasien",
    },
  ];
  let filter = {} as Filter;
  filter = setFilter();
  reportData.value = await fetchLaporanData(filter);
};

const handlePage = (event: any) => {
  properties.value.page = event.page + 1;
  properties.value.page_size = event.rows;
  searchData();
};

onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});
onMounted(() => {
  updatePageType(route.path);
  fetchDokterData()
  fetchRuangan()
});
</script>

<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <!-- {{ searchRuanganFilter }} -->
      <DataLaporanHeader
      :value-bulan-filter="valueBulan"
      :value-praktisi-filter="valueSearchPraktisi"
      @update:value-r-m-filter="handleSearchRM"
      @update:value-praktisi-filter="handleSearchPraktisi"
       @update:started-date-filter="handleStartedDate"
        @update:ended-date-filter="handleEndedDate"
        @update:value-bulan-filter="handleBulan"
        @search="searchData"
        @reset="handleReset"
        @refresh-page="handleRefreshPage"
        :current-route-name="pageType"
        :data-bread-crumb="dataBreadCrumb"
        :praktisi-payload="dokterPayload"
        ref="resetFormRef"
      >
        <template
          #before-content
          v-if="
            pageType === 'kunjungan-rawat-inap' ||
            pageType === 'pembatalan-dirawat'
          "
        >
          <div class="contents">
            <CustomSelect
              v-model="searchRuanganFilter"
              label="Ruangan"
              class=""
              optionLabel="name"
              optionValue="name"
              place-holder="Pilih Ruangan"
              :options="ruanganPayload"
            />
            <CustomSelect
              v-model="searchKelasFilter"
              label="Kelas"
              class=""
              optionLabel="label"
              optionValue="value"
              place-holder="Pilih Kelas"
              :options="optionsKelas"
            />
            <CustomSelect
              v-model="searchDokterDPJPFilter"
              label="Dokter DPJP"
              class=""
              optionLabel="pegawai.name"
              optionValue="uuid"
              place-holder="Pilih Dokter"
              :options="dokterPayload"
            />
          </div>
        </template>
      </DataLaporanHeader>
    </template>
    <template #content>
      <div v-if="reportData.length">
        <DataKunjunganRawatInap v-if="pageType === 'kunjungan-rawat-inap'" :payload="reportData"/>
        <DataPerpindahanPasien v-if="pageType === 'perpindahan-pasien'" :payload="reportData"/>
        <DataPembatalanDirawat v-if="pageType === 'pembatalan-dirawat'" :payload="reportData"/>
        <DataRekapTindakanPasien v-if="pageType === 'rekap-tindakan-pasien'" :payload="reportData"/>
      </div>
      <NoData v-else/>
      <!-- <NoData /> -->
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
