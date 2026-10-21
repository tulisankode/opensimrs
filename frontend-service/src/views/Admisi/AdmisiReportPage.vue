<script setup lang="ts">
import { onMounted, ref, watch, nextTick, defineEmits, computed, reactive } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";
import NoData from "@/components/section/NoData.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import { utilsStore } from "@/stores/utils";
import { useAdmisiReportStore } from "@/stores/admisi/laporan";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { usePenjaminStore } from "@/stores/datamaster/penjamin";
import { epochToDate, dateToEpoch, setTimeForDate } from "@/utils/Helpers";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import { downloadExportExcelKunjungan, downloadExportExcelBatalKunjungan, downloadExportExcelStatusKamar, downloadExportExcelKeperawatanInapPasien, downloadExportExcelBayiBaruLahir, downloadExportExcelRekapKunjungan } from "@/utils/exportexceladmisi";
import axios from "axios";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import { useMonitoringKamarStore } from "@/stores/admisi/monitoringKamar";

const penjaminStore = usePenjaminStore();
const storeUtils = utilsStore();
const admisiLaporanStore = useAdmisiReportStore();
const praktisiStore = usePraktisiStore();
const lokasiStore = useLokasiStore();
const monitoringKamarStore = useMonitoringKamarStore();
const emit = defineEmits(["search"]);
const route = useRoute();
const pageType = ref("");
const listJenisKunjungan = ref<any[]>([]);
const listPenjamin = ref<any[]>([]);
const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const penjaminOptions = computed(() => {
  return listPenjamin.value;
});
const dataBreadCrumb = ref<MenuItem[]>([]);
const properties = ref({
  page: 1,
  pageSize: 10,
  total: 0,
});
const jenisKunjunganOptions = [
  { label: "Semua", value: null },
  { label: "RJ", value: "RJ" },
  { label: "RI", value: "RI" },
  { label: "IGD", value: "IGD" }
];


type RekapRow = {
  name: string;
  total: number;
} & { [key: string]: number | string };

const reportType = ref("");
const reportData = ref<RekapRow[]>([]);
const expandedRows = ref();
const expandedRowsBayi = ref();
const isLoading = ref(false)
const rekapData = ref<any[]>([]);
const daysInMonth = ref(31);
const rekapDokterData = ref<any[]>([]);
const totalDokterPerDay = ref<{ [key: string]: number }>({});
const grandTotalDokter = ref(0);
const rekapPenjaminData = ref<any[]>([]);
const totalPenjaminPerDay = ref<{ [key: string]: number }>({});
const grandTotalPenjamin = ref(0);
const totalKunjunganPerDay = ref<{ [key: string]: number }>({});
const grandTotalKunjungan = ref(0);
const dateRangeColumns = ref<string[]>([]);
const admisiReportStore = useAdmisiReportStore();

const formatDateHeader = (fullDate: string) => {
  if (!fullDate) return '';
  const parts = fullDate.split('-');
  return `${parts[2]}/${parts[1]}`;
};

const generateDateRangeColumns = (start: Date, end: Date) => {
  if (!start || !end) return;
  const dates = [];
  let currentDate = new Date(start);
  currentDate.setHours(0, 0, 0, 0);

  const finalDate = new Date(end);
  finalDate.setHours(0, 0, 0, 0);

  while (currentDate <= finalDate) {
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  dateRangeColumns.value = dates;
};

watch(
  [startDateFilter, endDateFilter],
  ([newStart, newEnd]) => {
    generateDateRangeColumns(newStart, newEnd);
  },
  { 
    immediate: true,
    deep: true
  } 
);


const fetchAllReportData = async () => {
  if (pageType.value.startsWith('rekap-')) {
    storeUtils.setLoading(true);
    try {
      await Promise.all([
        fetchRekapData(),
        fetchRekapDokter(),
        fetchRekapPenjamin()
      ]);
    } catch (error) {
      console.error("Gagal memuat semua data rekap:", error);
    } finally {
      storeUtils.setLoading(false);
    }
  }
};

const fetchRekapData = async () => {
  storeUtils.setLoading(true);
  try {
    const startDate = dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0));
    const endDate = dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59));

    const reportParams = {
      startDate: String(startDate),
      endDate: String(endDate),
      jenisKunjungan: filterParams.jenis_kunjungan ?? "",
      limit: 99999,
      page: 1,
    };

    const response = await admisiLaporanStore.getJenisKunjunganReport(reportParams);

    if (response && response.payload) {
      processRekapData(response.payload);
    } else {
      rekapData.value = [];
    }
  } catch (error) {
    console.error("Gagal mengambil data rekap:", error);
    rekapData.value = [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const processRekapData = (payload: any) => {
  const dailyTotals: { [key: string]: number } = {};
  if (payload.totalHarian && Array.isArray(payload.totalHarian)) {
    for (const item of payload.totalHarian) {
      dailyTotals[item.tanggal] = item.total;
    }
  }
  totalKunjunganPerDay.value = dailyTotals;
  grandTotalKunjungan.value = payload.totalKeseluruhan || 0;

  const finalData: RekapRow[] = [];
  const kunjunganData = payload.kunjungan;

  const totalsMap: { [key: string]: number } = {};
  if (payload.totalJenisKunjungan && Array.isArray(payload.totalJenisKunjungan)) {
    for (const item of payload.totalJenisKunjungan) {
      totalsMap[item.jenisKunjungan] = item.total;
    }
  }

  for (const jenisKunjungan in kunjunganData) {
    const dailyDataArray = kunjunganData[jenisKunjungan];
    const rowData: RekapRow = {
      name: jenisKunjungan,
      total: totalsMap[jenisKunjungan] || 0,
    };

    if (Array.isArray(dailyDataArray)) {
      for (const dailyItem of dailyDataArray) {
        rowData[dailyItem.tanggal] = dailyItem.total;
      }
    }

    for (const dateKey of dateRangeColumns.value) {
      if (!rowData.hasOwnProperty(dateKey)) {
        rowData[dateKey] = 0;
      }
    }

    finalData.push(rowData);
  }

  rekapData.value = finalData;
};

const fetchRekapDokter = async () => {
  storeUtils.setLoading(true);
  try {
    const startDate = dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0));
    const endDate = dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59));

     const reportParams = {
      startDate: String(startDate),
      endDate: String(endDate),
      practitionerUuid: filterParams.dpjp ?? "",
      limit: 99999,
      page: 1,
    };

    const response = await admisiLaporanStore.getDpjpReport(reportParams);

    if (response && response.payload) {
      processRekapDokter(response.payload);
    } else {
      rekapDokterData.value = [];
      totalDokterPerDay.value = {};
      grandTotalDokter.value = 0;
    }
  } catch (error) {
    console.error("Gagal mengambil data rekap dokter:", error);
    rekapDokterData.value = [];
    totalDokterPerDay.value = {};
    grandTotalDokter.value = 0;
  } finally {
    storeUtils.setLoading(false);
  }
};

