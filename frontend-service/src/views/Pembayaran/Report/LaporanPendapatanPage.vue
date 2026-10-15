<script setup lang="ts">
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import { onMounted, ref , watch } from "vue";
import TotalLaporan from "../layout/TotalLaporan.vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import { useReportLaporanPendapatanStore } from "@/stores/pembayaran/laporanPendapatan";
import { dateToEpoch, epochToDate, formatPrice } from "@/utils/Helpers";
import { utilsStore } from "@/stores/utils";
import type { MenuItem } from "primevue/menuitem";
import { downloadExportExcelPendapatan } from '@/utils/exportexcelpayment';

const route = useRoute();
const pageType = ref("");
const dataBreadCrumb = ref<MenuItem[]>([{}]);
const laporanPendapatanStore = useReportLaporanPendapatanStore();

const today = new Date();
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(today.getDate() - 7);
const startDateFilter = ref<Date>(sevenDaysAgo);
const endDateFilter = ref<Date>(today);

const dataPendapatan = ref({
  totalPendapatan: 0,
  totalTunai: 0,
  totalDebit: 0,
  totalKredit: 0,
});

const updatePageType = (path: string) => {
  dataBreadCrumb.value = [];
  let tempArrPath = path.split("/");
  pageType.value = tempArrPath[3] ?? "";
  dataBreadCrumb.value = [
    {
      label: pageType.value == "pendapatan" ? "Pendapatan" : "",
    },
  ];
  //   console.log(pageType.value);
};

const fetchLaporanPendapatan = async () => {
  try {
    const startDate = new Date(startDateFilter.value);
    startDate.setHours(0, 0, 0, 0); 

    const endDate = new Date(endDateFilter.value);
    endDate.setHours(23, 59, 59, 999); 

    const response = await laporanPendapatanStore.getApi(
      dateToEpoch(startDate), 
      dateToEpoch(endDate)    
    );

    const plainResponse = JSON.parse(JSON.stringify(response));

    if (plainResponse && plainResponse.payload) {
      dataPendapatan.value.totalPendapatan = plainResponse.payload.totalPendapatan || 0;
      dataPendapatan.value.totalTunai = plainResponse.payload.totalTunai || 0;
      dataPendapatan.value.totalDebit = plainResponse.payload.totalDebit || 0;
      dataPendapatan.value.totalKredit = plainResponse.payload.totalKredit || 0;
    } else {
      dataPendapatan.value = { totalPendapatan: 0, totalTunai: 0, totalDebit: 0, totalKredit: 0 };
    }
  } catch (error) {
    console.error("Gagal mengambil data pendapatan:", error);
    dataPendapatan.value = { totalPendapatan: 0, totalTunai: 0, totalDebit: 0, totalKredit: 0 };
  }
};

let dateChangeTimeout: ReturnType<typeof setTimeout> | null = null;
watch([startDateFilter, endDateFilter], () => {
  if (dateChangeTimeout) clearTimeout(dateChangeTimeout);
  dateChangeTimeout = setTimeout(() => {
    fetchLaporanPendapatan();
  }, 500); // Tunggu 500ms setelah user selesai mengubah tanggal
});


const handleExport = () => {
  downloadExportExcelPendapatan(
        dataPendapatan.value,
        startDateFilter.value,
        endDateFilter.value
      );
};

//Refresh Button
const handleRefresh = () => {
  // Cukup panggil ulang fungsi fetch utama
  fetchLaporanPendapatan();
};


onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});
onMounted(() => {
  updatePageType(route.path);
});

onMounted(() => {
  updatePageType(route.path);
  fetchLaporanPendapatan(); 
});


watch([startDateFilter, endDateFilter], () => {
  fetchLaporanPendapatan();
});
</script>

<template>
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
          :model="dataBreadCrumb"
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
      </PageToolbar>
    </template>

    <template #content>
  <hr />

  <div class="grid grid-cols-2 gap-5 py-5">
    <TotalLaporan
      backgroundIcon="UangIcon"
      titleCard="Total Pendapatan"
      :totalTest="dataPendapatan.totalPendapatan" satuanCard="Rp"
      bottomIcon="UangIcon"
    />
    <TotalLaporan
      backgroundIcon="PayMoneyIcon"
      titleCard="Total Tunai"
      :totalTest="dataPendapatan.totalTunai" satuanCard="Rp"
      bottomIcon="PayMoneyIcon"
    />
    <TotalLaporan
      backgroundIcon="WalletIcon"
      titleCard="Total Debit"
      :totalTest="dataPendapatan.totalDebit" satuanCard="Rp"
      bottomIcon="WalletIcon"
    />
    <TotalLaporan
      backgroundIcon="CreditCardIcon"
      titleCard="Total Kredit (Asuransi/Piutang)"
      :totalTest="dataPendapatan.totalKredit" satuanCard="Rp"
      bottomIcon="CreditCardIcon"
    />
  </div>
</template>
    <template #footer>
      <hr />
      <div class="flex items-center justify-between pt-2">
        <CustomButton 
          label="Export" 
          icon="FileImportIcon" 
          @click="handleExport" 
        />
      </div>
    </template>
  </Card>
</template>
