<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { useStokOpnameStore } from "@/stores/inventory/stokOpname";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
// import AddStokOpname from "./AddStokOpnamePage.vue";
import DetailStokOpname from "./Layout/StokOpname/DetailStokOpnamePage.vue";
import TambahStokOpname from "./Layout/StokOpname/TambahStokOpnamePage.vue";

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
const StokOpnameStore = useStokOpnameStore();
const UseUtilsStore = utilsStore();
const StokOpnamePayload = ref<any[]>([]);
const StokOpnameProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  // () => StokOpnamePayload.value && StokOpnamePayload.value.length > 0
  () => dummyData.length > 0
);

// Fetch Stok Opname
const fetchStokOpname = async () => {
  if (!props.lokasiStokUuid) {
    console.warn("Menunggu Lokasi Stok dipilih...");
    return;
  }
  UseUtilsStore.setLoading(true);
  try {
    const response = await StokOpnameStore.getApi(
      props.lokasiStokUuid,
      searchQuery.value,
      StokOpnameProperties.value.page,
      StokOpnameProperties.value.page_size
    );

    if (response && response.payload) {
      StokOpnameProperties.value.total = response.properties.total;
      StokOpnamePayload.value = response.payload;
    } else {
      StokOpnamePayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StokOpnamePayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

watch(
  () => props.lokasiStokUuid,
  () => {
    StokOpnameProperties.value.page = 1;
    fetchStokOpname();
  }
);

const handleSearch = () => {
  fetchStokOpname();
};

// Handle reset
const handleReset = () => {
  searchQuery.value = "";
  StokOpnameProperties.value.page = 1;
  fetchStokOpname();
};

// Handle Pagination
const handlePage = (event: any) => {
  StokOpnameProperties.value.page = event.page + 1;
  StokOpnameProperties.value.page_size = event.rows;
  fetchStokOpname();
};

// Selected Row
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  changeSection("Detail");
};

// Fungsi  Handle klik tombol "+ Stok Opname"
const handleAddStokOpname = () => {
  selectedData.value = null;
  changeSection("Tambah Stok Opname");
};

const closePurchaseOfSupplierPage = () => {
  dataBreadCrumb.value.pop();
  selectedData.value = null; // Reset saat kembali
  fetchStokOpname();
};

const closeEditPage = async () => {
  dataBreadCrumb.value.pop();
  dataBreadCrumb.value.pop();
  await fetchStokOpname();
};

onMounted(() => {
  if (props.lokasiStokUuid) {
    fetchStokOpname();
  }
});

// Dummy data matching the requested structure
const dummyData = [
  {
    uuid: "0192b31f-365d-731c-8b16-3a4565c9475e",
    tanggalCutOff: 1736438433,
    noStokOpname: "SO-2021-0001",
    kategoriItem: "medis",
    jenisItems: ["obat", "alkes"],
    jenisStoks: [
      {
        uuid: "0192b31f-365d-731c-8b16-3a4565c9475e",
        name: "bpjs",
      },
    ],
    judulStokOpname: "Stok Opname Pertama",
    petugasSo: "admin",
    petugasPengubah: "fikri",
    status: "draft",
  },
  {
    uuid: "0192b31f-365d-731c-8b16-3a4565c9475r",
    tanggalCutOff: 1736438433,
    noStokOpname: "SO-2021-0002",
    kategoriItem: "medis",
    jenisItems: ["obat", "alkes"],
    jenisStoks: [
      {
        uuid: "0192b31f-365d-731c-8b16-3a4565c9475e",
        name: "bpjs",
      },
    ],
    judulStokOpname: "Stok Opname Pertama",
    petugasSo: "admin",
    petugasPengubah: "fikri",
    status: "final",
  },
];
</script>

<template>
  <div>
    <Card
      v-if="dataBreadCrumb.length == 0"
      pt:body:class="overflow-auto pt-0 h-full"
      pt:content:class="overflow-hidden h-full"
      class="overflow-hidden h-full"
    >
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchStokOpname" />
          <CustomBreadCrumb :home="{ label: 'Stok Opname', home: true }" />
          <CustomTextfield
            v-model="searchQuery"
            label="Pencarian"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Stok Opname / Nama Judul Stok Opname"
            @keydown.enter="handleSearch"
          />
          <CustomButton
            label="Cari"
            icon="PhMagnifyingGlass"
            @click="handleSearch"
          />
          <CustomButton
            label="Reset"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            @click="handleReset"
          />
          <CustomButton
            @click="handleAddStokOpname"
            icon="PhPlus"
            label="Stok Opname"
          />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable
          v-else
          :value="dummyData"
          v-model:selection="selectedData"
          :metaKeySelection="metaKey"
          @rowClick="onRowSelect"
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
          <!-- Tgl. Cut Off -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">Tgl. Cut Off</div>
            </template>
            <template #body="slotProps">
              <div class="">
                {{ epochToDate(slotProps.data.tanggalCutOff, "date") }}
              </div>
            </template>
          </Column>
          <!-- No. Stok Opname -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">No. Stok Opname</div>
            </template>
            <template #body="slotProps">
              <div class="mb-[5px]">{{ slotProps.data.noStokOpname }}</div>
              <div class="flex flex-wrap">
                <CustomChip
                  v-if="slotProps.data.kategoriItem == 'medis'"
                  label="MEDIS"
                  :showCheckedIcon="false"
                  borderColor="border-opensimrs-300"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                />
                <CustomChip
                  v-if="slotProps.data.kategoriItem == 'non-medis'"
                  label="NON-MEDIS"
                  :showCheckedIcon="false"
                  borderColor="border-opensimrs-300"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  class="ml-[5px]"
                />
                <CustomChip
                  v-if="slotProps.data.jenisItems == 'obat'"
                  label="OBAT"
                  :showCheckedIcon="false"
                  borderColor="border-opensimrs-300"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  class="ml-[5px]"
                />
                <CustomChip
                  v-if="slotProps.data.jenisItems == 'alkes'"
                  label="ALKES"
                  :showCheckedIcon="false"
                  borderColor="border-opensimrs-300"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  class="ml-[5px]"
                />
              </div>
            </template>
          </Column>
          <!-- Judul Stok Opname -->
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">Judul Stok Opname</div>
            </template>
            <template #body="slotProps">
              <div class="font-bold">{{ slotProps.data.judulStokOpname }}</div>
            </template>
          </Column>
          <!-- Petugas -->
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold">Petugas</div>
            </template>
            <template #body="slotProps">
              <div class="font-semibold underline text-SM">
                Petugas Stok Opname
              </div>
              <div class="font-normal text-normal mb-[10px]">
                {{ slotProps.data.petugasSo }}
              </div>
              <div class="font-semibold underline text-SM">
                Petugas Yang Merubah
              </div>
              <div class="font-normal text-normal">
                {{ slotProps.data.petugasPengubah }}
              </div>
            </template>
          </Column>
          <!-- Status -->
          <Column field="status" headerClass="bg-opensimrs-50">
            <template #header="">
              <div class="w-full font-semibold text-center text-SM">Status</div>
            </template>
            <template #body="slotProps">
              <div class="flex justify-center items-center">
                <CustomChip
                  v-if="slotProps.data.status == 'draft'"
                  label="DRAFT"
                  :showCheckedIcon="false"
                  borderColor="border-warning-75"
                  bgColor="bg-warning-75"
                  textColor="text-warning-300"
                />
                <CustomChip
                  v-if="slotProps.data.status == 'final'"
                  label="SELESAI"
                  :showCheckedIcon="false"
                  borderColor="border-mint-75"
                  bgColor="bg-mint-75"
                  textColor="text-success-400"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomPaginator
            :rows="StokOpnameProperties.page_size"
            :totalRecords="StokOpnameProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
    <TambahStokOpname
      v-else-if="dataBreadCrumb[0].label == 'Tambah Stok Opname'"
      :dataBreadCrumb="dataBreadCrumb"
      :pageType="pageType"
      @back="closePurchaseOfSupplierPage"
      @backEdit="closeEditPage"
      :lokasi-stok-uuid="lokasiStokUuid"
      :selectedData="selectedData"
    />

    <DetailStokOpname
      v-else-if="dataBreadCrumb[0].label == 'Detail'"
      :pageType="pageType"
      :selectedData="selectedData"
      @back="closePurchaseOfSupplierPage"
    />
  </div>
</template>
