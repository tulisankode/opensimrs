<script setup lang="ts">
import { ref, onMounted, type PropType, computed } from "vue";
import { useUnitDeliveryVerificationStore } from "@/stores/inventory/unitDeliveryVerification";
import { utilsStore } from "@/stores/utils";
import { epochToDate, formatPrice } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import type { MenuItem } from "primevue/menuitem";
import { PhArrowRight } from "@phosphor-icons/vue";
import { generatePermintaanPdf } from "@/utils/pdf/pdfInventory/cetakPermintaan";

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
const UnitDeliveryVerificationStore = useUnitDeliveryVerificationStore();
const UseUtilsStore = utilsStore();
const DetailPayload = ref<any>({});
const alasanBatal = ref("");
const batalDialog = ref(false);

const selectedItemsForDelivery = ref<any[]>([]);
const catatanPengiriman = ref("");

const emit = defineEmits(["back"]);

// Fetch Detail
const fetchDetail = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await UnitDeliveryVerificationStore.getApiDetail(props.selectedData.uuid);
    if (response && response.payload) {
      const payloadData = response.payload;
      if (payloadData.items && Array.isArray(payloadData.items)) {
        payloadData.items = payloadData.items.map((item: any) => ({
          ...item,
          // Set qtyPengiriman ke 0 jika null/undefined, jika tidak gunakan nilainya
          qtyPengiriman: item.qtyPengiriman ?? 0
        }));
      }
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

const confirmDelete = async () => {
  UseUtilsStore.setLoading(true);
  try {
    await UnitDeliveryVerificationStore.deleteApi(DetailPayload.value.uuid,
      {
        alasanBatal: alasanBatal.value,
      });
  } catch (error) {
    console.error("Failed to delete data", error);
  } finally {
    UseUtilsStore.setLoading(false);
    batalDialog.value = false;
    emit("back");
  }
};

// Hitung total item (opsional, tapi berguna)
const totalItem = computed(() => DetailPayload.value?.items?.length || 0);
const grandTotal = computed(() => {
  // Sesuaikan kalkulasi ini jika API item memiliki harga
  return DetailPayload.value?.items?.reduce((sum: number, item: any) => {
    // Asumsi ada field hargaSatuan dan qtyPengiriman/qtyPermintaan
    const qty = item.qtyPengiriman ?? item.qtyPermintaan ?? 0;
    const price = item.hargaSatuan ?? 0;
    return sum + (qty * price);
  }, 0) || 0;
});

// Handle Verify
const handleVerify = async () => {
  // 1. Dapatkan UUID item yang dipilih
  const selectedItemUuids = selectedItemsForDelivery.value?.map(item => item.uuid) || [];

  if (selectedItemUuids.length === 0) {
    alert("Pilih setidaknya satu item yang akan diverifikasi/dikirim.");
    return;
  }

  // 2. Ambil data item TERBARU dari DetailPayload dan filter berdasarkan UUID terpilih
  const itemsToVerify = DetailPayload.value.items
    ?.filter((item: any) => selectedItemUuids.includes(item.uuid)) // Filter yg dipilih
    ?.filter((item: any) => (item.qtyPengiriman ?? 0) > 0) // Filter yg qty > 0
    ?.map((item: any) => ({
      uuid: item.uuid,
      quantity: item.qtyPengiriman
    })) || [];

  // 3. Cek apakah ada item lolos filter qty > 0
  if (itemsToVerify.length === 0) {
    // Cek apakah ada yg dipilih tapi qty nya 0
    const selectedWithZeroQty = DetailPayload.value.items
      ?.filter((item: any) => selectedItemUuids.includes(item.uuid))
      ?.some((item: any) => (item.qtyPengiriman ?? 0) === 0);
    if (selectedWithZeroQty) {
      alert("Jumlah pengiriman untuk item yang dipilih masih 0.");
    } else {
      // Ini tidak seharusnya terjadi jika selectedItemUuids > 0
      alert("Item yang dipilih tidak ditemukan dalam data.");
    }
    return;
  }


  UseUtilsStore.setLoading(true);
  try {
    const payload = { item: itemsToVerify };
    console.log("Mengirim payload Verifikasi:", payload);
    await UnitDeliveryVerificationStore.putVerifyApi(props.selectedData.uuid, payload);
    emit('back');
  } catch (error) { console.error("Gagal verifikasi:", error); }
  finally { UseUtilsStore.setLoading(false); }
};

// Handle Send
const handleSend = async () => {
  // Validasi: Catatan mungkin wajib?
  if (!catatanPengiriman.value) {
    // alert("Catatan pengiriman harus diisi.");
    // return; // Aktifkan jika wajib
  }

  UseUtilsStore.setLoading(true);
  try {
    const payload = {
      catatanPengiriman: catatanPengiriman.value
    };
    console.log("Mengirim payload Kirim:", payload);
    await UnitDeliveryVerificationStore.putSendApi(props.selectedData.uuid, payload);
    // Tampilkan pesan sukses?
    emit('back'); // Kembali ke list setelah kirim
  } catch (error) {
    console.error("Gagal kirim barang:", error);
    // Tampilkan pesan error?
  }
  finally { UseUtilsStore.setLoading(false); }
};

const handleCetak = async () => {
  if (!DetailPayload.value.uuid) {
    console.error("Data detail belum dimuat.");
    return;
  }

  // 1. Ambil data faskes_profile dari localStorage
  const faskesProfileString = localStorage.getItem("faskes_profile");
  if (!faskesProfileString) {
    console.error("Data profil faskes tidak ditemukan di localStorage.");
    return;
  }

  let clinicProfile: any;
  try {
    // 2. Parse data JSON
    clinicProfile = JSON.parse(faskesProfileString);
  } catch (e) {
    console.error("Gagal parse data profil faskes:", e);
    return;
  }

  UseUtilsStore.setLoading(true);
  try {
    // 3. Kirim data ke fungsi PDF
    const base64Pdf = await generatePermintaanPdf(DetailPayload.value, clinicProfile);

    // Buka PDF di tab baru
    const pdfWindow = window.open("");
    if (pdfWindow) {
      pdfWindow.document.write(
        `<iframe width='100%' height='100%' src='data:application/pdf;base64,${base64Pdf}'></iframe>`
      );
      pdfWindow.document.title = `Faktur - ${DetailPayload.value.no_faktur || DetailPayload.value.no_pembelian}`;
    } else {
      console.error("Gagal membuka tab baru. Pop-up mungkin diblokir.");
    }

  } catch (error) {
    console.error("Gagal membuat PDF:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

onMounted(() => {
  fetchDetail();
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
              <div class="flex items-center">
                <CustomButton icon="PhArrowClockwise" class="mr-5" @click="fetchDetail" />
                <CustomBreadCrumb :home="{
                  label: 'Pengeluaran Barang',
                  home: true,
                }" :model="dataBreadCrumb" />
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-opensimrs-300" />
                <div class="">
                  <p class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]">
                    Verifikasi & Pengiriman Unit
                  </p>
                </div>
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-grey-300" />
                <div class="ml-[10px] mt-[5px]">
                  <CustomChip :label="props.selectedData.noPermintaan" :showCheckedIcon="false"
                    borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" />
                </div>
                <div v-if="props.selectedData.status == 'request'" class="ml-[10px] mt-[5px]">
                  <CustomChip label="PENGAJUAN" :showCheckedIcon="false" borderColor="border-grey-300"
                    bgColor="bg-grey-300" textColor="text-white" />
                </div>
                <div v-if="props.selectedData.status == 'request_sebagian'" class="ml-[10px] mt-[5px]">
                  <CustomChip label="PENGAJUAN - VERIF SEBAGIAN" :showCheckedIcon="false" borderColor="border-grey-300"
                    bgColor="bg-grey-300" textColor="text-white" />
                </div>
                <div v-if="props.selectedData.status == 'verified'" class="ml-[10px] mt-[5px]">
                  <CustomChip label="DIVERIFIKASI" :showCheckedIcon="false" borderColor="border-info-300"
                    bgColor="bg-info-300" textColor="text-white" />
                </div>
                <div v-if="props.selectedData.status == 'verif_sebagian'" class="ml-[10px] mt-[5px]">
                  <CustomChip label="DIVERIFIKASI - VERIF SEBAGIAN" :showCheckedIcon="false"
                    borderColor="border-info-300" bgColor="bg-info-300" textColor="text-white" />
                </div>
                <div v-if="props.selectedData.status == 'dikirim'" class="ml-[10px] mt-[5px]">
                  <CustomChip label="DIKIRIM" :showCheckedIcon="false" borderColor="border-success-300"
                    bgColor="bg-success-300" textColor="text-white" />
                </div>
                <div v-if="props.selectedData.status == 'cancel' || props.selectedData.status == 'ditolak'"
                  class="ml-[10px] mt-[5px]">
                  <CustomChip label="DITOLAK" :showCheckedIcon="false" borderColor="border-danger-300"
                    bgColor="bg-danger-300" textColor="text-white" />
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
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Tgl. Permintaan</p>
                <p>{{ DetailPayload.tanggalPermintaan ? epochToDate(DetailPayload.tanggalPermintaan / 1000, "date") :
                  '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Kategori Item</p>
                <p>{{ DetailPayload.kategoriItem || '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Jenis Stok</p>
                <p>{{ DetailPayload.jenisStok || '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Jenis Item</p>
                <p>{{ DetailPayload.jenisItem || '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Tujuan Permintaan</p>
                <p>{{ DetailPayload.lokasiStokTujuan|| '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Cito</p>
                <CustomChip v-if="DetailPayload.cito === true" label="CITO" :showCheckedIcon="false"
                  borderColor="border-danger-300" bgColor="bg-danger-300" textColor="text-white"
                  customClass="h-5 mt-1" />
                <p v-else>-</p>
              </div>
              <div v-if="['verified', 'dikirim', 'verif_sebagian'].includes(DetailPayload.status)">
                <p class="text-xs font-bold underline underline-offset-2">Petugas Verifikasi</p>
                <p>{{ DetailPayload.petugasVerifikasi || '-' }}</p>
              </div>
              <div v-else-if="['request', 'request_sebagian'].includes(DetailPayload.status)">
                <p class="text-xs font-bold underline underline-offset-2">Petugas Permintaan</p>
                <p>{{ DetailPayload.petugasPermintaan || '-' }}</p>
              </div>
              <div
                :class="['verified', 'dikirim','verif_sebagian'].includes(DetailPayload.status) ">
                <p class="text-xs font-bold underline underline-offset-2">Catatan</p>
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

      <template #content>
        <div class="mt-[20px] h-full">
          <DataTable :value="DetailPayload.items" scrollable scrollHeight="flex" :pt="{ headerRow: 'text-SM' }"
            v-model:selection="selectedItemsForDelivery" :dataKey="'uuid'">

            <Column headerClass="bg-opensimrs-50 w-[50px]" class="w-[50px]">
              <template #header>
                <div class="w-full font-semibold text-center">No.</div>
              </template>
              <template #body="slotProps">
                <div class="text-sm text-center">{{ slotProps.index + 1 }}</div>
              </template>
            </Column>

            <Column header="Nama Item" headerClass="bg-opensimrs-50 font-semibold">
              <template #body="slotProps">
                <div class="text-sm">{{ slotProps.data.itemMedis || '-' }}</div>
              </template>
            </Column>

            <Column header="Stok Ketika Permintaan" headerClass="bg-opensimrs-50 font-semibold w-[150px]"
              class="w-[150px]">
              <template #body="slotProps">
                <div class="text-sm text-left">{{ slotProps.data.qtyPermintaan ??
                  slotProps.data.qtyPermintaan ?? '-' }}</div>
              </template>
            </Column>

            <Column header="Satuan/Isi" headerClass="bg-opensimrs-50 font-semibold w-[120px]" class="w-[120px]">
              <template #body="slotProps">
                <div class="text-sm text-center">{{ slotProps.data.konversi || '-' }}</div>
              </template>
            </Column>

            <Column header="Harga Dasar" headerClass="bg-opensimrs-50 font-semibold w-[150px]" class="w-[150px]">
              <template #body="slotProps">
                <div class="text-sm text-left">{{ formatPrice(slotProps.data.hargaSatuan || 0) }}</div>
              </template>
            </Column>

            <Column header="Jumlah Permintaan" headerClass="bg-opensimrs-50 font-semibold w-[150px]" class="w-[150px]">
              <template #body="slotProps">
                <div class="text-sm text-left">{{ slotProps.data.qtyPermintaan ?? '-' }}</div>
              </template>
            </Column>

            <Column header="Pengiriman" headerClass="bg-opensimrs-50 font-semibold w-[160px]" class="w-[160px]">
              <template #body="slotProps"
                v-if="DetailPayload.status === 'request' || DetailPayload.status === 'request_sebagian'">
                <CustomInputNumber :show-label="false" :modelValue="slotProps.data.qtyPengiriman ?? 0"
                  @update:modelValue="newValue => slotProps.data.qtyPengiriman = newValue" :show-buttons="true" :min="0"
                  :max="slotProps.data.qtyPermintaan" />
              </template>
              <template #body="slotProps" >
                <div class="text-sm text-center">{{ slotProps.data.qtyPengiriman ?? '-' }}</div>
              </template>
            </Column>

            <Column v-if="DetailPayload.status === 'request' || DetailPayload.status === 'request_sebagian'"
              selectionMode="multiple" headerClass="bg-opensimrs-50 w-[70px]" class="w-[70px]">
              <template #header>
                <div class="text-center">Action</div>
              </template>
            </Column>

          </DataTable>
        </div>
      </template>

      <template #footer>
        <div class="flex-shrink-0 p-4 bg-white border-t border-grey-200">
          <div v-if="DetailPayload.status === 'request' || DetailPayload.status === 'request_sebagian'"
            class="flex justify-between w-full items-center">
            <div class="flex items-center gap-5">
              <CustomButton background-color="bg-opensimrs-300 rounded-lg" @click="handleCetak">
                <div class="flex items-center gap-2">
                  <PhPrinter :size="18" color="#ffffff" weight="fill" />
                  <div class="text-sm">Cetak</div>
                </div>
              </CustomButton>
              <div>
                <p class="font-bold underline underline-offset-2 text-sm">Total Item</p>
                <p>{{ totalItem }}</p>
              </div>
              <div>
                <p class="font-bold underline underline-offset-2 text-sm">Petugas Verifikasi</p>
                <p>{{ DetailPayload.petugasVerifikasi || '-' }}</p>
              </div>
            </div>
            <div class="flex gap-3">
              <CustomButton label="Tolak Permintaan" class="w-[150px]" backgroundColor="bg-danger-300"
                borderColor="border-danger-300" textColor="text-white" @click="batalDialog = true" />
              <CustomButton label="Verifikasi" class="w-[150px]" backgroundColor="bg-opensimrs-300"
                borderColor="border-opensimrs-300" textColor="text-white" @click="handleVerify" />
            </div>
          </div>

          <div v-else-if="DetailPayload.status === 'verified' || DetailPayload.status === 'verif_sebagian'"
            class="flex justify-between w-full items-center">
            <div class="flex items-center gap-5">
              <CustomButton background-color="bg-opensimrs-300 rounded-lg" @click="handleCetak">
                <div class="flex items-center gap-2">
                  <PhPrinter :size="18" color="#ffffff" weight="fill" />
                  <div class="text-sm">Cetak</div>
                </div>
              </CustomButton>
              <div>
                <p class="font-bold underline underline-offset-2 text-sm">Total Item</p>
                <p>{{ totalItem }}</p>
              </div>
              <div>
                <p class="font-bold underline underline-offset-2 text-sm">Petugas Pengirim</p>
                <p>{{ DetailPayload.petugasKirim || '-' }}</p>
              </div>
              <CustomTextfield :showLabel="false" placeholder="Catatan Pengiriman" v-model="catatanPengiriman"
                class="w-[300px]" />
            </div>
            <div class="flex gap-3">
              <CustomButton label="Kirim Barang" class="w-[150px]" backgroundColor="bg-opensimrs-300"
                borderColor="border-opensimrs-300" textColor="text-white" @click="handleSend" />
            </div>
          </div>

          <div v-else class="flex justify-between w-full items-start">
            <div class="flex items-center gap-5">
              <CustomButton background-color="bg-opensimrs-300 rounded-lg" @click="handleCetak">
                <div class="flex items-center gap-2">
                  <PhPrinter :size="18" color="#ffffff" weight="fill" />
                  <div class="text-sm">Cetak</div>
                </div>
              </CustomButton>
              <div>
                <p class="font-bold underline underline-offset-2 text-sm">Total Item</p>
                <p>{{ totalItem }}</p>
              </div>
              <div v-if="DetailPayload.status === 'dikirim'">
                <p class="font-bold underline underline-offset-2 text-sm">Petugas Pengirim</p>
                <p>{{ DetailPayload.petugasKirim || '-' }}</p>
              </div>
              <div v-else-if="DetailPayload.status === 'cancel' || DetailPayload.status === 'ditolak'">
                <p class="font-bold underline underline-offset-2 text-sm">Petugas Verifikasi</p>
                <p>{{ DetailPayload.petugasBatalTolak || '-' }}</p>
              </div>
              <div class="text-sm max-w-xs">
                <p class="font-bold underline underline-offset-2">Catatan</p>
                <p v-if="DetailPayload.status === 'dikirim'">{{ DetailPayload.catatanPengiriman || '-' }}</p>
                <p v-else-if="DetailPayload.status === 'cancel' || DetailPayload.status === 'ditolak'">
                  {{ DetailPayload.alasanBatalTolak || '-' }}
                </p>
              </div>
            </div>
          </div>

        </div>
      </template>

    </Card>

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