const processRekapDokter = (payload: any) => {
  const dailyTotals: { [key: string]: number } = {};
  if (payload.totalHarian && Array.isArray(payload.totalHarian)) {
    for (const item of payload.totalHarian) {
      dailyTotals[item.tanggal] = item.total;
    }
  }
  totalDokterPerDay.value = dailyTotals;
  grandTotalDokter.value = payload.totalKeseluruhan || 0;

  const finalData: RekapRow[] = [];
  const dokterData = payload.dokter;

  const doctorTotals: { [key: string]: number } = {};
  if (payload.totalDokter && Array.isArray(payload.totalDokter)) {
    for (const item of payload.totalDokter) {
      doctorTotals[item.namaDokter] = item.total;
    }
  }

  for (const dokterName in dokterData) {
    const dailyDataArray = dokterData[dokterName];
    const rowData: RekapRow = {
      name: dokterName,
      total: doctorTotals[dokterName] || 0,
    };

    if (Array.isArray(dailyDataArray)) {
      for (const dailyItem of dailyDataArray) {
        rowData[dailyItem.tanggal] = dailyItem.total;
      }
    }

    for (const dateKey of dateRangeColumns.value) {
      if (!rowData.hasOwnProperty(dateKey)) {
        rowData[dateKey] = 0;
      }
    }

    finalData.push(rowData);
  }

  rekapDokterData.value = finalData;
};

const fetchRekapPenjamin = async () => {
  storeUtils.setLoading(true);
  try {
    const startDate = dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0));
    const endDate = dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59));

    const reportParams = {
      startDate: String(startDate),
      endDate: String(endDate),
      penjamin: filterParams.penjamin ?? "",
      limit: 99999,
      page: 1,
    };


    const response = await admisiLaporanStore.getPenjaminReport(reportParams);

    if (response && response.payload) {
      processRekapPenjamin(response.payload);
    } else {
      rekapPenjaminData.value = [];
      totalPenjaminPerDay.value = {};
      grandTotalPenjamin.value = 0;
    }
  } catch (error) {
    console.error("Gagal mengambil data rekap penjamin:", error);
    rekapPenjaminData.value = [];
    totalPenjaminPerDay.value = {};
    grandTotalPenjamin.value = 0;
  } finally {
    storeUtils.setLoading(false);
  }
};

const processRekapPenjamin = (payload: any) => {
  const dailyTotals: { [key: string]: number } = {};
  if (payload.totalHarian && Array.isArray(payload.totalHarian)) {
    for (const item of payload.totalHarian) {
      dailyTotals[item.tanggal] = item.total;
    }
  }
  totalPenjaminPerDay.value = dailyTotals;
  grandTotalPenjamin.value = payload.totalKeseluruhan || 0;

  const finalData: RekapRow[] = [];
  const penjaminData = payload.penjamin;

  const penjaminTotals: { [key: string]: number } = {};
  if (payload.totalPenjamin && Array.isArray(payload.totalPenjamin)) {
    for (const item of payload.totalPenjamin) {
      penjaminTotals[item.namaPenjamin] = item.total;
    }
  }

  for (const penjaminName in penjaminData) {
    const dailyDataArray = penjaminData[penjaminName];
    const rowData: RekapRow = {
      name: penjaminName,
      total: penjaminTotals[penjaminName] || 0,
    };

    if (Array.isArray(dailyDataArray)) {
      for (const dailyItem of dailyDataArray) {
        rowData[dailyItem.tanggal] = dailyItem.total;
      }
    }

    for (const dateKey of dateRangeColumns.value) {
      if (!rowData.hasOwnProperty(dateKey)) {
        rowData[dateKey] = 0;
      }
    }

    finalData.push(rowData);
  }

  rekapPenjaminData.value = finalData;
};

const updatePageType = async (path: string) => {
  resetFilter();
  try {
    const responseDpjp = await praktisiStore.getApi({ limit: 9999, isDoctor: true });
    if (responseDpjp && responseDpjp.payload) {
      const filteredList = responseDpjp.payload.filter((practitioner: { isDoctor: any; }) => practitioner.isDoctor);
      
      if (filteredList?.length > 0) {
          const mappedList = filteredList.map((practitioner: { pegawai: { name: any; }; uuid: any; }) => {
            return {
              name: practitioner.pegawai.name, 
              uuid: practitioner.uuid       
            };
          });
          listDpjp.value = mappedList;
      } else {
          listDpjp.value = [];
      }

    }
    const responseRuangan = await monitoringKamarStore.getMonitoringKamar({});
    if (responseRuangan && responseRuangan.payload) {
      listRuangan.value = responseRuangan.payload;
    }
    const responsePenjamin = await penjaminStore.getAktifApi();
    if (responsePenjamin && responsePenjamin.payload) {
      listPenjamin.value = responsePenjamin.payload;
    }
    listJenisKunjungan.value = [
      { label: 'Rawat Jalan', value: 'RJ' },
      { label: 'Rawat Inap', value: 'RI' },
      { label: 'IGD', value: 'IGD' }
    ];
  } catch (error) {
    console.error("Failed to fetch dropdown data", error);
  } finally {
    storeUtils.setLoading(false);
  }
  
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
  
  if (pageType.value === "rekap-kunjungan") {
  storeUtils.setLoading(true);
  try {
    const startDate = dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0));
    const endDate = dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59));

    const params = {
      startDate: startDate.toString(),
      endDate: endDate.toString(),
      practitionerUuid: filterParams.dpjp ?? "",
      penjamin: filterParams.penjamin ?? "",
      jenisKunjungan: filterParams.jenis_kunjungan ?? "",
    };

    const response = await admisiReportStore.getRekapJenisKunjunganReport(params);

    if (response && response.data.payload && response.data.payload.kunjungan) {
      processRekapData(response.data.payload.kunjungan);
    } else {
      rekapData.value = [];
    }
  } catch (error) {
    console.error("Gagal mengambil data rekap:", error);
    rekapData.value = [];
  } finally {
    storeUtils.setLoading(false);
  }
  return;
}
  
  let filter = {} as Filter;
  filter = setFilter();
  filter.practitionerUuid =
    filter.practitionerUuid == "Semua" ? "" : filter.practitionerUuid;
  filter.ruangan = filter.ruangan == "Semua" ? "" : filter.ruangan;
  reportData.value = await fetchReportData(filter);
};

onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});

onMounted(async () => {
  updatePageType(route.path);
});

const search = ref("");
const dpjpFilter = ref("Semua");
const visitTypeFilter = ref(null);
const penjaminFilter = ref(null);
const ruanganFilter = ref("Semua");
const rekapTabelFilter = ref(['kunjungan', 'dpjp', 'penjamin']);
const rekapTabelOptions = ref([
  { label: 'Rekap Kunjungan', value: 'kunjungan' },
  { label: 'Rekap DPJP', value: 'dpjp' },
  { label: 'Rekap Penjamin', value: 'penjamin' },
]);

const listDpjp = ref<any[]>([]);
const listRuangan = ref<any[]>([]);
const nameOptions = ref<any[]>([]);
const nameFilter = ref<any[]>([]);


watch(startDateFilter, (newDate) => {
    if (newDate) {
        const year = newDate.getFullYear();
        const month = newDate.getMonth();
        daysInMonth.value = new Date(year, month + 1, 0).getDate();
    }
}, { immediate: true });

const resetFilter = () => {
  search.value = "";
  filterParams.q = "";
  dpjpFilter.value = "Semua";
  filterParams.jenis_kunjungan = "";
  filterParams.penjamin = "";
  filterParams.ruangan = "";
  ruanganFilter.value = "Semua";
  let date = new Date(),
      y = date.getFullYear(),
      m = date.getMonth();
  startDateFilter.value = new Date(y, m, 1);
  endDateFilter.value = new Date(y, m + 1, 0);
  if (pageType.value === 'rekap-kunjungan') {
    rekapTabelFilter.value = ['kunjungan', 'dpjp', 'penjamin'];
  }
  searchData();
};

const onSelectJenisKunjungan = (val: string | null) => {
  filterParams.jenis_kunjungan = val ?? "";
};

const onSelectPenjamin = (val: string | null) => {
  filterParams.penjamin = val ?? "";
};

interface Filter {
  page?: number;
  limit?: number;
  q?: string;
  practitionerUuid?: string;
  jenisKunjungan?: string | null;
  penjamin?: string | null;
  ruangan?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  jenis_kunjungan?: string | null;
};

const setFilter = () => {
  let filter = {} as Filter;

  filter.page = properties.value.page;
  filter.limit = properties.value.pageSize;
  filter.q = filterParams.q || "";
  filter.startDate = `${dateToEpoch(
    setTimeForDate(startDateFilter.value, 0, 0, 0)
  )}`;
  filter.endDate = `${dateToEpoch(
    setTimeForDate(endDateFilter.value, 23, 59, 59)
  )}`;

  if (pageType.value == "kunjungan") {
    filter.practitionerUuid =
      filterParams.practitioner_uuid ||
      (dpjpFilter.value == "Semua" || !dpjpFilter.value ? "" : dpjpFilter.value);

    filter.jenisKunjungan =
      filterParams.jenis_kunjungan && filterParams.jenis_kunjungan !== "Semua"
        ? filterParams.jenis_kunjungan
        : (visitTypeFilter.value == "Semua" || !visitTypeFilter.value
            ? ""
            : visitTypeFilter.value);
    filter.penjamin =
      filterParams.penjamin ||
      (!penjaminFilter.value ? "" : penjaminFilter.value);
  } else if (pageType.value == "penjamin") {
    filter.practitionerUuid =
      filterParams.practitioner_uuid ||
      (dpjpFilter.value == "Semua" || !dpjpFilter.value ? "" : dpjpFilter.value);

    filter.jenisKunjungan =
      filterParams.jenis_kunjungan && filterParams.jenis_kunjungan !== "Semua"
        ? filterParams.jenis_kunjungan
        : (visitTypeFilter.value == "Semua" || !visitTypeFilter.value
            ? ""
            : visitTypeFilter.value);

    filter.penjamin =
      filterParams.penjamin ||
      (!penjaminFilter.value ? "" : penjaminFilter.value);
  } else if (
    pageType.value == "batal-kunjungan" ||
    pageType.value == "bayi-baru-lahir" ||
    pageType.value == "rekap-kunjungan"
  ) {
    filter.jenisKunjungan =
      filterParams.jenis_kunjungan && filterParams.jenis_kunjungan !== "Semua"
        ? filterParams.jenis_kunjungan
        : (visitTypeFilter.value == "Semua" || !visitTypeFilter.value
            ? ""
            : visitTypeFilter.value);
  } else if (
    pageType.value == "status-kamar" ||
    pageType.value == "keperawatan-inap-pasien"
  ) {
    filter.ruangan =
      filterParams.ruangan ||
      (ruanganFilter.value == "Semua" || !ruanganFilter.value
        ? ""
        : ruanganFilter.value);
  }

  return filter;
};

