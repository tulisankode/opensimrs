<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { useStokAdjustmentStore } from "@/stores/inventory/stokAdjustment";
import { useStockTypeStore } from "@/stores/datamasterFarmasi/StockType";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import { utilsStore } from "@/stores/utils";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import DialogDetailAdjustment from "./DialogDetailAdjustment.vue";

const props = defineProps({
  lokasiStokUuid: {
    type: String,
    default: "",
  },
});

// State Management Kategori Item
const kategoriItem = ref<string>("");
const optionKategori = ref([
  { name: "Medis", value: "medis" },
  { name: "Non-Medis", value: "nonmedis" },
]);

// State Management Jenis Item
const jenisItem = ref<string>("");
const optionJenis = ref([
  { name: "Obat", value: "obat" },
  { name: "Alkes", value: "alkes" },
]);

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());

// State Management Stock Type
const jenisStokUuid = ref<string>("");
const StockTypeStore = useStockTypeStore();
const StockTypePayload = ref<any[]>([]);

// Fetch Stock Type
const fetchStockType = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await StockTypeStore.getApi(1, 9999);

    if (response && response.payload) {
      StockTypePayload.value = response.payload;
    } else {
      StockTypePayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StockTypePayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// State Management Stock Location
const StockLocationStore = useStockLocationStore();
const StockLocationPayload = ref<any[]>([]);

// Fetch Stock Location
const fetchStockLocation = async () => {
  try {
    const response = await StockLocationStore.getApi(1, 9999);

    if (response && response.payload) {
      StockLocationPayload.value = response.payload;
    } else {
      StockLocationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StockLocationPayload.value = [];
  }
};

// Title Label
const pageType = ref("");
const dataBreadCrumb = ref<MenuItem[]>([]);

const changeSection = (label: string) => {
  if (dataBreadCrumb.value.length) {
    dataBreadCrumb.value[0] = { label: label };
  } else {
    dataBreadCrumb.value.push({ label: label });
  }
};

// ------------------------------------------------------------------------------------------

// State Management Stok Adjustment
const searchStok = ref<string>("");
const StokAdjustmentStore = useStokAdjustmentStore();
const UseUtilsStore = utilsStore();
const StockPayload = ref<any[]>([]);
const selectedLokasi = ref<string>("");
const StockProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasDataStok = computed(
  () => StockPayload.value && StockPayload.value.length > 0
);

// Fetch Stock
const fetchStokAdjustment = async () => {
  if (!props.lokasiStokUuid) {
    console.warn("Menunggu Lokasi Stok dipilih...");
    return;
  }
  UseUtilsStore.setLoading(true);
  try {
    const response = await StokAdjustmentStore.getApi(
      props.lokasiStokUuid || "",
      jenisStokUuid.value || "",
      kategoriItem.value || "",
      jenisItem.value || "",
      searchStok.value || "",
      StockProperties.value.page,
      StockProperties.value.page_size
    );

    if (response && response.payload) {
      StockProperties.value.total = response.properties.total;
      StockPayload.value = response.payload;
    } else {
      StockPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StockPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

watch(() => props.lokasiStokUuid, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    StockProperties.value.page = 1;
    fetchStokAdjustment(); // Fetch ulang jika lokasi sidebar berubah
  }
}, { immediate: true }); // immediate: true agar fetch saat halaman pertama kali load
// Handle Pagination
const handleStok = (event: any) => {
  StockProperties.value.page = event.page + 1;
  StockProperties.value.page_size = event.rows;
  fetchStokAdjustment();
};

// Filter Reset Stok
const resetStok = () => {
  jenisStokUuid.value = "";
  kategoriItem.value = "";
  jenisItem.value = "";
  searchStok.value = "";
  StockPayload.value = []; // Kosongkan data
  StockProperties.value.total = 0;
  StockProperties.value.page = 1;
};

const isDetailDialogVisible = ref(false);
const selectedItemForDetail = ref<any>(null); // Untuk menyimpan data baris yg diklik

// --- UBAH: Fungsi Adjustment untuk membuka dialog ---
const Adjustment = async (rowData: any) => {
  selectedItemForDetail.value = rowData;
  isDetailDialogVisible.value = true;
};

onMounted(() => {
  if (props.lokasiStokUuid){
  fetchStockLocation();
  fetchStockType();}
});
</script>

<template>
  <div>
    <Card v-if="dataBreadCrumb.length == 0" pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchStokAdjustment" />
          <CustomBreadCrumb :home="{ label: 'Stock Adjustment', home: true }" />
          <CustomTextfield label="Pencarian (Nama Item / Kode Item)" v-model="searchStok"
            prependIcon="PhMagnifyingGlass" placeholder="Cari Nama Item / Kode Item"
            @keydown.enter="fetchStokAdjustment" />
          <CustomSelect label="Kategori" placeHolder="Pilih Kategori" v-model="kategoriItem"
            :options="optionKategori" optionLabel="name" optionValue="value" />
          <CustomSelect label="Jenis Stok" placeHolder="Pilih Jenis Stok" v-model="jenisStokUuid"
            :options="StockTypePayload" optionLabel="name" optionValue="uuid" />
          <CustomSelect label="Jenis Item" placeHolder="Pilih Jenis Item" v-model="jenisItem" :options="optionJenis"
            optionLabel="name" optionValue="value" />
          <CustomButton label="Cari" icon="PhMagnifyingGlass" @click="fetchStokAdjustment" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300"
            @click="resetStok" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasDataStok" />
        <DataTable v-else :value="StockPayload" stripedRows class="text-xs" scrollable scrollHeight="flex">
          <!-- No -->
          <Column headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #header>
              <div class="font-semibold">No</div>
            </template>
            <template #body="slotProps">
              <div class="text-center">{{ slotProps.index + 1 }}</div>
            </template>
          </Column>
          <!-- Nama Item -->
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="font-semibold">Nama Item</div>
            </template>
            <template #body="slotProps">
              <div class="mb-[5px] ml-[10px]">{{ slotProps.data.nama }}</div>
              <div class="flex flex-wrap">
                <CustomChip v-if="slotProps.data.kategori == 'Medis'" label="MEDIS" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" />
                <CustomChip v-if="slotProps.data.kategori == 'Non-medis'" label="NON-MEDIS" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="ml-[5px]" />
                <CustomChip v-if="slotProps.data.jenisStok == 'BPJS'" label="BPJS" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="ml-[5px]" />
                <CustomChip v-if="slotProps.data.jenisStok == 'Umum'" label="UMUM" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="ml-[5px]" />
                <CustomChip v-if="slotProps.data.jenisItem == 'obat'" label="OBAT" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="ml-[5px]" />
                <CustomChip v-if="slotProps.data.jenisItem == 'alkes'" label="ALKES" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="ml-[5px]" />
                <CustomChip :label="slotProps.data.kategoriObat" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="ml-[5px]" />
              </div>
            </template>
          </Column>
          <!-- Sisa Stok -->
          <Column headerClass="bg-opensimrs-50" bodyClass="text-center w-[100px]">
            <template #header>
              <div class="font-semibold">Sisa Stok</div>
            </template>
            <template #body="slotProps">
              <div class="">{{ slotProps.data.sisaStok }}</div>
              <div class="text-[10px] text-opensimrs-300">Tablet</div>
            </template>
          </Column>
          <!-- Action -->
          <Column field="action" headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold text-center">Action</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                <CustomButton label="Adjustment" class="my-auto bg-opensimrs-300" @click="Adjustment(slotProps.data)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomPaginator :rows="StockProperties.page_size" :totalRecords="StockProperties.total"
            :rowsPerPageOptions="[10, 20, 30]" @page="handleStok" />
        </div>
      </template>
    </Card>
    <DialogDetailAdjustment v-model:isDialogVisible="isDetailDialogVisible" :detailData="selectedItemForDetail"
      :lokasi-stok-uuid="props.lokasiStokUuid" />
  </div>
</template>

