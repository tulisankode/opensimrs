<script setup lang="ts">
import { onBeforeRouteLeave, useRoute } from "vue-router";
import { ref, onMounted, computed, watch } from "vue";
import type { MenuItem } from "primevue/menuitem";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import { PhMinus } from "@phosphor-icons/vue";
import { useExpiredDrugReportStore } from "@/stores/inventory/expiredDrugReport";
import { utilsStore } from "@/stores/utils";
import { epochToDate, formatPrice, formatDate } from "@/utils/Helpers";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import { exportReportDrugToExcel } from "@/utils/exportExcelInventory";

const route = useRoute();
const props = defineProps({
  lokasiStokUuid: {
    type: String,
    default: "",
  },
});

// State Management
const ExpiredDrugReportStore = useExpiredDrugReportStore();
const UseUtilsStore = utilsStore();

// State Halaman
const dataBreadCrumb = ref<MenuItem[]>([
  { label: 'Barang Expired' }
]);

// State Data
const obatExpiredData = ref<any[]>([]);
const properties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const expandedRows = ref<any[]>([]);

// State Filters
const searchQuery = ref("");
const selectedLokasi = ref<string>("");
const StockLocationPayload = ref<any[]>([]);
const StockLocationStore = useStockLocationStore();


// Inisialisasi Tanggal Default & maxDate
const today = new Date();
const oneMonthAgo = new Date(today);
oneMonthAgo.setMonth(today.getMonth() - 1);

const tanggalMulai = ref<Date>(oneMonthAgo);
const tanggalSelesai = ref<Date>(today);
const maxDate = ref(today);


// Logika Breadcrumb
const updatePageType = (path: string) => {
  dataBreadCrumb.value = [{ label: 'Barang Expired' }];
};

onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});

// Computed
const hasData = computed(() => obatExpiredData.value.length > 0);
const lokasiOptions = computed(() => {
  return StockLocationPayload.value.map((loc) => ({
    name: loc.name,
    value: loc.uuid,
  }));
});

