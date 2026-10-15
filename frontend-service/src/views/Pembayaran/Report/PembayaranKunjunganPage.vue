<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import { dateToEpoch, epochToDate, formatPrice } from "@/utils/Helpers";
import { useReportPembayaranKunjunganStore } from "@/stores/pembayaran/pembayaranKunjungan";
import { utilsStore } from "@/stores/utils";
import { downloadExportExcelPembayaranKunjungan } from '@/utils/exportexcelpayment';

const today = new Date();
// set 7 hari yang lalu
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(today.getDate() - 7);
const startDateFilter = ref<Date>(sevenDaysAgo);
const endDateFilter = ref<Date>(today);
const reportType = ref("");
const reportData = ref([1]);
const expandedRows = ref();
const searchQuery = ref<string>("");
const shiftType = ref("ALL");

const searchResults = ref<any[]>([]); // Untuk menampung hasil dropdown
const loadingSearch = ref(false);      
const selectedPatientUuid = ref<string | null>(null); 

const optionShiftItem = ref([
  { label: "Semua", value: "ALL" },
  { label: "Pagi", value: "1" },
  { label: "Siang", value: "2" },
  { label: "Malam", value: "3" },
]);

// State Management
const reportPembayaranKunjunganStore = useReportPembayaranKunjunganStore();
const UseUtilsStore = utilsStore();
const pembayaranKunjunganPayload = ref<any[]>([]);
const pembayaranKunjunganProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () =>
    pembayaranKunjunganPayload.value &&
    pembayaranKunjunganPayload.value.length > 0
);

const paymentTypeMapping: { [key: string]: string } = {
  'CASH' : 'Tunai',
  'INSURANCE' : 'Asuransi'
}

//format price lokal(khusus kunjungan)
const formatPriceLokal = (price: number) => {
  if (typeof price !== 'number') return 'Rp 0';
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0, 
  }).format(price);
};

watch(startDateFilter, (newDate) => {
  if (newDate) {
    newDate.setHours(0, 0, 0, 0);
  }
}, { immediate: true }); // immediate: true agar dijalankan saat pertama kali dimuat

watch(endDateFilter, (newDate) => {
  if (newDate) {
    newDate.setHours(23, 59, 59, 999);
  }
}, { immediate: true }); // immediate: true agar dijalankan saat pertama kali dimuat

