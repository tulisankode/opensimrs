<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";
import { ref, computed, watch } from "vue";
import { useSupplierReturnsStore } from "@/stores/inventory/supplierReturns";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  method: {
    type: String,
  },
  lokasiStokUuid: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:isDialogVisible", "faktur-selected"]);

function formatDate(date: any) {
  const parsedDate = new Date(date);
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  return `${day}-${month}-${year}`;
}

//State Management
const SupplierReturnsStore = useSupplierReturnsStore();
const StockLocationStore = useStockLocationStore();
const UseUtilsStore = utilsStore();
const InvoicePayload = ref<any[]>([]);
const InvoiceProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const date = ref<Date | null>(null);
const noInvoice = ref("");
const selectedData = ref();

const hasData = computed(() => InvoicePayload.value && InvoicePayload.value.length > 0);

// fetch data available 
const fetchAvailable = async () => {
  UseUtilsStore.setLoading(true);
  try {
    // Format tanggal ke DD-MM-YYYY atau string kosong
    const formattedDate = date.value ? formatDate(date.value) : ""; 

    const response = await SupplierReturnsStore.getApiAvailable(
      props.lokasiStokUuid,
      noInvoice.value, 
      formattedDate, 
      InvoiceProperties.value.page,
      InvoiceProperties.value.page_size
    );
    InvoicePayload.value = response?.payload || [];
    InvoiceProperties.value.total = response?.properties?.total || 0;
  } catch (error) {
    console.error("Failed to fetch data", error);
    InvoicePayload.value = [];
    InvoiceProperties.value.total = 0; // Pastikan reset jika error
  } finally {
    UseUtilsStore.setLoading(false);
  }
};


// State baru untuk menampung nama lokasi gudang
const lokasiStokName = ref("Memuat..."); 


// fetch location gudang
const fetchLokasiStokName = async (uuid: string) => {
  if (!uuid || uuid === 'null' || uuid === 'undefined') { 
    lokasiStokName.value = "Semua Lokasi"; 
    return;
  }
  
  lokasiStokName.value = "Memuat..."; 
  
  try {
    const response = await StockLocationStore.getApi(1, 9999); // Mengambil list
    const locationData = response?.payload; 
    if (locationData && Array.isArray(locationData)) {
      // Filtering lokal
      const foundLocation = locationData.find( 
        (location: { uuid: string; name: string }) => location.uuid === uuid 
      );
      if (foundLocation) {
        lokasiStokName.value = foundLocation.name;
      } else {
        lokasiStokName.value = `Nama Lokasi (${uuid.substring(0, 8)}...) Tidak Ditemukan`;
      }
    } else {
      // Jika response.payload bukan array, tampilkan error
      lokasiStokName.value = "Gagal mengambil data lokasi (Format respons tidak sesuai)"; 
    }
  } catch (error) {
    console.error("Gagal mengambil nama lokasi stok", error);
    lokasiStokName.value = "Error saat Memuat Lokasi";
  }
};

// Gunakan watch untuk memanggil fungsi fetch saat prop lokasiStokUuid berubah
watch(() => props.lokasiStokUuid, (newUuid) => {
  // Panggil fungsi fetching faktur yang sudah Anda buat
  fetchAvailable();
  fetchLokasiStokName(newUuid); 
}, { immediate: true })

const handlePage = (event: any) => {
  InvoiceProperties.value.page = event.page + 1;
  InvoiceProperties.value.page_size = event.rows;
  fetchAvailable(); 
};

// reset form pencarian
const handleReset = () => {
  noInvoice.value = "";
  date.value = null; 
  InvoiceProperties.value.page = 1; // Reset halaman
  fetchAvailable(); 
};

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

// Reset state setiap kali dialog dibuka
watch(() => props.isDialogVisible, (newValue) => {
  if (newValue) {
    handleReset(); // Ini sekarang akan memanggil fetchAvailable()
  }
});

// Handle row selection
const onRowSelect = (event: any) => {
  emit("faktur-selected", event.data); // Kirim data faktur yang dipilih
  updateVisibility(false); // Langsung tutup dialog
};
</script>

<template>
  <CustomDialog :visible="isDialogVisible" @update:visible="updateVisibility" width="1000px">
    <template #header>Faktur Penerimaan</template>
    <template #body>
      <div class="flex items-center py-4">
        <div class="flex flex-col justify-center">
          <div class="font-semibold underline text-SM">Lokasi Gudang</div>
          <div class="font-normal text-normal">{{ lokasiStokName }}</div>
        </div>
        <hr class="mx-10 min-h-16 border-[1px] border-opensimrs-300" />
        <div class="flex items-end gap-5">
          <CustomTextfield label="Cari No. Faktur" v-model="noInvoice" prepend-icon="PhMagnifyingGlass"
            placeholder="Cari Berdasarkan No. Faktur" class="w-[360px]" />
          <CustomDatePicker label="Tgl. Faktur" v-model="date" />
          <div class="flex gap-2.5">
            <CustomButton class="my-auto" label="Cari" icon="PhMagnifyingGlass" @click="fetchAvailable" />
            <CustomButton label="Reset" class="my-auto bg-transparent" border-color="border-opensimrs-300 border-2"
              text-color="text-opensimrs-300" @click="handleReset" />
          </div>
        </div>
      </div>
      <NoData v-if="!hasData" />
      <DataTable v-else :value="InvoicePayload" v-model:selection="selectedData" selectionMode="single"
        @row-select="onRowSelect" stripedRows class="text-xs" scrollable scrollHeight="300px">
        <Column header="No." headerClass="bg-opensimrs-50" class="w-16">
          <template #body="slotProps">
            <div class="w-full text-center">{{ slotProps.index + 1 }}</div>
          </template>
        </Column>

        <Column header="Nomor" headerClass="bg-opensimrs-50" class="w-[250px]">
          <template #body="slotProps">
            <div>
              <p class="font-semibold underline">No. Penerimaan</p>
              <p>{{ slotProps.data.noPenerimaan }}</p>
            </div>
            <div class="mt-2">
              <p class="font-semibold underline">No. Faktur</p>
              <p>{{ slotProps.data.noFaktur || '-' }}</p>
            </div>
          </template>
        </Column>

        <Column header="Tanggal" headerClass="bg-opensimrs-50" class="w-[250px]">
          <template #body="slotProps">
            <div>
              <p class="font-semibold underline">Tgl. Penerimaan</p>
              <p>{{ epochToDate(slotProps.data.tanggalPenerimaan, "date") || '-' }}</p>
            </div>
            <div class="mt-2">
              <p class="font-semibold underline">Tgl. Faktur</p>
              <p>{{ epochToDate(slotProps.data.tanggalFaktur, "date") || '-' }}</p>
            </div>
          </template>
        </Column>

        <Column header="Supplier" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <p>{{ slotProps.data.supplier || '-'}}</p>
          </template>
        </Column>
      </DataTable>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <CustomPaginator :rows="InvoiceProperties.page_size" :totalRecords="InvoiceProperties.total"
          :rowsPerPageOptions="[10, 20, 30]" @page="handlePage" />
      </div>
    </template>
  </CustomDialog>
</template>