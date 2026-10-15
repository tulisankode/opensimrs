<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { useUnitDeliveryVerificationStore } from "@/stores/inventory/unitDeliveryVerification";
import { utilsStore } from "@/stores/utils";
import { epochToDate, formatDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import DetailUnitDeliveryVerification from "./DetailUnitDeliveryVerificationPage.vue";

const props = defineProps({
  lokasiStokUuid: {
    type: String,
    default: "",
  },
});

// Filter
const onSelected = ref<string>("request");

const funcOnSelected = (label: string) => {
  onSelected.value = label;
  fetchUnitDeliveryVerification()
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
const UnitDeliveryVerificationStore = useUnitDeliveryVerificationStore();
const UseUtilsStore = utilsStore();
const UnitDeliveryVerificationPayload = ref<any[]>([]);
const UnitDeliveryVerificationProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () => UnitDeliveryVerificationPayload.value && UnitDeliveryVerificationPayload.value.length > 0
);

// Fetch Unit Delivery Verification
const fetchUnitDeliveryVerification = async () => {
  if (!props.lokasiStokUuid) return;
  UseUtilsStore.setLoading(true);

  let statusParams: string | string[];
  const currentStatus = onSelected.value;

  if (currentStatus === 'request') {
    statusParams = ['request', 'request_sebagian'];
  } else if (currentStatus === 'verified') {
    statusParams = ['verified', 'verif_sebagian'];
  } else {
    statusParams = currentStatus;
  }
  try {
    const response = await UnitDeliveryVerificationStore.getApi(
      props.lokasiStokUuid,
      statusParams,
      searchQuery.value,
      UnitDeliveryVerificationProperties.value.page,
      UnitDeliveryVerificationProperties.value.page_size,
    );

    if (response && response.payload) {
      UnitDeliveryVerificationProperties.value.total = response.properties.total;
      UnitDeliveryVerificationPayload.value = response.payload;
    } else {
      UnitDeliveryVerificationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    UnitDeliveryVerificationPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

watch(() => props.lokasiStokUuid, () => {
  UnitDeliveryVerificationProperties.value.page = 1; // Reset ke halaman pertama
  fetchUnitDeliveryVerification();
});


// handle cari dan reset

const handleReset = () => {
  searchQuery.value = "";
  UnitDeliveryVerificationProperties.value.page = 1;
  fetchUnitDeliveryVerification();
};

const handleSearch = () => {
  UnitDeliveryVerificationProperties.value.page = 1;
  fetchUnitDeliveryVerification();
}

// Handle Pagination
const handlePage = (event: any) => {
  UnitDeliveryVerificationProperties.value.page = event.page + 1;
  UnitDeliveryVerificationProperties.value.page_size = event.rows;
  fetchUnitDeliveryVerification();
};

// Selected Row
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  changeSection('Verifikasi & Pengiriman Unit');
};

const closeUnitDeliveryVerification = () => {
  dataBreadCrumb.value.pop();
  fetchUnitDeliveryVerification();
};

onMounted(() => {
  if (props.lokasiStokUuid) {
    fetchUnitDeliveryVerification();
  }
});
</script>

<template>
  <div>
    <Card v-if="dataBreadCrumb.length == 0" pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchUnitDeliveryVerification" />
          <CustomBreadCrumb :home="{ label: 'Pengeluaran Barang', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Verifikasi & Pengiriman Unit</h1>
          <CustomTextfield v-model="searchQuery" label="Pencarian" prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Permintaan / Tujuan Penerimaan" @keydown.enter="handleSearch" />
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Status">
            <CustomButton @click="funcOnSelected('request')" label="Permintaan" :outlined="onSelected != 'request'"
              borderColor="border-opensimrs-300"
              :textColor="onSelected != 'request' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="onSelected != 'request' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold" />
            <CustomButton @click="funcOnSelected('verified')" label="Verifikasi" :outlined="onSelected != 'verified'"
              borderColor="border-opensimrs-300"
              :textColor="onSelected != 'verified' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="onSelected != 'verified' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold" />
            <CustomButton @click="funcOnSelected('dikirim')" label="Dikirim" :outlined="onSelected != 'dikirim'"
              borderColor="border-opensimrs-300"
              :textColor="onSelected != 'dikirim' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="onSelected != 'dikirim' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold" />
            <CustomButton @click="funcOnSelected('cancel')" label="Ditolak" :outlined="onSelected != 'cancel'"
              borderColor="border-opensimrs-300" :textColor="onSelected != 'cancel' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="onSelected != 'cancel' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold" />
          </div>
          <CustomButton label="Cari" icon="PhMagnifyingGlass" @click="handleSearch" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300"
            @click="handleReset" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable v-else :value="UnitDeliveryVerificationPayload" v-model:selection="selectedData"
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
              <div class="">{{ formatDate(new Date(Number(slotProps.data.tanggalPermintaan))) }}</div>
            </template>
          </Column>
          <!-- No. Pengeluaran -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">No. Pengeluaran</div>
            </template>
            <template #body="slotProps">
              <div class="mb-[5px]">{{ slotProps.data.noPermintaan }}</div>
              <div class="flex flex-wrap">
                <CustomChip v-if="slotProps.data.jenisStok" :label="slotProps.data.jenisStok.toUpperCase()"
                  :showCheckedIcon="false" borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300"
                  textColor="text-white" class="mr-[5px]" />
                  <CustomChip v-if="slotProps.data.jenisItem" :label="slotProps.data.jenisItem.toUpperCase()"
                  :showCheckedIcon="false" borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300"
                  textColor="text-white" class="mr-[5px]" />
                <CustomChip v-if="slotProps.data.kategoriItem == 'medis'" label="MEDIS" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="mr-[5px]" />
                <CustomChip v-if="slotProps.data.kategoriItem == 'non-medis'" label="NON-MEDIS" :showCheckedIcon="false"
                  borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" class="mr-[5px]" />
                <CustomChip v-if="slotProps.data.cito == true" label="CITO" :showCheckedIcon="false"
                  borderColor="border-danger-300" bgColor="bg-danger-300" textColor="text-white" class="mr-[5px]" />
              </div>
            </template>
          </Column>
          <!-- Tujuan Permintaan -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">Tujuan Permintaan</div>
            </template>
            <template #body="slotProps">
              <div class="font-bold">{{ slotProps.data.lokasiStokTujuan }}</div>
            </template>
          </Column>
          <!-- Petugas -->
          <Column field="petugasPermintaan" header="Petugas" headerClass="bg-opensimrs-50 font-semibold text-SM"></Column>
          <!-- Status -->
          <Column field="status" headerClass="bg-opensimrs-50">
            <template #header="">
              <div class="w-full font-semibold text-center text-SM">Status</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                <CustomChip v-if="slotProps.data.status == 'request'" label="PENGAJUAN" :showCheckedIcon="false"
                  borderColor="border-grey-300" bgColor="bg-grey-300" textColor="text-white" customClass="h-6" />
                <CustomChip v-if="slotProps.data.status == 'request_sebagian'" label="PENGAJUAN - VERIF SEBAGIAN"
                  :showCheckedIcon="false" borderColor="border-grey-300" bgColor="bg-grey-300" textColor="text-white"
                  customClass="h-6" />
                <CustomChip v-if="slotProps.data.status == 'cancel'" label="DIBATALKAN" :showCheckedIcon="false"
                  borderColor="border-danger-300" bgColor="bg-danger-300" textColor="text-white" customClass="h-6" />
                <CustomChip v-if="slotProps.data.status == 'verified'" label="DIVERIFIKASI" :showCheckedIcon="false"
                  borderColor="border-info-300" bgColor="bg-info-300" textColor="text-white" customClass="h-6" />
                <CustomChip v-if="slotProps.data.status == 'verif_sebagian'" label="DIVERIFIKASI - VERIF SEBAGIAN"
                  :showCheckedIcon="false" borderColor="border-info-300" bgColor="bg-info-300" textColor="text-white"
                  customClass="h-6" />
                <CustomChip v-if="slotProps.data.status == 'dikirim'" label="DIKIRIM" :showCheckedIcon="false"
                  borderColor="border-grey-300" bgColor="bg-grey-300" textColor="text-white" customClass="h-6" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomPaginator :rows="UnitDeliveryVerificationProperties.page_size"
            :totalRecords="UnitDeliveryVerificationProperties.total" :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage" />
        </div>
      </template>
    </Card>
    <DetailUnitDeliveryVerification v-else-if="dataBreadCrumb[0].label == 'Verifikasi & Pengiriman Unit'"
      :dataBreadCrumb="dataBreadCrumb" :pageType="pageType" :selectedData="selectedData"
      @back="closeUnitDeliveryVerification" />
  </div>
</template>
