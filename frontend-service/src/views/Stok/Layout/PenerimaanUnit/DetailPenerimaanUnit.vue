<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomCheckbox from "@/components/Base/CustomCheckbox.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import PlusIcon from "@/components/icons/PlusIcon.vue";
import { useReturUnitStore } from "@/stores/stok/ReturUnit";
import { formatPrice, formatStringDate } from "@/utils/Helpers";
import { PhMinus } from "@phosphor-icons/vue";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

// Terima data dari list
const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
});

const isDeleteDialogVisible = ref(false);
const pengiriman = ref(0);
// Selection state per row (keyed by item.no)
const rowSelection = ref<Record<number, boolean>>({});

const emit = defineEmits(["back"]);

// Kontainer konten untuk mendeteksi overflow
const contentRef = ref<HTMLElement | null>(null);
const isSticky = ref(false);
let resizeObserver: ResizeObserver | null = null;

const updateSticky = () => {
  const el = contentRef.value;
  if (!el) {
    isSticky.value = false;
    return;
  }
  // Sticky aktif jika konten overflow (tinggi konten > tinggi tampilan)
  isSticky.value = el.scrollHeight - el.clientHeight > 2;
};

const tableRows = ref([
  {
    no: 1,
    namaItem: "",
    minStok: 0,
    maxStok: 0,
    stokPermintaan: 0,
    satuanIsi: "",
    hargaDasar: 0,
    jumlahPermintaan: 0,
  },
]);

onMounted(() => {
  nextTick(updateSticky);
  resizeObserver = new ResizeObserver(() => updateSticky());
  if (contentRef.value) resizeObserver.observe(contentRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect?.();
});

// Re-evaluasi saat jumlah baris berubah
watch(tableRows, () => nextTick(updateSticky), { deep: true });

watch(
  () => props.data,
  (newVal) => {
    console.log("props.data changed:", newVal);
  },
  { immediate: true, deep: true }
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
                    label: 'Penerimaan Barang',
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
                    Penerimaan Unit
                  </p>
                </div>
                <PhCaretRight
                  :size="25"
                  weight="bold"
                  class="ml-[10px] mt-[8px] text-opensimrs-300"
                />
                <div class="px-2 space-x-2">
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
            <div class="py-3">
              <div class="grid grid-cols-5 gap-6">
                <!-- Row 1 -->
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Tgl. Permintaan</div>
                  <div>
                    {{ formatStringDate(props.data.tanggalPermintaan, "date") }}
                  </div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Tgl. Verifikasi</div>
                  <div>
                    {{ formatStringDate(props.data.tanggalPermintaan, "date") }}
                  </div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Kategori Item</div>
                  <div>{{ props.data.kategoriItem }}</div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Jenis Stok</div>
                  <div>{{ props.data.jenisStokName }}</div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Jenis Item</div>
                  <div>{{ props.data.jenisItem }}</div>
                </div>
                <!-- Row 2 -->
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Asal Permintaan</div>
                  <div>{{ props.data.lokasiTujuan.name }}</div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">
                    Tujuan Permintaan
                  </div>
                  <div>{{ props.data.lokasiTujuan.name }}</div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">
                    Petugas Permintaan
                  </div>
                  <div>
                    {{
                      props.data.petugasPermintaan
                        ? props.data.petugasPermintaan
                        : "-"
                    }}
                  </div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Catatan</div>
                  <div>{{ props.data.catatan }}</div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">
                    Catatan Verifikasi
                  </div>
                  <div>{{ props.data.catatan }}</div>
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
              >
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="flex justify-center w-full font-semibold">
                    Stok Ketika Permintaan
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center w-full">
                    {{ slotProps.data.sisaStok }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="flex justify-center w-full font-semibold">
                    Permintaan
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center w-full">
                    {{ slotProps.data.jumlahPermintaan }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="flex justify-center w-full font-semibold">
                    Penerimaan
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center w-full">
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
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style lang="scss" scoped></style>
