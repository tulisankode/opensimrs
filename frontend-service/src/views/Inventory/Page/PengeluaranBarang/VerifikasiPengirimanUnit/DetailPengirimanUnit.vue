<script lang="ts" setup>
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import LayoutDialog from "@/views/Inventory/Layout/LayoutDialog.vue";
import type { MenuItem } from "primevue/menuitem";
import { ref, type PropType } from "vue";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  detailPengirimanData: {
    type: Object,
  },
});

const emit = defineEmits([
  "kembali",
  "penolakan",
  "verifikasiPengiriman",
  "kirimBarang",
]);

const selectedPengirimanData = ref([]);

const isDialogVisible = ref(false);
const dialogConfig = ref({
  title: "",
  labelTextField: "",
  buttonFooterLeft: "",
  buttonFooterRight: "",
  message: "",
  spanMessage: "",
  extendedMessage: "",
});

const handleDialog = (
  title: string,
  labelTextField: string,
  buttonFooterLeft: string,
  buttonFooterRight: string,
  message: string,
  spanMessage: string,
  extendedMessage: string
) => {
  dialogConfig.value = {
    title,
    labelTextField,
    buttonFooterLeft,
    buttonFooterRight,
    message,
    spanMessage,
    extendedMessage,
  };
  console.log(dialogConfig.value);
  isDialogVisible.value = true;
};

const handleReject = (reason: string) => {
  // Update the status to DIBATALKAN and set the reason
  if (props.detailPengirimanData) {
    props.detailPengirimanData.status = "DITOLAK";
    props.detailPengirimanData.alasan = reason;

    emit("penolakan", props.detailPengirimanData);
  }
};

const verifikasiPengiriman = () => {
  // Emit event ke parent component dengan data yang dipilih
  emit("verifikasiPengiriman", selectedPengirimanData.value);
};

const catatanPengiriman = ref("");

const kirimBarang = () => {
  emit("kirimBarang", props.detailPengirimanData, catatanPengiriman.value);
};
</script>

