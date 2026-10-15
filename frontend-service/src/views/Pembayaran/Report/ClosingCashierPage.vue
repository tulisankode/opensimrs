<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import { useReportCloseCashierStore } from "@/stores/pembayaran/reportClosingCashier";
import { utilsStore } from "@/stores/utils";
import { dateToEpoch, epochToDate } from "@/utils/Helpers";
import { downloadExportExcelClosingCashier } from '@/utils/exportexcelpayment';

// Tentukan tanggal hari ini
const today = new Date();
// Buat tanggal baru, lalu set mundur 7 hari dari hari ini
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(today.getDate() - 7);
const startDateFilter = ref<Date>(sevenDaysAgo);
const endDateFilter = ref<Date>(today);
const type = ref("ALL");
const optionType = ref([
  { label: "Semua", value: "ALL" },
  { label: "Closing Shift", value: "SHIFT" },
  { label: "Closing Harian", value: "DAYS" },
]);

const emits = defineEmits(["update:rows", "update:current-page"]);

const shiftTypeMap: { [key: string]: string } = {
  "1": "Pagi",
  "2": "Siang",
  "3": "Malam",
};

//Jenis tipe kasir
const jenisKasirMap: { [key: string]: string } = {
  'DAYS': 'Closing Harian',
  'SHIFT': 'Closing Kasir'
};

// State Management
const reportCloseCashier = useReportCloseCashierStore();
const UseUtilsStore = utilsStore();
const closeCashierPayload = ref<any[]>([]);
const closeCashierProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () => closeCashierPayload.value && closeCashierPayload.value.length > 0
);

// Fetch data
const fetchCloseCashier = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await reportCloseCashier.getApi(
      closeCashierProperties.value.page,
      closeCashierProperties.value.page_size,
      dateToEpoch(startDateFilter.value),
      dateToEpoch(endDateFilter.value),
      type.value 
    );

    // Konversi ke plain object untuk keamanan
    const plainResponse = JSON.parse(JSON.stringify(response));
    
    if (plainResponse && plainResponse.payload && plainResponse.properties) {
      closeCashierPayload.value = plainResponse.payload;
      
      const apiProperties = plainResponse.properties;

      closeCashierProperties.value.page = apiProperties.page;
      closeCashierProperties.value.page_size = apiProperties.pageSize; 
      closeCashierProperties.value.total = parseInt(apiProperties.totalData, 10) || 0; 

    } else {
      closeCashierPayload.value = [];
      closeCashierProperties.value.page = 1;
      closeCashierProperties.value.total = 0;
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    closeCashierPayload.value = [];
    closeCashierProperties.value.page = 1;
    closeCashierProperties.value.total = 0;
  } finally {
    UseUtilsStore.setLoading(false);
  }
};


watch(startDateFilter, (newDate) => {
  if (newDate) {
    newDate.setHours(0, 0, 0, 0);
  }
}, { immediate: true });

// Watcher ini khusus untuk memastikan waktu pada tanggal akhir
// selalu diatur ke 23:59:59 agar semua data di hari itu terhitung.
watch(endDateFilter, (newDate) => {
  if (newDate) {
    newDate.setHours(23, 59, 59, 999);
  }
}, { immediate: true });




// Handle Pagination
const handlePage = (event: any) => {
  console.log("--- [A] PAGINATOR EVENT TERPANGGIL ---");
  console.log("[A.1] Event dari Paginator:", event);
  
  closeCashierProperties.value.page = event.page + 1; 
  closeCashierProperties.value.page_size = event.rows;

  console.log("[A.2] State akan diubah untuk memanggil API:", JSON.parse(JSON.stringify(closeCashierProperties.value)));
  fetchCloseCashier();
};

// Filter Search Data
const searchData = () => {
  dateToEpoch(startDateFilter.value),
    dateToEpoch(endDateFilter.value),
    type.value;
    closeCashierProperties.value.page = 1;
  fetchCloseCashier();
};

// Filter Reset Data
const resetData = () => {
  const todayReset = new Date();
  const sevenDaysAgoReset = new Date();
  sevenDaysAgoReset.setDate(todayReset.getDate() - 7);

  sevenDaysAgoReset.setHours(0, 0, 0, 0); 
  todayReset.setHours(23, 59, 59, 999);
  
  startDateFilter.value = sevenDaysAgoReset;
  endDateFilter.value = todayReset;
  type.value = "ALL";
  closeCashierProperties.value.page = 1;
  fetchCloseCashier();
};

const handleExport = async () => {
  // Jika tidak ada data sama sekali, hentikan proses
  if (closeCashierProperties.value.total === 0) {
    console.warn("Tidak ada data untuk diekspor.");
    return;
  }

  UseUtilsStore.setLoading(true);

  try {
    const response = await reportCloseCashier.getApi(
      1,
      closeCashierProperties.value.total, 
      dateToEpoch(startDateFilter.value),
      dateToEpoch(endDateFilter.value),
      type.value 
    );

    const plainResponse = JSON.parse(JSON.stringify(response));

    if (plainResponse && plainResponse.payload) {
      const allData = plainResponse.payload; 

      downloadExportExcelClosingCashier(
        allData,
        startDateFilter.value,
        endDateFilter.value,
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

//Refresh Button
const handleRefresh = () => {
  // Cukup panggil ulang fungsi fetch utama
  fetchCloseCashier();
};

onMounted(() => {
  fetchCloseCashier();
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
            :model="[{ label: 'Closing Kasir' }]"
          />
          <CustomSelect
            v-model="type"
            label="Jenis Kasir"
            optionLabel="label"
            optionValue="value"
            :options="optionType"
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
        <DataTable
          v-if="hasData"
          :value="closeCashierPayload"
          scrollable
          scrollHeight="flex"
          :pt="{ headerRow: 'text-SM' }"
        >
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold">No.</div>
            </template>
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.index + 1 }}</div>
            </template>
          </Column>
          <Column header="Jenis Kasir" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ jenisKasirMap[slotProps.data.type] }}</div>
            </template>
          </Column>
          <Column header="Tgl. Open Kasir" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <div>
                  {{ slotProps.data.shiftTimeOpen ? epochToDate(slotProps.data.shiftTimeOpen, "date") : '-' }}
                </div>
              </div>
            </template>
          </Column>
          <Column header="Tgl. Closing Kasir" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <div>
                  {{ slotProps.data.shiftTimeClosed ? epochToDate(slotProps.data.shiftTimeClosed, "date") : '-' }}
                </div>
              </div>
            </template>
          </Column>
          <!-- Shift belum fix, antara ambil shiftType atau shiftList -->
          <Column header="Shift" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM"> {{ slotProps.data.type === 'SHIFT' ? shiftTypeMap[slotProps.data.shiftType] : slotProps.data.shiftList }}</div>
            </template>
          </Column>
          <Column header="Tgl. Close Harian" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <div>
                  {{ slotProps.data.daysTimeClosed ? epochToDate(slotProps.data.daysTimeClosed, "date") : '-' }}
                </div>
              </div>
            </template>
          </Column>
          <Column header="Petugas" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.cashierName || slotProps.data.petugasList }}</div>
            </template>
          </Column>
        </DataTable>
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
          <Paginator
            :first="(closeCashierProperties.page - 1) * closeCashierProperties.page_size"
            :rows="closeCashierProperties.page_size"
            :totalRecords="closeCashierProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
            template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
            currentPageReportTemplate="{currentPage}"
          >
            <template #start>
              <span class="font-md mr-4">Total Data: {{ closeCashierProperties.total }}</span>
            </template>
          </Paginator>
        </div>
      </template>
    </Card>
  </div>
</template>
