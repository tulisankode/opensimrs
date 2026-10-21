<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import TambahItemMultiple from "../../../../components/Stok/TambahItemMultiple.vue";
import { utilsStore } from "@/stores/utils";
import { useStockTypeStore } from "@/stores/datamasterFarmasi/StockType";
import { useStockLocationSelectionStore } from "@/utils/StockLocationSelection";
import { usePengeluaranUnitStore } from "@/stores/stok/PengeluaranUnit";
import { useUnitStore } from "@/stores/datamasterFarmasi/Unit";
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
import { formatPrice } from "../../../../utils/Helpers";
import { PhTrash } from "@phosphor-icons/vue";

// Emit
const emit = defineEmits(["back", "saved"]);

const UseUtilsStore = utilsStore();
const isSubmitting = ref(false);
const showTambahItemMultiple = ref(false);

// Default nilai dan mapping
const DEFAULT_KATEGORI_ITEM = "medis";
const DEFAULT_JENIS_PENGELUARAN = "pemakaian unit";
const KATEGORI_TO_JENIS_ITEM_MAP: Record<string, string> = {
  medis: "obat",
  "non-medis": "alkes",
};

// Kontainer konten untuk mendeteksi overflow
const contentRef = ref<HTMLElement | null>(null);
const isSticky = ref(false);
let resizeObserver: ResizeObserver | null = null;

// Helper: ambil nama user dari localStorage
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

