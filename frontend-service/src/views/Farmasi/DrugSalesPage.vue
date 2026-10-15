<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useDrugSalesStore } from "@/stores/farmasi/DrugSales";
import { utilsStore } from "@/stores/utils";
import {
  epochToDate,
  dateToEpoch,
  formatPrice,
  setTimeForDate,
} from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import type { MenuItem } from "primevue/menuitem";
import NoData from "@/components/section/NoData.vue";
import DetailDrugSalesPage from "./Layout/DetailDrugSalesPage.vue";
import DetailDrugSalesPage2 from "./Layout/DetailDrugSalesPage2.vue";

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const pageType = ref("");

const filterFarmasi = ref([
  { label: "Semua", value: "4" },
  { label: "IGD", value: "2" },
  { label: "Rawat Rajan", value: "1" },
  { label: "Rawat Inap", value: "0" },
]);

// Filter Menunggu Pembayaran
const selectedPayType = ref<string>("belum_lunas");

const onSelectPayType = (label: string) => {
  selectedPayType.value = label;
  fetchDrugSales();
};

// Filter Farmasi
const selectedFilterFarmasi = ref<string[]>([]);
const onPoliSelect = (label: string) => {
  if (selectedFilterFarmasi.value.includes(label)) {
    selectedFilterFarmasi.value = selectedFilterFarmasi.value.filter(
      (item) => item != label
    );
  } else {
    selectedFilterFarmasi.value.push(label);
  }
  fetchDrugSales();
};

const dataBreadCrumb = ref<MenuItem[]>([]);

const changeSection = (label: string) => {
  if (dataBreadCrumb.value.length) {
    dataBreadCrumb.value[0] = { label: label };
  } else {
    dataBreadCrumb.value.push({ label: label });
  }
};

// Filter Search Data
const searchData = () => {
  searchQuery.value;
  dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0));
  dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59));
  fetchDrugSales();
};

// Filter Reset Data
const resetData = () => {
  searchQuery.value = "";
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  fetchDrugSales();
};

// State Management
const DrugSalesStore = useDrugSalesStore();
const UseUtilsStore = utilsStore();
const DrugSalesPayload = ref<any[]>([]);
const DrugSalesProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const searchQuery = ref<string>("");

// Check if Data Exists
const hasData = computed(
  () => DrugSalesPayload.value && DrugSalesPayload.value.length > 0
);

// Fetch Drug Sales
const fetchDrugSales = async () => {
  UseUtilsStore.setLoading(true);
  const selectedTest = [...selectedFilterFarmasi.value];
  try {
    const response = await DrugSalesStore.getApi(
      selectedPayType.value,
      dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0)),
      dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59)),
      selectedTest.join(""),
      searchQuery.value,
      DrugSalesProperties.value.page,
      DrugSalesProperties.value.page_size
    );

    if (response && response.payload) {
      DrugSalesProperties.value.total = response.properties.total;
      DrugSalesPayload.value = response.payload;
    } else {
      DrugSalesPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    DrugSalesPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Handle Pagination
const handlePage = (event: any) => {
  DrugSalesProperties.value.page = event.page + 1;
  DrugSalesProperties.value.page_size = event.rows;
  fetchDrugSales();
};

// Detail Management
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  changeSection("Detail Obat");
};

const closeDrugsalesPage = () => {
  dataBreadCrumb.value.pop();
  fetchDrugSales();
};

onMounted(() => {
  fetchDrugSales();
});
</script>

