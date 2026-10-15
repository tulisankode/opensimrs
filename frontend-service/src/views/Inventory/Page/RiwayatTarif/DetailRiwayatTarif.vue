<script lang="ts" setup>
// Import yang dibutuhkan untuk data dinamis
import { useRateHistoryStore } from "@/stores/inventory/rateHistory";
import { utilsStore } from "@/stores/utils";
import { epochToDate, formatPrice } from "@/utils/Helpers";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import Card from "primevue/card";
import { onMounted, ref, type PropType } from "vue";

// Props sekarang menerima UUID, bukan seluruh objek data
const props = defineProps({
  selectedDataUuid: {
    type: String,
    required: true,
  },
  selectedItemName: {
    type: String,
    default: "-",
  },
});

const emit = defineEmits(["kembali"]);

//  State untuk menampung data dari API
const detailData = ref<any>({}); // Menggunakan nama yang sama dengan yang ada di template

//  State Management
const RateHistoryStore = useRateHistoryStore();
const UseUtilsStore = utilsStore();

//  Fungsi untuk mengambil data detail dari API
const fetchDetail = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await RateHistoryStore.getApiDetail(props.selectedDataUuid);
    detailData.value = response?.payload || {};
  } catch (error) {
    console.error("Gagal mengambil detail riwayat tarif:", error);
    detailData.value = {}; // Pastikan tetap objek kosong jika error
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// onMounted sekarang memanggil fungsi fetch, bukan membuat data statis
onMounted(() => {
  fetchDetail();
});
</script>

<template>
  <Card pt:body:class="h-full pt-0" class="h-full overflow-hidden overflow-y-auto">
    <template #header>
      <CustomAccordion :openWithHeader="false" noBorder initialState="0">
        <template #header>
          <div class="flex items-center justify-between w-full align-middle">
            <div class="flex items-center">
              <CustomButton icon="PhArrowClockwise" class="mr-5" @click="fetchDetail" />
              <CustomBreadCrumb :home="{
                label: 'Riwayat Tarif',
                home: true,
              }" :model="[
                {
                  label: selectedItemName,
                },
              ]">
              </CustomBreadCrumb>
            </div>
            <CustomButton @click="emit('kembali')" icon="PhCaretLeft" label="Kembali" class="mr-[10px]" outlined
              borderColor="border-opensimrs-300" textColor="text-opensimrs-300" />
          </div>
        </template>
        <template #content>
          <div class="flex flex-col gap-2.5 pt-2.5">
            <div class="flex gap-5">
              <div class="grid grid-rows-2">
                <div class="grid grid-cols-2">
                  <div>
                    <div class="font-semibold underline text-SM">Kode Item</div>
                    <div class="font-normal text-normal">
                      {{ detailData?.kodeItem || '-' }}
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-2">
                  <div>
                    <div class="font-semibold underline text-SM">Pabrik</div>
                    <div class="font-normal text-normal">
                      {{ detailData?.pabrik || '-' }}
                    </div>
                  </div>
                </div>
              </div>
              <hr class="h-auto border-[0.5px] w-px border-opensimrs-300" />
              <div class="grid grid-cols-2 grow">
                <div>
                  <div class="font-semibold underline text-SM">Kategori</div>
                  <div class="font-normal text-normal">
                    {{ detailData?.kategoriItem || '-' }}
                  </div>
                </div>
                <div>
                  <div class="font-semibold underline text-SM">Jenis Stok</div>
                  <div class="font-normal text-normal">
                    {{ detailData?.jenisStok || '-' }}
                  </div>
                </div>
                <div>
                  <div class="font-semibold underline text-SM">Jenis Item</div>
                  <div class="font-normal text-normal">
                    {{ detailData?.jenisItem || '-' }}
                  </div>
                </div>
                <div>
                  <div class="font-semibold underline text-SM">
                    Satuan Penggunaan
                  </div>
                  <div class="font-normal text-normal">
                    {{ detailData?.satuanPenggunaan || '-' }}
                  </div>
                </div>
              </div>
              <hr class="h-auto border-[0.5px] w-px border-opensimrs-300" />
              <div class="grid grid-rows-2 min-w-[400px]">
                <div class="grid grid-cols-2">
                  <div>
                    <div class="font-semibold underline text-SM">
                      Harga Dasar
                    </div>
                    <div class="font-normal text-normal">
                      Rp. {{ detailData?.hargaDasar || '-' }}
                    </div>
                  </div>
                  <div>
                    <div class="font-semibold underline text-SM">HNA</div>
                    <div class="font-normal text-normal">
                      Rp. {{ detailData?.hna|| '-' }}
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-2">
                  <div>
                    <div class="font-semibold underline text-SM">HJA</div>
                    <div class="font-normal text-normal">
                      Rp. {{ detailData?.hja || '-' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <hr class="border-grey-200" />
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
    <template #content>
      <CustomAccordion :openWithHeader="false" noBorder initialState="0" header-class="-mt-4">
        <template #header>
          <div class="-mx-4">Konversi Satuan</div>
        </template>
        <template #content>
          <DataTable :value="detailData.conversions" tableStyle="min-width: 50rem" scrollable class="-mx-[18px]"
            scrollHeight="240px" :pt="{ headerRow: 'text-SM' }">
            <Column field="jenisSatuan" headerClass="bg-opensimrs-50">
              <template #header>
                <div class="font-semibold">Jenis Satuan</div>
              </template>
              <template #body="slotProps">
                <div>
                  <div class="text-SM">
                    {{ slotProps.data.satuanPembelian || '-' }}
                  </div>
                </div>
              </template>
            </Column>
            <Column field="satuan" headerClass="bg-opensimrs-50">
              <template #header>
                <div class="font-semibold">Satuan</div>
              </template>
              <template #body="slotProps">
                <div>
                  <div class="text-SM">
                    {{ slotProps.data.satuanPenggunaan || '-' }}
                  </div>
                </div>
              </template>
            </Column>
            <Column field="konversiIsi" headerClass="bg-opensimrs-50">
              <template #header>
                <div class="font-semibold">Konversi Isi</div>
              </template>
              <template #body="slotProps">
                <div>
                  <div class="text-SM">
                    {{ slotProps.data.konversi || '-' }} Pcs
                  </div>
                </div>
              </template>
            </Column>
          </DataTable>
        </template>
        <template #collapseIcon>
          <CustomButton icon="PhCaretUp" backgroundColor="bg-white" textColor="text-opensimrs-300" />
        </template>
        <template #expandIcon>
          <CustomButton icon="PhCaretDown" backgroundColor="bg-white" textColor="text-opensimrs-300" />
        </template>
      </CustomAccordion>
      <CustomAccordion :openWithHeader="false" noBorder initialState="0" header-class="-mt-4">
        <template #header>
          <div class="-mx-4">Riwayat Penerimaan Pembelian</div>
        </template>
        <template #content>
          <DataTable :value="detailData.purchaseHistory" tableStyle="min-width: 60rem" scrollable class="-mx-[18px]"
            scrollHeight="380px" :pt="{ headerRow: 'text-SM' }">
            <Column field="tanggal" headerClass="bg-opensimrs-50">
              <template #header>
                <div class="font-semibold">Tanggal</div>
              </template>
              <template #body="slotProps">
                <div>
                  <div class="text-SM">
                    {{ epochToDate(slotProps.data.tanggal || '-', "date") }}
                  </div>
                </div>
              </template>
            </Column>
            <Column field="expDate" headerClass="bg-opensimrs-50">
              <template #header>
                <div class="font-semibold">No.Po</div>
              </template>
              <template #body="slotProps">
                <div>
                  <div class="text-SM">
                    {{ slotProps.data.noPo || '-' }}
                  </div>
                </div>
              </template>
            </Column>
            <Column field="expDate" headerClass="bg-opensimrs-50"">
              <template #header>
                <div class="font-semibold">Exp Date</div>
              </template>
              <template #body="slotProps">
                <div>
                  <div class="text-SM">
                    {{ epochToDate(slotProps.data.expDate || '-', "date") }}
                  </div>
                </div>
              </template>
            </Column>
            <Column field="hargaDasar" headerClass="bg-opensimrs-50">
              <template #header>
                <div class="font-semibold">Harga Dasar</div>
              </template>
              <template #body="slotProps">
                <div>
                  <div class="text-SM">Rp. {{ slotProps.data.hargaDasar || '-' }}</div>
                </div>
              </template>
            </Column>
            <Column field="HNA" headerClass="bg-opensimrs-50">
              <template #header>
                <div class="font-semibold">HNA</div>
              </template>
              <template #body="slotProps">
                <div>
                  <div class="text-SM">Rp. {{ slotProps.data.hna || '-' }}</div>
                </div>
              </template>
            </Column>
            <Column field="HPP" headerClass="bg-opensimrs-50">
              <template #header>
                <div class="font-semibold">HJA</div>
              </template>
              <template #body="slotProps">
                <div>
                  <div class="text-SM">Rp. {{ slotProps.data.hja || '-' }}</div>
                </div>
              </template>
            </Column>
          </DataTable>
        </template>
        <template #collapseIcon>
          <CustomButton icon="PhCaretUp" backgroundColor="bg-white" textColor="text-opensimrs-300" />
        </template>
        <template #expandIcon>
          <CustomButton icon="PhCaretDown" backgroundColor="bg-white" textColor="text-opensimrs-300" />
        </template>
      </CustomAccordion>
    </template>
  </Card>
</template>
