<script setup lang="ts">
import { ref, onMounted, type PropType, computed } from "vue";
import { usePurchasingOfSupplierStore } from "@/stores/inventory/purchasingOfSupplier";
import { usePriceConfigurationStore } from "@/stores/datamasterFarmasi/PriceConfiguration";
import { utilsStore } from "@/stores/utils";
import { epochToDate, formatPrice } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import AddPurchaseOfSupplier from "./AddPurchaseOfSupplierPage.vue";
import type { MenuItem } from "primevue/menuitem";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  selectedData: {
    type: Object,
    default: () => ({}),
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
const PurchasingOfSupplierStore = usePurchasingOfSupplierStore();
const PriceConfigurationStore = usePriceConfigurationStore();
const UseUtilsStore = utilsStore();
const DetailPayload = ref<any>({});
const alasanBatal = ref("");
const batalDialog = ref(false);
const ppnPercentage = ref(0);

const emit = defineEmits(["back"]);

//  Fungsi Fetch Config PPN
const fetchPpnConfig = async () => {
  try {
    const response = await PriceConfigurationStore.getApiKonfig();
    if (response && response.payload) {
      // Ambil nilai ppn dari payload (contoh: 2)
      ppnPercentage.value = response.payload.ppn || 0;
    }
  } catch (error) {
    console.error("Gagal mengambil konfigurasi PPN", error);
    // Fallback optional jika gagal, bisa set 11 atau 0
    // ppnPercentage.value = 11; 
  }
};

// Fetch Detail
const fetchDetail = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await PurchasingOfSupplierStore.getApiDetail(props.selectedData.uuid);
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

// Confirm Delete / Cancel Purchase
const confirmDelete = async () => {
  UseUtilsStore.setLoading(true);
  try {
    await PurchasingOfSupplierStore.deleteApi(DetailPayload.value.uuid,
      {
        alasan_batal: alasanBatal.value,
      });
  } catch (error) {
    console.error("Failed to delete data", error);
  } finally {
    UseUtilsStore.setLoading(false);
    batalDialog.value = false;
    emit("back");
  }
};

// Kalkulasi ppn
const ppnNominal = computed(() => {
  if (!DetailPayload.value || !DetailPayload.value.items) {
    return 0;
  }
  const subTotal = DetailPayload.value.items.reduce((total: any, item: { totalHarga: any; }) => {
    return total + (item.totalHarga || 0);
  }, 0);
  const totalSetelahDiskon = subTotal - (DetailPayload.value.diskon || 0);
  const nilaiPpn = totalSetelahDiskon * (ppnPercentage.value / 100);
  return Math.max(0, nilaiPpn);
});

const edit = async () => {
  changeSection('Tambah Pembelian')
};

const closePurchaseOfSupplierPage = () => {
  dataBreadCrumb.value.pop();
};

const handleSaveSuccess = async () => {
  // 1. Panggil fungsi untuk menutup halaman (kembali ke breadcrumb sebelumnya)
  closePurchaseOfSupplierPage();

  // 2. Fetch ulang data agar data terbaru muncul
  await fetchDetail();
};

const handleReset = () => {
  fetchDetail(); // Memanggil data lagi dengan query kosong
};

onMounted(async () => {
  await fetchPpnConfig(); 
  fetchDetail();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card v-if="dataBreadCrumb.length == 0" pt:body:class="h-full pt-0 pb-0 overflow-auto"
      pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden overflow-y-auto">
      <template #header>
        <CustomAccordion :openWithHeader="false" noBorder initialState="0">
          <template #header>
            <div class="flex justify-between w-full align-middle">
              <div class="flex">
                <CustomButton icon="PhArrowClockwise" @click="handleReset" class="mr-5" />
                <CustomBreadCrumb :home="{
                  label: 'Pengadaan Barang',
                  home: true,
                }" :model="dataBreadCrumb" />
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-opensimrs-300" />
                <div class="">
                  <p class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]">
                    Pembelian Barang Supplier
                  </p>
                </div>
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-grey-300" />
                <div class="ml-[10px] mt-[5px]">
                  <CustomChip :label="props.selectedData.noPo" :showCheckedIcon="false" borderColor="border-opensimrs-300"
                    bgColor="bg-opensimrs-300" textColor="text-white" />
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
            <div class="grid grid-cols-5 gap-5 mt-[20px]">
              <!-- No. Pembelian -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">No. Pembelian</p>
                <p>{{ DetailPayload.noPembelian }}</p>
              </div>
              <!-- Lokasi Penerima -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Lokasi Penerima</p>
                <p>{{ DetailPayload.lokasi }}</p>
              </div>
              <!-- Kategori Item -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Kategori Item</p>
                <p>{{ DetailPayload.kategoriItem }}</p>
              </div>
              <!-- Jenis Stok -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Jenis Stok</p>
                <p>{{ DetailPayload.jenisStok }}</p>
              </div>
              <!-- Jenis Item -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Jenis Item</p>
                <p>{{ DetailPayload.jenisItem }}</p>
              </div>
              <!-- Supplier -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Supplier</p>
                <p>{{ DetailPayload.supplier }}</p>
              </div>
              <!-- Tanggal Pembelian -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Tanggal Pembelian</p>
                <p>{{ epochToDate(DetailPayload.tanggalPembelian, "date") }}</p>
              </div>
              <!-- Cara Bayar -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Cara Bayar</p>
                <p>{{ DetailPayload.paymentMethod }}</p>
              </div>
              <!-- Cito -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Cito</p>
                <p>{{ DetailPayload.cito ? 'Ya' : '-' }}</p>
              </div>
              <!-- Catatan -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Catatan</p>
                <p>{{ DetailPayload.catatanPo }}</p>
              </div>
            </div>
            <hr class="mt-5 border-1 border-grey-200" />
            <div class="mt-[20px] h-[160px]">
              <DataTable :value="DetailPayload.items" scrollable scrollHeight="flex" :pt="{ headerRow: 'text-SM' }">
                <!-- No -->
                <Column headerClass="bg-opensimrs-50">
                  <template #header>
                    <div class="w-full font-semibold">No.</div>
                  </template>
                  <template #body="slotProps">
                    <div class="text-sm">{{ slotProps.index + 1 }}</div>
                  </template>
                </Column>

                <!-- Nama Item -->
                <Column header="Nama Item" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-sm">{{ slotProps.data.nama }}</div>
                  </template>
                </Column>

                <!-- Jumlah Beli -->
                <Column header="Jumlah beli" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-sm ml-[30px]">{{ slotProps.data.qtyOrder }}</div>
                  </template>
                </Column>

                <!-- Satuan Beli -->
                <Column header="Satuan Beli" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-sm">{{ slotProps.data.satuanBeliInfo?.namaSatuanBeli || '-' }}</div>
                  </template>
                </Column>

                <!-- Harga Satuan -->
                <Column header="Harga Satuan" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-sm">{{ formatPrice(slotProps.data.hargaSatuan) }}</div>
                  </template>
                </Column>

                <!-- Total -->
                <Column header="Total" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-sm">{{ formatPrice(slotProps.data.totalHarga) }}</div>
                  </template>
                </Column>
              </DataTable>
            </div>
            <hr class="mt-5 border-1 border-grey-200" />
            <div class="flex justify-between w-full">
              <div class="flex mt-[20px]">
                <div>
                  <p class="font-bold underline underline-offset-2">Diskon</p>
                  <p>{{ formatPrice(DetailPayload.diskon) }}</p>
                </div>
                <div class="ml-[50px]">
                  <p class="font-bold underline underline-offset-2">Materai</p>
                  <p>{{ formatPrice(DetailPayload.materai) }}</p>
                </div>
                <div class="ml-[50px]">
                  <p class="font-bold underline underline-offset-2">PPN {{ ppnPercentage }}%</p>
                  <p>{{ formatPrice(DetailPayload.ppn ? ppnNominal : 0) }}</p>
                </div>
              </div>
              <div class="flex">
                <div class="bg-opensimrs-300 w-[1.5px] h-[50px] mr-[20px] mt-[20px]"></div>
                <div class="mt-[20px] mr-[60px]">
                  <p class="font-bold underline underline-offset-2">Grand Total</p>
                  <p>{{ formatPrice(DetailPayload.grandTotal) }}</p>
                </div>
              </div>
            </div>
          </template>
          <template #footer>
            <div class="flex justify-between w-full mt-[20px]">
              <div class="flex">
                <div>
                  <p class="font-bold underline underline-offset-2">
                    Total Item
                  </p>
                  <p>{{ DetailPayload.totalItem }}</p>
                </div>
                <div class="ml-[70px]">
                  <p class="font-bold underline underline-offset-2">
                    Petugas Permintaan
                  </p>
                  <p>{{ DetailPayload.petugasPembuatPo }}</p>
                </div>
                <div class="ml-[70px]"
                  v-if="props.selectedData.status == 'cancel' || props.selectedData.status == 'verifikasi'">
                  <p class="font-bold underline underline-offset-2">
                    Petugas verifikasi
                  </p>
                  <p>{{ DetailPayload.petugasVerifikasi }}</p>
                </div>
                <div class="ml-[70px]" v-if="props.selectedData.status == 'cancel'">
                  <p class="font-bold underline underline-offset-2">
                    Alasan Batal
                  </p>
                  <p>{{ DetailPayload.alasanBatal || '-' }}</p>
                </div>
              </div>
              <div v-if="props.selectedData.status == 'pending'" class="flex mt-[5px]">
                <CustomButton @click="batalDialog = true" label="Batal Pembelian" class="w-[150px]"
                  backgroundColor="bg-danger-300" borderColor="border-danger-300" textColor="text-white" />
                <CustomButton @click="edit" label="Ubah Pembelian" class="w-[150px] ml-[20px]"
                  backgroundColor="bg-opensimrs-300" borderColor="border-opensimrs-300" textColor="text-white" />
              </div>
            </div>
          </template>
          <template #collapseIcon>
            <CustomButton icon="PhCaretUp" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
          </template>
          <template #expandIcon>
            <CustomButton icon="PhCaretDown" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
          </template>
        </CustomAccordion>
      </template>
    </Card>

    <AddPurchaseOfSupplier v-else-if="dataBreadCrumb[0].label == 'Tambah Pembelian'" :dataBreadCrumb="dataBreadCrumb"
      :pageType="pageType" :DetailPayload="DetailPayload" @back="closePurchaseOfSupplierPage"
      @backEdit="handleSaveSuccess" />

    <!-- Dialog Cancel -->
    <CustomDialog v-model:visible="batalDialog" width="600px" headerBg="bg-danger-300">
      <template #header>Batal Penjualan</template>
      <template #body>
        <div class="grid grid-cols-1">
          <div>
            <p class="mt-[20px] font-bold">
              Alasan Pembatalan
            </p>
          </div>
          <div class="mt-[15px]">
            <CustomTextfield v-model="alasanBatal" :showLabel="false" placeholder="Alasan Pembatalan" />
          </div>
          <div class="mt-[10px]">
            <p class="text-sm italic text-danger-300">
              *Setelah membatalkan, riwayat permintaan akan masuk ke tab menu
              <span class="font-bold">DIBATALKAN</span>
            </p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton @click="batalDialog = false" label="Tidak" outlined class="mr-[10px]"
            borderColor="border-grey-200" textColor="text-grey-300" />
          <CustomButton @click="confirmDelete" label="Iya, Batalkan" backgroundColor="bg-danger-300"
            borderColor="border-danger-300" textColor="text-white" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
