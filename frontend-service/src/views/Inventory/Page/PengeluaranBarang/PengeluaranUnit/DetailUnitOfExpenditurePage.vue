<script setup lang="ts">
import { ref, onMounted, type PropType } from "vue";
import { useUnitOfExpenditureStore } from "@/stores/inventory/unitOfExpenditure";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import { utilsStore } from "@/stores/utils";
import { epochToDate, formatPrice } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { PhCaretRight, PhPrinter } from "@phosphor-icons/vue";
import { generatePengeluaranUnitPdf } from "@/utils/pdf/pdfInventory/cetakPengeluaranUnit";

const props = defineProps({
  selectedData: {
    type: Object,
    default: () => ({}),
  },
});

function formatDate(date: any) {
  const parsedDate = new Date(date);
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${day}-${month}-${year}`;
}

// State Management
const UnitOfExpenditureStore = useUnitOfExpenditureStore();
const UseUtilsStore = utilsStore();
const stockLocationStore = useStockLocationStore();
const DetailPayload = ref<any>({});
const stockLocations = ref<any[]>([]);

const emit = defineEmits(["back"]);

// Fetch Detail
const fetchDetail = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await UnitOfExpenditureStore.getApiDetail(
      props.selectedData.uuid
    );
    if (response && response.payload) {
      DetailPayload.value = response.payload;
    } else {
      DetailPayload.value = {};
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

//handle cetak
const handleCetak = async () => {
  if (!DetailPayload.value.uuid) {
    console.error("Data detail belum dimuat.");
    return;
  }

  // Ambil data faskes_profile dari localStorage
  const faskesProfileString = localStorage.getItem("faskes_profile");
  if (!faskesProfileString) {
    console.error("Data profil faskes tidak ditemukan di localStorage.");
    return;
  }

  let clinicProfile: any;
  try {
    // Parse data JSON
    clinicProfile = JSON.parse(faskesProfileString);
  } catch (e) {
    console.error("Gagal parse data profil faskes:", e);
    return;
  }

  //  Buat salinan payload untuk dikirim ke PDF
  const pdfPayload = { ...DetailPayload.value };
  if (pdfPayload.lokasiStokAwalUuid && stockLocations.value.length > 0) {
    const lokasiAwal = stockLocations.value.find(loc => loc.uuid === pdfPayload.lokasiStokAwalUuid);
    if (lokasiAwal) {
      pdfPayload.lokasiStokAwal = { name: lokasiAwal.name };
    }
  }

  UseUtilsStore.setLoading(true);
  try {
    const base64Pdf = await generatePengeluaranUnitPdf(pdfPayload, clinicProfile);

    // Buka PDF di tab baru
    const pdfWindow = window.open("");
    if (pdfWindow) {
      pdfWindow.document.write(
        `<iframe width='100%' height='100%' src='data:application/pdf;base64,${base64Pdf}'></iframe>`
      );
      pdfWindow.document.title = `Pengeluaran - ${DetailPayload.value.noPengeluaran || 'Detail'}`;
    } else {
      console.error("Gagal membuka tab baru. Pop-up mungkin diblokir.");
    }
  } catch (error) {
    console.error("Gagal membuat PDF:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};


onMounted(async () => {
  await fetchDetail(); // Tunggu detail selesai

  // fetchDetail, ambil data lokasi stok
  if (stockLocations.value.length === 0) {
    try {
      // Ambil semua lokasi (asumsi halaman 1, limit 999)
      const locResponse = await stockLocationStore.getApi(1, 999);
      if (locResponse && locResponse.payload && Array.isArray(locResponse.payload.data)) {
        stockLocations.value = locResponse.payload.data;
      } else if (locResponse && Array.isArray(locResponse.data)) {
        stockLocations.value = locResponse.data;
      } else if (locResponse && Array.isArray(locResponse.payload)) {
        stockLocations.value = locResponse.payload;
      } else if (locResponse && Array.isArray(locResponse)) {
        stockLocations.value = locResponse;
      } else {
        console.warn("Struktur respons lokasi stok tidak terduga:", locResponse);
      }

    } catch (error) {
      console.error("Gagal mengambil daftar lokasi stok:", error);
    }
  }
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="flex flex-col h-full overflow-hidden pt-0 pb-0" pt:content:class="flex-grow overflow-auto"
      class="h-full overflow-hidden">

      <template #header>
        <CustomAccordion :openWithHeader="false" noBorder initialState="0">
          <template #header>
            <div class="flex justify-between w-full align-middle">
              <div class="flex">
                <CustomButton icon="PhArrowClockwise" class="mr-5" @click="fetchDetail" />
                <CustomBreadCrumb :home="{
                  label: 'Pengeluaran Barang',
                  home: true,
                }" />
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-opensimrs-300" />
                <div class="">
                  <p class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]">
                    Pengeluaran Unit
                  </p>
                </div>
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-grey-300" />
                <div class="ml-[10px] mt-[5px]">
                  <CustomChip :label="props.selectedData.noPengeluaran" :showCheckedIcon="false"
                    borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" />
                </div>
                <div v-if="props.selectedData.status == 'cancel'" class="ml-[10px] mt-[5px]">
                  <CustomChip label="DIBATALKAN" :showCheckedIcon="false" borderColor="border-danger-300"
                    bgColor="bg-danger-300" textColor="text-white" />
                </div>
                <div v-if="props.selectedData.status == 'verifikasi'" class="ml-[10px] mt-[5px]">
                  <CustomChip label="DIVERIFIKASI" :showCheckedIcon="false" borderColor="border-info-300"
                    bgColor="bg-info-300" textColor="text-white" />
                </div>
              </div>
              <div class="flex">
                <CustomButton @click="emit('back')" icon="PhCaretLeft" label="Kembali" class="mr-[10px]" outlined
                  borderColor="border-opensimrs-300" textColor="text-opensimrs-300" />
              </div>
            </div>
          </template>
          <template #content>
            <div class="grid grid-cols-4 gap-4 mt-[20px]">
              <!-- Jenis Pengeluaran -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Jenis Pengeluaran</p>
                <p>{{ DetailPayload.jenisPengeluaran }}</p>
              </div>
              <!-- Tgl. Permintaan -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Tgl. Permintaan</p>
                <p>{{ DetailPayload.tanggalPengeluaran ? epochToDate(DetailPayload.tanggalPengeluaran > 1e11 ? DetailPayload.tanggalPengeluaran / 1000 : DetailPayload.tanggalPengeluaran, "date") : '-' }}
                </p>
              </div>
              <!-- Kategori Item -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">
                  Kategori Item
                </p>
                <p>{{ DetailPayload.kategoriItem }}</p>
              </div>
              <!-- Jenis Stok -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">
                  Jenis Stok
                </p>
                <p>{{ DetailPayload.jenisStok }}</p>
              </div>
              <!-- Jenis Item -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">
                  Jenis Item
                </p>
                <p>{{ DetailPayload.jenisItem }}</p>
              </div>
              <!-- Tujuan Pengeluaran -->
              <div v-if="DetailPayload.jenisPengeluaran == 'pengeluaran tanpa permintaan'">
                <p class="text-xs font-bold underline underline-offset-2">
                  Tujuan Pengeluaran
                </p>
                <p>{{ DetailPayload.lokasiStokAkhir || '-' }}</p>
              </div>
              <!-- Jenis Pemusnahan -->
              <div v-if="DetailPayload.jenisPengeluaran == 'pemusnahan barang'">
                <p class="text-xs font-bold underline underline-offset-2">
                  Jenis Pemusnahan
                </p>
                <p>{{ DetailPayload.jenisPemusnahan || '-' }}</p>
              </div>
              <!-- Petugas Pengeluaran -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">
                  Petugas Pengeluaran
                </p>
                <p>{{ DetailPayload.petugasPengeluaran }}</p>
              </div>
              <!-- Catatan -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">
                  Catatan
                </p>
                <p>{{ DetailPayload.catatan || '-' }}</p>
              </div>
            </div>
            <hr class="mt-5 border-1 border-grey-200" />
          </template>
          <template #collapseIcon>
            <CustomButton icon="PhCaretUp" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
          </template>
          <template #expandIcon>
            <CustomButton icon="PhCaretDown" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
          </template>
        </CustomAccordion>
      </template>

      <!-- content -->
      <template #content>
        <div class="mt-[20px] h-full">
          <DataTable :value="DetailPayload.items" scrollable scrollHeight="flex" :pt="{ headerRow: 'text-SM' }">
            <Column headerClass="bg-opensimrs-50 w-[50px]" class="w-[50px]">
              <template #header>
                <div class="font-semibold">No.</div>
              </template>
              <template #body="slotProps">
                <div class="text-sm text-center">{{ slotProps.index + 1 }}</div>
              </template>
            </Column>
            <Column header="Nama Item" headerClass="bg-opensimrs-50 font-semibold">
              <template #body="slotProps">
                <div class="text-sm">{{ slotProps.data.name || '-' }}</div>
              </template>
            </Column>
            <Column header="Exp. Date" headerClass="bg-opensimrs-50 font-semibold w-[120px]" class="w-[120px]">
              <template #body="slotProps">
                <div class="text-sm ">
                  {{ formatDate(slotProps.data.expDate) }}
                </div>
              </template>
            </Column>
            <Column header="Pengeluaran" headerClass="bg-opensimrs-50 font-semibold w-[100px]" class="w-[100px]">
              <template #body="slotProps">
                <div class="text-sm text-center">{{ slotProps.data.pengeluaran ?? '-' }}</div>
              </template>
            </Column>
            <Column header="Satuan/Isi" headerClass="bg-opensimrs-50 font-semibold w-[120px]" class="w-[120px]">
              <template #body="slotProps">
                <div class="text-sm">{{ slotProps.data.satuan || '-' }}</div>
              </template>
            </Column>
            <Column header="Harga Dasar" headerClass="bg-opensimrs-50 font-semibold w-[150px]" class="w-[150px]">
              <template #body="slotProps">
                <div class="text-sm ">
                  {{ formatPrice(slotProps.data.hargaSatuan || 0) }}
                </div>
              </template>
            </Column>
            <Column header="Total" headerClass="bg-opensimrs-50 font-semibold w-[150px]" class="w-[150px]">
              <template #body="slotProps">
                <div class="text-sm ">
                  {{ formatPrice(slotProps.data.total || 0) }}
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>

      <template #footer>
        <div class="flex-shrink-0 p-4 bg-white border-t border-grey-200">
          <div class="flex">
            <div>
              <CustomButton background-color="bg-opensimrs-300 rounded-lg" @click="handleCetak">
                <div class="flex items-center gap-2">
                  <PhPrinter :size="18" color="#ffffff" weight="fill" />
                  <div class="text-sm">Cetak</div>
                </div>
              </CustomButton>
            </div>
            <div class="ml-[30px]">
              <p class="font-bold underline underline-offset-2">
                Total Item
              </p>
              <p>{{ DetailPayload.totalItem }}</p>
            </div>
            <div class="ml-[30px]">
              <p class="font-bold underline underline-offset-2">
                Grand Total
              </p>
              <!-- [PERBAIKAN] Gunakan formatPrice -->
              <p>{{ formatPrice(DetailPayload.totalHarga || 0) }}</p>
            </div>
          </div>
        </div>
      </template>

    </Card>
  </div>
</template>