<template>
  <div class="flex overflow-hidden flex-col h-full">
    <Card
      v-if="dataBreadCrumb.length == 0"
      pt:body:class="overflow-auto pt-0 h-full"
      pt:content:class="overflow-hidden h-full"
      class="overflow-hidden h-full"
    >
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchDrugSales" />
          <CustomBreadCrumb :home="{ label: 'Penjualan Obat', home: true }" />
          <CustomTextfield
            v-model="searchQuery"
            label="Pencarian"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Transaksi / Nama Pembeli"
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
          <ToolbarFilterMenu :count="selectedFilterFarmasi.length">
            <template #label>Farmasi</template>
            <CustomChip
              v-for="(Pelayanan, index) in filterFarmasi"
              :key="index"
              :label="Pelayanan.label"
              :value="Pelayanan.value"
              :isSelected="selectedFilterFarmasi.includes(Pelayanan.value)"
              @selected="onPoliSelect"
            />
          </ToolbarFilterMenu>
          <!-- Filter Bayar -->
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Status bayar">
            <CustomButton
              @click="onSelectPayType('belum_lunas')"
              label="Belum Bayar"
              :outlined="selectedPayType != 'belum_lunas'"
              borderColor="border-opensimrs-300"
              :textColor="
                selectedPayType != 'belum_lunas' ? 'text-opensimrs-300' : 'text-white'
              "
              :backgroundColor="
                selectedPayType != 'belum_lunas' ? 'bg-transparent' : 'bg-opensimrs-300'
              "
              class="font-semibold"
            />
            <CustomButton
              @click="onSelectPayType('lunas')"
              label="Lunas"
              :outlined="selectedPayType != 'lunas'"
              borderColor="border-opensimrs-300"
              :textColor="
                selectedPayType != 'lunas' ? 'text-opensimrs-300' : 'text-white'
              "
              :backgroundColor="
                selectedPayType != 'lunas' ? 'bg-transparent' : 'bg-opensimrs-300'
              "
              class="font-semibold"
            />
            <CustomButton
              @click="onSelectPayType('cancel')"
              label="Dibatalkan"
              :outlined="selectedPayType != 'cancel'"
              borderColor="border-opensimrs-300"
              :textColor="
                selectedPayType != 'cancel' ? 'text-opensimrs-300' : 'text-white'
              "
              :backgroundColor="
                selectedPayType != 'cancel' ? 'bg-transparent' : 'bg-opensimrs-300'
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
          <CustomButton
            @click="changeSection('Beli Obat')"
            icon="PhPlus"
            label="Beli"
          />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable
          :value="DrugSalesPayload"
          v-model:selection="selectedData"
          :metaKeySelection="metaKey"
          @rowClick="onRowSelect"
          stripedRows
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
          <!-- Penjualan -->
          <Column header="Penjualan" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <p>{{ slotProps.data.noTransaksi }}</p>
                <p>
                  {{ epochToDate(slotProps.data.tanggalPembelian, "dateTime") }}
                </p>
              </div>
            </template>
          </Column>
          <!-- Pembeli -->
          <Column header="Pembeli" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <p class="font-semibold">{{ slotProps.data.namaPembeli }}</p>
              </div>
              <div class="flex flex-wrap">
                <CustomChip
                  :label="slotProps.data.lokasiStok.name"
                  :showCheckedIcon="false"
                  borderColor="border-opensimrs-300"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-6"
                />
              </div>
            </template>
          </Column>
          <!-- Nama Petugas -->
          <Column header="Nama Petugas" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.dokterPemberiResep }}</div>
            </template>
          </Column>
          <!-- Harga -->
          <Column header="Harga" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                {{ formatPrice(slotProps.data.totalHarga) }}
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomPaginator
            :rows="DrugSalesProperties.page_size"
            :totalRecords="DrugSalesProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
    <DetailDrugSalesPage
      v-else-if="dataBreadCrumb[0].label == 'Beli Obat'"
      :dataBreadCrumb="dataBreadCrumb"
      :pageType="pageType"
      @back="closeDrugsalesPage"
    />
    <DetailDrugSalesPage2
      v-else-if="dataBreadCrumb[0].label == 'Detail Obat'"
      :dataBreadCrumb="dataBreadCrumb"
      :selectedData="selectedData"
      :pageType="pageType"
      @back="closeDrugsalesPage"
    />
  </div>
</template>