// Fetch Revenue
const fetchPembayaranKunjungan = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const startDate = new Date(startDateFilter.value);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(endDateFilter.value);
    endDate.setHours(23, 59, 59, 999);

    const response = await reportPembayaranKunjunganStore.getApi(
      pembayaranKunjunganProperties.value.page,
      pembayaranKunjunganProperties.value.page_size,
      dateToEpoch(startDate),
      dateToEpoch(endDate),
      shiftType.value,
      selectedPatientUuid.value || '' 
    );

    const plainResponse = JSON.parse(JSON.stringify(response));
    
    if (plainResponse && plainResponse.payload && plainResponse.properties) {
      pembayaranKunjunganPayload.value = plainResponse.payload;
      const apiProperties = plainResponse.properties;
      pembayaranKunjunganProperties.value.page = apiProperties.page;
      pembayaranKunjunganProperties.value.page_size = apiProperties.pageSize;
      pembayaranKunjunganProperties.value.total = parseInt(apiProperties.totalData, 10) || 0;
    } else {
      pembayaranKunjunganPayload.value = [];
      pembayaranKunjunganProperties.value.total = 0;
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    pembayaranKunjunganPayload.value = [];
    pembayaranKunjunganProperties.value.total = 0;
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const handleExport = async () => {
  if (pembayaranKunjunganProperties.value.total === 0) {
    console.warn("Tidak ada data untuk diekspor.");
    return;
  }

  UseUtilsStore.setLoading(true);

  try {
    const response = await reportPembayaranKunjunganStore.getApi(
      1, 
      pembayaranKunjunganProperties.value.total, 
      dateToEpoch(startDateFilter.value),
      dateToEpoch(endDateFilter.value),
      shiftType.value,
      selectedPatientUuid.value || ''
    );

    const plainResponse = JSON.parse(JSON.stringify(response));

    if (plainResponse && plainResponse.payload) {
      const allData = plainResponse.payload; 

      downloadExportExcelPembayaranKunjungan(
        allData,
        startDateFilter.value,
        endDateFilter.value,
        shiftType.value,
        epochToDate
      );
    } else {
      console.error("Gagal mengambil data lengkap untuk ekspor.");
    }
  } catch (error) {
    console.error("Terjadi error saat menyiapkan data untuk ekspor:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

//optionlabel
const dynamicOptionLabelKey = computed(() => {
  const query = searchQuery.value;
  const queryUC = query.toUpperCase();
  const addressKeywords = ["JL", "DS", "DSN", "RT", "RW", "NO", "GG", "BLOK"];
  const isAddressQuery = addressKeywords.some(keyword => queryUC.includes(keyword));

  // Pola untuk No. RM
  const isRmPattern = /^\d{2}-/.test(query);


  if (isRmPattern) {
    return 'noRm'; 
  }
  if (isAddressQuery) {
    return 'patientAddress';
  }
  return 'patientName';
});

// Handle Patient Selection
const handlePatientSelection = (uuid: string) => {
  if (!uuid) return;
  selectedPatientUuid.value = uuid;
  pembayaranKunjunganProperties.value.page = 1; // Reset halaman
  fetchPembayaranKunjungan();
};

// Handle Pagination
const handlePage = (event: any) => {
  pembayaranKunjunganProperties.value.page = event.page + 1;
  pembayaranKunjunganProperties.value.page_size = event.rows;
  fetchPembayaranKunjungan();
};

// Filter Search Data
const searchData = () => {
  dateToEpoch(startDateFilter.value),
    dateToEpoch(endDateFilter.value),
    shiftType.value;
    pembayaranKunjunganProperties.value.page = 1;
  fetchPembayaranKunjungan();
};

// Filter Reset Data
const resetData = () => {
  const todayReset = new Date();
  const sevenDaysAgoReset = new Date();
  sevenDaysAgoReset.setDate(todayReset.getDate() - 7);
  
  startDateFilter.value = sevenDaysAgoReset;
  endDateFilter.value = todayReset;
  shiftType.value = "ALL";
  selectedPatientUuid.value = null;
  searchResults.value = [];
  pembayaranKunjunganProperties.value.page = 1;
  
  fetchPembayaranKunjungan();
};

// Handle Row Expansion
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const findTransactionsForDropdown = async (filter: string) => {
  if (searchTimer) clearTimeout(searchTimer);
  
  searchQuery.value = filter || "";

  if (!filter) {
    searchResults.value = [];
    return;
  }

  searchTimer = setTimeout(async () => {
    loadingSearch.value = true;
    try {
      const response = await reportPembayaranKunjunganStore.getApi(
        1, 
        10, 
        dateToEpoch(startDateFilter.value), 
        dateToEpoch(endDateFilter.value),   
        shiftType.value,                    
        filter                              
      );
      
      if (response && response.payload) {
        searchResults.value = response.payload; 
      } else {
        searchResults.value = [];
      }
    } catch (error) {
      console.error("Failed to fetch dropdown data", error);
      searchResults.value = [];
    } finally {
      loadingSearch.value = false;
    }
  }, 500); // Debounce 500ms
};

//Refresh Button
const handleRefresh = () => {
  // Cukup panggil ulang fungsi fetch utama
  fetchPembayaranKunjungan();
};

onMounted(() => {
  fetchPembayaranKunjungan();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card
      pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden"
      class="h-full overflow-hidden"
    >
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="handleRefresh" />
          <CustomBreadCrumb
            :home="{ label: 'Laporan', home: true }"
            :model="[{ label: 'Pembayaran Kunjungan' }]"
          />
          <CustomSelect
            v-model="selectedPatientUuid"
            label="Pencarian"
            prependIcon="PhMagnifyingGlass"
            place-holder="Cari Nama / Alamat / No. RM"
            :options="searchResults"
            :optionLabel="dynamicOptionLabelKey"
            optionValue="uuid"
            :loading="loadingSearch"
            @filter="findTransactionsForDropdown"
            @update:model-value="handlePatientSelection"
          />
          <CustomSelect
            v-model="shiftType"
            label="Shift"
            optionLabel="label"
            optionValue="value"
            :options="optionShiftItem"
          />
          <CustomDatePicker
            v-model="startDateFilter"
            label="Tanggal mulai"
            class="toolbar-field--date"
            :maxDate="endDateFilter"
          />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker
            v-model="endDateFilter"
            label="Tanggal selesai"
            class="toolbar-field--date"
            :minDate="startDateFilter"
            :maxDate="today"
          />
          <CustomButton @click="searchData" icon="PhMagnifyingGlass" label="Cari" />
          <CustomButton
            @click="resetData"
            label="Reset"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
          />
        </PageToolbar>
      </template>

      <template #content>
        <NoData v-if="!hasData" />
        <DataTable
          v-else
          :value="pembayaranKunjunganPayload"
          scrollable
          scrollHeight="flex"
          :pt="{ headerRow: 'text-SM' }"
          class="text-SM"
        >
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold">No.</div>
            </template>
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.index + 1 }}</div>
            </template>
          </Column>
          <Column  header="Nomor" headerClass="bg-opensimrs-50 pl-10">
            <template #body="slotProps">
              <div class="text-SM pl-4">{{ slotProps.data.noRm }}</div>
              <div class="text-SM">{{ slotProps.data.billCode }}</div>
              <div class="text-SM">{{ slotProps.data.invoiceCode }}</div>
            </template>
          </Column>
          <Column header="Nama Pasien" headerClass="bg-opensimrs-50 pl-8">
            <template #body="slotProps">
              <div class="text-SM">
                {{ slotProps.data.patientName }}
              </div>
            </template>
          </Column>
          <Column header="Waktu Bayar" headerClass="bg-opensimrs-50 pl-6">
            <template #body="slotProps">
              <div class="text-SM">
                <div>
                  {{ epochToDate(slotProps.data.paymentDate, "date") }} {{ epochToDate(slotProps.data.paymentDate, "time") }}
                </div>
              </div>
            </template>
          </Column>
          <Column header="Cara Bayar" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ paymentTypeMapping[slotProps.data.paymentType] || slotProps.data.paymentType }}</div>
            </template>
          </Column>
          <Column header="Total Bayar" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{  formatPriceLokal (slotProps.data.amount) }}</div>
            </template>
          </Column>
          <Column header="Kasir" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.cashierName }}</div>
            </template>
          </Column>
          <Column header="Keterangan" headerClass="bg-opensimrs-50 " style="max-width: 250px" class="break-words">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.note }}</div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
  <div class="flex justify-between items-center">
    <CustomButton
      @click="handleExport"
      icon="PhPrinter"
      label="Cetak"
      class="mr-[10px]"
      backgroundColor="bg-opensimrs-300"
    />
      <Paginator
        :first="(pembayaranKunjunganProperties.page - 1) * pembayaranKunjunganProperties.page_size"
        :rows="pembayaranKunjunganProperties.page_size"
        :totalRecords="pembayaranKunjunganProperties.total"
        :rowsPerPageOptions="[10, 20, 30]"
        @page="handlePage"
        template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
        currentPageReportTemplate="{currentPage}"
      >
        <template #start>
          <span class="font-md mr-4">Total Data: {{ pembayaranKunjunganProperties.total }}</span>
        </template>
      </Paginator>
  </div>
</template>
    </Card>
  </div>
</template>
