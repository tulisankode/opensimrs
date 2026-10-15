<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useDrugReturStore } from "@/stores/farmasi/DrugRetur";
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
import DialogDetailObat from "./Layout/DetailReturnObatPage.vue";
import DialogDetailAlkes from "./Layout/DetailReturnAlkesPage.vue";

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());

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

// Filter Search Data
const searchData = () => {
  searchQuery.value;
  dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0)),
    dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59)),
    fetchDrugRetur();
};

// Filter Reset Data
const resetData = () => {
  searchQuery.value = "";
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  selectedLocation.value = [];
  selectedPaymentMethod.value = [];
  fetchDrugRetur();
};

// Filter Obat
const selectMedicine = ref<string>("obat");
const onSelectMedicine = (label: string) => {
  selectMedicine.value = label;
  fetchDrugRetur();
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
  fetchDrugRetur();
};

// Filter Pembayaran
const selectedPaymentMethod = ref<string[]>([]);
const onPaymentMethodSelect = (label: string) => {
  if (selectedPaymentMethod.value.includes(label)) {
    selectedPaymentMethod.value = selectedPaymentMethod.value.filter(
      (item) => item != label
    );
  } else {
    selectedPaymentMethod.value.push(label);
  }
  fetchDrugRetur();
};

// State Management
const DrugReturStore = useDrugReturStore();
const UseUtilsStore = utilsStore();
const DrugReturObatPayload = ref<any[]>([]);
const DrugReturAlkesPayload = ref<any[]>([]);
const DrugReturObatProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const searchQuery = ref<string>("");

// Check if Data Exists
const hasDataObat = computed(
  () => DrugReturObatPayload.value && DrugReturObatPayload.value.length > 0
);
const hasDataAlkes = computed(
  () => DrugReturAlkesPayload.value && DrugReturAlkesPayload.value.length > 0
);

