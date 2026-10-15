<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";
import { useForm, useFieldArray } from "vee-validate";
import { useStockLocationSelectionStore } from "@/utils/StockLocationSelection";
import { usePengeluaranUnitStore } from "@/stores/stok/PengeluaranUnit";
import { useStockTypeStore } from "@/stores/datamasterFarmasi/StockType";
import { utilsStore } from "@/stores/utils";
import { useUnitStore } from "@/stores/datamasterFarmasi/Unit";
import { useReturUnitStore } from "../../../../stores/stok/ReturUnit";
import { formatDate, formatPrice } from "@/utils/Helpers";

const UseUtilsStore = utilsStore();
const emit = defineEmits(["back", "saved"]);
const isSubmitting = ref(false);

// Default kategori pertama: Medis ("obat")
const DEFAULT_KATEGORI_ITEM = "medis";
// Mapping kategori → jenis item
const KATEGORI_TO_JENIS_ITEM_MAP: Record<string, string> = {
  medis: "obat",
  "non-medis": "alkes",
};

const jenisItemSwitch = ref(false);

// Kontainer konten untuk mendeteksi overflow
const contentRef = ref<HTMLElement | null>(null);
const isSticky = ref(false);
let resizeObserver: ResizeObserver | null = null;

// Schema utama form + items (array)
const schema = toTypedSchema(
  yup.object({
    tanggalRetur: yup.date().required("Tanggal Retur harus diisi"),
    kategoriItem: yup.string().required("Kategori Item harus diisi"),
    jenisStok: yup.string().required("Jenis Stok harus diisi"),
    jenisItem: yup.string().required("Jenis Item harus diisi"),
    tujuanRetur: yup.string().required("Tujuan Retur harus diisi"),
    catatan: yup.string().required("Catatan harus diisi"),
    alasanRetur: yup.string().required("Alasan Retur harus diisi"),
    items: yup
      .array()
      .of(
        yup.object({
          selectedItemUuid: yup.string().required("Nama Item harus diisi"),
          selectedSatuanUuid: yup.string().required("Satuan harus diisi"),
          satuanName: yup.string().optional(),
          pengeluaran: yup
            .number()
            .required("Pengeluaran harus diisi")
            .moreThan(0, "Pengeluaran harus lebih dari 0"),
          hargaSatuan: yup.number().required("Harga Satuan harus diisi"),
          total: yup.number().optional(),
          // Informasi tampilan (opsional)
          namaItem: yup.string().optional(),
          stokPermintaan: yup.number().optional(),
          expDate: yup.date().optional(),
        })
      )
      .min(1, "Minimal satu item permintaan"),
  })
);

// Inisialisasi form
const { errors, handleSubmit, defineField } = useForm({
  validationSchema: schema,
  initialValues: {
    tanggalRetur: undefined,
    kategoriItem: DEFAULT_KATEGORI_ITEM,
    jenisStok: "",
    jenisItem: KATEGORI_TO_JENIS_ITEM_MAP[DEFAULT_KATEGORI_ITEM],
    tujuanRetur: "",
    catatan: "",
    alasanRetur: "",
    items: [
      {
        selectedItemUuid: "",
        namaItem: "",
        stokPermintaan: 0,
        selectedSatuanUuid: "",
        satuanName: "",
        expDate: undefined,
        pengeluaran: 0,
        hargaSatuan: 0,
        total: 0,
      },
    ],
  },
});

const [tanggalRetur] = defineField("tanggalRetur");
const [kategoriItem] = defineField("kategoriItem");
const [jenisStok] = defineField("jenisStok");
const [jenisItem] = defineField("jenisItem");
const [tujuanRetur] = defineField("tujuanRetur");
const [catatan] = defineField("catatan");
const [alasanRetur] = defineField("alasanRetur");

// Field array untuk tabel
interface ReturUnitItem {
  selectedItemUuid: string;
  namaItem: string;
  stokPermintaan: number;
  selectedSatuanUuid: string;
  satuanName: string;
  expDate: Date | undefined;
  pengeluaran: number;
  hargaSatuan: number;
  total: number;
}

const {
  remove,
  push,
  fields: fieldsRetur,
  replace,
} = useFieldArray<ReturUnitItem>("items");

const getLocalJSON = (key: string) => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const petugasName = computed(
  () => getLocalJSON("user")?.name ?? "Nama Petugas"
);

// Utils untuk data lokasi/satuan/item
const stockLocSel = useStockLocationSelectionStore();
const filteredStockLocations = computed(() => stockLocSel.filtered);