// Store untuk master data
const StockTypeStore = useStockTypeStore();
const StockTypePayload = ref<any[]>([]);
const fetchStockType = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await StockTypeStore.getApi(1, 999999999999);
    StockTypePayload.value = response?.payload ?? [];
  } catch (error) {
    console.error("Failed to fetch data", error);
    StockTypePayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const SatuanStore = useUnitStore();
const SatuanPayload = ref<any[]>([]);
const fetchSatuan = async () => {
  try {
    const response = await SatuanStore.getApi(1, 999999999999);
    SatuanPayload.value = response?.payload ?? [];
  } catch (error) {
    console.error("Failed to fetch unit", error);
    SatuanPayload.value = [];
  }
};

// Store untuk inventori berdasarkan lokasi
const stockLocSel = useStockLocationSelectionStore();
const PengeluaranUnitStore = usePengeluaranUnitStore();
const InventoryStokByLocationPayload = ref<any[]>([]);
const fetchInventoryStokByLocation = async () => {
  try {
    const response = await PengeluaranUnitStore.inventoryStokByLocation(
      stockLocSel.selectedUuid
    );
    InventoryStokByLocationPayload.value = response?.payload ?? [];
  } catch (error) {
    console.error("Failed to fetch data", error);
    InventoryStokByLocationPayload.value = [];
  }
};

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

// Schema utama form + items array (mengikuti pola TambahPermintaanBarang.vue)
const schema = toTypedSchema(
  yup.object({
    jenisPengeluaran: yup.string().required("Jenis Pengeluaran harus diisi"),
    tanggalPengeluaran: yup.date().required("Tanggal Pengeluaran harus diisi"),
    kategoriItem: yup.string().required("Kategori Item harus diisi"),
    jenisStok: yup.string().required("Jenis Stok harus diisi"),
    jenisItem: yup.string().required("Jenis Item harus diisi"),
    // Wajib hanya untuk 'pengeluaran tanpa permintaan'
    tujuanPengeluaran: yup.string().when("jenisPengeluaran", {
      is: (val: string) => val === "pengeluaran tanpa permintaan",
      then: (s) => s.required("Tujuan Pengeluaran harus diisi"),
      otherwise: (s) => s.notRequired(),
    }),
    // Wajib hanya untuk 'pemusnahan barang'
    jenisPemusnahan: yup.string().when("jenisPengeluaran", {
      is: (val: string) => val === "pemusnahan barang",
      then: (s) => s.required("Jenis Pemusnahan harus diisi"),
      otherwise: (s) => s.notRequired(),
    }),
    catatan: yup.string().required("Catatan harus diisi"),

    items: yup
      .array()
      .of(
        yup.object({
          selectedItemUuid: yup.string().required("Nama Item harus diisi"),
          selectedSatuanUuid: yup.string().required("Satuan harus diisi"),
          jumlahPermintaan: yup
            .number()
            .required("Jumlah Pengeluaran harus diisi")
            .moreThan(0, "Jumlah Pengeluaran harus lebih dari 0"),
          // Informasi tampilan (opsional)
          namaItem: yup.string().optional(),
          stockUuid: yup.string().optional(),
          hpp: yup.number().optional(),
          expDate: yup.string().optional(),
          hna: yup.number().optional(),
          total: yup.number().optional(),
        })
      )
      .min(1, "Minimal satu item pengeluaran"),
  })
);

// Inisialisasi form menggunakan useForm + initialValues
const { errors, handleSubmit, defineField } = useForm({
  validationSchema: schema,
  initialValues: {
    jenisPengeluaran: DEFAULT_JENIS_PENGELUARAN,
    tanggalPengeluaran: undefined,
    kategoriItem: DEFAULT_KATEGORI_ITEM,
    jenisStok: "",
    jenisItem: KATEGORI_TO_JENIS_ITEM_MAP[DEFAULT_KATEGORI_ITEM],
    tujuanPengeluaran: "",
    jenisPemusnahan: "",
    catatan: "",
    items: [
      {
        selectedItemUuid: "",
        selectedSatuanUuid: "",
        jumlahPermintaan: 0,
        // opsional tampilan:
        namaItem: "",
        stockUuid: "",
        hpp: 0,
        expDate: "",
        hna: 0,
        total: 0,
      },
    ],
  },
});

// Bind field-level
const [jenisPengeluaran] = defineField("jenisPengeluaran");
const [tanggalPengeluaran] = defineField("tanggalPengeluaran");
const [kategoriItem] = defineField("kategoriItem");
const [jenisStok] = defineField("jenisStok");
const [jenisItem] = defineField("jenisItem");
const [tujuanPengeluaran] = defineField("tujuanPengeluaran");
const [catatan] = defineField("catatan");
const [jenisPemusnahan] = defineField("jenisPemusnahan");

// Field array untuk tabel items
interface PengeluaranItem {
  selectedItemUuid: string;
  selectedSatuanUuid: string;
  jumlahPermintaan: number;
  // opsional tampilan
  namaItem?: string;
  stockUuid?: string;
  hpp?: number;
  expDate?: string;
  hna?: number;
  total?: number;
}
const {
  remove,
  push,
  fields: fieldsPengeluaran,
  replace,
} = useFieldArray<PengeluaranItem>("items");

// Util untuk menemukan item by uuid dan menerapkan ke baris (tampilan)
const getItemByUuid = (uuid: string) =>
  InventoryStokByLocationPayload.value.find((i: any) => i.itemUuid === uuid);

const applyItemToRow = (row: any, item: any | undefined) => {
  row.namaItem = item?.itemName ?? "";
  row.stockUuid = item?.stockUuid ?? "";
  // Stok dipotong dalam satuan penggunaan (satuan terkecil) batch, jadi satuan baris dikunci ke
  // satuan itu agar jumlah yang diketik tidak disalahartikan sebagai Box/Strip.
  row.selectedSatuanUuid = item?.satuanUuid ?? "";
  row.hpp = item?.hpp ?? 0;
  row.expDate = item?.expDate ?? "";
  row.hna = item?.hna ?? 0;
  row.total = item?.total ?? 0;
};

// Update saat item/satuan/qty dipilih pada baris
const updateSelectedItem = (rowIndex: number) => {
  const row = fieldsPengeluaran.value[rowIndex]?.value;
  if (!row) return;
  const item = getItemByUuid(row.selectedItemUuid);
  applyItemToRow(row, item);
};
const updateSelectedSatuan = (rowIndex: number) => {
  // noop: cukup update v-model, validasi ditangani oleh schema
};
const updateJumlahPermintaan = () => {
  nextTick(updateSticky);
};

// Row ops
const addRow = () => {
  push({
    selectedItemUuid: "",
    selectedSatuanUuid: "",
    jumlahPermintaan: 0,
    namaItem: "",
    stockUuid: "",
    hpp: 0,
    expDate: "",
    hna: 0,
    total: 0,
  });
};
const resetTable = () => {
  replace([
    {
      selectedItemUuid: "",
      selectedSatuanUuid: "",
      jumlahPermintaan: 0,
      namaItem: "",
      stockUuid: "",
      hpp: 0,
      expDate: "",
      hna: 0,
      total: 0,
    },
  ]);
};

// Sticky update
const updateSticky = () => {
  const el = contentRef.value;
  if (!el) {
    isSticky.value = false;
    return;
  }
  isSticky.value = el.scrollHeight - el.clientHeight > 2;
};

// Opsi Jenis Item mengikuti kategori terpilih (obat/alkes)
const jenisItemOptions = computed(() => {
  const mapped = KATEGORI_TO_JENIS_ITEM_MAP[kategoriItem.value as string];
  return mapped ? [{ value: mapped }] : [];
});

// Saat kategori berubah, set nilai jenisItem ke nilai kategori
watch(kategoriItem, (val) => {
  jenisItem.value = val ? KATEGORI_TO_JENIS_ITEM_MAP[val] ?? "" : "";
});

// Sinkronkan tujuan dengan Lokasi Stok saat default 'Pemakaian Unit'
onMounted(() => {
  fetchStockType();
  fetchSatuan();

  // Set default kategori/jenis pengeluaran
  if (!kategoriItem.value) kategoriItem.value = DEFAULT_KATEGORI_ITEM;
  if (!jenisPengeluaran.value)
    jenisPengeluaran.value = DEFAULT_JENIS_PENGELUARAN;

  // Sinkronkan tujuan saat default 'pemakaian unit'
  if (jenisPengeluaran.value === "pemakaian unit" && stockLocSel.selectedUuid) {
    tujuanPengeluaran.value = stockLocSel.selectedUuid;
  }

  // Ambil inventori sesuai lokasi
  fetchInventoryStokByLocation();

  // Sticky
  nextTick(updateSticky);
  resizeObserver = new ResizeObserver(() => updateSticky());
  if (contentRef.value) resizeObserver.observe(contentRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect?.();
});

// Re-evaluasi saat jumlah baris/isi berubah
watch(fieldsPengeluaran, () => nextTick(updateSticky), { deep: true });

// Sinkronkan tujuan dengan Lokasi Stok saat 'Pemakaian Unit' dipilih
watch(
  () => stockLocSel.selectedUuid,
  (val) => {
    if (jenisPengeluaran.value === "pemakaian unit" && val) {
      tujuanPengeluaran.value = val;
      resetTable();
      fetchInventoryStokByLocation();
    }
  },
  { immediate: true }
);

// Reset tabel saat jenisPengeluaran berubah (menghindari campuran state)
watch(jenisPengeluaran, () => {
  resetTable();
});

// Ambil item multiple dari dialog
const onAmbilItems = (uuids: string[]) => {
  // Kumpulkan indeks baris yang masih kosong
  const emptyIndices: number[] = fieldsPengeluaran.value.reduce(
    (acc: number[], entry, i) => {
      if (!entry.value.selectedItemUuid) acc.push(i);
      return acc;
    },
    []
  );

  let cursor = 0;

  uuids.forEach((uuid) => {
    const item = getItemByUuid(uuid);

    if (cursor < emptyIndices.length) {
      // Isi baris kosong yang sudah ada
      const idx = emptyIndices[cursor++];
      const row = fieldsPengeluaran.value[idx].value;
      row.selectedItemUuid = uuid;
      applyItemToRow(row, item);
    } else {
      // Tambahkan baris baru dengan data lengkap
      push({
        selectedItemUuid: uuid,
        selectedSatuanUuid: "",
        jumlahPermintaan: 0,
        namaItem: item?.itemName ?? "",
        stockUuid: item?.stockUuid ?? "",
        hpp: item?.hpp ?? 0,
        expDate: item?.expDate ?? "",
        hna: item?.hna ?? 0,
        total: item?.total ?? 0,
      });
    }
  });

  nextTick(updateSticky);
  showTambahItemMultiple.value = false;
};

// Submit form
const onSubmit = handleSubmit(async (values: any) => {
  isSubmitting.value = true;
  try {
    const items = (values.items ?? [])
      .filter(
        (r: any) =>
          r.selectedItemUuid &&
          r.selectedSatuanUuid &&
          (r.jumlahPermintaan ?? 0) > 0
      )
      .map((r: any) => ({
        stock_uuid: r.stockUuid,
        qty: r.jumlahPermintaan,
        exp_date: r.expDate,
        harga_satuan: r.hpp,
        konversi_uuid: r.selectedSatuanUuid,
      }));

    const payload: any = {
      jenis_pengeluaran: values.jenisPengeluaran,
      kategori_item: values.kategoriItem,
      jenis_stok_uuid: values.jenisStok,
      jenis_item: values.jenisItem,
      catatan: values.catatan,
      items,
    };

    if (values.jenisPengeluaran === "pengeluaran tanpa permintaan") {
      payload.lokasi_stok_tujuan_uuid = values.tujuanPengeluaran;
      payload.lokasi_stok_awal_uuid = stockLocSel.selectedUuid;
    }
    if (values.jenisPengeluaran === "pemakaian unit") {
      payload.lokasi_stok_awal_uuid = stockLocSel.selectedUuid;
    }
    if (values.jenisPengeluaran === "pemusnahan barang") {
      payload.lokasi_stok_awal_uuid = stockLocSel.selectedUuid;
      payload.jenis_pemusnahan = values.jenisPemusnahan;
    }

    await PengeluaranUnitStore.postPengeluaranUnit(payload);
    emit("saved");
    emit("back");
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    isSubmitting.value = false;
  }
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
                  @click="resetTable"
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
                <div class="">
                  <p
                    class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]"
                  >
                    Tambah Pengeluaran
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
                  <CustomSelect
                    v-model="jenisPengeluaran"
                    class="w-full"
                    label="Jenis Pengeluaran"
                    placeHolder="Pilih Jenis Pengeluaran"
                    :options="[
                      { label: 'Pemakaian Unit', value: 'pemakaian unit' },
                      {
                        label: 'Pengeluaran Tanpa Permintaan',
                        value: 'pengeluaran tanpa permintaan',
                      },
                      {
                        label: 'Pemusnahan Barang',
                        value: 'pemusnahan barang',
                      },
                    ]"
                    optionLabel="label"
                    optionValue="value"
                    :invalid="!!errors.jenisPengeluaran"
                    :invalidMessage="errors.jenisPengeluaran"
                  />
                  <CustomDatePicker
                    v-model="tanggalPengeluaran"
                    class="w-full"
                    placeHolder="Pilih Tanggal Pengeluaran"
                    label="Tanggal Pengeluaran"
                    :invalid="!!errors.tanggalPengeluaran"
                    :invalidMessage="errors.tanggalPengeluaran"
                  />
                  <CustomSelect
                    v-model="kategoriItem"
                    class="w-full"
                    label="Kategori Item"
                    placeHolder="Pilih Kategori Item"
                    :options="[
                      { label: 'Medis', value: 'medis' },
                      { label: 'Non-Medis', value: 'non-medis' },
                    ]"
                    optionLabel="label"
                    optionValue="value"
                    dataKey="value"
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
                </div>
              </div>
              <div class="grid grid-cols-12 gap-3 items-end">
                <div
                  :class="
                    jenisPengeluaran === 'pemakaian unit'
                      ? 'col-span-6'
                      : 'col-span-4'
                  "
                >
                  <CustomSelect
                    class="w-full"
                    v-model="jenisItem"
                    label="Jenis Item"
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
                <div
                  v-if="jenisPengeluaran === 'pengeluaran tanpa permintaan'"
                  class="col-span-4"
                >
                  <CustomSelect
                    class="w-full"
                    v-model="tujuanPengeluaran"
                    label="Tujuan Pengeluaran"
                    placeHolder="Pilih Tujuan Pengeluaran"
                    :options="stockLocSel.filtered"
                    optionLabel="name"
                    optionValue="uuid"
                    dataKey="uuid"
                    :invalid="!!errors.tujuanPengeluaran"
                    :invalidMessage="errors.tujuanPengeluaran"
                  />
                </div>
                <div
                  v-if="jenisPengeluaran === 'pemusnahan barang'"
                  class="col-span-4"
                >
                  <CustomSelect
                    class="w-full"
                    v-model="jenisPemusnahan"
                    label="Jenis Pemusnahan"
                    placeHolder="Pilih Jenis Pemusnahan"
                    :options="[
                      { label: 'Barang Kadaluarsa', value: 'kadaluarsa' },
                      { label: 'Barang Rusak', value: 'rusak' },
                    ]"
                    optionLabel="label"
                    optionValue="value"
                    :invalid="!!errors.jenisPemusnahan"
                    :invalidMessage="errors.jenisPemusnahan"
                  />
                </div>
                <div
                  :class="
                    jenisPengeluaran === 'pemakaian unit'
                      ? 'col-span-6'
                      : 'col-span-4'
                  "
                >
                  <CustomTextfield
                    class="w-full"
                    v-model="catatan"
                    label="Catatan"
                    placeholder="Masukkan Catatan"
                    :invalid="!!errors.catatan"
                    :invalidMessage="errors.catatan"
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
              :value="fieldsPengeluaran"
              stripedRows
              scrollable
              class="h-full text-xs"
            >
              <!-- No -->
              <Column headerClass="bg-opensimrs-50" header="No">
                <template #body="slotProps">
                  <div class="text-center">{{ slotProps.index + 1 }}</div>
                </template>
              </Column>

              <!-- Nama Item -->
              <Column headerClass="bg-opensimrs-50" header="Nama Item">
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

              <!-- EXP. Date -->
              <Column headerClass="bg-opensimrs-50" header="EXP. Date">
                <template #body="slotProps">
                  <div class="px-2">
                    {{ slotProps.data.value.expDate || "" }}
                  </div>
                </template>
              </Column>

              <!-- Pengeluaran -->
              <Column headerClass="bg-opensimrs-50" header="Pengeluaran">
                <template #body="slotProps">
                  <CustomInputNumber
                    :showLabel="false"
                    v-model="slotProps.data.value.jumlahPermintaan"
                    @update:modelValue="updateJumlahPermintaan"
                    :invalid="
                      Boolean(
                        (errors as any)[`items[${slotProps.index}].jumlahPermintaan`]
                      )
                    "
                    :invalidMessage="
                      (errors as any)[`items[${slotProps.index}].jumlahPermintaan`]
                    "
                  />
                </template>
              </Column>

              <!-- Satuan/Isi -->
              <Column headerClass="bg-opensimrs-50" header="Satuan/Isi">
                <template #body="slotProps">
                  <CustomSelect
                    :showLabel="false"
                    class="w-full"
                    v-model="slotProps.data.value.selectedSatuanUuid"
                    placeHolder="Pilih Satuan"
                    :disabled="Boolean(slotProps.data.value.stockUuid)"
                    :options="SatuanPayload"
                    optionLabel="name"
                    optionValue="uuid"
                    @update:modelValue="updateSelectedSatuan(slotProps.index)"
                    :invalid="
                      Boolean(
                        (errors as any)[`items[${slotProps.index}].selectedSatuanUuid`]
                      )
                    "
                    :invalidMessage="
                      (errors as any)[`items[${slotProps.index}].selectedSatuanUuid`]
                    "
                  />
                </template>
              </Column>

              <!-- HNA -->
              <Column headerClass="bg-opensimrs-50" header="HNA">
                <template #body="slotProps">
                  <div class="px-2">
                    {{ formatPrice(slotProps.data.value.hna || 0) }}
                  </div>
                </template>
              </Column>

              <!-- HPP -->
              <Column headerClass="bg-opensimrs-50" header="HPP">
                <template #body="slotProps">
                  <div class="px-2">
                    {{ formatPrice(slotProps.data.value.hpp || 0) }}
                  </div>
                </template>
              </Column>

              <!-- Total -->
              <Column headerClass="bg-opensimrs-50" header="Total">
                <template #body="slotProps">
                  <div class="px-2">
                    {{ formatPrice(slotProps.data.value.total || 0) }}
                  </div>
                </template>
              </Column>

              <!-- Action -->
              <Column headerClass="bg-opensimrs-50" header="Action">
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

          <!-- Toolbar bawah -->
          <div
            :class="[
              'mt-3 gap-3 flex justify-center items-center p-5 rounded-lg border border-dashed border-opensimrs-300 flex-shrink-0',
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
            <CustomButton
              icon="PhPlus"
              label="Tambah Item Multiple"
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
              backgroundColor="bg-white"
              @click="showTambahItemMultiple = true"
              :disabled="
                jenisPengeluaran === 'pengeluaran tanpa permintaan'
                  ? !tujuanPengeluaran
                  : false
              "
            />
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-between py-2 border-t border-grey-200">
          <div class="flex gap-10">
            <div>
              <div class="underline">Total Item</div>
              <div>{{ fieldsPengeluaran.length }}</div>
            </div>
            <div>
              <div class="underline">Petugas Permintaan</div>
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
              @click="onSubmit"
              textColor="text-white"
              :disabled="isSubmitting"
            />
          </div>
        </div>
      </template>
    </Card>

    <TambahItemMultiple
      v-model:visible="showTambahItemMultiple"
      :showHeaderInfo="false"
      :fetchOptions="InventoryStokByLocationPayload"
      @ambil-items="onAmbilItems"
    />
  </div>
</template>

<style lang="scss" scoped></style>
