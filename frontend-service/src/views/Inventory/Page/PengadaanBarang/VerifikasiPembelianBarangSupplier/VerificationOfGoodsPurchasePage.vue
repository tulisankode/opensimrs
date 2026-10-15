<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { useVerificationOfGoodsPurchaseStore } from "@/stores/inventory/verificationOfGoodsPurchase";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import DetailVerificationOfGoodsPurchasePage from "./DetailVerificationOfGoodsPurchasePage.vue";

// Props sidebar stok lokasi
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
  fetchVerification()
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
const VerificationStore = useVerificationOfGoodsPurchaseStore();
const UseUtilsStore = utilsStore();
const VerificationPayload = ref<any[]>([]);
const VerificationProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () => VerificationPayload.value && VerificationPayload.value.length > 0
);

// Fetch Verification
const fetchVerification = async () => {
  if (!props.lokasiStokUuid) return;
  UseUtilsStore.setLoading(true);
  try {
    const response = await VerificationStore.getApi(
      props.lokasiStokUuid,
      onSelected.value,
      searchQuery.value,
      VerificationProperties.value.page,
      VerificationProperties.value.page_size,
    );

    if (response && response.payload) {
      VerificationProperties.value.total = response.properties.total;
      VerificationPayload.value = response.payload;
    } else {
      VerificationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    VerificationPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

watch(() => props.lokasiStokUuid, () => {
  VerificationProperties.value.page = 1; // Reset ke halaman pertama
  fetchVerification();
});


// handle cari 
const handleReset = () => {
  searchQuery.value = "";
  VerificationProperties.value.page = 1;
  fetchVerification();
};

const handleSearch = () => {
  VerificationProperties.value.page = 1;
  fetchVerification();
}

// Handle Pagination
const handlePage = (event: any) => {
  VerificationProperties.value.page = event.page + 1;
  VerificationProperties.value.page_size = event.rows;
  fetchVerification();
};

// Selected Row
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  changeSection('Verifikasi');
};

const closePurchaseOfSupplierPage = () => {
  dataBreadCrumb.value.pop();
  fetchVerification();
};

onMounted(() => {
  if (props.lokasiStokUuid) {
    fetchVerification();
  }
});
</script>

<template>
  <div>
    <Card v-if="dataBreadCrumb.length == 0" pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchVerification" />
          <CustomBreadCrumb :home="{ label: 'Pengadaan Barang', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Verifikasi Pembelian Barang Supplier</h1>
          <CustomTextfield v-model="searchQuery" label="Pencarian" prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Pembelian / Supplier" @keydown.enter="handleSearch" />
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Status">
            <CustomButton @click="funcOnSelected('pending')" label="Pengajuan Pembelian"
              :outlined="onSelected != 'pending'" borderColor="border-opensimrs-300"
              :textColor="onSelected != 'pending' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="onSelected != 'pending' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold" />
            <CustomButton @click="funcOnSelected('verifikasi')" label="Verifikasi"
              :outlined="onSelected != 'verifikasi'" borderColor="border-opensimrs-300"
              :textColor="onSelected != 'verifikasi' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="onSelected != 'verifikasi' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold" />
          </div>
          <CustomButton label="Cari" icon="PhMagnifyingGlass" @click="handleSearch" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300"
            @click="handleReset" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable v-else :value="VerificationPayload" v-model:selection="selectedData" :metaKeySelection="metaKey"
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
                  borderColor="border-grey-300" bgColor="bg-grey-300" textColor="text-white" customClass="h-6" />
                <CustomChip v-if="slotProps.data.status == 'cancel'" label="DIBATALKAN" :showCheckedIcon="false"
                  borderColor="border-danger-300" bgColor="bg-danger-300" textColor="text-white" customClass="h-6" />
                <CustomChip v-if="slotProps.data.status == 'verifikasi'" label="DIVERIFIKASI" :showCheckedIcon="false"
                  borderColor="border-success-300" bgColor="bg-success-300" textColor="text-white" customClass="h-6" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomPaginator :rows="VerificationProperties.page_size" :totalRecords="VerificationProperties.total"
            :rowsPerPageOptions="[10, 20, 30]" @page="handlePage" />
        </div>
      </template>
    </Card>
    <DetailVerificationOfGoodsPurchasePage v-else-if="dataBreadCrumb[0].label == 'Verifikasi'"
      :dataBreadCrumb="dataBreadCrumb" :pageType="pageType" :selectedData="selectedData"
      @back="closePurchaseOfSupplierPage" />
  </div>
</template>