const fetchReportData = async (filter: Filter = {}) => {
  storeUtils.setLoading(true);
  let response;
  try {
    if (pageType.value == "kunjungan") {
      response = await admisiLaporanStore.getKunjunganReport(filter as any);
    } else if (pageType.value == "penjamin") {
      response = await admisiLaporanStore.getPenjaminReport(filter as any);
    } else if (pageType.value == "batal-kunjungan") {
      response = await admisiLaporanStore.getBatalKunjunganReport(filter as any);
    } else if (pageType.value == "status-kamar") {
      response = await admisiLaporanStore.getStatusRuanganReport(filter as any);
    } else if (pageType.value == "keperawatan-inap-pasien") {
      response = await admisiLaporanStore.getKeperawatanInapReport(filter as any);
    } else if (pageType.value == "bayi-baru-lahir") {
      response = await admisiLaporanStore.getBayiBaruLahirReport(filter as any);
    }

    if (response && response.payload) {
      properties.value.total = response.properties.totalData;
      return response.payload;
    } else return [];
  } catch (error) {
    console.error("Failed to fetch data", error);
    return [];
  } finally {
    storeUtils.setLoading(false);
  }
};


const searchData = async () => {
  if (pageType.value === 'rekap-kunjungan') {
    await Promise.all([
    fetchRekapData(),
    fetchRekapDokter(),
    fetchRekapPenjamin()
  ]); 

  }
  let filter = {} as Filter;
  filter = setFilter();
  filter.practitionerUuid =
    filter.practitionerUuid == "Semua" ? "" : filter.practitionerUuid;
  reportData.value = await fetchReportData(filter);
};

const handlePage = (event: any) => {
  properties.value.page = event.page + 1;
  properties.value.pageSize = event.rows;
  searchData();
};

const filters = ref({
  startDate: '',
  endDate: '',
  paymentMethod: '',
  dpjp: '',
  status: '',
  jenis_kunjungan: '',
  penjamin: '',
  q: ''
});

const filterParams = reactive({
  start_date: Math.floor(new Date().setHours(0, 0, 0, 0) / 1000), 
  end_date: Math.floor(new Date().setHours(23, 59, 59, 999) / 1000), 
  q: '', 
  practitioner_uuid: '',
  jenis_kunjungan: '',
  ruangan: '',
  dpjp: '',
  penjamin: '',
  page: 1,
  limit: 10,
});

let debounceTimer: ReturnType<typeof setTimeout>;

watch(filterParams, () => {
  if (pageType.value === 'rekap-kunjungan') {
    clearTimeout(debounceTimer);
    
    debounceTimer = setTimeout(() => {
      fetchAllReportData(); 
    }, 500);
  }
}, {
  deep: true 
});


const handleExport = () => {
  const filterSnakeCase: any = {};
  if (filterParams.q) filterSnakeCase.q = filterParams.q;
  if (startDateFilter.value) {
    filterSnakeCase.start_date = dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0));
  }
  if (endDateFilter.value) {
    filterSnakeCase.end_date = dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59));
  }
  if (filterParams.practitioner_uuid) {
    filterSnakeCase.practitioner_uuid = filterParams.practitioner_uuid;
  }
  if (filterParams.jenis_kunjungan) {
    filterSnakeCase.jenis_kunjungan = filterParams.jenis_kunjungan;
  }
  if (filterParams.penjamin) {
    filterSnakeCase.penjamin = filterParams.penjamin;
  }
  if (filterParams.ruangan) {
    filterSnakeCase.ruangan = filterParams.ruangan;
  }
  filterSnakeCase.practitioner_uuid = 
    filterParams.practitioner_uuid || 
    (dpjpFilter.value == "Semua" || !dpjpFilter.value ? "" : dpjpFilter.value);

  if (!filterSnakeCase.practitioner_uuid) {
    delete filterSnakeCase.practitioner_uuid;
  }

  switch (route.path) {
    case "/admisi/laporan/kunjungan":
      downloadExportExcelKunjungan(filterSnakeCase);
      break;
    case "/admisi/laporan/batal-kunjungan":
      downloadExportExcelBatalKunjungan(filterSnakeCase);
      break;
    case "/admisi/laporan/status-kamar":
      downloadExportExcelStatusKamar(filterSnakeCase);
      break;
    case "/admisi/laporan/keperawatan-inap-pasien":
      downloadExportExcelKeperawatanInapPasien(filterSnakeCase);
      break;
    case "/admisi/laporan/bayi-baru-lahir":
      downloadExportExcelBayiBaruLahir(filterSnakeCase);
      break;
      case "/admisi/laporan/rekap-kunjungan":
      downloadExportExcelRekapKunjungan(
        filterSnakeCase,
        rekapTabelFilter.value,
        dateRangeColumns.value,
    
        rekapData.value,
        totalKunjunganPerDay.value,
        grandTotalKunjungan.value,
    
        rekapDokterData.value,
        totalDokterPerDay.value,
        grandTotalDokter.value,
    
        rekapPenjaminData.value,
        totalPenjaminPerDay.value,
        grandTotalPenjamin.value
      );
      break;
    default:
      console.warn("Fungsi export belum diatur untuk halaman ini.");
  }
};

defineExpose({
  resetFilter,
});
</script>