const PengeluaranUnitStore = usePengeluaranUnitStore();
const InventoryStokByLocationPayload = ref<any[]>([]);

const fetchInventoryStokByLocation = async () => {
  try {
    const response = await PengeluaranUnitStore.inventoryStokByLocation(
      stockLocSel.selectedUuid
    );
    if (response && response.payload) {
      InventoryStokByLocationPayload.value = response.payload;
    } else {
      InventoryStokByLocationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    InventoryStokByLocationPayload.value = [];
  }
};

const StockTypeStore = useStockTypeStore();
const StockTypePayload = ref<any[]>([]);

const fetchStockType = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await StockTypeStore.getApi(1, 999999999999);
    if (response && response.payload) {
      StockTypePayload.value = response.payload;
    } else {
      StockTypePayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StockTypePayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const getJenisStokName = (uuid: any) => {
  const match = StockTypePayload.value.find((s: any) => s.uuid === uuid);
  return match?.name ?? "";
};

// Util untuk menemukan item by uuid dan menerapkan ke baris
const getItemByUuid = (uuid: string) =>
  InventoryStokByLocationPayload.value.find((i: any) => i.itemUuid === uuid);

const applyItemToRow = (row: any, item: any | undefined) => {
  row.namaItem = item?.itemName ?? "";
  row.expDate = item?.expDate ? new Date(item.expDate) : undefined;
  row.selectedSatuanUuid = item?.jenisStokUuid ?? "";
  row.satuanName = item?.satuan ?? "";
  row.stokPermintaan = item?.jumlahTersedia ?? 0;
  row.hargaSatuan = item?.hargaSatuan ?? 0;
  row.total = item?.total ?? 0;
};

// Update saat item dipilih
const updateSelectedItem = (rowIndex: number) => {
  const row = fieldsRetur.value[rowIndex]?.value;
  if (!row) return;
  const item = getItemByUuid(row.selectedItemUuid);
  applyItemToRow(row, item);
};

// Opsi Jenis Item mengikuti kategori terpilih (obat/alkes)
const jenisItemOptions = computed(() => {
  const mapped = KATEGORI_TO_JENIS_ITEM_MAP[kategoriItem.value as string];
  return mapped ? [{ value: mapped }] : [];
});

const updateSticky = () => {
  const el = contentRef.value;
  if (!el) {
    isSticky.value = false;
    return;
  }
  // Sticky aktif jika konten overflow (tinggi konten > tinggi tampilan)
  isSticky.value = el.scrollHeight - el.clientHeight > 2;
};

const ReturUnitStore = useReturUnitStore();

const onSubmit = handleSubmit(async (values: any) => {
  isSubmitting.value = true;
  try {
    const items = (values.items ?? [])
      .filter(
        (r: any) =>
          r.selectedItemUuid && r.selectedSatuanUuid && (r.pengeluaran ?? 0) > 0
      )
      .map((r: any) => ({
        item_uuid: r.selectedItemUuid,
        kategori_item: values.kategoriItem,
        qty: r.pengeluaran,
        exp_date: r.expDate ? formatDate(r.expDate, true) : undefined,
        harga_satuan: r.hargaSatuan ?? 0,
        konversi_uuid: r.selectedSatuanUuid,
      }));

    const payload = {
      kategori_item: values.kategoriItem,
      jenis_stok: getJenisStokName(values.jenisStok),
      jenis_stok_uuid: values.jenisStok,
      jenis_item: values.jenisItem,
      lokasi_stok_awal_uuid: stockLocSel.selectedUuid,
      lokasi_stok_tujuan_uuid: values.tujuanRetur,
      alasan_retur: values.alasanRetur,
      catatan: values.catatan,
      items,
    };

    await ReturUnitStore.postReturUnit(payload);
    emit("saved");
    emit("back");
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    isSubmitting.value = false;
  }
});

// Opsi Jenis Stok yang difilter berdasarkan inventori yang aktif
const filteredStockTypes = computed(() => {
  const inv = Array.isArray(InventoryStokByLocationPayload.value)
    ? InventoryStokByLocationPayload.value
    : [];
  const types = Array.isArray(StockTypePayload.value)
    ? StockTypePayload.value
    : [];

  const availableTypeUuids = new Set(
    inv.map((i: any) => i?.jenisStokUuid).filter(Boolean)
  );

  return types.filter((t: any) => availableTypeUuids.has(t?.uuid));
});

// Hitung Grand Retur berbasis qty * hargaSatuan per baris
const grandRetur = computed(() =>
  fieldsRetur.value.reduce((sum, entry) => {
    const { total } = entry.value;
    return sum + (Number(total) || 0);
  }, 0)
);

const addRow = () => {
  push({
    selectedItemUuid: "",
    namaItem: "",
    stokPermintaan: 0,
    selectedSatuanUuid: "",
    satuanName: "",
    expDate: undefined,
    pengeluaran: 0,
    hargaSatuan: 0,
    total: 0,
  });
};

const resetTable = () => {
  replace([
    {
      selectedItemUuid: "",
      namaItem: "",
      stokPermintaan: 0,
      selectedSatuanUuid: "",
      satuanName: "",
      expDate: undefined,
      pengeluaran: 0,
      hargaSatuan: 0,
      total: 0,
    },
  ]);
};

onMounted(() => {
  // Ambil semua data stock type
  fetchStockType();

  // Set default kategori ke Medis jika belum ada nilai (sudah di initialValues)
  if (!kategoriItem.value) {
    kategoriItem.value = DEFAULT_KATEGORI_ITEM;
  }

  nextTick(updateSticky);
  resizeObserver = new ResizeObserver(() => updateSticky());
  if (contentRef.value) resizeObserver.observe(contentRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect?.();
});

watch(
  () => stockLocSel.selectedUuid,
  (val) => {
    if (!val) return;
    resetTable();
    fetchInventoryStokByLocation();
  },
  { immediate: true }
);

// Re-evaluasi saat jumlah baris berubah
watch(
  fieldsRetur,
  () => {
    nextTick(updateSticky);
  },
  { deep: true }
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
                  @click="resetTable"
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
                <div class="">
                  <p
                    class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]"
                  >
                    Tambah Retur
                  </p>
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
              <div class="flex gap-2">
                <div class="flex gap-2 w-full">
                  <CustomDatePicker
                    class="w-full"
                    v-model="tanggalRetur"
                    label="Tanggal Retur"
                    placeHolder="Pilih tanggal Retur"
                    :invalid="!!errors.tanggalRetur"
                    :invalidMessage="errors.tanggalRetur"
                  />
                  <CustomSelect
                    class="w-full"
                    label="Kategori Item"
                    placeHolder="Pilih Kategori Item"
                    v-model="kategoriItem"
                    :options="[
                      { label: 'Medis', value: 'medis' },
                      { label: 'Non-Medis', value: 'non-medis' },
                    ]"
                    optionLabel="label"
                    optionValue="value"
                    :invalid="!!errors.kategoriItem"
                    :invalidMessage="errors.kategoriItem"
                  />
                  <CustomSelect
                    class="w-full"
                    label="Jenis Stok"
                    v-model="jenisStok"
                    placeHolder="Pilih Jenis Stok"
                    :options="filteredStockTypes"
                    optionLabel="name"
                    optionValue="uuid"
                    :invalid="!!errors.jenisStok"
                    :invalidMessage="errors.jenisStok"
                  />
                  <CustomSelect
                    class="w-full"
                    label="Jenis Item"
                    v-model="jenisItem"
                    :placeHolder="
                      kategoriItem
                        ? 'Pilih Jenis Item'
                        : 'Silahkan isi kategori item terlebih dahulu'
                    "
                    :options="jenisItemOptions"
                    optionLabel="value"
                    optionValue="value"
                    :disabled="!kategoriItem"
                    :invalid="!!errors.jenisItem"
                    :invalidMessage="errors.jenisItem"
                  />
                </div>
              </div>
              <div class="grid grid-cols-12 gap-3 items-end">
                <div class="col-span-4">
                  <CustomSelect
                    class="w-full"
                    label="Tujuan Retur"
                    placeHolder="Pilih Tujuan Retur"
                    :options="filteredStockLocations"
                    v-model="tujuanRetur"
                    optionLabel="name"
                    optionValue="uuid"
                    dataKey="uuid"
                    :invalid="!!errors.tujuanRetur"
                    :invalidMessage="errors.tujuanRetur"
                  />
                </div>
                <div class="col-span-4">
                  <CustomSelect
                    class="w-full"
                    label="Alasan Retur"
                    v-model="alasanRetur"
                    placeHolder="Pilih Alasan Retur"
                    :options="[
                      { label: 'Rusak', value: 'rusak' },
                      { label: 'Kadaluarsa', value: 'kadaluarsa' },
                      { label: 'Salah/ingin diganti', value: 'salah' },
                      { label: 'Sisa pemakaian ruangan', value: 'sisa' },
                    ]"
                    optionLabel="label"
                    optionValue="value"
                    :invalid="!!errors.alasanRetur"
                    :invalidMessage="errors.alasanRetur"
                  />
                </div>
                <div class="col-span-3">
                  <CustomTextfield
                    class="w-full"
                    label="Catatan"
                    v-model="catatan"
                    placeholder="Catatan"
                  />
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
        <div
          ref="contentRef"
          class="flex overflow-auto flex-col flex-1 min-h-0"
        >
          <div class="flex-none">
            <DataTable
              :value="fieldsRetur"
              stripedRows
              scrollable
              class="h-full text-xs"
            >
              <!-- No -->
              <Column header="No" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-center">
                    {{ slotProps.index + 1 }}
                  </div>
                </template>
              </Column>

              <!-- Nama Item -->
              <Column
                header="Nama Item"
                headerClass="bg-opensimrs-50"
                field="namaItem"
              >
                <template #body="slotProps">
                  <CustomSelect
                    :showLabel="false"
                    class="w-full"
                    v-model="slotProps.data.value.selectedItemUuid"
                    :options="InventoryStokByLocationPayload"
                    optionLabel="itemName"
                    placeHolder="Pilih Item"
                    optionValue="itemUuid"
                    @update:modelValue="updateSelectedItem(slotProps.index)"
                    :invalid="
                      Boolean(
                        (errors as any)[`items[${slotProps.index}].selectedItemUuid`]
                      )
                    "
                    :invalidMessage="
                      (errors as any)[`items[${slotProps.index}].selectedItemUuid`]
                    "
                  />
                </template>
              </Column>

              <!-- Exp. Date -->
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div
                    class="flex justify-center items-center w-full font-semibold"
                  >
                    EXP. Date
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center w-full">
                    {{ formatDate(slotProps.data.value.expDate) || "-" }}
                  </div>
                </template>
              </Column>

              <!-- Stok -->
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div
                    class="flex justify-center items-center w-full font-semibold"
                  >
                    Stok
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center w-full">
                    {{ slotProps.data.value.stokPermintaan || 0 }}
                  </div>
                </template>
              </Column>

              <!-- Pengeluaran -->
              <Column header="pengeluaran" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <CustomInputNumber
                    :showLabel="false"
                    v-model="slotProps.data.value.pengeluaran"
                    :invalid="
                      Boolean(
                        (errors as any)[`items[${slotProps.index}].pengeluaran`]
                      )
                    "
                    :invalidMessage="
                      (errors as any)[`items[${slotProps.index}].pengeluaran`]
                    "
                  >
                  </CustomInputNumber>
                </template>
              </Column>

              <!-- Satuan/Isi -->
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div
                    class="flex justify-center items-center w-full font-semibold"
                  >
                    Satuan/Isi
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center w-full">
                    {{ slotProps.data.value.satuanName || "-" }}
                  </div>
                </template>
              </Column>

              <!-- Action -->
              <Column header="Action" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <CustomButton
                    label=""
                    background-color="bg-danger-300 rounded-lg"
                    @click="remove(slotProps.index)"
                  >
                    <PhTrash :size="18" color="#ffffff" weight="fill" />
                  </CustomButton>
                </template>
              </Column>
            </DataTable>
          </div>
          <div
            :class="[
              'mt-3 flex justify-center items-center p-5 rounded-lg border border-dashed border-opensimrs-300 flex-shrink-0',
              isSticky ? 'sticky bottom-0 bg-white' : '',
            ]"
          >
            <CustomButton
              icon="PhPlus"
              label="Tambah Item"
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
              backgroundColor="bg-white"
              @click="addRow"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between py-2 border-t border-grey-200">
          <div class="flex gap-10">
            <div>
              <div class="underline">Total Item</div>
              <div>{{ fieldsRetur.length }}</div>
            </div>
            <div>
              <div class="underline">Grand Retur</div>
              <div>{{ formatPrice(grandRetur) }}</div>
            </div>
            <div>
              <div class="underline">Petugas Retur</div>
              <div>{{ petugasName }}</div>
            </div>
          </div>
          <div class="flex gap-3">
            <CustomButton
              label="Reset"
              @click="resetTable"
              backgroundColor="bg-white"
              borderColor="border-grey-500"
              textColor="text-grey-500"
            />
            <CustomButton
              label="Simpan"
              backgroundColor="bg-opensimrs-300"
              textColor="text-white"
              @click="onSubmit"
              :disabled="isSubmitting"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style lang="scss" scoped></style>
