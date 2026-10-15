<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useTransactionHistoryStore } from "@/stores/farmasi/TransactionHistory";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import { utilsStore } from "@/stores/utils";
import { dateToEpoch, epochToDate, setTimeForDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import DialogDetailObat from "./Layout/DetailTransactionObatPage.vue";
import DialogDetailAlkes from "./Layout/DetailTransactionAlkesPage.vue";

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());

// State Management
const TransactionHistoryStore = useTransactionHistoryStore();
const UseUtilsStore = utilsStore();
const TransactionHistoryObatPayload = ref<any[]>([]);
const TransactionHistoryAlkesPayload = ref<any[]>([]);
const TransactionHistoryProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const searchQuery = ref<string>("");

// Check if Data Exists
const hasDataObat = computed(
  () =>
    TransactionHistoryObatPayload.value &&
    TransactionHistoryObatPayload.value.length > 0
);
const hasDataAlkes = computed(
  () =>
    TransactionHistoryAlkesPayload.value &&
    TransactionHistoryAlkesPayload.value.length > 0
);

// Fetch Transaction History
const fetchTransactionHistory = async () => {
  UseUtilsStore.setLoading(true);
  const selectedPaymentNew = [...selectedPayment.value];
  const selectedLocationNew = [...selectedLocation.value];
  // Bangun parameter: satu pilihan -> kirim nilai; >1/0 -> kosong (tanpa filter)
  const paymentParam =
    selectedPaymentNew.length !== 1 ? "" : selectedPaymentNew[0];
  const locationParam =
    selectedLocationNew.length !== 1 ? "" : selectedLocationNew[0];

  try {
    const response = await TransactionHistoryStore.getApi({
      item_type: selectMedicine.value,
      status_type: selectedHistory.value,
      start_date: dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0)),
      end_date: dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59)),
      search: searchQuery.value,
      lokasi_stok_uuid: locationParam,
      payment_method: paymentParam,
      page: TransactionHistoryProperties.value.page,
      limit: TransactionHistoryProperties.value.page_size,
    });

    if (response && response.payload) {
      TransactionHistoryProperties.value.total = response.properties.total;
      if (selectMedicine.value === "obat") {
        TransactionHistoryObatPayload.value = response.payload;
      } else {
        TransactionHistoryAlkesPayload.value = response.payload;
      }
    } else {
      TransactionHistoryObatPayload.value = [];
      TransactionHistoryAlkesPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    TransactionHistoryObatPayload.value = [];
    TransactionHistoryAlkesPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Filter Riwayat
const selectedHistory = ref<string>("resep");
const onSelectHistory = (label: string) => {
  selectedHistory.value = label;
  fetchTransactionHistory();
};

// Filter Obat
const selectMedicine = ref<string>("obat");
const onSelectMedicine = (label: string) => {
  selectMedicine.value = label;
  fetchTransactionHistory();
};

// Filter Lokasi
const selectedLocation = ref<string[]>([]);
const selectLocation = (label: string) => {
  if (selectedLocation.value.includes(label)) {
    selectedLocation.value = selectedLocation.value.filter(
      (item) => item != label
    );
  } else {
    selectedLocation.value.push(label);
  }
  fetchTransactionHistory();
};

// Filter Pembayaran
const selectedPayment = ref<string[]>([]);
const onSelectPayment = (label: string) => {
  if (selectedPayment.value.includes(label)) {
    selectedPayment.value = selectedPayment.value.filter(
      (item) => item != label
    );
  } else {
    selectedPayment.value.push(label);
  }
  fetchTransactionHistory();
};

// Filter Search Data
const searchData = () => {
  searchQuery.value;
  dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0));
  dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59));
  fetchTransactionHistory();
};

// Filter Reset Data
const resetData = () => {
  searchQuery.value = "";
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  selectedLocation.value = [];
  selectedPayment.value = [];
  fetchTransactionHistory();
};

// State Management Stock Location
const StockLocationStore = useStockLocationStore();
const StockLocationPayload = ref<any[]>([]);

