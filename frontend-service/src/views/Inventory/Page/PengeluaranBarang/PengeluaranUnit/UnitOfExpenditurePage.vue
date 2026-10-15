<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { useUnitOfExpenditureStore } from "@/stores/inventory/unitOfExpenditure";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import AddUnitOfExpenditure from "./AddUnitOfExpenditurePage.vue";
import DetailUnitOfExpenditure from "./DetailUnitOfExpenditurePage.vue";
import { PhArrowRight } from "@phosphor-icons/vue";

const props = defineProps({
  lokasiStokUuid: {
    type: String,
    default: "",
  },
});

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

// State Management
const searchQuery = ref<string>("");
const UnitOfExpenditureStore = useUnitOfExpenditureStore();
const UseUtilsStore = utilsStore();
const UnitExpenditurePayload = ref<any[]>([]);
const UnitExpenditureProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () => UnitExpenditurePayload.value && UnitExpenditurePayload.value.length > 0
);

// Fetch Purchasing Of Supplier
const fetchUnitExpenditure = async () => {
  if (!props.lokasiStokUuid) return;
  UseUtilsStore.setLoading(true);
  try {
    const response = await UnitOfExpenditureStore.getApi(
      props.lokasiStokUuid,
      searchQuery.value,
      UnitExpenditureProperties.value.page, // Gunakan variabel baru
      UnitExpenditureProperties.value.page_size, // Gunakan variabel baru
    );
    if (response && response.payload && response.payload.data) {
      // Ambil total dari payload.pagination
      UnitExpenditureProperties.value.total = response.payload.pagination.total || 0;
      // Ambil array data dari payload.data
      UnitExpenditurePayload.value = response.payload.data;
    } else {
      UnitExpenditurePayload.value = [];
      UnitExpenditureProperties.value.total = 0; // Reset total juga
    }

  } catch (error) {
    console.error("Failed to fetch unit expenditure data:", error); // Perbaiki pesan error
    UnitExpenditurePayload.value = [];
    UnitExpenditureProperties.value.total = 0; // Reset total jika error
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

watch(() => props.lokasiStokUuid, () => {
  UnitExpenditureProperties.value.page = 1;
  fetchUnitExpenditure(); // Panggil fungsi baru
});

const handleReset = () => {
  searchQuery.value = "";
  UnitExpenditureProperties.value.page = 1;
  fetchUnitExpenditure(); // Panggil fungsi baru
};

const handleSearch = () => {
  UnitExpenditureProperties.value.page = 1;
  fetchUnitExpenditure(); // Panggil fungsi baru
}

// Handle Pagination
const handlePage = (event: any) => {
  UnitExpenditureProperties.value.page = event.page + 1;
  UnitExpenditureProperties.value.page_size = event.rows;
  fetchUnitExpenditure(); // Panggil fungsi baru
};

// Selected Row
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  changeSection('Detail');
};

const closePurchaseOfSupplierPage = () => {
  dataBreadCrumb.value.pop();
  fetchUnitExpenditure(); // Panggil fungsi baru
};

onMounted(() => {
  if (props.lokasiStokUuid){
  fetchUnitExpenditure();} // Panggil fungsi baru
});
</script>

<template>
  <div>
    <Card v-if="dataBreadCrumb.length == 0" pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchUnitExpenditure" />
          <CustomBreadCrumb :home="{ label: 'Pengeluaran Barang', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Pengeluaran Unit</h1>
          <CustomTextfield v-model="searchQuery" label="Pencarian" prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Pengeluaran" @keydown.enter="handleSearch" />
          <CustomButton label="Cari" icon="PhMagnifyingGlass" @click="handleSearch" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300"
            @click="handleReset" />
          <CustomButton @click="changeSection('Tambah')" icon="PhPlus" label="Pengeluaran" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable v-else :value="UnitExpenditurePayload" v-model:selection="selectedData" :metaKeySelection="metaKey"
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
              <div class="">{{ epochToDate(slotProps.data.tanggalPengeluaran, "date") }}</div>
            </template>
          </Column>
          <!-- No. Pengeluaran -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">No. Pengeluaran</div>
            </template>
            <template #body="slotProps">
              <div class="mb-[5px]">{{ slotProps.data.noPengeluaran }}</div>
              <div class="flex flex-wrap">
                <CustomChip v-if="slotProps.data.kategoriItem == 'medis'" label="MEDIS" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="mr-[5px]" />
                <CustomChip v-if="slotProps.data.kategoriItem == 'non-medis'" label="NON-MEDIS" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="mr-[5px]" />
                <CustomChip v-if="slotProps.data.jenisItem == 'obat'" label="OBAT" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="mr-[5px]" />
                <CustomChip v-if="slotProps.data.jenisItem == 'alkes'" label="ALKES" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="mr-[5px]" />
                <CustomChip v-if="slotProps.data.jenisStok" :label="slotProps.data.jenisStok.toUpperCase()"
                  :showCheckedIcon="false" borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300"
                  textColor="text-white" class="mr-[5px]" />
              </div>
            </template>
          </Column>
          <!-- Jenis Pengeluaran -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">Jenis Pengeluaran</div>
            </template>
            <template #body="slotProps">
              <div>
                <div class="font-bold">{{ slotProps.data.jenisPengeluaran }}</div>
                
                <div 
                  v-if="slotProps.data.jenisPengeluaran === 'pengeluaran tanpa permintaan'" 
                  class="flex items-center text-xs text-opensimrs-300 mt-1" 
                >
                  <PhArrowRight :size="12" weight="bold" class="mr-1 flex-shrink-0" />
                  <span>{{ slotProps.data.lokasiStokAkhir || '-' }}</span> 
                </div>
              </div>
            </template>
          </Column>
          <!-- Petugas -->
          <Column field="petugasPengeluaran" header="Petugas" headerClass="bg-opensimrs-50 font-semibold text-SM">
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomPaginator :rows="UnitExpenditureProperties.page_size" :totalRecords="UnitExpenditureProperties.total"
            :rowsPerPageOptions="[10, 20, 30]" @page="handlePage" />
        </div>
      </template>
    </Card>
    <AddUnitOfExpenditure v-else-if="dataBreadCrumb[0].label == 'Tambah'" :dataBreadCrumb="dataBreadCrumb"
      :pageType="pageType" :lokasiStokUuid="props.lokasiStokUuid" @back="closePurchaseOfSupplierPage" />
    <DetailUnitOfExpenditure v-else-if="dataBreadCrumb[0].label == 'Detail'" :selectedData="selectedData"
      @back="closePurchaseOfSupplierPage" />
  </div>
</template>
