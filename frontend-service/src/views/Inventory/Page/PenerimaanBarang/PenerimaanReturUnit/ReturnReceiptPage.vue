<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useReturnReceipteStore } from "@/stores/inventory/returnReceipt";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import DetailReturnReceipt from "./DetailReturnReceiptPage.vue";

const props = defineProps({
  lokasiStokUuid: {
    type: String,
    default: "",
  },
});

// Filter Alasan
const reason = ref("");
const optionReason = ref([
  { name: "Rusak", value: "rusak" },
  { name: "Kadaluarsa", value: "kadaluarsa" },
  { name: "Salah/Ingin diganti", value: "salah" },
  { name: "Sisa Pemakaian Ruangan", value: "sisa" },
]);

// State Management
const searchQuery = ref<string>("");
const ReturnReceiptStore = useReturnReceipteStore();
const UseUtilsStore = utilsStore();
const ReturnReceiptPayload = ref<any[]>([]);
const ReturnReceiptProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () => ReturnReceiptPayload.value && ReturnReceiptPayload.value.length > 0
);

// Fetch Data
const fetchReturnReceipt = async () => {
  if (!props.lokasiStokUuid) return;
  UseUtilsStore.setLoading(true);
  try {
    const response = await ReturnReceiptStore.getApi(
      props.lokasiStokUuid || "",
      reason.value || "",
      searchQuery.value || "",
      ReturnReceiptProperties.value.page,
      ReturnReceiptProperties.value.page_size,
    );
    ReturnReceiptPayload.value = response?.payload || [];
    ReturnReceiptProperties.value.total = response?.properties?.total || 0;

  } catch (error) {
    console.error("Failed to fetch return receipt data:", error);
    ReturnReceiptPayload.value = [];
    ReturnReceiptProperties.value.total = 0;
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Watch Sidebar Location
watch(() => props.lokasiStokUuid, () => {
  ReturnReceiptProperties.value.page = 1;
  fetchReturnReceipt();
});

// handle Search
const handleSearch = () => {
  ReturnReceiptProperties.value.page = 1;
  fetchReturnReceipt();
};

// handle Reset
const handleReset = () => {
  searchQuery.value = "";
  reason.value = "";
  ReturnReceiptProperties.value.page = 1;
  fetchReturnReceipt();
};

// Handle Pagination
const handlePage = (event: any) => {
  ReturnReceiptProperties.value.page = event.page + 1;
  ReturnReceiptProperties.value.page_size = event.rows;
  fetchReturnReceipt();
};

// Selected Row & Navigation
const metaKey = ref(true);
const selectedData = ref();
const isDetailView = ref(false);

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  isDetailView.value = true;
};

const closePage = () => {
  isDetailView.value = false;
  selectedData.value = null;
  // Mungkin tidak perlu fetch ulang saat kembali dari detail
  fetchReturnReceipt();
};

onMounted(() => {
  if (props.lokasiStokUuid) {
    fetchReturnReceipt();
  }
});
</script>
<template>
  <div>
    <Card v-if="!isDetailView" pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden"
      class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchReturnReceipt" />
          <CustomBreadCrumb :home="{ label: 'Penerimaan Barang', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Penerimaan Retur Unit</h1>
          <CustomTextfield v-model="searchQuery" label="Pencarian" prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Retur / Asal Retur" @keydown.enter="handleSearch" />
          <CustomSelect v-model="reason" place-holder="Pilih Alasan" label="Alasan"
            optionLabel="name" optionValue="value" :options="optionReason" />
          <CustomButton label="Cari" icon="PhMagnifyingGlass" @click="handleSearch" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300"
            @click="handleReset" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable v-else :value="ReturnReceiptPayload" v-model:selection="selectedData" :metaKeySelection="metaKey"
          @rowClick="onRowSelect" tableStyle="min-width: 50rem" stripedRows class="text-xs" scrollable
          scrollHeight="flex" :dt="{
            rowSelectedColor: '#000000',
            rowSelectedBackground: 'transparent',
            bodyCellSelectedBorderColor: 'transparent',
            bodyCellBorderColor: 'transparent',
            rowStripedBackground: '#F8F8F8',
          }">
          <!-- Tanggal -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">Tanggal</div>
            </template>
            <template #body="slotProps">
              <div class="">{{ epochToDate(slotProps.data.tanggalRetur > 1e11 ? slotProps.data.tanggalRetur / 1000 : slotProps.data.tanggalRetur, "date") }}</div>
            </template>
          </Column>
          <!-- No. Permintaan -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">No. Permintaan</div>
            </template>
            <template #body="slotProps">
              <div class="mb-[5px]">{{ slotProps.data.noRetur }}</div>
              <div class="flex flex-wrap">
                <CustomChip v-if="slotProps.data.kategoriItem == 'medis'" label="MEDIS" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" />
                <CustomChip v-if="slotProps.data.kategoriItem == 'non-medis'" label="NON-MEDIS" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" />
                <CustomChip v-if="slotProps.data.jenisItem == 'Obat'" label="OBAT" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="ml-2" />
                <CustomChip v-if="slotProps.data.jenisItem == 'Alkes'" label="ALKES" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="ml-2" />
                <CustomChip v-if="slotProps.data.jenisStok" :label="slotProps.data.jenisStok.toUpperCase()"
                  :showCheckedIcon="false" borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300"
                  textColor="text-white" customClass="h-5" class="ml-2" />
              </div>
            </template>
          </Column>
          <!-- Asal Pengirim -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">Asal Pengirim</div>
            </template>
            <template #body="slotProps">
              <div class="font-bold">{{ slotProps.data.lokasiStokAwal.name }}</div>
            </template>
          </Column>
          <!-- Alasan Retur -->
          <Column field="alasanRetur" header="Alasan Retur" headerClass="bg-opensimrs-50 font-semibold text-SM"></Column>
          <!-- Petugas -->
          <Column field="petugasRetur" header="Petugas" headerClass="bg-opensimrs-50 font-semibold text-SM"></Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomPaginator :rows="ReturnReceiptProperties.page_size" :totalRecords="ReturnReceiptProperties.total"
            :rowsPerPageOptions="[10, 20, 30]" @page="handlePage" />
        </div>
      </template>
    </Card>
    <DetailReturnReceipt v-else :selectedData="selectedData" @back="closePage" />
  </div>
</template>
