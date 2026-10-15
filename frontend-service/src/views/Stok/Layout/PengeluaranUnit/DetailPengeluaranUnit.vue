<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { usePengeluaranUnitStore } from "@/stores/stok/PengeluaranUnit";
import { utilsStore } from "@/stores/utils";
import { formatPrice, formatStringDate } from "@/utils/Helpers";
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

const useUtilsStore = utilsStore();

const PengeluaranUnitStore = usePengeluaranUnitStore();
const pengeluaranUnitDetailPayload = ref<any>({});

// Pilih UUID lokasi berdasarkan jenisPengeluaran
const selectedLokasiUuid = computed(() => {
  const payload = pengeluaranUnitDetailPayload.value;
  const jenis = payload?.jenisPengeluaran;

  return jenis === "pengeluaran tanpa permintaan"
    ? payload?.lokasiStokAkhir?.uuid
    : payload?.lokasiStokAwal?.uuid;
});

const fetchPengeluaranUnitDetail = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await PengeluaranUnitStore.getPengeluaranUnitDetail(
      props.data.uuid
    );
    console.log("response:", response);
    pengeluaranUnitDetailPayload.value = response.payload;
    console.log(
      "pengeluaranUnitDetailPayload:",
      pengeluaranUnitDetailPayload.value
    );
  } catch (error) {
    console.error("Error fetching pengeluaran unit:", error);
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const InventoryStokByLocationPayload = ref<any[]>([]);

const fetchInventoryStokByLocation = async () => {
  try {
    const response = await PengeluaranUnitStore.inventoryStokByLocation(
      selectedLokasiUuid.value
    );

    if (response && response.payload) {
      InventoryStokByLocationPayload.value = response.payload;
      console.log(
        "InventoryStokByLocationPayload:",
        InventoryStokByLocationPayload.value
      );
    } else {
      InventoryStokByLocationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    InventoryStokByLocationPayload.value = [];
  }
};

const pengeluaranItemsDisplay = computed(() => {
  const items = Array.isArray(pengeluaranUnitDetailPayload.value?.items)
    ? pengeluaranUnitDetailPayload.value.items
    : [];
  const payload = Array.isArray(InventoryStokByLocationPayload.value)
    ? InventoryStokByLocationPayload.value
    : [];

  return items.map((it: any) => {
    const itemUuid = it?.item?.uuid ?? it.uuid;
    const match = payload.find((p: any) => p.itemUuid === itemUuid);

    return {
      ...it,
      // Satuan/Isi dari payload inventori, fallback ke field item jika ada
      satuanIsi: match?.satuan ?? it?.satuan ?? "",
      // HNA & HPP dari inventori, fallback ke hargaSatuan detail dan 0
      hna: match?.hna ?? it?.hargaSatuan ?? 0,
      hpp: match?.hpp ?? 0,
      total: match?.total ?? 0,
    };
  });
});

const grandTotal = computed(() =>
  pengeluaranItemsDisplay.value.reduce(
    (sum: number, it: any) => sum + (Number(it.total) || 0),
    0
  )
);

// computed untuk menentukan label Jenis Item berdasarkan Kategori Item
const jenisItemLabel = computed(() => {
  const kategori = pengeluaranUnitDetailPayload.value.kategoriItem;
  if (!kategori) return pengeluaranUnitDetailPayload.value.jenisItem ?? "-";
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

onMounted(async () => {
  await fetchPengeluaranUnitDetail();
  await fetchInventoryStokByLocation();
});

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
                    Pengeluaran Unit
                  </p>
                </div>
                <PhCaretRight
                  :size="25"
                  weight="bold"
                  class="ml-[10px] mt-[8px] text-opensimrs-300"
                />
                <div class="px-2">
                  <CustomButton :label="props.data.noPengeluaran" />
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
                  <div class="text-sm font-bold underline">Jenis Pengeluaran</div>
                  <div>{{ pengeluaranUnitDetailPayload.jenisPengeluaran }}</div>
                </div>
                <div class="flex flex-col">
                  <div class="text-sm font-bold underline">Tgl. Pengeluaran</div>
                  <div>
                    {{
                      pengeluaranUnitDetailPayload.tanggalPengeluaran
                        ? formatStringDate(
                            pengeluaranUnitDetailPayload.tanggalPengeluaran,
                            "date"
                          )
                        : "-"
                    }}
                  </div>
                </div>
                <div class="flex flex-col">
                  <div class="text-sm font-bold underline">Kategori Item</div>
                  <div>{{ pengeluaranUnitDetailPayload.kategoriItem }}</div>
                </div>
                <div class="flex flex-col">
                  <div class="text-sm font-bold underline">Jenis Stok</div>
                  <div>
                    {{ pengeluaranUnitDetailPayload?.jenisStok?.name ?? "-" }}
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-4 gap-2">
                <div class="flex flex-col col-start-1">
                  <div class="text-sm font-bold underline">Jenis Item</div>
                  <div>{{ jenisItemLabel }}</div>
                </div>
                <div
                  v-if="
                    pengeluaranUnitDetailPayload.jenisPengeluaran !==
                      'pemakaian unit' &&
                    pengeluaranUnitDetailPayload.jenisPengeluaran !==
                      'pemusnahan barang'
                  "
                  class="flex flex-col col-start-2"
                >
                  <div class="text-sm font-bold underline">Tujuan Pengeluaran</div>
                  <div>
                    {{ pengeluaranUnitDetailPayload?.lokasiStokAkhir?.name ?? "-" }}
                  </div>
                </div>
                <div
                  v-if="
                    pengeluaranUnitDetailPayload.jenisPengeluaran ===
                    'pemusnahan barang'
                  "
                  class="flex flex-col col-start-2"
                >
                  <div class="text-sm font-bold underline">Jenis Pemusnahan</div>
                  <div>{{ pengeluaranUnitDetailPayload.jenisPemusnahan }}</div>
                </div>
                <div
                  class="flex flex-col"
                  :class="pengeluaranUnitDetailPayload.jenisPengeluaran === 'pemakaian unit' ? 'col-start-2' : 'col-start-3'"
                >
                  <div class="text-sm font-bold underline">Petugas Pengeluaran</div>
                  <div>{{ pengeluaranUnitDetailPayload.petugasPengeluaran }}</div>
                </div>
                <div
                  class="flex flex-col"
                  :class="pengeluaranUnitDetailPayload.jenisPengeluaran === 'pemakaian unit' ? 'col-start-3' : 'col-start-4'"
                >
                  <div class="text-sm font-bold underline">Catatan</div>
                  <div>
                    {{
                      pengeluaranUnitDetailPayload.catatan
                        ? pengeluaranUnitDetailPayload.catatan
                        : "-"
                    }}
                  </div>
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
              :value="pengeluaranItemsDisplay"
              stripedRows
              scrollable
              class="h-full text-xs"
            >
              <Column headerClass="bg-opensimrs-50">
                <template #header>No.</template>
                <template #body="slotProps">
                  {{ slotProps.index + 1 }}
                </template>
              </Column>
              <Column
                headerClass="bg-opensimrs-50"
                header="Nama Item"
                field="item.name"
              />
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold text-center">EXP. Date</div>
                </template>
                <template #body="slotProps">
                  <div class="w-full text-center">
                    {{ slotProps.data.expDate }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold text-center">
                    Pengeluaran
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="w-full text-center">
                    {{ slotProps.data.qty }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold text-center">Satuan/Isi</div>
                </template>
                <template #body="slotProps">
                  <div class="w-full text-center">
                    {{ slotProps.data.satuanIsi }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold text-end">HNA</div>
                </template>
                <template #body="slotProps">
                  <div class="w-full text-end">
                    {{ formatPrice(slotProps.data.hna) }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold text-end">HPP</div>
                </template>
                <template #body="slotProps">
                  <div class="w-full text-end">
                    {{ formatPrice(slotProps.data.hpp) }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold text-end">Total</div>
                </template>
                <template #body="slotProps">
                  <div class="w-full text-end">
                    {{ formatPrice(slotProps.data.total) }}
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
      <template #footer>
        <div
          class="flex justify-between items-center py-2 border-t border-grey-200"
        >
          <div class="flex gap-8">
            <CustomButton icon="PhPrinter" label="Cetak"></CustomButton>
            <div>
              <div class="underline">Total Item</div>
              <div>{{ props.data.items.length }}</div>
            </div>
            <div>
              <div class="underline">Grand Total</div>
              <div>
                {{ formatPrice(grandTotal) }}
              </div>
            </div>
          </div>
          <div class="flex gap-3"></div>
        </div>
      </template>
    </Card>
    <DeleteDialog
      v-model:isDialogVisible="isDeleteDialogVisible"
      @cancel="handleCancellation"
    />
  </div>
</template>

<style lang="scss" scoped></style>