<template>
  <!-- {{ detailPengirimanData }} -->
  <Card pt:body:class="h-full pt-0" pt:content:class="h-full">
    <template #header>
      <CustomAccordion :openWithHeader="false" noBorder initialState="0">
        <template #header>
          <div class="flex items-center justify-between w-full align-middle">
            <div class="flex items-center">
              <CustomButton icon="PhArrowClockwise" class="mr-5" />
              <CustomBreadCrumb
                :home="{
                  label: 'Pengadaan Barang',
                  home: true,
                }"
                :model="[
                  {
                    label: 'Verifikasi Pembelian Barang Supplier',
                  },
                  {
                    noPengeluaran: detailPengirimanData?.noPengeluaran,
                  },
                ]"
              >
                <template #customItem="{ item }">
                  <div class="flex">
                    <div
                      v-if="item.noPengeluaran"
                      class="rounded-lg bg-opensimrs-300 px-[10px] text-white mr-[10px]"
                    >
                      {{ item.noPengeluaran }}
                    </div>
                    <span
                      :class="{
                        'text-opensimrs-300': item.home,
                        'text-grey-400': !item.home,
                      }"
                    >
                      {{ item.label }}
                    </span>
                  </div>
                </template>
              </CustomBreadCrumb>
              <CustomChip
                :showCheckedIcon="false"
                :label="detailPengirimanData?.status"
                :bgColor="
                  detailPengirimanData?.status === 'DIVERIFIKASI'
                    ? 'bg-aqua-300'
                    : detailPengirimanData?.status === 'DIKIRIM'
                    ? 'bg-mint-300'
                    : 'bg-grey-300'
                "
                textColor="text-white"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
            </div>
            <CustomButton
              @click="emit('kembali')"
              icon="PhCaretLeft"
              label="Kembali"
              class="mr-[10px]"
              outlined
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
            />
          </div>
        </template>
        <template #content>
          <div class="grid grid-rows-2 gap-2.5 pt-2.5">
            <div class="grid grid-cols-5 gap-2.5">
              <div>
                <div class="font-semibold underline text-SM">
                  Tgl. Permintaan
                </div>
                <div class="font-normal text-normal">
                  {{ detailPengirimanData?.tglPermintaan }}
                </div>
              </div>
              <div>
                <div class="font-semibold underline text-SM">Kategori Item</div>
                <div class="font-normal text-normal">
                  {{ detailPengirimanData?.kategori }}
                </div>
              </div>
              <div>
                <div class="font-semibold underline text-SM">Jenis Stok</div>
                <div class="font-normal text-normal">
                  {{ detailPengirimanData?.jenisStok }}
                </div>
              </div>
              <div>
                <div class="font-semibold underline text-SM">Jenis Item</div>
                <div class="font-normal text-normal">
                  {{ detailPengirimanData?.jenisItem }}
                </div>
              </div>
            </div>
            <div class="grid grid-cols-5 gap-2.5">
              <div>
                <div class="font-semibold underline text-SM">
                  Tujuan Permintaan
                </div>
                <div class="font-normal text-normal">
                  {{ detailPengirimanData?.tujuanPermintaan }}
                </div>
              </div>
              <div>
                <div class="font-semibold underline text-SM">Cito</div>
                <CustomChip
                  :showCheckedIcon="false"
                  :label="
                    detailPengirimanData?.isCito
                      ? 'CITO'
                      : detailPengirimanData?.isCito
                  "
                  bgColor="bg-danger-300"
                  textColor="text-white"
                  customClass="h-5 pr-[6px] border-none mr-[5px]"
                />
              </div>

              <div>
                <div class="font-semibold underline text-SM">
                  Petugas Verifikasi
                </div>
                <div class="font-normal text-normal">
                  {{ detailPengirimanData?.petugasVerifikasi }}
                </div>
              </div>
              <div>
                <div class="font-semibold underline text-SM">Catatan</div>
                <div class="font-normal text-normal">
                  {{ detailPengirimanData?.catatan }}
                </div>
              </div>
            </div>
          </div>
          <hr class="mt-2.5 border-grey-200" />
        </template>
        <template #collapseIcon>
          <CustomButton
            icon="PhCaretUp"
            backgroundColor="bg-opensimrs-75"
            textColor="text-opensimrs-300"
          />
        </template>
        <template #expandIcon>
          <CustomButton
            icon="PhCaretDown"
            backgroundColor="bg-opensimrs-75"
            textColor="text-opensimrs-300"
          />
        </template>
      </CustomAccordion>
    </template>
    <template #content>
      <DataTable
        :value="detailPengirimanData?.datas"
        v-model:selection="selectedPengirimanData"
        tableStyle="min-width: 50rem"
        scrollable
        scrollHeight="240px"
        :pt="{ headerRow: 'text-SM' }"
      >
        <Column headerClass="bg-opensimrs-50">
          <template #header>
            <div class="font-semibold text-SM">No.</div>
          </template>
          <template #body="slotProps">
            <div class="w-full text-center text-SM">
              {{ slotProps.index + 1 }}
            </div>
          </template>
        </Column>
        <Column
          header="Nama Item"
          headerClass="bg-opensimrs-50 text-SM"
          class="w-1/2"
        >
          <template #body="slotProps">
            <div class="text-SM">{{ slotProps.data.namaItems }}</div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50 text-SM" class="min-w-[120px]">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">Min Stok</div>
          </template>
          <template #body="slotProps">
            <div class="text-center text-SM">
              {{ slotProps.data.minStok }}
            </div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50 text-SM" class="min-w-[120px]">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">Max Stok</div>
          </template>
          <template #body="slotProps">
            <div class="text-center text-SM">
              {{ slotProps.data.maxStok }}
            </div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50" class="min-w-[120px]">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">
              Stok Ketika Permintaan
            </div>
          </template>
          <template #body="slotProps">
            <div class="text-center text-SM">
              {{ slotProps.data.stokKetikaPermintaan }}
            </div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50 text-SM" class="min-w-[120px]">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">
              Satuan/Isi
            </div>
          </template>
          <template #body="slotProps">
            <div class="text-center text-SM">
              {{ slotProps.data.satuan }}
            </div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50 text-SM" class="min-w-[120px]">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">
              Jumlah Permintaan
            </div>
          </template>
          <template #body="slotProps">
            <div class="text-center text-SM">
              {{ slotProps.data.jumlahPermintaan }} Box
            </div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50" class="min-w-[150px]">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">
              Pengiriman
            </div>
          </template>
          <template #body="slotProps">
            <CustomInputNumber
              v-if="detailPengirimanData?.status == 'PENGAJUAN'"
              :show-label="false"
              v-model="slotProps.data.pengiriman"
              :show-buttons="true"
              disabled
            />
            <div class="text-center text-SM" v-else>
              {{ slotProps.data.pengiriman }}
            </div>
          </template>
        </Column>

        <Column
          v-if="detailPengirimanData?.status == 'PENGAJUAN'"
          header="Action"
          body-class="text-center"
          selectionMode="multiple"
          headerStyle="width: 3rem"
          headerClass="bg-opensimrs-50"
          class="custom-checkbox"
        >
          <!-- <template #header>
            <div class="w-full font-semibold text-center text-SM">Action</div>
          </template> -->
        </Column>
      </DataTable>
      <LayoutDialog
        v-model:isDialogVisible="isDialogVisible"
        :buttonFooterLeft="dialogConfig.buttonFooterLeft"
        :buttonFooterRight="dialogConfig.buttonFooterRight"
        :labelTextField="dialogConfig.labelTextField"
        :message="dialogConfig.message"
        :spanMessage="dialogConfig.spanMessage"
        :title="dialogConfig.title"
        :extendedMessage="dialogConfig.extendedMessage"
        @reject="handleReject"
      />
    </template>
    <template #footer>
      <hr class="my-4 border-grey-200" />
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-6">
          <CustomButton
            label="Cetak"
            class="my-auto bg-opensimrs-300"
            icon="PhPrinter"
          />
          <div>
            <div class="font-semibold underline text-SM">Total Item</div>
            <div class="font-normal text-normal">
              {{ detailPengirimanData?.datas.length }} item
            </div>
          </div>
          <div>
            <div class="font-semibold underline text-SM">
              {{
                detailPengirimanData?.status === "PENGAJUAN"
                  ? "Petugas Verifikasi"
                  : "Petugas Kirim Barang"
              }}
            </div>
            <div class="font-normal text-normal">
              {{ detailPengirimanData?.petugasVerifikasi }}
            </div>
          </div>
          <CustomTextfield
            v-if="detailPengirimanData?.status == 'DIVERIFIKASI'"
            label=""
            v-model:model-value="catatanPengiriman"
            placeholder="Catatan Pengiriman"
            class="w-[300px]"
          />
          <div  v-else-if="detailPengirimanData?.status == 'DIKIRIM'">
            <div class="font-semibold underline text-SM">Catatan</div>
            <div class="font-normal text-normal">
              {{ detailPengirimanData?.catatanPengiriman}}
            </div>
          </div>
        </div>
        <div
          class="flex gap-3"
          v-if="detailPengirimanData?.status == 'PENGAJUAN'"
        >
          <CustomButton
            label="Tolak Permintaan"
            class="my-auto bg-danger-300"
            @click="
              handleDialog(
                'Tolak Permintaan',
                'Alasan Tolak Permintaan',
                'Tidak',
                'Iya, Tolak',
                '*Setelah menolak, riwayat permintaan akan masuk ke tab menu',
                'DITOLAK, ',
                'dan item akan kembali ke stok sebelumnya'
              )
            "
          />
          <CustomButton
            label="Verifikasi"
            class="my-auto bg-opensimrs-300"
            @click="verifikasiPengiriman"
          />
        </div>
        <div
          class="flex gap-3"
          v-else-if="detailPengirimanData?.status == 'DIVERIFIKASI'"
        >
          <CustomButton
            label="Kirim Barang"
            class="my-auto bg-opensimrs-300"
            @click="kirimBarang"
          />
        </div>
      </div>
    </template>
  </Card>
</template>

<style>
.custom-checkbox .p-checkbox-checked .p-checkbox-box {
  @apply border-opensimrs-300 bg-opensimrs-300; /* Kelas Tailwind untuk border dan warna latar */
}

.custom-checkbox .p-checkbox-checked .p-checkbox-box .p-checkbox-icon {
  @apply text-white; /* Kelas Tailwind untuk warna tanda centang */
}
</style>
