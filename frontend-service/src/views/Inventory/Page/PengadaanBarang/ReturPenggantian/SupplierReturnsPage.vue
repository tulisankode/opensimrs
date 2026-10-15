<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { useSupplierReturnsStore } from "@/stores/inventory/supplierReturns";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import DialogInvoice from "./DialogInvoice.vue"
import AddSupplierReturns from "./AddSupplierReturnsPage.vue";
import DetailSupplierReturns from "./DetailSupplierReturnsPage.vue";

const props = defineProps({
  lokasiStokUuid: {
    type: String,
    default: "",
  },
});

// Filter
const onSelected = ref<string>("retur");

const funcOnSelected = (label: string) => {
  onSelected.value = label;
  fetchSupplierReturns()
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

const selectedFaktur = ref<any>(null);

// State Management
const searchQuery = ref<string>("");
const SupplierReturnsStore = useSupplierReturnsStore();
const UseUtilsStore = utilsStore();
const SupplierReturnsPayload = ref<any[]>([]);
const SupplierReturnsProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () => SupplierReturnsPayload.value && SupplierReturnsPayload.value.length > 0
);

// Fetch Supplier Returns
const fetchSupplierReturns = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await SupplierReturnsStore.getApi(
      props.lokasiStokUuid,
      onSelected.value,
      searchQuery.value,
      SupplierReturnsProperties.value.page,
      SupplierReturnsProperties.value.page_size,
    );

    if (response && response.payload) {
      SupplierReturnsProperties.value.total = response.properties.total;
      SupplierReturnsPayload.value = response.payload;
    } else {
      SupplierReturnsPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    SupplierReturnsPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

watch(() => props.lokasiStokUuid, () => {
  SupplierReturnsProperties.value.page = 1; // Reset ke halaman pertama
  fetchSupplierReturns();
});


// Handle Pagination
const handlePage = (event: any) => {
  SupplierReturnsProperties.value.page = event.page + 1;
  SupplierReturnsProperties.value.page_size = event.rows;
  fetchSupplierReturns();
};

//handle faktur selected
const handleFakturSelected = (fakturData: any) => {
  selectedFaktur.value = fakturData; // Simpan data faktur
  changeSection('Tambah Retur'); // Pindah ke halaman Tambah Retur
};

// Selected Row
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  changeSection('Retur & Penggantian Barang Supplier');
};

// Dialog Management
const InvoiceDialog = ref(false);
const DeleteSupplierDialog = ref(false);

const dialogConfig = ref<any>({
  method: "add",
});

const openDialog = (method: string) => {
  dialogConfig.value = { method };
  InvoiceDialog.value = true;
};

const closeSupplierReturns = () => {
  dataBreadCrumb.value.pop();
  fetchSupplierReturns();
};

// GANTI DENGAN INI:
const handleReset = () => {
  searchQuery.value = "";
  SupplierReturnsProperties.value.page = 1;
  fetchSupplierReturns();
};

const handleSearch = () => {
  SupplierReturnsProperties.value.page = 1;
  fetchSupplierReturns();
}

onMounted(() => {
  fetchSupplierReturns();
});
</script>

<template>
  <div>
    <Card v-if="dataBreadCrumb.length == 0" pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchSupplierReturns" />
          <CustomBreadCrumb :home="{ label: 'Pengadaan Barang', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Retur & Penggantian Barang Supplier</h1>
          <CustomTextfield v-model="searchQuery" label="Pencarian" prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Retur / Tujuan Retur" @keydown.enter="handleSearch" />
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Status">
            <CustomButton @click="funcOnSelected('retur')" label="Retur Supplier" :outlined="onSelected != 'retur'"
              borderColor="border-opensimrs-300" :textColor="onSelected != 'retur' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="onSelected != 'retur' ? 'bg-transparent' : 'bg-opensimrs-300'" class="font-semibold" />
            <CustomButton @click="funcOnSelected('terima')" label="Terima Pengganti"
              :outlined="onSelected != 'terima'" borderColor="border-opensimrs-300"
              :textColor="onSelected != 'terima' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="onSelected != 'terima' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold" />
          </div>
          <CustomButton label="Cari" icon="PhMagnifyingGlass" @click="handleSearch" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300"
            @click="handleReset" />
          <CustomButton @click="openDialog('add')" icon="PhPlus" label="Retur" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable v-else :value="SupplierReturnsPayload" v-model:selection="selectedData" :metaKeySelection="metaKey"
          @rowClick="onRowSelect" tableStyle="min-width: 50rem" stripedRows class="text-xs" scrollable
          scrollHeight="flex" :dt="{
            rowSelectedColor: '#000000',
            rowSelectedBackground: 'transparent',
            bodyCellSelectedBorderColor: 'transparent',
            bodyCellBorderColor: 'transparent',
            rowStripedBackground: '#F8F8F8',
          }">
          <!-- Tanggal Pembelian -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">Tanggal</div>
            </template>
            <template #body="slotProps">
              <div class="">{{ epochToDate(slotProps.data.tanggalRetur, "date") }}</div>
            </template>
          </Column>
          <!-- No. Pembelian -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">No. Pembelian</div>
            </template>
            <template #body="slotProps">
              <div class="mb-[5px]">{{ slotProps.data.noReturSupplier }}</div>
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
                  textColor="text-white" customClass="h-5" class="ml-2" />
              </div>
            </template>
          </Column>
          <!-- Supplier -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">Supplier</div>
            </template>
            <template #body="slotProps">
              <div class="font-bold">{{ slotProps.data.supplier }}</div>
            </template>
          </Column>
          <!-- Petugas -->
          <Column field="petugas" header="Petugas" headerClass="bg-opensimrs-50 font-semibold text-SM"></Column>
          <!-- Status -->
          <Column field="status" headerClass="bg-opensimrs-50">
            <template #header="">
              <div class="font-semibold text-center text-SM">Status</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                <CustomChip v-if="slotProps.data.status == 'retur'" label="RETUR" :showCheckedIcon="false"
                  borderColor="border-lavender-300" bgColor="bg-lavender-300" textColor="text-white" />
                <CustomChip v-if="slotProps.data.status == 'terima'" label="DITERIMA" :showCheckedIcon="false"
                  borderColor="border-success-300" bgColor="bg-success-300" textColor="text-white" />
              </div>
            </template>
          </Column>
        </DataTable>
        <DialogInvoice v-model:isDialogVisible="InvoiceDialog" :lokasi-stok-uuid="props.lokasiStokUuid"
          @faktur-selected="handleFakturSelected" />
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomPaginator :rows="SupplierReturnsProperties.page_size" :totalRecords="SupplierReturnsProperties.total"
            :rowsPerPageOptions="[10, 20, 30]" @page="handlePage" />
        </div>
      </template>
    </Card>
    <AddSupplierReturns v-else-if="dataBreadCrumb[0]?.label == 'Tambah Retur'" :faktur-payload="selectedFaktur"
      @back="closeSupplierReturns" />

    <DetailSupplierReturns v-else-if="dataBreadCrumb[0]?.label == 'Retur & Penggantian Barang Supplier'"
      :selectedData="selectedData" @back="closeSupplierReturns" />
  </div>
</template>
