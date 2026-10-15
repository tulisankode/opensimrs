<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import DeleteDialog from "./DeleteDialogPermintaanBarang.vue";
import { formatStringDate } from "@/utils/Helpers";
import { formatPrice } from "../../../../utils/Helpers";

// Terima data dari list
const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  isCancelable: {
    type: Boolean,
    default: false,
  },
});

const isDeleteDialogVisible = ref(false);

// Function to show cancel dialog
const showCancelDialog = () => {
  isDeleteDialogVisible.value = true;
};

// Function to handle cancellation
const handleCancellation = (alasan: string) => {
  console.log("Permintaan dibatalkan dengan alasan:", alasan);
  // Add your cancellation logic here
  // For example: call API to cancel the request
  // Then navigate back or update the status
  emit("back");
};

const emit = defineEmits(["back"]);

watch(
  () => props.data,
  (newVal) => {
    console.log("data updated:", newVal);
    // Add any logic you need when data changes
  },
  { immediate: true }
);
</script>

<template>
  <div class="flex flex-col h-full">
    <Card
      pt:body:class="flex overflow-hidden flex-col flex-1 pt-0"
      pt:content:class="flex overflow-hidden flex-col flex-1"
      class="flex overflow-hidden flex-col h-full"
    >
      <template #header>
        <CustomAccordion :openWithHeader="false" noBorder initial-state="0">
          <template #header>
            <div class="flex justify-between w-full align-middle">
              <div class="flex">
                <CustomButton
                  icon="PhArrowClockwise"
                  @click=""
                  class="mr-5"
                  title="Refresh"
                />
                <CustomBreadCrumb
                  :home="{
                    label: 'Permintaan Barang',
                    home: true,
                  }"
                />
                <PhCaretRight
                  :size="25"
                  weight="bold"
                  class="ml-[10px] mt-[8px] text-opensimrs-300"
                />
                <div class="">
                  <p
                    class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]"
                  >
                    Permintaan Unit
                  </p>
                </div>
                <PhCaretRight
                  :size="25"
                  weight="bold"
                  class="ml-[10px] mt-[8px] text-opensimrs-300"
                />
                <div class="px-2">
                  <CustomButton :label="props.data.noPermintaan" />
                </div>
              </div>
              <CustomButton
                @click="emit('back')"
                icon="PhCaretLeft"
                label="Kembali"
                class="mr-[10px]"
              />
            </div>
          </template>
          <template #content>
            <div class="py-3 space-y-3">
              <div class="grid grid-cols-4 gap-2">
                <div class="flex flex-col">
                  <div class="text-sm font-bold underline">Tgl. Permintaan</div>
                  <div>
                    {{ formatStringDate(props.data.tanggalPermintaan, "date") }}
                  </div>
                </div>
                <div class="flex flex-col">
                  <div class="text-sm font-bold underline">Kategori Item</div>
                  <div>{{ props.data.kategoriItem }}</div>
                </div>
                <div class="flex flex-col">
                  <div class="text-sm font-bold underline">Jenis Stok</div>
                  <div>{{ props.data.jenisStokName }}</div>
                </div>
                <div class="flex flex-col">
                  <div class="text-sm font-bold underline">Jenis Item</div>
                  <div>{{ props.data.jenisItem }}</div>
                </div>
              </div>
              <div class="grid grid-cols-4 gap-2">
                <div class="flex flex-col col-start-1">
                  <div class="text-sm font-bold underline">
                    Tujuan Permintaan
                  </div>
                  <div>
                    {{
                      props.data.lokasiTujuan
                        ? props.data.lokasiTujuan?.name
                        : "Tujuan Tidak Diberikan"
                    }}
                  </div>
                </div>
                <div class="flex flex-col col-start-2">
                  <div class="text-sm font-bold underline">Catatan</div>
                  <div>{{ props.data.catatan || "-" }}</div>
                </div>
              </div>
            </div>
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
        <div class="flex overflow-auto flex-col flex-1 min-h-0">
          <div class="flex-none">
            <DataTable
              :value="props.data.items"
              stripedRows
              scrollable
              class="h-full text-xs"
            >
              <Column headerClass="bg-opensimrs-50" header="No">
                <template #body="slotProps">
                  {{ slotProps.index + 1 }}
                </template>
              </Column>
              <Column
                headerClass="bg-opensimrs-50"
                header="Nama Item"
                field="namaItem"
              />
              <Column headerClass="bg-opensimrs-50" header="" field="">
                <template #header>
                  <div class="w-full font-semibold text-center">
                    Stok Ketika Permintaan
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="w-full text-center">
                    {{ slotProps.data.sisaStok }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50" header="" field="">
                <template #header>
                  <div class="w-full font-semibold text-center">Satuan/Isi</div>
                </template>
                <template #body="slotProps">
                  <div class="w-full text-center">
                    {{ slotProps.data.satuanName }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50" header="" field="">
                <template #header>
                  <div class="pr-4 w-full font-semibold text-end">
                    Harga Dasar
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="pr-4 w-full text-end">
                    {{ formatPrice(slotProps.data.hargaDasar) }}
                  </div>
                </template>
              </Column>

              <Column headerClass="bg-opensimrs-50" header="" field="">
                <template #header>
                  <div class="w-full font-semibold text-center">
                    Jumlah Permintaan
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="w-full text-center">
                    {{ slotProps.data.jumlahPermintaan }}
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between py-2 border-t border-grey-200">
          <div class="flex gap-10">
            <div>
              <div class="underline">Total Item</div>
              <div>{{ props.data.items.length }}</div>
            </div>
            <div>
              <div class="underline">Petugas Permintaan</div>
              <div>{{ props.data.petugasPermintaan }}</div>
            </div>
          </div>
          <div class="flex gap-3">
            <CustomButton
              v-if="props.isCancelable"
              label="Batal"
              backgroundColor="bg-danger-300"
              textColor="text-white"
              @click="showCancelDialog"
            />
          </div>
        </div>
      </template>
    </Card>
    <DeleteDialog
      v-if="props.isCancelable"
      v-model:isDialogVisible="isDeleteDialogVisible"
      @cancel="handleCancellation"
      :data="props.data"
    />
  </div>
</template>

<style lang="scss" scoped></style>