// Fetch Stock Location
const fetchStockLocation = async () => {
  try {
    const response = await StockLocationStore.getApi(1, 999999);

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

// Handle Pagination
const handlePage = (event: any) => {
  TransactionHistoryProperties.value.page = event.page + 1;
  TransactionHistoryProperties.value.page_size = event.rows;
  fetchTransactionHistory();
};

// Selected Row Obat
const metaKeyObat = ref(true);
const selectedDataObat = ref();
const DrugHistory = ref(false);
const refDialogDetailObat = ref<InstanceType<typeof DialogDetailObat> | null>(
  null
);

const onRowSelectObat = (event: any) => {
  selectedDataObat.value = event.data;
  DrugHistory.value = true;
  refDialogDetailObat.value?.fetchTransactionHistoryDetail(
    selectedDataObat.value.uuid
  );
};

// Selected Row Alkes
const metaKeyAlkes = ref(true);
const selectedDataAlkes = ref();
const medicalEquipmentHistory = ref(false);
const refDialogDetailAlkes = ref<InstanceType<typeof DialogDetailAlkes> | null>(
  null
);

const onRowSelectAlkes = (event: any) => {
  selectedDataAlkes.value = event.data;
  medicalEquipmentHistory.value = true;
  refDialogDetailAlkes.value?.fetchTransactionHistoryDetail(
    selectedDataAlkes.value.uuid
  );
};

onMounted(() => {
  fetchTransactionHistory();
  fetchStockLocation();
});
</script>

<template>
  <div class="flex overflow-hidden flex-col h-full">
    <Card
      pt:body:class="overflow-auto pt-0 h-full"
      pt:content:class="overflow-hidden h-full"
      class="overflow-hidden h-full"
    >
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchTransactionHistory" />
          <CustomBreadCrumb :home="{ label: 'Riwayat Transaksi', home: true }" />
          <CustomTextfield
            v-model="searchQuery"
            label="Pencarian"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Resep / No. RM / Nama Pasien"
            @keydown.enter="searchData"
          />
          <CustomDatePicker
            v-model="startDateFilter"
            label="Tanggal mulai"
            class="toolbar-field--date"
          />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker
            v-model="endDateFilter"
            label="Tanggal selesai"
            class="toolbar-field--date"
          />
          <ToolbarFilterMenu :count="selectedLocation.length">
            <template #label>Lokasi</template>
            <CustomChip
              v-for="(item, index) in StockLocationPayload"
              :key="item + index"
              :label="item.name"
              :value="item.uuid"
              :isSelected="selectedLocation.includes(item.uuid)"
              @selected="selectLocation"
            />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="selectedPayment.length">
            <template #label>Pembayaran</template>
            <CustomChip
              label="TUNAI"
              value="1"
              :isSelected="selectedPayment.includes('1')"
              @selected="onSelectPayment"
            />
            <CustomChip
              label="ASURANSI"
              value="2"
              :isSelected="selectedPayment.includes('2')"
              @selected="onSelectPayment"
            />
          </ToolbarFilterMenu>
          <!-- Filter Riwayat -->
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Jenis riwayat">
            <CustomButton
              @click="onSelectHistory('resep')"
              label="Resep"
              :outlined="selectedHistory != 'resep'"
              borderColor="border-opensimrs-300"
              :textColor="
                selectedHistory != 'resep' ? 'text-opensimrs-300' : 'text-white'
              "
              :backgroundColor="
                selectedHistory != 'resep' ? 'bg-transparent' : 'bg-opensimrs-300'
              "
              class="font-semibold"
            />
            <CustomButton
              @click="onSelectHistory('retur')"
              label="Retur"
              :outlined="selectedHistory != 'retur'"
              borderColor="border-opensimrs-300"
              :textColor="
                selectedHistory != 'retur' ? 'text-opensimrs-300' : 'text-white'
              "
              :backgroundColor="
                selectedHistory != 'retur' ? 'bg-transparent' : 'bg-opensimrs-300'
              "
              class="font-semibold"
            />
            <CustomButton
              @click="onSelectHistory('batal')"
              label="Pembatalan"
              :outlined="selectedHistory != 'batal'"
              borderColor="border-opensimrs-300"
              :textColor="
                selectedHistory != 'batal' ? 'text-opensimrs-300' : 'text-white'
              "
              :backgroundColor="
                selectedHistory != 'batal' ? 'bg-transparent' : 'bg-opensimrs-300'
              "
              class="font-semibold"
            />
          </div>
          <!-- Filter Obat / Material -->
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Jenis item">
            <CustomButton
              @click="onSelectMedicine('obat')"
              label="Obat"
              :outlined="selectMedicine != 'obat'"
              borderColor="border-opensimrs-300"
              :textColor="
                selectMedicine != 'obat' ? 'text-opensimrs-300' : 'text-white'
              "
              :backgroundColor="
                selectMedicine != 'obat' ? 'bg-transparent' : 'bg-opensimrs-300'
              "
              class="font-semibold"
            />
            <CustomButton
              @click="onSelectMedicine('alkes')"
              label="Material"
              :outlined="selectMedicine != 'alkes'"
              borderColor="border-opensimrs-300"
              :textColor="
                selectMedicine != 'alkes' ? 'text-opensimrs-300' : 'text-white'
              "
              :backgroundColor="
                selectMedicine != 'alkes' ? 'bg-transparent' : 'bg-opensimrs-300'
              "
              class="font-semibold"
            />
          </div>
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
        <!-- Datatable Obat -->
        <NoData v-if="!hasDataObat" v-show="selectMedicine === 'obat'" />
        <DataTable
          v-else
          v-show="selectMedicine === 'obat'"
          :value="TransactionHistoryObatPayload"
          v-model:selection="selectedDataObat"
          :metaKeySelection="metaKeyObat"
          @rowClick="onRowSelectObat"
          stripedRows
          class="text-xs"
          scrollable
          scrollHeight="flex"
          :dt="{
            rowSelectedColor: '#000000',
            rowSelectedBackground: 'transparent',
            bodyCellSelectedBorderColor: 'transparent',
            bodyCellBorderColor: 'transparent',
            rowStripedBackground: '#F8F8F8',
          }"
        >
          <!-- Resep -->
          <Column header="Resep" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <p>{{ slotProps.data.code }}</p>
                <p class="mt-[3px]">
                  {{ epochToDate(slotProps.data.date, "dateTime") }}
                </p>
              </div>
            </template>
          </Column>

          <!-- Pasien -->
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <p class="font-semibold">{{ slotProps.data.name }}</p>
              </div>
              <div class="flex flex-wrap mt-[3px]">
                <CustomChip
                  :label="slotProps.data.noRm"
                  :showCheckedIcon="false"
                  borderColor="border-opensimrs-300"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-6"
                />
              </div>
            </template>
          </Column>

          <!-- Keperawatan -->
          <Column header="Keperawatan" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div>
                <p class="text-SM">{{ slotProps.data.jenisPelayanan }}</p>
              </div>
              <div class="flex">
                <div class="mt-[3px]">
                  <CustomChip
                    :label="slotProps.data.lokasiStok"
                    :showCheckedIcon="false"
                    borderColor="border-opensimrs-300"
                    bgColor="bg-opensimrs-300"
                    textColor="text-white"
                    customClass="h-6"
                  />
                </div>
                <div class="ml-[5px] mt-[3px]">
                  <CustomChip
                    label="Obat"
                    :showCheckedIcon="false"
                    borderColor="border-lavender-300"
                    bgColor="bg-lavender-300"
                    textColor="text-white"
                    customClass="h-6"
                  />
                </div>
                <div class="ml-[5px] mt-[3px]">
                  <CustomChip
                    v-if="slotProps.data.paymentMethod == 'Tunai'"
                    label="TUNAI"
                    :showCheckedIcon="false"
                    borderColor="border-opensimrs-300"
                    bgColor="bg-opensimrs-300"
                    textColor="text-white"
                    customClass="h-6"
                  />
                  <CustomChip
                    v-else
                    label="BPJS"
                    :showCheckedIcon="false"
                    borderColor="border-warning-300"
                    bgColor="bg-warning-300"
                    textColor="text-white"
                    customClass="h-6"
                  />
                </div>
                <div class="ml-[5px] mt-[3px]">
                  <CustomChip
                    v-if="slotProps.data.racikan == true"
                    label="MENGANDUNG RACIKAN"
                    :showCheckedIcon="false"
                    borderColor="border-danger-300"
                    bgColor="bg-danger-300"
                    textColor="text-white"
                    customClass="h-6"
                  />
                  <CustomChip
                    v-if="slotProps.data.kronis == true"
                    label="KRONIS"
                    :showCheckedIcon="false"
                    borderColor="border-sunFlower-300"
                    bgColor="bg-sunFlower-300"
                    textColor="text-white"
                    customClass="h-6 ml-[5px]"
                  />
                </div>
              </div>
            </template>
          </Column>

          <!-- Status -->
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="">
                <CustomChip
                  :showCheckedIcon="false"
                  :label="
                    slotProps.data.status == 'Lunas' ? 'Lunas' : 'Piutang'
                  "
                  :bgColor="
                    slotProps.data.status == 'Lunas'
                      ? 'bg-success-300'
                      : 'bg-danger-75'
                  "
                  :textColor="
                    slotProps.data.status == 'Lunas'
                      ? 'text-white'
                      : 'text-danger-300'
                  "
                  customClass="h-6 pr-[6px] border-none"
                />
              </div>
            </template>
          </Column>
        </DataTable>

        <!-- Datatable Alkes -->
        <NoData v-if="!hasDataAlkes" v-show="selectMedicine === 'alkes'" />
        <DataTable
          v-else
          v-show="selectMedicine === 'alkes'"
          :value="TransactionHistoryAlkesPayload"
          v-model:selection="selectedDataAlkes"
          :metaKeySelection="metaKeyAlkes"
          @rowClick="onRowSelectAlkes"
          stripedRows
          class="text-xs"
          scrollable
          scrollHeight="flex"
          :dt="{
            rowSelectedColor: '#000000',
            rowSelectedBackground: 'transparent',
            bodyCellSelectedBorderColor: 'transparent',
            bodyCellBorderColor: 'transparent',
            rowStripedBackground: '#F8F8F8',
          }"
        >
          <!-- Resep -->
          <Column header="Resep" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <p>{{ slotProps.data.code }}</p>
                <p class="mt-[3px]">
                  {{ epochToDate(slotProps.data.date, "dateTime") }}
                </p>
              </div>
            </template>
          </Column>

          <!-- Pasien -->
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <p class="font-semibold">{{ slotProps.data.name }}</p>
              </div>
              <div class="flex flex-wrap mt-[3px]">
                <CustomChip
                  :label="slotProps.data.noRM"
                  :showCheckedIcon="false"
                  borderColor="border-opensimrs-300"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-6"
                />
              </div>
            </template>
          </Column>
          <!-- Keperawatan -->
          <Column header="Keperawatan" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div>
                <p class="text-SM">{{ slotProps.data.jenisPelayanan }}</p>
              </div>
              <div class="flex">
                <div class="mt-[3px]">
                  <CustomChip
                    :label="slotProps.data.lokasiStok"
                    :showCheckedIcon="false"
                    borderColor="border-opensimrs-300"
                    bgColor="bg-opensimrs-300"
                    textColor="text-white"
                    customClass="h-6"
                  />
                </div>
                <div class="ml-[5px] mt-[3px]">
                  <CustomChip
                    label="Alkes"
                    :showCheckedIcon="false"
                    borderColor="border-lavender-300"
                    bgColor="bg-lavender-300"
                    textColor="text-white"
                    customClass="h-6"
                  />
                </div>
                <div class="ml-[5px] mt-[3px]">
                  <CustomChip
                    v-if="slotProps.data.paymentMethod == 'Tunai'"
                    label="TUNAI"
                    :showCheckedIcon="false"
                    borderColor="border-opensimrs-300"
                    bgColor="bg-opensimrs-300"
                    textColor="text-white"
                    customClass="h-6"
                  />
                  <CustomChip
                    v-else
                    label="BPJS"
                    :showCheckedIcon="false"
                    borderColor="border-warning-300"
                    bgColor="bg-warning-300"
                    textColor="text-white"
                    customClass="h-6"
                  />
                </div>
                <div class="ml-[5px] mt-[3px]">
                  <CustomChip
                    v-if="slotProps.data.racikan == true"
                    label="MENGANDUNG RACIKAN"
                    :showCheckedIcon="false"
                    borderColor="border-danger-300"
                    bgColor="bg-danger-300"
                    textColor="text-white"
                    customClass="h-6"
                  />
                  <CustomChip
                    v-if="slotProps.data.kronis == true"
                    label="KRONIS"
                    :showCheckedIcon="false"
                    borderColor="border-sunFlower-300"
                    bgColor="bg-sunFlower-300"
                    textColor="text-white"
                    customClass="h-6"
                  />
                </div>
              </div>
            </template>
          </Column>
          <!-- Status -->
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="">
                <CustomChip
                  :showCheckedIcon="false"
                  :label="
                    slotProps.data.status == 'Lunas' ? 'Lunas' : 'Piutang'
                  "
                  :bgColor="
                    slotProps.data.status == 'Lunas'
                      ? 'bg-success-300'
                      : 'bg-danger-75'
                  "
                  :textColor="
                    slotProps.data.status == 'Lunas'
                      ? 'text-white'
                      : 'text-danger-300'
                  "
                  customClass="h-6 pr-[6px] border-none"
                />
              </div>
            </template>
          </Column>
        </DataTable>

        <DialogDetailObat
          v-model:isDialogVisible="DrugHistory"
          :payloadObat="selectedDataObat"
          :filterItem="selectMedicine"
          :filterStatus="selectedHistory"
          ref="refDialogDetailObat"
        />

        <DialogDetailAlkes
          v-model:isDialogVisible="medicalEquipmentHistory"
          :payloadAlkes="selectedDataAlkes"
          :filterItem="selectMedicine"
          :filterStatus="selectedHistory"
          ref="refDialogDetailAlkes"
        />
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomPaginator
            :rows="TransactionHistoryProperties.page_size"
            :totalRecords="TransactionHistoryProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
