<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useVerificationOfGoodsPurchaseStore } from "@/stores/inventory/verificationOfGoodsPurchase";
import { usePriceConfigurationStore } from "@/stores/datamasterFarmasi/PriceConfiguration";
import { utilsStore } from "@/stores/utils";
import { epochToDate, formatPrice } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  selectedData: {
    type: Object,
    default: () => ({}),
  },
});

// State Management
const VerificationStore = useVerificationOfGoodsPurchaseStore();
const PriceConfigurationStore = usePriceConfigurationStore(); 
const UseUtilsStore = utilsStore();
const DetailPayload = ref<any>({});
const ppnPercentage = ref(0);

const emit = defineEmits(["back"]);

// Fetch PPN Configuration
const fetchPpnConfig = async () => {
  try {
    const response = await PriceConfigurationStore.getApiKonfig();
    if (response && response.payload) {
      // Ambil nilai ppn dari payload (contoh: 2)
      ppnPercentage.value = response.payload.ppn || 0;
    }
  } catch (error) {
    console.error("Gagal mengambil konfigurasi PPN", error);
  }
};

// Fetch Detail
const fetchDetail = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await VerificationStore.getApiDetail(props.selectedData.uuid);
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

const verification = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await VerificationStore.putApi(props.selectedData.uuid);
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    UseUtilsStore.setLoading(false);
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

onMounted(async () => {
  await fetchPpnConfig(); 
  fetchDetail();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 pb-0 overflow-auto" pt:content:class="h-full overflow-hidden"
      class="h-full overflow-hidden overflow-y-auto">
      <template #header>
        <CustomAccordion :openWithHeader="false" noBorder initialState="0">
          <template #header>
            <div class="flex justify-between w-full align-middle">
              <div class="flex">
                <CustomButton icon="PhArrowClockwise" class="mr-5" @click="fetchDetail" />
                <CustomBreadCrumb :home="{
                  label: 'Pengadaan Barang',
                  home: true,
                }" />
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-opensimrs-300" />
                <div class="">
                  <p class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]">
                    Verifikasi Pembelian Barang Supplier
                  </p>
                </div>
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-grey-300" />
                <div class="ml-[10px] mt-[5px]">
                  <CustomChip :label="props.selectedData.noPo" :showCheckedIcon="false" borderColor="border-opensimrs-300"
                    bgColor="bg-opensimrs-300" textColor="text-white" />
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
                <p v-if="DetailPayload.cito == true">Ya</p>
                <p v-else>Tidak</p>
              </div>
              <!-- Catatan -->
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Catatan</p>
                <p>{{ DetailPayload.catatanPo }}</p>
              </div>
            </div>
            <hr class="mt-5 border-1 border-grey-200" />
            <div class="mt-[20px] h-[260px]">
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
                    <div class="text-sm">{{ slotProps.data.satuanBeliString }}</div>
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
                <div class="ml-[70px]">
                  <p class="font-bold underline underline-offset-2">
                    Petugas Verifikasi
                  </p>
                  <p>{{ DetailPayload.petugasVerifikasi || '-'}}</p>
                </div>
              </div>
              <div v-if="DetailPayload.status != 'verifikasi'" class="flex mt-[5px]">
                <CustomButton @click="verification" label="Verifikasi" class="w-[150px] ml-[20px]"
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
  </div>
</template>
