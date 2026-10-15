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
import { formatPrice } from "@/utils/Helpers";
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

const returUnitStore = useReturUnitStore();
const InventoryStokByLocationPayload = ref<any[]>([]);

const fetchInventoryStokByLocation = async () => {
  try {
    const response = await returUnitStore.inventoryStokByLocation(
      props.data.lokasiStokTujuan.uuid
    );

    InventoryStokByLocationPayload.value = response.payload;
    console.log(
      "InventoryStokByLocationPayload:",
      InventoryStokByLocationPayload.value
    );
  } catch (error) {
    console.error("Failed to fetch data", error);
    InventoryStokByLocationPayload.value = [];
  }
};

// Gabungkan items dengan payload inventory berdasarkan itemUuid (camelCase otomatis)
const returItemsDisplay = computed(() => {
  const items = Array.isArray(props.data?.items) ? props.data.items : [];
  const payload = Array.isArray(InventoryStokByLocationPayload.value)
    ? InventoryStokByLocationPayload.value
    : [];

  return items.map((it: any) => {
    const itemUuid = it?.item?.uuid ?? it.uuid;
    const match = payload.find((p: any) => p.itemUuid === itemUuid);

    return {
      ...it,
      // tampilkan "Satuan/Isi" dari payload.satuan, fallback ke yang ada atau kosong
      satuanIsi: match?.satuan ?? it?.satuanIsi ?? "",
      // tampilkan HNA & HPP dari payload
      hna: match?.hna ?? null,
      hpp: match?.hpp ?? null,
    };
  });
});

// True jika semua baris terpilih
const allSelected = computed(() => {
  return (
    Array.isArray(props.data?.items) &&
    props.data.items.length > 0 &&
    props.data.items.every((item: any) => rowSelection.value[item.no] === true)
  );
});

// Checkbox header: get mencerminkan status semua, set mengubah semua
const selectAll = computed({
  get: () => allSelected.value,
  set: (val: boolean) => {
    if (!Array.isArray(props.data?.items)) return;
    for (const item of props.data.items) {
      rowSelection.value[item.no] = !!val;
    }
  },
});

// Inisialisasi key selection saat daftar items tersedia/berubah
watch(
  () => props.data?.items,
  (items) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (rowSelection.value[item.no] === undefined) {
        rowSelection.value[item.no] = false;
      }
    }
  },
  { immediate: true }
);

// computed untuk menentukan label Jenis Item berdasarkan Kategori Item
const jenisItemLabel = computed(() => {
  const kategori = props.data.kategoriItem;
  if (!kategori) return props.data.jenisItem ?? "-";
  return kategori.toLowerCase() === "medis" ? "obat" : "alkes";
});

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

onMounted(() => {
  fetchInventoryStokByLocation();
});
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
                    label: 'Pengeluaran Barang',
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
                    Retur Unit
                  </p>
                </div>
                <PhCaretRight
                  :size="25"
                  weight="bold"
                  class="ml-[10px] mt-[8px] text-opensimrs-300"
                />
                <div class="px-2 space-x-2">
                  <CustomButton :label="props.data.noRetur" />
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
              <div class="grid grid-cols-4 gap-6">
                <!-- Row 1 -->
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Tgl. Permintaan</div>
                  <div>{{ props.data.tanggalRetur }}</div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Kategori Item</div>
                  <div>{{ props.data.kategoriItem }}</div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Jenis Stok</div>
                  <div>{{ props.data.jenisStok }}</div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Jenis Item</div>
                  <div>{{ jenisItemLabel }}</div>
                </div>
                <!-- Row 2 -->
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Tujuan Retur</div>
                  <div>{{ props.data.lokasiStokTujuan.name }}</div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Alasan Retur</div>
                  <div>
                    {{ props.data.alasanRetur ? props.data.alasanRetur : "-" }}
                  </div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Petugas Retur</div>
                  <div>
                    {{
                      props.data.petugasRetur ? props.data.petugasRetur : "-"
                    }}
                  </div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Catatan</div>
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
              :value="returItemsDisplay"
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
                field="item.name"
              >
              </Column>
              <Column
                headerClass="bg-opensimrs-50"
                header="EXP. Date"
                field="expDate"
              />
              <Column
                headerClass="bg-opensimrs-50"
                header="Pengeluaran"
                field="qty"
              />
              <Column
                headerClass="bg-opensimrs-50"
                header="Satuan/Isi"
                field="satuanIsi"
              >
              </Column>
              <Column headerClass="bg-opensimrs-50" header="HNA" field="hna">
                <template #body="slotProps">
                  {{ formatPrice(slotProps.data.hna) }}
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50" header="HPP" field="hpp">
                <template #body="slotProps">
                  {{ formatPrice(slotProps.data.hpp) }}
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50" header="Total">
                <template #body>
                  {{ formatPrice(props.data.totalHarga) }}
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
              <div>{{ props.data.totalItem }}</div>
            </div>
          </div>
        </div>
      </template>
    </Card>
    <DeleteDialogPengirimanUnit
      v-model:isDialogVisible="isDeleteDialogVisible"
      @cancel="handleCancellation"
    />
  </div>
</template>

<style lang="scss" scoped></style>