// Fetch Drug Retur
const fetchDrugRetur = async () => {
  UseUtilsStore.setLoading(true);

  const selectedPayment = [...selectedPaymentMethod.value];
  const selectedLocationNew = [...selectedLocation.value];

  // Bangun parameter query: satu pilihan -> kirim nilai; >1/0 -> kosong (tanpa filter)
  const paymentParam = selectedPayment.length !== 1 ? "" : selectedPayment[0];
  const locationParam =
    selectedLocationNew.length !== 1 ? "" : selectedLocationNew[0];

  try {
    const response = await DrugReturStore.getApi(
      selectMedicine.value,
      dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0)),
      dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59)),
      searchQuery.value,
      locationParam,
      paymentParam,
      DrugReturObatProperties.value.page,
      DrugReturObatProperties.value.page_size
    );

    if (response && response.payload) {
      DrugReturObatProperties.value.total = response.properties.total;
      if (selectMedicine.value === "obat") {
        DrugReturObatPayload.value = response.payload;
      } else {
        DrugReturAlkesPayload.value = response.payload;
      }
    } else {
      DrugReturObatPayload.value = [];
      DrugReturAlkesPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    DrugReturObatPayload.value = [];
    DrugReturAlkesPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Handle Pagination
const handlePage = (event: any) => {
  DrugReturObatProperties.value.page = event.page + 1;
  DrugReturObatProperties.value.page_size = event.rows;
  fetchDrugRetur();
};

// Selected Row Obat
const metaKeyObat = ref(true);
const selectedDataObat = ref();
const dialogDetailObat = ref(false);
const refDialogDetailObat = ref<InstanceType<typeof DialogDetailObat> | null>(
  null
);

const onRowSelectObat = (event: any) => {
  selectedDataObat.value = event.data;
  dialogDetailObat.value = true;
  refDialogDetailObat.value?.fetchDrugReturDetail(selectedDataObat.value.uuid);
};

// Selected Row Alkes
const metaKeyAlkes = ref(true);
const selectedDataAlkes = ref();
const dialogDetailAlkes = ref(false);
const refDialogDetailAlkes = ref<InstanceType<typeof DialogDetailAlkes> | null>(
  null
);

const onRowSelectAlkes = (event: any) => {
  selectedDataAlkes.value = event.data;
  dialogDetailAlkes.value = true;
  refDialogDetailAlkes.value?.fetchDrugReturDetail(
    selectedDataAlkes.value.uuid
  );
};

onMounted(() => {
  fetchStockLocation();
  fetchDrugRetur();
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
          <CustomButton icon="PhArrowClockwise" @click="fetchDrugRetur" />
          <CustomBreadCrumb :home="{ label: 'Retur Obat & Material', home: true }" />
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
          <ToolbarFilterMenu :count="selectedPaymentMethod.length">
            <template #label>Pembayaran</template>
            <CustomChip
              label="TUNAI"
              value="1"
              :isSelected="selectedPaymentMethod.includes('1')"
              @selected="onPaymentMethodSelect"
            />
            <CustomChip
              label="ASURANSI"
              value="2"
              :isSelected="selectedPaymentMethod.includes('2')"
              @selected="onPaymentMethodSelect"
            />
          </ToolbarFilterMenu>
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
          v-show="selectMedicine === 'obat'"
          v-else
          :value="DrugReturObatPayload"
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
                <p>{{ slotProps.data.noResep || "-" }}</p>
                <p class="mt-[3px]">
                  {{
                    slotProps.data.orderDate
                      ? epochToDate(slotProps.data.orderDate, "dateTime")
                      : "-"
                  }}
                </p>
              </div>
            </template>
          </Column>

          <!-- Pasien -->
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <p class="font-semibold">
                  {{ slotProps.data.patient?.name || "-" }}
                </p>
              </div>
              <div class="flex flex-wrap mt-[3px]">
                <CustomChip
                  :label="slotProps.data.noRm || '-'"
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
              <div class="text-SM">
                {{ slotProps.data.jenisPelayanan || "-" }}
              </div>
              <div class="flex flex-wrap mt-[3px]">
                <CustomChip
                  :label="slotProps.data.lokasiStok?.name || '-'"
                  :showCheckedIcon="false"
                  borderColor="border-opensimrs-300"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-6 mr-[5px]"
                />
                <CustomChip
                  label="Obat"
                  :showCheckedIcon="false"
                  borderColor="border-opensimrs-300"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-6 mr-[5px]"
                />
                <CustomChip
                  v-if="slotProps.data.paymentMethod == 1"
                  :showCheckedIcon="false"
                  label="TUNAI"
                  borderColor="border-opensimrs-300"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-6 "
                />
                <CustomChip
                  v-if="slotProps.data.paymentMethod == 2"
                  :showCheckedIcon="false"
                  label="BPJS"
                  borderColor="border-warning-300"
                  bgColor="bg-warning-300"
                  textColor="text-white"
                  customClass="h-6 pr-[6px] ml-[5px]"
                />
              </div>
            </template>
          </Column>

          <!-- Status -->
          <Column field="status" header="Status" headerClass="bg-opensimrs-50">
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
          v-show="selectMedicine === 'alkes'"
          v-else
          :value="DrugReturAlkesPayload"
          v-model:selection="selectedDataAlkes"
          :metaKeySelection="metaKeyAlkes"
          @rowClick="onRowSelectAlkes"
          class="mt-2"
          scrollable
          scrollHeight="flex"
          :pt="{ headerRow: 'text-SM' }"
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
                <p>{{ slotProps.data.noOrderAlkes }}</p>
                <p class="mt-[3px]">
                  {{ epochToDate(slotProps.data.createdAt, "dateTime") }}
                </p>
              </div>
            </template>
          </Column>
          <!-- Pasien -->
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <p class="font-semibold">{{ slotProps.data.patient?.name }}</p>
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
              <div class="text-SM">{{ slotProps.data.jenisPelayanan }}</div>
              <div class="flex flex-wrap mt-[3px]">
                <CustomChip
                  :label="slotProps.data.lokasiStok?.name || '-'"
                  :showCheckedIcon="false"
                  borderColor="border-opensimrs-300"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-6 mr-[5px]"
                />
                <CustomChip
                  label="Alkes"
                  :showCheckedIcon="false"
                  borderColor="border-opensimrs-300"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-6 mr-[5px]"
                />
                <CustomChip
                  v-if="slotProps.data.paymentMethod == 1"
                  :showCheckedIcon="false"
                  label="TUNAI"
                  bgColor="bg-opensimrs-50"
                  textColor="text-opensimrs-300"
                  borderColor="border-opensimrs-300"
                  customClass="h-6 pr-[6px]"
                />
                <CustomChip
                  v-if="slotProps.data.paymentMethod == 2"
                  :showCheckedIcon="false"
                  label="BPJS"
                  bgColor="bg-warning-50"
                  textColor="text-warning-300"
                  borderColor="border-warning-300"
                  customClass="h-6 pr-[6px] ml-[5px]"
                />
              </div>
            </template>
          </Column>
          <!-- Status -->
          <Column field="status" header="Status" headerClass="bg-opensimrs-50">
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
          v-model:isDialogVisible="dialogDetailObat"
          :payloadObat="selectedDataObat"
          :selectMedicine="selectMedicine"
          @update:isDialogVisible="fetchDrugRetur"
          ref="refDialogDetailObat"
        />
        <DialogDetailAlkes
          v-model:isDialogVisible="dialogDetailAlkes"
          :payloadAlkes="selectedDataAlkes"
          :selectMedicine="selectMedicine"
          @update:isDialogVisible="fetchDrugRetur"
          ref="refDialogDetailAlkes"
        />
      </template>

      <template #footer>
        <div class="flex justify-end">
          <CustomPaginator
            :rows="DrugReturObatProperties.page_size"
            :totalRecords="DrugReturObatProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