<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
      <PageToolbar>
        <CustomButton @click="searchData" icon="PhArrowClockwise" />
        <CustomBreadCrumb
          :home="{
            label: 'Laporan',
            home: true,
          }"
          :model="dataBreadCrumb"
        />
        <template v-if="pageType == 'kunjungan'">
          <CustomTextfield
            v-model="filterParams.q"
            label="Cari Pasien"
            placeholder="Cari Nama / Alamat / No. RM"
            @keydown.enter="searchData"
          />
          <CustomSelect
            v-model="dpjpFilter"
            label="DPJP"
            optionLabel="name"
            optionValue="uuid"
            :options="[
              {
                uuid: 'Semua',
                name: 'Semua',
              },
              ...listDpjp,
            ]"
            prependIcon="PhMagnifyingGlass"
          />
        </template>
        <CustomMultiSelect
          v-if="pageType === 'rekap-kunjungan'"
          v-model="rekapTabelFilter"
          :options="rekapTabelOptions"
          label="Data Rekap"
          placeHolder="Pilih satu atau lebih tabel"
          optionLabel="label"
          optionValue="value"
        />
        <CustomTextfield
          v-if="pageType != 'kunjungan' && pageType != 'penjamin' && pageType != 'status-kamar' && pageType != 'rekap-kunjungan'"
          v-model="filterParams.q"
          label="Cari Pasien"
          placeholder="Cari Nama / Alamat / No. RM"
          @keydown.enter="searchData"
        />
        <CustomSelect
          v-if="pageType == 'status-kamar' || pageType == 'keperawatan-inap-pasien'"
          v-model="filterParams.ruangan"
          label="Ruangan"
          placeHolder="Pilih Ruangan"
          optionLabel="name"
          optionValue="name"
          :options="listRuangan"
        />
        <CustomSelect
          v-if="pageType !== 'bayi-baru-lahir' && pageType !== 'batal-kunjungan' && pageType !== 'keperawatan-inap-pasien' && pageType !== 'status-kamar' && pageType !== 'rekap-kunjungan'"
          v-model="filterParams.penjamin" 
          label="Penjamin"
          @update:model-value="onSelectPenjamin"
          placeHolder="Pilih Penjamin"
          optionLabel="name"
          optionValue="name"
          :options="penjaminOptions"
        />
        <CustomSelect
          v-if="pageType != 'status-kamar' && pageType != 'keperawatan-inap-pasien' && pageType !== 'rekap-kunjungan'"
          v-model="filterParams.jenis_kunjungan"
          placeHolder="Pilih Jenis Kunjungan"
          @update:model-value="onSelectJenisKunjungan"
          label="Jenis Kunjungan"
          optionLabel="label"
          optionValue="value"
          :options="jenisKunjunganOptions"
        />
        <CustomDatePicker
          v-model="startDateFilter"
          :maxDate="endDateFilter"
          label="Tanggal mulai"
          class="toolbar-field--date"
        />
        <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
        <CustomDatePicker
          v-model="endDateFilter"
          :minDate="startDateFilter"
          label="Tanggal selesai"
          class="toolbar-field--date"
        />
        <CustomButton
          @click="searchData"
          icon="PhMagnifyingGlass"
          label="Cari"
        />
        <CustomButton
          @click="resetFilter"
          label="Reset"
          outlined
          borderColor="border-opensimrs-300"
          textColor="text-opensimrs-300"
        />
      </PageToolbar>
    </template>
    <template #content>
      <div class =" flex flex-col gap-6 h-full" v-if="reportType === 'rekap-kunjungan'">
        <div v-if="rekapTabelFilter.length > 0" class="flex flex-col gap-6">
          <CustomAccordion
        v-if="rekapTabelFilter.includes('kunjungan')"
        :openWithHeader="true"
        initialState="0"
        headerClass="flex items-center justify-between bg-opensimrs-300 p-3"
      >
        <template #header>
          <span class="font-semibold text-white">
            Rekap Kunjungan
          </span>
        </template>
  
        <template #collapseIcon>
          <CustomButton
            icon="PhCaretUp"
            backgroundColor="bg-transparent"
            textColor="text-white"
          />
        </template>
        <template #expandIcon>
          <CustomButton
            icon="PhCaretDown"
            backgroundColor="bg-transparent"
            textColor="text-white"
          />
        </template>
        <template #content>
          <div class="border-x border-b rounded-b-lg overflow-hidden bg-white mt-2">
            <div class="flex items-center p-4 bg-opensimrs-50">
                <label class="w-40 font-semibold">Jenis Kunjungan</label>
                <CustomSelect
                :showLabel="false"
                v-model="filterParams.jenis_kunjungan"
                class="w-full md:w-1/4"
                placeHolder="Pilih Jenis Kunjungan"
                :options="jenisKunjunganOptions"
                optionLabel="label"
                optionValue="value"
              />
              </div>
            <DataTable
              :value="rekapData"
              tableStyle="min-width: 50rem"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
              showGridlines
            >
              <Column
                field="name"
                header="Nama"
                header-class="text-black bg-opensimrs-50"
                style="width: 150px"
                frozen
                align-frozen="left"
              >
                <template #footer>
                  <span style="font-weight: bold;">Total Harian:</span>
                </template>
              </Column>
  
              <Column
                v-for="dateString in dateRangeColumns"
                :key="dateString"
                :field="dateString"
                :header="formatDateHeader(dateString)"
                header-class="text-black bg-opensimrs-50"
                style="width: 55px; text-align: center"
              >
                <template #footer>
                  <span style="font-weight: bold; text-align: center; display: block;">
                    {{ (totalKunjunganPerDay[dateString] || 0).toString() }}
                  </span>
                </template>
              </Column>
  
              <Column
                field="total"
                header="Total"
                header-class="text-black bg-opensimrs-50"
                style="width: 60px; font-weight: bold; text-align: center"
                frozen
                align-frozen="right"
              >
                <template #footer>
                  <span style="font-weight: bold; text-align: center; display: block;">
                    {{ grandTotalKunjungan.toString() }}
                  </span>
                </template>
              </Column>
            </DataTable>
          </div>
        </template>
          </CustomAccordion>
          <CustomAccordion
            v-if="rekapTabelFilter.includes('dpjp')"
            :openWithHeader="true"
            initialState="0"
            headerClass="flex items-center justify-between bg-opensimrs-300 p-3"
          >
            <template #header>
              <span class="font-semibold text-white">
                Rekap DPJP
              </span>
            </template>
  
            <template #collapseIcon>
              <CustomButton
                icon="PhCaretUp"
                backgroundColor="bg-transparent"
                textColor="text-white"
              />
            </template>
            <template #expandIcon>
              <CustomButton
                icon="PhCaretDown"
                backgroundColor="bg-transparent"
                textColor="text-white"
              />
            </template>
            <template #content>
              <div class="border-x border-b rounded-b-lg overflow-hidden bg-white mt-2">
                <div class="flex items-center p-4 bg-opensimrs-50">
                    <label class="w-40 font-semibold">Dokter DPJP</label>
                    <CustomSelect
                    v-model="filterParams.dpjp"
                    placeHolder="Pilih Dokter"
                    :showLabel="false"
                    class="w-full md:w-1/4"
                    optionLabel="name"
                    optionValue="uuid"
                    :options="[
                      { name: 'Semua Dokter', uuid: null },
                      ...listDpjp,
                    ]"
                  />
                  </div>
                <DataTable
                  :value="rekapDokterData"
                  tableStyle="min-width: 50rem"
                  scrollable
                  scrollHeight="flex"
                  :pt="{ headerRow: 'text-SM' }"
                  showGridlines
                >
                  <Column
                    field="name"
                    header="Nama"
                    header-class="text-black bg-opensimrs-50"
                    style="width: 150px"
                    frozen
                    align-frozen="left"
                  >
                    <template #footer>
                      <span style="font-weight: bold;">Total Harian:</span>
                    </template>
                  </Column>
  
                  <Column
                    v-for="dateString in dateRangeColumns"
                    :key="dateString"
                    :field="dateString"
                    :header="formatDateHeader(dateString)"
                    header-class="text-black bg-opensimrs-50"
                    style="width: 55px; text-align: center"
                  >
                    <template #footer>
                      <span style="font-weight: bold; text-align: center; display: block;">
                        {{ (totalDokterPerDay[dateString] || 0).toString() }}
                      </span>
                    </template>
                  </Column>
  
                  <Column
                    field="total"
                    header="Total"
                    header-class="text-black bg-opensimrs-50"
                    style="width: 60px; font-weight: bold; text-align: center"
                    frozen
                    align-frozen="right"
                  >
                    <template #footer>
                      <span style="font-weight: bold; text-align: center; display: block;">
                        {{ grandTotalDokter.toString() }}
                      </span>
                    </template>
                  </Column>
                </DataTable>
              </div>
            </template>
          </CustomAccordion>
          <CustomAccordion
            v-if="rekapTabelFilter.includes('penjamin')"
            :openWithHeader="true"
            initialState="0"
            headerClass="flex items-center justify-between bg-opensimrs-300 p-3"
          >
            <template #header>
              <span class="font-semibold text-white">
                Rekap Penjamin
              </span>
            </template>
  
            <template #collapseIcon>
              <CustomButton
                icon="PhCaretUp"
                backgroundColor="bg-transparent"
                textColor="text-white"
              />
            </template>
            <template #expandIcon>
              <CustomButton
                icon="PhCaretDown"
                backgroundColor="bg-transparent"
                textColor="text-white"
              />
            </template>
            <template #content>
              <div class="border-x border-b rounded-b-lg overflow-hidden bg-white mt-2">
                <div class="flex items-center p-4 bg-opensimrs-50">
                  <label class="w-40 font-semibold">Penjamin</label>
                    <CustomSelect
                    :showLabel="false"
                    v-model="filterParams.penjamin"
                    class="w-full md:w-1/4"
                    :options="penjaminOptions"
                    optionLabel="name"
                    optionValue="name"
                    placeHolder="Pilih Penjamin"
                  />
                </div>
                <DataTable
                  :value="rekapPenjaminData"
                  tableStyle="min-width: 50rem"
                  scrollable
                  scrollHeight="flex"
                  :pt="{ headerRow: 'text-SM' }"
                  showGridlines
                >
                  <Column
                    field="name"
                    header="Nama"
                    header-class="text-black bg-opensimrs-50"
                    style="width: 150px"
                    frozen
                    align-frozen="left"
                  >
                    <template #footer>
                      <span style="font-weight: bold;">Total Harian:</span>
                    </template>
                  </Column>
  
                  <Column
                    v-for="dateString in dateRangeColumns"
                    :key="dateString"
                    :field="dateString"
                    :header="formatDateHeader(dateString)"
                    header-class="text-black bg-opensimrs-50"
                    style="width: 55px; text-align: center"
                  >
                    <template #footer>
                      <span style="font-weight: bold; text-align: center; display: block;">
                        {{ (totalPenjaminPerDay[dateString] || 0).toString() }}
                      </span>
                    </template>
                  </Column>
  
                  <Column
                    field="total"
                    header="Total"
                    header-class="text-black bg-opensimrs-50"
                    style="width: 60px; font-weight: bold; text-align: center"
                    frozen
                    align-frozen="right"
                  >
                    <template #footer>
                      <span style="font-weight: bold; text-align: center; display: block;">
                        {{ grandTotalPenjamin.toString() }}
                      </span>
                    </template>
                  </Column>
                </DataTable>
              </div>
            </template>
          </CustomAccordion>
        </div>
        <NoData v-else />
      </div>
      <Tabs v-else-if="reportData.length" v-model:value="reportType">
        <TabPanels class="p-0">
          <TabPanel value="kunjungan">
            <DataTable
              v-model:expandedRows="expandedRows"
              :value="reportData"
              tableStyle="min-width: 50rem"
              stripedRows
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <Column
                expander
                style="width: 40px"
                header-class="text-black bg-opensimrs-50"
              />
              <Column
                field="no"
                header="No."
                header-class="text-black bg-opensimrs-50"
                style="width: 40px"
              >
                <template #body="{ index }">{{ index + 1 }}</template>
              </Column>
              <Column
                field="tglRegistrasi"
                header="Tgl. Registrasi"
                header-class="text-black bg-opensimrs-50"
              >
                <template #body="{ data }">
                  {{ epochToDate(data.tglRegistrasi, "dateTime") }}
                </template>
              </Column>
              <Column
                field="noreg"
                header="No. Registrasi"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="jenisKunjungan"
                header="Jenis Kunjungan"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="patient.noRm"
                header="No. RM"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="patient.name"
                header="Nama Pasien"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="polyclinic"
                header="Poli"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="practitioner.nama"
                header="Dokter"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <template #expansion="slotProps">
                <div class="p-3 -mx-3 -my-1.5 bg-opensimrs-75">
                  <DataTable
                    :value="[slotProps.data]"
                    class="overflow-hidden rounded-lg bg-opensimrs-50"
                    :pt="{ headerRow: 'text-SM' }"
                  >
                    <Column
                      field="gender"
                      header="Jenis Kelamin"
                      header-class="text-black bg-opensimrs-50"
                    >
                      <template #body="{ data }">
                        {{ ['Male', 'Laki-laki'].includes(data.patient.gender) ? 'L' : ['Female', 'Perempuan'].includes(data.patient.gender) ? 'P' : '-' }}
                      </template>
                    </Column>
                    <Column
                      field="patient.birthDetail.birthDate"
                      header="Tgl. Lahir"
                      header-class="text-black bg-opensimrs-50"
                    >
                      <template #body="{ data }">
                        {{ data.patient.birthDetail?.birthDate ?? "-" }}
                      </template>
                    </Column>
                    <Column
                      field="patient.birthDetail.birthDate"
                      header="Umur"
                      header-class="text-black bg-opensimrs-50"
                    >
                      <template #body="{ data }">
                        {{
                          data.patient.birthDetail
                            ? `${data.patient.birthDetail.ageYear} Tahun ${data.patient.birthDetail.ageMonth} Bulan ${data.patient.birthDetail.ageDay} Hari`
                            : "-"
                        }}
                      </template>
                    </Column>
                    <Column
                      field="patient.address.fullAddress"
                      header="Alamat"
                      header-class="text-black bg-opensimrs-50"
                    >
                      <template #body="{ data }">
                        {{ data.patient.address?.fullAddress ?? "-" }}
                      </template>
                    </Column>
                    <Column
                      field="patient.identity"
                      header="Jenis ID"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                      <Column
                      field="noPenjamin.name"
                      header="Penjamin"
                      header-class="text-black bg-opensimrs-50"
                      >
                      <template #body="{ data }">
                        {{ data.patient.insurance?.[0]?.name ?? "-" }}
                      </template>
                    </Column>
                    <Column
                      field="noPenjamin.accountNumber"
                      header="No. Penjamin"
                      header-class="text-black bg-opensimrs-50"
                      >
                      <template #body="{ data }">
                        <!-- <pre>{{ data }}</pre> -->
                        {{ data.patient.insurance?.[0]?.accountNumber ?? "-" }}
                      </template>
                    </Column>
                    <Column
                      field="patient.noIdentity"
                      header="No. Identitas"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                  </DataTable>
                </div>
              </template>
            </DataTable>
          </TabPanel>
          <TabPanel value="batal-kunjungan">
            <DataTable
              v-model:expandedRows="expandedRows"
              :value="reportData"
              tableStyle="min-width: 50rem"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <Column
                expander
                style="width: 40px"
                header-class="text-black bg-opensimrs-50"
              />
              <Column
                field="no"
                header="No."
                header-class="text-black bg-opensimrs-50"
                style="width: 40px"
              >
                <template #body="{ index }">{{ index + 1 }}</template>
              </Column>
              <Column
                field="tglRegistrasi"
                header="Tgl. Registrasi"
                header-class="text-black bg-opensimrs-50"
              >
                <template #body="{ data }">
                  {{ epochToDate(data.tglRegistrasi, "dateTime") }}
                </template>
              </Column>
              <Column
                field="noreg"
                header="No. Registrasi"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="jenisKunjungan"
                header="Jenis Kunjungan"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="patient.noRm"
                header="No. RM"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="patient.name"
                header="Nama Pasien"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="cancelDate"
                header="Tgl. Batal"
                header-class="text-black bg-opensimrs-50"
              >
                <template #body="{ data }">
                  {{ epochToDate(data.cancelDate, "dateTime") }}
                </template>
              </Column>
              <Column
                header="Petugas"
                header-class="text-black bg-opensimrs-50"
              >
                <template #body="{ data }">
                  {{ data.cancelBy ?? '-' }}
                </template>
              </Column>
              <template #expansion="slotProps">
                <div class="p-3 -mx-3 -my-1.5 bg-opensimrs-75">
                  <DataTable
                    :value="[slotProps.data]"
                    class="overflow-hidden rounded-lg bg-opensimrs-50"
                    :pt="{ headerRow: 'text-SM' }"
                  >
                    <Column
                      field="polyclinic"
                      header="Poli"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                    <Column
                      field="practitioner.nama"
                      header="Dokter DPJP"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                    <Column
                      field="cancelReason"
                      header="Alasan Batal"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                  </DataTable>
                </div>
              </template>
            </DataTable>
          </TabPanel>
          <TabPanel value="status-kamar">
            <DataTable
              :value="reportData"
              tableStyle="min-width: 50rem"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <Column
                field="no"
                header="No."
                header-class="text-black bg-opensimrs-50"
                style="width: 40px"
              >
                <template #body="{ index }">{{ index + 1 }}</template>
              </Column>
              <Column
                field="room"
                header="Ruangan"
                header-class="text-black bg-opensimrs-50"
              >
                <template #body="{ data }">
                  {{ data.room?.name ?? '-' }}
                </template>
              </Column>
              <Column
                field="roomClass"
                header="Kelas"
                header-class="text-black bg-opensimrs-50"
              >
                <template #body="{ data }">
                  {{ data.room?.className ?? '-' }}
                </template>
              </Column>
              <Column
                field="totalPatients"
                header="Jumlah Pasien"
                header-class="text-black bg-opensimrs-50"
              >
                <template #body="{ data }">
                  {{ data.jumlahPasien ?? '-' }}
                </template>
              </Column>
            </DataTable>
          </TabPanel>
          <TabPanel value="keperawatan-inap-pasien">
            <DataTable
              :value="reportData"
              tableStyle="min-width: 50rem"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <Column
                field="no"
                header="No."
                header-class="text-black bg-opensimrs-50"
                style="width: 40px"
              >
                <template #body="{ index }">{{ index + 1 }}</template>
              </Column>
              <Column
                field="noRm"
                header="No. RM"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="monitoringRoom.room.name"
                header="Ruangan"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="monitoringRoom.room.className"
                header="Kelas"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="monitoringRoom.noBed"
                header="No. Bed"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="enterDate"
                header="Tgl. Masuk"
                header-class="text-black bg-opensimrs-50"
              >
                <template #body="{ data }">
                  {{
                    data.tanggalDirawat
                      ? epochToDate(data.tanggalDirawat, "dateTime")
                      : "-"
                  }}
                </template>
              </Column>
              <Column
                field="exitDate"
                header="Tgl. Keluar"
                header-class="text-black bg-opensimrs-50"
              >
                <template #body="{ data }">
                  {{
                    data.dischargeDate
                      ? epochToDate(data.dischargeDate, "dateTime")
                      : "-"
                  }}
                </template>
              </Column>
            </DataTable>
          </TabPanel>
          <TabPanel value="bayi-baru-lahir">
            <DataTable
              v-model:expandedRows="expandedRowsBayi"
              :value="reportData"
              tableStyle="min-width: 50rem"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <Column
                expander
                style="width: 40px"
                header-class="text-black bg-opensimrs-50"
              />
              <Column
                field="no"
                header="No."
                header-class="text-black bg-opensimrs-50"
                style="width: 40px"
              >
                <template #body="{ index }">{{ index + 1 }}</template>
              </Column>
              <Column
                field="tglRegistrasi"
                header="Tgl. Registrasi"
                header-class="text-black bg-opensimrs-50"
              >
                <template #body="{ data }">
                  {{ data.tanggalDaftar && reportType === 'bayi-baru-lahir' ? data.tanggalDaftar.split('T')[0] : '' }}
                </template>
              </Column>
              <Column
                field="noRmBaby"
                header="No. RM"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="nameBaby"
                header="Nama Bayi"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="birthDetail.birthDate"
                header="Tgl. Lahir"
                header-class="text-black bg-opensimrs-50"
              >
                <template #body="slotProps">
                  {{ slotProps.data.birthDetail?.birthDate?.split('T')[0] }}
                </template>
              </Column>
              <Column
                field="birthTimeBaby"
                header="Jam Lahir"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column header="Jenis Kunjungan" header-class="text-black bg-opensimrs-50">
                  <template #body="slotProps">
                      {{ slotProps.data.birthDetail?.patient?.logPelayanan?.jenisKunjungan }}
                  </template>
              </Column>
              <template #expansion="slotProps">
                <div class="p-3 -mx-3 -my-1.5 bg-opensimrs-75">
                  <DataTable
                    :value="[slotProps.data]"
                    class="overflow-hidden rounded-lg bg-opensimrs-50"
                    :pt="{ headerRow: 'text-SM' }"
                  >
                    <Column
                      field="genderBaby"
                      header="Jenis Kelamin"
                      header-class="text-black bg-opensimrs-50"
                    >
                      <template #body="{ data }">
                        {{ ['Male', 'Laki-laki'].includes(data.genderBaby) ? 'L' : ['Female', 'Perempuan'].includes(data.genderBaby) ? 'P' : '-' }}
                      </template>
                    </Column>
                    <Column
                      field="birthDetail.birthPlace"
                      header="Tempat Lahir"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                    <Column
                      field="birthDetail.patient.noIdentity"
                      header="Identitas Ibu"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                    <Column
                      field="nameMom"
                      header="Nama Ibu"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                  </DataTable>
                </div>
              </template>
            </DataTable>
          </TabPanel>
          <TabPanel value="rekap-pasien-bpjs">
            <DataTable
              v-model:expandedRows="expandedRows"
              :value="reportData"
              tableStyle="min-width: 50rem"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <Column
                expander
                style="width: 40px"
                header-class="text-black bg-opensimrs-50"
              />
              <Column
                field="no"
                header="No."
                header-class="text-black bg-opensimrs-50"
                style="width: 40px"
              ></Column>
              <Column
                field="registrationDate"
                header="Tgl. Registrasi"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="registrationNo"
                header="No. Registrasi"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="visitType"
                header="Jenis Kunjungan"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="rmNumber"
                header="No. RM"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="patientName"
                header="Nama Pasien"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="cardNo"
                header="No. Kartu"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <Column
                field="referenceNo"
                header="No. Rujukan"
                header-class="text-black bg-opensimrs-50"
              ></Column>
              <template #expansion="slotProps">
                <div class="p-3 -mx-3 -my-1.5 bg-opensimrs-75">
                  <DataTable
                    :value="slotProps.data.orders"
                    class="overflow-hidden rounded-lg bg-opensimrs-50"
                    :pt="{ headerRow: 'text-SM' }"
                  >
                    <Column
                      field="gender"
                      header="Jenis Kelamin"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                    <Column
                      field="birthDate"
                      header="Tgl. Lahir"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                    <Column
                      field="age"
                      header="Umur"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                    <Column
                      field="address"
                      header="Alamat"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                    <Column
                      field="idType"
                      header="Jenis ID"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                    <Column
                      field="identityNo"
                      header="No. Identitas"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                    <Column
                      field="insurance"
                      header="Penjamin"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                    <Column
                      field="spri"
                      header="No. SPRI/SKDP"
                      header-class="text-black bg-opensimrs-50"
                    ></Column>
                  </DataTable>
                </div>
              </template>
            </DataTable>
          </TabPanel>
        </TabPanels>
      </Tabs>
      <NoData v-else />
    </template>
    <template #footer>
      <div class="flex justify-between">
        <CustomButton
          @click="handleExport"
          icon="PhPrinter"
          label="Cetak"
          class="mr-[10px]"
          backgroundColor="bg-opensimrs-300"
        />
        <CustomPaginator
          :rows="properties.pageSize"
          :totalRecords="properties.total"
          @page="handlePage"
        />
      </div>
    </template>
  </Card>
</template>