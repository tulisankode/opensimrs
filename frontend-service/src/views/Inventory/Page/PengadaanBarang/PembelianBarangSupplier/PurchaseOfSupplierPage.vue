<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { usePurchasingOfSupplierStore } from "@/stores/inventory/purchasingOfSupplier";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import AddPurchaseOfSupplier from "./AddPurchaseOfSupplierPage.vue";
import DetailPurchaseOfSupplierPage from "./DetailPurchaseOfSupplierPage.vue";

const props = defineProps({
  lokasiStokUuid: {
    type: String,
    default: "",
  },
});

// Filter
const onSelected = ref<string>("pending");

const funcOnSelected = (label: string) => {
  onSelected.value = label;
  fetchPurchasingOfSupplier()
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

// State Management
const searchQuery = ref<string>("");
const PurchasingOfSupplierStore = usePurchasingOfSupplierStore();
const UseUtilsStore = utilsStore();
const PurchasingOfSupplierPayload = ref<any[]>([]);
const PurchasingOfSupplierProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () => PurchasingOfSupplierPayload.value && PurchasingOfSupplierPayload.value.length > 0
);

// Fetch Purchasing Of Supplier
const fetchPurchasingOfSupplier = async () => {
  if (!props.lokasiStokUuid) return;
  UseUtilsStore.setLoading(true);
  try {
    const response = await PurchasingOfSupplierStore.getApi(
      props.lokasiStokUuid,
      onSelected.value,
      searchQuery.value,
      PurchasingOfSupplierProperties.value.page,
      PurchasingOfSupplierProperties.value.page_size,
    );

    if (response && response.payload) {
      PurchasingOfSupplierProperties.value.total = response.properties.total;
      PurchasingOfSupplierPayload.value = response.payload;
    } else {
      PurchasingOfSupplierPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    PurchasingOfSupplierPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

watch(() => props.lokasiStokUuid, (newValue) => {
  // Reset ke halaman 1 dan panggil ulang API
  PurchasingOfSupplierProperties.value.page = 1;
  fetchPurchasingOfSupplier();
});

// TAMBAHKAN Logika Tombol Reset & Cari (Mirip UnitOfExpenditurePage)
const handleReset = () => {
  searchQuery.value = "";
  PurchasingOfSupplierProperties.value.page = 1;
  fetchPurchasingOfSupplier();
};

const handleSearch = () => {
  PurchasingOfSupplierProperties.value.page = 1;
  fetchPurchasingOfSupplier();
}

// Handle Pagination
const handlePage = (event: any) => {
  PurchasingOfSupplierProperties.value.page = event.page + 1;
  PurchasingOfSupplierProperties.value.page_size = event.rows;
  fetchPurchasingOfSupplier();
};

// Selected Row
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  changeSection('Pembelian Barang Supplier');
};

const closePurchaseOfSupplierPage = () => {
  dataBreadCrumb.value.pop();
  fetchPurchasingOfSupplier();
};

const closeEditPage = async () => {
  dataBreadCrumb.value = dataBreadCrumb.value.slice(0, -2);
  await fetchPurchasingOfSupplier();
};

onMounted(() => {
  if (props.lokasiStokUuid) {
    fetchPurchasingOfSupplier();
  }
});
</script>

<template>
  <div>
    <Card v-if="dataBreadCrumb.length == 0" pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchPurchasingOfSupplier" />
          <CustomBreadCrumb :home="{ label: 'Pengadaan Barang', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Pembelian Barang Supplier</h1>
          <CustomTextfield v-model="searchQuery" label="Pencarian" prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Pembelian / Supplier" @keydown.enter="handleSearch" />
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Status">
            <CustomButton @click="funcOnSelected('pending')" label="Pengajuan"
              :outlined="onSelected != 'pending'" borderColor="border-opensimrs-300"
              :textColor="onSelected != 'pending' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="onSelected != 'pending' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold" />
            <CustomButton @click="funcOnSelected('cancel')" label="Dibatalkan" :outlined="onSelected != 'cancel'"
              borderColor="border-opensimrs-300" :textColor="onSelected != 'cancel' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="onSelected != 'cancel' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold" />
            <CustomButton @click="funcOnSelected('verifikasi')" label="Terverifikasi"
              :outlined="onSelected != 'verifikasi'" borderColor="border-opensimrs-300"
              :textColor="onSelected != 'verifikasi' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="onSelected != 'verifikasi' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold" />
          </div>
          <CustomButton label="Cari" icon="PhMagnifyingGlass" @click="handleSearch" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300"
            @click="handleReset" />
          <CustomButton @click="changeSection('Tambah Pembelian')" icon="PhPlus" label="Permintaan" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable v-else :value="PurchasingOfSupplierPayload" v-model:selection="selectedData"
          :metaKeySelection="metaKey" @rowClick="onRowSelect" tableStyle="min-width: 50rem" stripedRows class="text-xs"
          scrollable scrollHeight="flex" :dt="{
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
              <div class="">{{ epochToDate(slotProps.data.tanggalPembelian, "date") }}</div>
            </template>
          </Column>
          <!-- No. Pembelian -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">No. Pembelian</div>
            </template>
            <template #body="slotProps">
              <div class="mb-[5px]">{{ slotProps.data.noPo }}</div>
              <div class="flex flex-wrap">
                <CustomChip v-if="slotProps.data.kategoriItem == 'medis'" label="MEDIS" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" customClass="h-5" />
                <CustomChip v-if="slotProps.data.kategoriItem == 'non-medis'" label="NON-MEDIS" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" customClass="h-5" />
                <CustomChip v-if="slotProps.data.jenisItem == 'obat'" label="OBAT" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" customClass="h-5"
                  class="ml-2" />
                <CustomChip v-if="slotProps.data.jenisItem == 'alkes'" label="ALKES" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" customClass="h-5"
                  class="ml-2" />
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
          <Column field="petugasPembuatPo" header="Petugas" headerClass="bg-opensimrs-50 font-semibold text-SM"></Column>
          <!-- Status -->
          <Column field="status" headerClass="bg-opensimrs-50">
            <template #header="">
              <div class="w-full font-semibold text-center text-SM">Status</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                <CustomChip v-if="slotProps.data.status == 'pending'" label="PENGAJUAN" :showCheckedIcon="false"
                  borderColor="border-grey-300" bgColor="bg-grey-300" textColor="text-white" />
                <CustomChip v-if="slotProps.data.status == 'cancel'" label="DIBATALKAN" :showCheckedIcon="false"
                  borderColor="border-danger-300" bgColor="bg-danger-300" textColor="text-white" />
                <CustomChip v-if="slotProps.data.status == 'verifikasi'" label="DIVERIFIKASI" :showCheckedIcon="false"
                  borderColor="border-info-300" bgColor="bg-info-300" textColor="text-white" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomPaginator :rows="PurchasingOfSupplierProperties.page_size"
            :totalRecords="PurchasingOfSupplierProperties.total" :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage" />
        </div>
      </template>
    </Card>
    <AddPurchaseOfSupplier v-else-if="dataBreadCrumb[0].label == 'Tambah Pembelian'" @back="closePurchaseOfSupplierPage"
      @backEdit="closeEditPage" />
    <DetailPurchaseOfSupplierPage v-else-if="dataBreadCrumb[0].label == 'Pembelian Barang Supplier'"
      :dataBreadCrumb="dataBreadCrumb" :pageType="pageType" :selectedData="selectedData"
      @back="closePurchaseOfSupplierPage" />
  </div>
</template>
