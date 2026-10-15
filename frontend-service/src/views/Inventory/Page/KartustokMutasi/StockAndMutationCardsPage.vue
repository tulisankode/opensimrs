<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { PhMinus, PhArrowCircleDown, PhArrowCircleUp, PhArrowRight } from "@phosphor-icons/vue";
import { useStockAndMutationStore } from "@/stores/inventory/stockAndMutation";
import { useStockTypeStore } from "@/stores/datamasterFarmasi/StockType";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import { useDrugCategoryStore } from "@/stores/datamasterFarmasi/DrugCategory";
import { utilsStore } from "@/stores/utils";
import { epochToDate, dateToEpoch } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { exportKartuStok } from "@/utils/exportExcelInventory";


function formatDate(date: any) {
  const parsedDate = new Date(date);
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${day}-${month}-${year}`;
}

// State Management Kategori Item
const kategoriItem = ref<string>("");
const optionKategori = ref([
  { name: "Medis", value: "medis" },
  { name: "Non-Medis", value: "non-medis" },
]);

// State Management Jenis Item
const jenisItem = ref<string>("");
const kategoriObat = ref<string>("");
const optionJenis = ref([
  { name: "Obat", value: "obat" },
  { name: "Alkes", value: "alkes" },
]);

const value = ref("1");
const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());

// State Management Drug Category
const DrugCategoryStore = useDrugCategoryStore();
const DrugCategoryPayload = ref<any[]>([]);

// Fetch Drug Category
const fetchDrugCategory = async () => {
  try {
    const response = await DrugCategoryStore.getApi(1, 1000);

    if (response && response.payload) {
      DrugCategoryPayload.value = response.payload;
    } else {
      DrugCategoryPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    DrugCategoryPayload.value = [];
  }
};

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
const selectedLokasi = ref<string>("");
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
  // Kartu stok & riwayat mutasi wajib per lokasi (API menolak lokasi kosong) → pilih lokasi pertama
  if (!selectedLokasi.value && StockLocationPayload.value.length) {
    selectedLokasi.value = StockLocationPayload.value[0].uuid;
  }
};

const defaultLokasi = () => StockLocationPayload.value[0]?.uuid ?? "";

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

// State Management Stok
const searchStok = ref<string>("");
const StockAndMutationStore = useStockAndMutationStore();
const UseUtilsStore = utilsStore();
const StockPayload = ref<any[]>([]);
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
const fetchStock = async () => {
  if (!selectedLokasi.value) {
    StockPayload.value = [];
    StockProperties.value.total = 0;
    return;
  }
  UseUtilsStore.setLoading(true);
  try {
    const response = await StockAndMutationStore.getApiStok(
      selectedLokasi.value || "",
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

const handleExportKartuStok = async () => {
  // 0. Validasi total data
  if (StockProperties.value.total === 0) {
    alert("Tidak ada data untuk diekspor.");
    return;
  }

  // 1. Ambil data faskes_profile dari localStorage (Pola dari referensi Anda)
  const faskesProfileString = localStorage.getItem("faskes_profile");
  if (!faskesProfileString) {
    console.error("Data profil faskes tidak ditemukan di localStorage.");
    alert("Gagal memuat profil klinik untuk header.");
    return;
  }

  let clinicProfile: any;
  try {
    // 2. Parse data JSON
    clinicProfile = JSON.parse(faskesProfileString);
  } catch (e) {
    console.error("Gagal parse data profil faskes:", e);
    alert("Gagal memuat profil klinik (data korup).");
    return;
  }

  // 3. Lanjutkan proses fetching data (Pola Anda sebelumnya)
  try {
    UseUtilsStore.setLoading(true);

    const response = await StockAndMutationStore.getApiStok(
      selectedLokasi.value || "",
      jenisStokUuid.value || "",
      kategoriItem.value || "",
      jenisItem.value || "",
      searchStok.value || "",
      1, // page
      StockProperties.value.total // limit: Ambil semua data
    );

    const rowsToExport = response?.payload;

    if (!rowsToExport || !Array.isArray(rowsToExport) || rowsToExport.length === 0) {
      alert("Gagal memuat semua data untuk diekspor.");
      return;
    }

    const fileName = `Kartu Stok - ${new Date().toISOString().slice(0, 10)}`;

    // 4. Panggil fungsi export dengan argumen clinicProfile
    exportKartuStok(rowsToExport, clinicProfile, fileName); 

  } catch (error) {
    console.error("Gagal mempersiapkan data untuk ekspor:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

let searchTimeoutStok: ReturnType<typeof setTimeout> | null = null;
watch(searchStok, (newValue) => {
  if (searchTimeoutStok) clearTimeout(searchTimeoutStok);
  searchTimeoutStok = setTimeout(() => {
    fetchStock();
  }, 500);
});

// Handle Pagination
const handleStok = (event: any) => {
  StockProperties.value.page = event.page + 1;
  StockProperties.value.page_size = event.rows;
  fetchStock();
};

// Filter Reset Stok
const resetStok = () => {
  selectedLokasi.value = defaultLokasi();
  jenisStokUuid.value = "";
  kategoriItem.value = "";
  jenisItem.value = "";
  searchStok.value = "";
  kategoriObat.value = "";
  fetchStock();
};

// ------------------------------------------------------------------------------------------

// State Management Mutasi
const searchMutasi = ref<string>("");
const MutasiPayload = ref<any[]>([]);
const MutasiProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasDataMutasi = computed(
  () => MutasiPayload.value && MutasiPayload.value.length > 0
);

// Fetch Mutasi
const fetchMutasi = async () => {
  if (!selectedLokasi.value) {
    MutasiPayload.value = [];
    MutasiProperties.value.total = 0;
    return;
  }
  UseUtilsStore.setLoading(true);
  try {
    const response = await StockAndMutationStore.getApiMutasi(
      selectedLokasi.value || "",
      jenisStokUuid.value || "",
      kategoriItem.value || "",
      jenisItem.value || "",
      searchMutasi.value || "",
      dateToEpoch(startDateFilter.value),
      dateToEpoch(endDateFilter.value),
      MutasiProperties.value.page,
      MutasiProperties.value.page_size
    );

    if (response && response.payload) {
      MutasiProperties.value.total = response.properties.total;
      MutasiPayload.value = response.payload;
    } else {
      MutasiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    MutasiPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};


let searchTimeoutMutasi: ReturnType<typeof setTimeout> | null = null;
watch(searchMutasi, (newValue) => {
  if (searchTimeoutMutasi) clearTimeout(searchTimeoutMutasi);
  searchTimeoutMutasi = setTimeout(() => {
    fetchMutasi();
  }, 500);
});

// Handle Pagination
const handleMutasi = (event: any) => {
  MutasiProperties.value.page = event.page + 1;
  MutasiProperties.value.page_size = event.rows;
  fetchMutasi();
};

// Filter Reset Stok
const resetMutasi = () => {
  selectedLokasi.value = defaultLokasi();
  jenisStokUuid.value = "";
  kategoriItem.value = "";
  jenisItem.value = "";
  searchMutasi.value = "";
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  fetchMutasi();
};

// ------------------------------------------------------------------------------------------

onMounted(async () => {
  fetchDrugCategory();
  fetchStockType();
  await fetchStockLocation(); // lokasi default dibutuhkan sebelum memuat stok & mutasi
  fetchStock();
  fetchMutasi();
});
</script>

<template>
  <div>
    <Card v-if="dataBreadCrumb.length == 0" pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchStock" />
          <CustomBreadCrumb :home="{ label: 'Kartu Stok & Mutasi', home: true }" />
          <!-- Filter Kartu Stok (v-show + .toolbar-layout = display: contents) -->
          <div v-show="value === '1'" class="toolbar-layout">
            <CustomTextfield label="Pencarian (Nama Item / Kode Item)" v-model="searchStok"
              prependIcon="PhMagnifyingGlass" placeholder="Cari Nama Item / Kode Item"
              @keydown.enter="fetchStock" />
            <CustomSelect label="Kategori" placeHolder="Pilih Kategori" v-model="kategoriItem"
              :options="optionKategori" optionLabel="name" optionValue="value" />
            <CustomSelect label="Jenis Stok" placeHolder="Pilih Jenis Stok" v-model="jenisStokUuid"
              :options="StockTypePayload" optionLabel="name" optionValue="uuid" />
            <CustomSelect label="Jenis Item" placeHolder="Pilih Jenis Item" v-model="jenisItem"
              :options="optionJenis" optionLabel="name" optionValue="value" />
            <CustomSelect label="Lokasi Stok" placeHolder="Pilih Lokasi" v-model="selectedLokasi"
              :options="StockLocationPayload" optionLabel="name" optionValue="uuid" />
            <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="fetchStock" />
            <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300"
              @click="resetStok" />
          </div>
          <!-- Filter Mutasi -->
          <div v-show="value === '2'" class="toolbar-layout">
            <CustomTextfield label="Pencarian (Nama Item / Kode Item)" v-model="searchMutasi"
              prependIcon="PhMagnifyingGlass" placeholder="Cari Nama Item / Kode Item"
              @keydown.enter="fetchMutasi" />
            <CustomSelect label="Kategori" placeHolder="Pilih Kategori" v-model="kategoriItem"
              :options="optionKategori" optionLabel="name" optionValue="value" />
            <CustomSelect label="Jenis Stok" placeHolder="Pilih Jenis Stok" v-model="jenisStokUuid"
              :options="StockTypePayload" optionLabel="name" optionValue="uuid" />
            <CustomSelect label="Jenis Item" placeHolder="Pilih Jenis Item" v-model="jenisItem"
              :options="optionJenis" optionLabel="name" optionValue="value" />
            <CustomSelect label="Lokasi Stok" placeHolder="Pilih Lokasi" v-model="selectedLokasi"
              :options="StockLocationPayload" optionLabel="name" optionValue="uuid" />
            <CustomDatePicker v-model="startDateFilter" label="Tanggal mulai" class="toolbar-field--date" />
            <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
            <CustomDatePicker v-model="endDateFilter" label="Tanggal selesai" class="toolbar-field--date" />
            <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="fetchMutasi" />
            <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300"
              @click="resetMutasi" />
          </div>
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Jenis tampilan">
          <CustomButton label="Kartu Stok" :text-color="value === '1' ? 'text-white' : 'text-opensimrs-300'"
            :border-color="value === '1' ? 'border-none' : 'border-opensimrs-300'"
            :class="value === '1' ? 'bg-opensimrs-300' : 'bg-white'" @click="value = '1'"
            :outlined="value !== '1'" />
          <CustomButton label="Mutasi" :text-color="value === '2' ? 'text-white' : 'text-opensimrs-300'"
            :border-color="value === '2' ? 'border-none' : 'border-opensimrs-300'"
            :class="value === '2' ? 'bg-opensimrs-300' : 'bg-white'" @click="value = '2'"
            :outlined="value !== '2'" />
          </div>
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col h-full overflow-hidden">
          <!-- Datatable Kartu Stok -->
          <div v-show="value === '1'" class="flex flex-col h-full overflow-auto">
            <NoData v-if="!hasDataStok" />
            <DataTable v-else :value="StockPayload" tableStyle="min-width: 50rem" stripedRows class="text-xs" scrollable
              scrollHeight="flex">
              <Column headerClass="bg-opensimrs-50" class="w-[50px]">
                <template #header>
                  <div class="font-semibold">No</div>
                </template>
                <template #body="slotProps">
                  <div>
                    <div class="text-center text-SM">
                      {{ slotProps.index + 1 }}
                    </div>
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
                <template #header>
                  <div class="">Nama Item</div>
                </template>
                <template #body="slotProps">
                  <div class="mb-[5px]">{{ slotProps.data.nama }}</div>
                  <div class="flex flex-wrap">
                    <CustomChip :label="slotProps.data.kategori.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase()"
                      :showCheckedIcon="false" borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300"
                      textColor="text-white" />
                    <CustomChip :label="slotProps.data.jenisItem.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase()"
                      :showCheckedIcon="false" borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300"
                      textColor="text-white" class="ml-[5px]" />
                    <CustomChip :label="slotProps.data.jenisStok.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase()"
                      :showCheckedIcon="false" borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300"
                      textColor="text-white" class="ml-[5px]" />
                    <CustomChip :label="slotProps.data.kategoriObat.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase()"
                      :showCheckedIcon="false" borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300"
                      textColor="text-white" class="ml-[5px]" />
                  </div>
                </template>
              </Column>
              <Column field="lokasiStok" header="Lokasi" headerClass="bg-opensimrs-50 font-semibold text-SM"></Column>
              <Column field="sisaStok" header="Sisa Stok" headerClass="bg-opensimrs-50 font-semibold text-SM"></Column>
              <Column field="satuanObat" header="Satuan" headerClass="bg-opensimrs-50 font-semibold text-SM"></Column>
            </DataTable>
          </div>

          <!-- Datatable Mutasi -->
          <div v-show="value === '2'" class="flex flex-col h-full overflow-auto">
            <NoData v-if="!hasDataMutasi" />
            <DataTable v-else :value="MutasiPayload" tableStyle="min-width: 50rem" stripedRows class="text-xs"
              scrollable scrollHeight="flex">

              <Column header="Transaksi" headerClass="bg-opensimrs-50 font-semibold text-SM" class="w-[200px]">
                <template #body="slotProps">
                  <div class="mb-1 text-xs">{{ slotProps.data.kodeTransaksi }}</div>
                  <CustomChip :label="slotProps.data.sumberMutasi" :showCheckedIcon="false"
                    borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white"
                    customClass="h-5 mb-1" />
                  <p class="text-xs">{{ epochToDate(slotProps.data.tanggalMutasi, "date") }}</p>
                </template>
              </Column>

              <Column header="Item" headerClass="bg-opensimrs-50 font-semibold text-SM" class="w-[250px]">
                <template #body="slotProps">
                  <div class="mb-1 font-bold">{{ slotProps.data.namaItem }}</div>
                  <div class="mb-2 text-xs">{{ slotProps.data.kodeItem }}</div>
                  <div class="flex flex-wrap gap-1">
                    <CustomChip :label="slotProps.data.kategoriItem" :showCheckedIcon="false"
                      borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white"
                      customClass="h-5" />
                    <CustomChip :label="slotProps.data.jenisStok?.toUpperCase()" :showCheckedIcon="false"
                      borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white"
                      customClass="h-5" />
                    <CustomChip :label="slotProps.data.jenisItem?.toUpperCase()" :showCheckedIcon="false"
                      borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white"
                      customClass="h-5" />
                  </div>
                </template>
              </Column>

              <Column header="Exp. Date" headerClass="bg-opensimrs-50 font-semibold text-SM w-[120px]" class="w-[120px]">
                <template #body="slotProps">
                  <div class="text-center">{{ formatDate(slotProps.data.expDate) }}</div>
                </template>
              </Column>

              <Column header="Keterangan" headerClass="bg-opensimrs-50 font-semibold text-SM">
                <template #body="slotProps">
                  <div>{{ slotProps.data.keterangan }}</div>
                  <div v-if="slotProps.data.lokasiStokAwal && slotProps.data.lokasiStokTujuan"
                    class="flex items-center text-xs text-opensimrs-300 mt-1">
                    <CustomChip :label="slotProps.data.lokasiStokAwal?.name || '??'" :showCheckedIcon="false"
                      bgColor="bg-grey-100" textColor="text-grey-400" customClass="h-5" />
                    <PhArrowRight :size="12" weight="bold" class="mx-1" />
                    <CustomChip :label="slotProps.data.lokasiStokTujuan?.name || '??'" :showCheckedIcon="false"
                      bgColor="bg-grey-100" textColor="text-grey-400" customClass="h-5" />
                  </div>
                </template>
              </Column>

              <Column field="petugas" header="Petugas" headerClass="bg-opensimrs-50 font-semibold text-SM"></Column>

              <Column field="stokAwal" header="Stok Awal" headerClass="bg-opensimrs-50 font-semibold text-SM w-[100px]"
                class="w-[100px] text-center"></Column>

              <Column header="Mutasi Stok" headerClass="bg-opensimrs-50 font-semibold text-SM w-[100px]"
                class="w-[100px]">
                <template #body="slotProps">
                  <div class="flex items-center justify-center gap-1">
                    <div v-if="slotProps.data.stokMasuk > 0" class="text-center text-SM">
                      {{ slotProps.data.stokMasuk }}
                    </div>
                    <div v-if="slotProps.data.stokKeluar > 0" class="text-center text-SM">
                      {{ slotProps.data.stokKeluar }}
                    </div>

                    <PhArrowCircleDown v-if="slotProps.data.stokKeluar > 0" :size="18" color="#E9594C" weight="fill" />
                    <PhArrowCircleUp v-else-if="slotProps.data.stokMasuk > 0" :size="18" color="#3AC279"
                      weight="fill" />
                  </div>
                </template>
              </Column>

              <Column field="sisaStok" header="Sisa Stok" headerClass="bg-opensimrs-50 font-semibold text-SM w-[100px]"
                class="w-[100px] text-center"></Column>

            </DataTable>
          </div>
        </div>
      </template>
      <template #footer>
        <div v-if="value === '1'" class="flex justify-between items-center p-2 border-t border-grey-200 bg-white">
          <CustomButton label="Cetak" class="bg-opensimrs-300" icon="PhPrinter" @click="handleExportKartuStok" />

          <CustomPaginator :rows="StockProperties.page_size" :totalRecords="StockProperties.total"
            :rowsPerPageOptions="[10, 20, 30]" @page="handleStok" />
        </div>

        <div v-else class="flex justify-end items-center p-2 border-t border-grey-200 bg-white">
          <CustomPaginator :rows="MutasiProperties.page_size" :totalRecords="MutasiProperties.total"
            :rowsPerPageOptions="[10, 20, 30]" @page="handleMutasi" />
        </div>
      </template>
    </Card>
  </div>
</template>