// Fungsi Fetch Data Utama
const fetchData = async () => {
  if (!props.lokasiStokUuid) return;
  UseUtilsStore.setLoading(true);
  try {
    const tglMulaiStr = tanggalMulai.value ? formatDate(tanggalMulai.value) : "";
    const tglSelesaiStr = tanggalSelesai.value ? formatDate(tanggalSelesai.value) : "";

    const response = await ExpiredDrugReportStore.getApi(
      props.lokasiStokUuid,
      tglMulaiStr,
      tglSelesaiStr,
      searchQuery.value || "",
      properties.value.page,
      properties.value.page_size
    );

    if (response && response.payload && Array.isArray(response.payload)) {
      obatExpiredData.value = response.payload.map((item: any) => ({
        id: item.uuid,
        lokasi: item.lokasi,
        kodeItem: item.kodeItem,
        namaItem: item.namaItem,
        jenisStok: item.jenisStok,
        stokAkhir: item.stokAkhir,
        noFaktur: item.noFaktur,
        tglExpired: formatDate(new Date(item.tglExpired)), // Pastikan ini juga diformat
        subMenu: [
          {
            jenisItem: item.jenisItem,
            satuan: item.satuan,
            supplier: item.supplier,
            tglPenerimaan: epochToDate(item.tglPenerimaan, "date"),
            noPembelian: item.noPembelian,
            hargaSatuan: formatPrice(item.hargaSatuan),
            totalHarga: formatPrice(item.totalHarga),
          },
        ],
      }));
      if (response.properties) {
        properties.value.total = response.properties.total;
        // properties.value.page = response.properties.page; // Opsional
      } else {
        properties.value.total = 0;
      }
    } else {
      obatExpiredData.value = [];
      properties.value.total = 0;
    }
  } catch (error) {
    console.error("Gagal mengambil data obat expired:", error);
    obatExpiredData.value = [];
    properties.value.total = 0;
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

//  Fungsi Handle Export 
const handleExportExcel = async () => {
  // 1. Ambil data faskes_profile dari localStorage
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

    // Asumsi: Anda mengambil filter dari state
    const tglMulaiStr = tanggalMulai.value ? formatDate(tanggalMulai.value) : "";
    const tglSelesaiStr = tanggalSelesai.value ? formatDate(tanggalSelesai.value) : "";

    const response = await ExpiredDrugReportStore.getApi(
      selectedLokasi.value || "",     // Parameter 1: Lokasi
      tglMulaiStr,                    // Parameter 2: Tgl Mulai
      tglSelesaiStr,                  // Parameter 3: Tgl Selesai
      searchQuery.value || "",        // Parameter 4: Search
      1, // Halaman 1
      properties.value.total || 9999 // Ambil semua data
    );

    const rowsToExport = response.payload;

    if (!rowsToExport || !Array.isArray(rowsToExport) || rowsToExport.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }
    const startDate = formatDate(tanggalMulai.value); // Pastikan format dd-mm-yyyy
    const endDate = formatDate(tanggalSelesai.value);
    const periodeStr = `${startDate} - ${endDate}`;

    const fileName = `Laporan Obat Expired - ${new Date().toISOString().slice(0, 10)}`;

    // 4. Panggil fungsi export dengan argumen clinicProfile
    exportReportDrugToExcel(rowsToExport, clinicProfile, periodeStr, fileName); // <-- Tanda tangan fungsi diubah

  } catch (error) {
    console.error("Gagal mempersiapkan data untuk ekspor:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// event watcher 
watch(() => props.lokasiStokUuid, (newValue) => {
  if (newValue) {
    // Jika ingin sync variable lokal (opsional, jika ada dropdown di dalam page)
    selectedLokasi.value = newValue;

    properties.value.page = 1;
    fetchData();
  }
}, { immediate: true });

// Event Handlers
const handleSearch = () => {
  properties.value.page = 1;
  fetchData();
};

const handleReset = () => {
  searchQuery.value = "";
  selectedLokasi.value = "";

  // eset tanggal ke default
  const todayReset = new Date();
  const oneMonthAgoReset = new Date(todayReset);
  oneMonthAgoReset.setMonth(todayReset.getMonth() - 1);

  tanggalMulai.value = oneMonthAgoReset;
  tanggalSelesai.value = todayReset;

  properties.value.page = 1;
  fetchData();
};

const handlePage = (event: any) => {
  properties.value.page = event.page + 1;
  properties.value.page_size = event.rows;
  fetchData();
};

onMounted(() => {
  updatePageType(route.path);
  if (props.lokasiStokUuid) {
    fetchData();
  }
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden"
      class="h-full overflow-hidden">

      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchData" />
          <CustomBreadCrumb :home="{ label: 'Laporan', home: true }" :model="dataBreadCrumb" />
          <CustomTextfield v-model="searchQuery" label="Pencarian" placeholder="Cari Nama Item"
            prepend-icon="PhMagnifyingGlass" @keyup.enter="handleSearch" />
          <CustomDatePicker v-model="tanggalMulai" label="Tanggal mulai" class="toolbar-field--date"
            :maxDate="tanggalSelesai" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tanggalSelesai" label="Tanggal selesai" class="toolbar-field--date"
            :maxDate="maxDate" :minDate="tanggalMulai" />
          <CustomButton label="Cari" icon="PhMagnifyingGlass" @click="handleSearch" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300"
            @click="handleReset" />
        </PageToolbar>
      </template>

      <template #content>
        <div class="h-full overflow-auto">
          <DataTable v-if="hasData" :value="obatExpiredData" responsiveLayout="scroll" dataKey="id"
            v-model:expandedRows="expandedRows" scrollable scrollHeight="flex" class="p-datatable-sm text-xs">

            <Column expander style="width: 2em" header-class="text-black bg-opensimrs-50" />

            <Column header="No" header-class="text-black bg-opensimrs-50" class="w-10 p-5 text-center text-black text-SM">
              <template #body="slotProps">
                {{ slotProps.index + 1 }}
              </template>
            </Column>

            <Column field="lokasi" header="Lokasi" header-class="text-black bg-opensimrs-50" class="text-black text-SM"
              style="width: 150px" />

            <Column field="kodeItem" header="Kode Item" header-class="text-black bg-opensimrs-50"
              class="text-black text-SM" />

            <Column field="namaItem" header="Nama Item" header-class="text-black bg-opensimrs-50"
              class="text-black text-SM" />

            <Column field="jenisStok" header="Jenis Stok" header-class="text-black bg-opensimrs-50"
              class="text-black text-SM" />

            <Column field="stokAkhir" header="Stok Akhir" header-class="text-center text-black bg-opensimrs-50"
              class="w-[80px] text-center text-black text-SM" />

            <Column field="noFaktur" header="No Faktur" header-class="text-center text-black bg-opensimrs-50"
              class="w-[80px] text-center text-black text-SM" />

            <Column field="tglExpired" header="Tgl. Expired" header-class="text-center text-black bg-opensimrs-50"
              class="w-[100px] text-center text-black text-SM" />

            <template #expansion="slotProps">
              <div class="p-3 -mx-2 -my-1.5 bg-opensimrs-50">
                <DataTable :value="slotProps.data.subMenu" class="overflow-hidden rounded-lg bg-opensimrs-50">
                  <Column field="jenisItem" header="Jenis Item" header-class="text-white bg-opensimrs-300"
                    class="p-5 text-black text-SM" />
                  <Column field="satuan" header="Satuan" header-class="text-white bg-opensimrs-300"
                    class="text-black text-SM" />
                  <Column field="supplier" header="Supplier" header-class="text-white bg-opensimrs-300"
                    class="text-black text-SM" />
                  <Column field="tglPenerimaan" header="Tgl. Penerimaan" header-class="text-white bg-opensimrs-300"
                    class="text-black text-SM" />
                  <Column field="noPembelian" header="No Pembelian" header-class="text-white bg-opensimrs-300"
                    class="text-black text-SM" />
                  <Column field="hargaSatuan" header="Harga Satuan" header-class="text-white bg-opensimrs-300"
                    class="text-black text-SM text-right" />
                  <Column field="totalHarga" header="Total Harga" header-class="text-white bg-opensimrs-300"
                    class="text-black text-SM text-right" />
                </DataTable>
              </div>
            </template>
          </DataTable>
          <NoData v-else />
        </div>
      </template>

      <template #footer>
        <div class="flex justify-between items-center p-2 border-t border-grey-200 bg-white">
          <CustomButton label="Cetak" class="bg-opensimrs-300" icon="PhPrinter" @click="handleExportExcel" />
          <div class="flex items-center gap-4">
            <CustomPaginator :rows="properties.page_size" :totalRecords="properties.total"
              :rowsPerPageOptions="[10, 20, 30]" @page="handlePage" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>