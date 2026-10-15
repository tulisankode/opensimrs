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
import TambahItemMultiple from "../../../../components/Stok/TambahItemMultiple.vue";
import { utilsStore } from "@/stores/utils";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";
import { useForm, useFieldArray } from "vee-validate";
import { useStockTypeStore } from "@/stores/datamasterFarmasi/StockType";
import { useStockLocationSelectionStore } from "@/utils/StockLocationSelection";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import { usePengeluaranUnitStore } from "@/stores/stok/PengeluaranUnit";
import { useUnitStore } from "@/stores/datamasterFarmasi/Unit";
import { usePermintaanBarangStore } from "@/stores/stok/PermintaanBarang";
import { useToast } from "primevue/usetoast";

const UseUtilsStore = utilsStore();
const emit = defineEmits(["back", "saved"]);
const isSubmitting = ref(false);
const toast = useToast();

// Default kategori pertama: Medis ("obat")
const DEFAULT_KATEGORI_ITEM = "medis";
// Mapping kategori → jenis item
const KATEGORI_TO_JENIS_ITEM_MAP: Record<string, string> = {
  medis: "obat",
  "non-medis": "alkes",
};

const showTambahItemMultiple = ref(false);

// Kontainer konten untuk mendeteksi overflow
const contentRef = ref<HTMLElement | null>(null);
const isSticky = ref(false);
let resizeObserver: ResizeObserver | null = null;

// Helper: nama jenis stok dari uuid
const StockTypeStore = useStockTypeStore();
const StockTypePayload = ref<any[]>([]);
const getJenisStokName = (uuid: any) => {
  const match = StockTypePayload.value.find((s: any) => s.uuid === uuid);
  return match?.name ?? "";
};

// Schema utama form + items (array)
const schema = toTypedSchema(
  yup.object({
    tanggalPermintaan: yup.date().required("Tanggal Pengeluaran harus diisi"),
    kategoriItem: yup.string().required("Kategori Item harus diisi"),
    jenisStok: yup.string().required("Jenis Stok harus diisi"),
    jenisItem: yup.string().required("Jenis Item harus diisi"),
    tujuanPermintaan: yup.string().required("Tujuan Permintaan harus diisi"),
    catatan: yup.string(),
    cito: yup.boolean().default(true),
    items: yup
      .array()
      .of(
        yup.object({
          selectedItemUuid: yup.string().required("Nama Item harus diisi"),
          selectedSatuanUuid: yup.string().required("Satuan harus diisi"),
          jumlahPermintaan: yup
            .number()
            .required("Jumlah Permintaan harus diisi")
            .moreThan(0, "Jumlah Permintaan harus lebih dari 0"),
          // Informasi tampilan (opsional)
          namaItem: yup.string().optional(),
          stokPermintaan: yup.number().optional(),
          hargaDasar: yup.number().optional(),
        })
      )
      .min(1, "Minimal satu item permintaan"),
  })
);

// Inisialisasi form
const { errors, handleSubmit, defineField } = useForm({
  validationSchema: schema,
  initialValues: {
    tanggalPermintaan: undefined,
    kategoriItem: DEFAULT_KATEGORI_ITEM,
    jenisStok: "",
    jenisItem: KATEGORI_TO_JENIS_ITEM_MAP[DEFAULT_KATEGORI_ITEM],
    tujuanPermintaan: "",
    catatan: "",
    cito: true,
    items: [
      {
        selectedItemUuid: "",
        namaItem: "",
        stokPermintaan: 0,
        selectedSatuanUuid: "",
        hargaDasar: 0,
        jumlahPermintaan: 0,
      },
    ],
  },
});

const [tanggalPermintaan] = defineField("tanggalPermintaan");
const [kategoriItem] = defineField("kategoriItem");
const [jenisStok] = defineField("jenisStok");
const [jenisItem] = defineField("jenisItem");
const [tujuanPermintaan] = defineField("tujuanPermintaan");
const [catatan] = defineField("catatan");
const [cito] = defineField("cito");

// Field array untuk tabel
interface PermintaanItem {
  selectedItemUuid: string;
  namaItem: string;
  stokPermintaan: number;
  selectedSatuanUuid: string;
  hargaDasar: number;
  jumlahPermintaan: number;
}

const {
  remove,
  push,
  fields: fieldsPermintaan,
  replace,
} = useFieldArray<PermintaanItem>("items");

// Utils untuk data lokasi/satuan/item
const stockLocSel = useStockLocationSelectionStore();
const StockLocationStore = useStockLocationStore();
const stockLocations = computed(() => stockLocSel.filtered);
const fetchStockLocations = async () => {
  const response = await StockLocationStore.getApi(1, 999999999, "", "");
  const list = response?.payload ?? [];
  stockLocSel.setAll(list);
  if (!tujuanPermintaan.value && Array.isArray(list) && list.length > 0) {
    if (!stockLocSel.selectedUuid) {
      stockLocSel.setSelectedUuid(list[0].uuid);
    }
    const firstValid = list.find(
      (l: any) => l.uuid !== stockLocSel.selectedUuid
    );
    if (firstValid) {
      tujuanPermintaan.value = firstValid.uuid;
    }
  }
};

const PengeluaranUnitStore = usePengeluaranUnitStore();
const InventoryStokByLocationPayload = ref<any[]>([]);

const fetchInventoryStokByLocation = async () => {
  try {
    const response = await PengeluaranUnitStore.inventoryStokByLocation(
      tujuanPermintaan.value
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

const SatuanStore = useUnitStore();
const SatuanPayload = ref<any[]>([]);

// Fetch Unit
const fetchSatuan = async () => {
  try {
    const response = await SatuanStore.getApi(1, 999999999999);
    if (response && response.payload) {
      SatuanPayload.value = response.payload;
    } else {
      SatuanPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch provinsi", error);
    SatuanPayload.value = [];
  }
};

// Util untuk menemukan item by uuid dan menerapkan ke baris
const getItemByUuid = (uuid: string) =>
  InventoryStokByLocationPayload.value.find((i: any) => i.itemUuid === uuid);

const applyItemToRow = (row: any, item: any | undefined) => {
  row.namaItem = item?.itemName ?? "";
  row.stokPermintaan = item?.jumlahTersedia ?? 0;
  row.hargaDasar = item?.hargaSatuan ?? 0;
};

// Update saat item dipilih
const updateSelectedItem = (rowIndex: number) => {
  const row = fieldsPermintaan.value[rowIndex]?.value;
  if (!row) return;
  const item = getItemByUuid(row.selectedItemUuid);
  applyItemToRow(row, item);
};

// Helper to show unit name per row
const getSatuanName = (uuid: string) => {
  const match = SatuanPayload.value.find((u: any) => u.uuid === uuid);
  return match?.name ?? "";
};

// Update jumlah permintaan untuk side effects ringan (mis. sticky)
const updateJumlahPermintaan = () => {
  nextTick(updateSticky);
};

const addRow = () => {
  push({
    selectedItemUuid: "",
    namaItem: "",
    stokPermintaan: 0,
    selectedSatuanUuid: "",
    hargaDasar: 0,
    jumlahPermintaan: 0,
  });
};

const resetTable = () => {
  replace([
    {
      selectedItemUuid: "",
      namaItem: "",
      stokPermintaan: 0,
      selectedSatuanUuid: "",
      hargaDasar: 0,
      jumlahPermintaan: 0,
    },
  ]);
  tanggalPermintaan.value = null;
  jenisStok.value = "";
  catatan.value = "";
};

//Untuk dikirim ke TambahItemMultiple
const fieldData = computed(() => ({
  kategoriItem: kategoriItem.value,
  jenisStok: getJenisStokName(jenisStok.value),
  jenisItem: jenisItem.value,
}));

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

// Fetch Stock Type
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

const PermintaanBarangStore = usePermintaanBarangStore();

const onSubmit = handleSubmit(
  async (values: any) => {
    isSubmitting.value = true;
    try {
      const selectedItems = (values.items ?? []).filter(
        (r: any) =>
          r.selectedItemUuid &&
          r.selectedSatuanUuid &&
          (r.jumlahPermintaan ?? 0) > 0
      );

      if (selectedItems.length === 0) {
        toast.add({
          severity: "warn",
          summary: "Validasi",
          detail: "Wajib memilih 1 item",
          life: 3000,
        });
        return;
      }

      const items = selectedItems.map((r: any) => ({
        item_uuid: r.selectedItemUuid,
        qty_permintaan: r.jumlahPermintaan,
        konversi_uuid: r.selectedSatuanUuid,
      }));

      const payload = {
        kategori_item: values.kategoriItem,
        jenis_stok_uuid: values.jenisStok,
        jenis_stok: getJenisStokName(values.jenisStok),
        lokasi_stok_awal_uuid: values.tujuanPermintaan,
        lokasi_stok_tujuan_uuid: stockLocSel.selectedUuid,
        catatan: values.catatan,
        cito: values.cito,
        items,
      };

      await PermintaanBarangStore.postPermintaanBarang(payload);
      emit("saved");
      emit("back");
    } catch (error) {
      console.error("Failed to process the data:", error);
    } finally {
      isSubmitting.value = false;
    }
  },
  () => {
    if ((fieldsPermintaan.value?.length ?? 0) === 0) {
      toast.add({
        severity: "warn",
        summary: "Validasi",
        detail: "Wajib memilih 1 item",
        life: 3000,
      });
    }
  }
);

const updateSticky = () => {
  const el = contentRef.value;
  if (!el) {
    isSticky.value = false;
    return;
  }
  // Sticky aktif jika konten overflow (tinggi konten > tinggi tampilan)
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

onMounted(() => {
  // Ambil semua data stock type
  fetchStockType();

  // Ambil semua data satuan
  fetchSatuan();

  fetchStockLocations();

  // Set default kategori ke Medis jika belum ada nilai (sudah di initialValues)
  if (!kategoriItem.value) {
    kategoriItem.value = DEFAULT_KATEGORI_ITEM;
  }

  // Set sticky header setelah data diambil
  nextTick(updateSticky);
  resizeObserver = new ResizeObserver(() => updateSticky());
  if (contentRef.value) resizeObserver.observe(contentRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect?.();
});

// Re-evaluasi saat jumlah baris/isi berubah
watch(
  fieldsPermintaan,
  () => {
    nextTick(updateSticky);
  },
  { deep: true }
);

watch(tujuanPermintaan, () => {
  resetTable();
  fetchInventoryStokByLocation();
});

// Callback saat pengguna mengambil item multiple
const onAmbilItems = (uuids: string[]) => {
  // Kumpulkan indeks baris yang masih kosong
  const emptyIndices: number[] = fieldsPermintaan.value.reduce(
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
      const row = fieldsPermintaan.value[idx].value;
      row.selectedItemUuid = uuid;
      applyItemToRow(row, item);
    } else {
      // Tambahkan baris baru dengan data lengkap
      push({
        selectedItemUuid: uuid,
        namaItem: item?.itemName ?? "",
        stokPermintaan: item?.jumlahTersedia ?? 0,
        selectedSatuanUuid: "",
        hargaDasar: item?.hargaSatuan ?? 0,
        jumlahPermintaan: 0,
      });
    }
  });

  nextTick(updateSticky);
  showTambahItemMultiple.value = false;
};
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
                    Permintaan Unit
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
                <div class="flex items-end">
                  <CustomDatePicker
                    class="w-full"
                    v-model="tanggalPermintaan"
                    placeHolder="Pilih tanggal Permintaan"
                    label="Tgl. Permintaan"
                    :invalid="!!errors.tanggalPermintaan"
                    :invalidMessage="errors.tanggalPermintaan"
                  />
                </div>
                <div class="flex gap-2 w-full">
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
                <div class="col-span-6">
                  <CustomSelect
                    class="w-full"
                    label="Tujuan Permintaan"
                    :placeHolder="'Pilih Tujuan Permintaan'"
                    v-model="tujuanPermintaan"
                    :options="stockLocations"
                    optionLabel="name"
                    optionValue="uuid"
                    dataKey="uuid"
                    :invalid="!!errors.tujuanPermintaan"
                    :invalidMessage="errors.tujuanPermintaan"
                  />
                </div>
                <div class="col-span-5">
                  <CustomTextfield
                    class="w-full"
                    label="Catatan"
                    placeholder="Catatan"
                    v-model="catatan"
                  />
                </div>
                <div class="col-span-1">
                  <CustomSwitch v-model="cito" class="w-auto" label="Cito" />
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
              :value="fieldsPermintaan"
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

              <!-- Stok Ketika Permintaan -->
              <Column
                header=""
                headerClass="bg-opensimrs-50"
                field="stokPermintaan"
              >
                <template #header>
                  <div
                    class="flex justify-center items-center w-full font-semibold"
                  >
                    Stok Ketika Permintaan
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center w-full">
                    {{ slotProps.data.value.stokPermintaan || 0 }}
                  </div>
                </template>
              </Column>

              <!-- Satuan/Isi -->
              <Column header="" headerClass="bg-opensimrs-50" field="satuanIsi">
                <template #header>
                  <div
                    class="flex justify-center items-center w-full font-semibold"
                  >
                    Satuan/Isi
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center w-full">
                    <CustomSelect
                      :showLabel="false"
                      class="w-full"
                      v-model="slotProps.data.value.selectedSatuanUuid"
                      :options="SatuanPayload"
                      optionLabel="name"
                      placeHolder="Pilih Satuan"
                      optionValue="uuid"
                      :invalid="
                        Boolean(
                          (errors as any)[`items[${slotProps.index}].selectedSatuanUuid`]
                        )
                      "
                      :invalidMessage="
                        (errors as any)[`items[${slotProps.index}].selectedSatuanUuid`]
                      "
                    />
                  </div>
                </template>
              </Column>

              <!-- Harga Dasar -->
              <Column
                header="Harga Dasar"
                headerClass="bg-opensimrs-50"
                field="hargaDasar"
              >
                <template #body="slotProps">
                  <div class="text-end">
                    Rp{{ slotProps.data.value.hargaDasar || 0 }}
                  </div>
                </template>
              </Column>

              <!-- Jumlah Permintaan -->
              <Column
                header=""
                headerClass="bg-opensimrs-50"
                field="jumlahPermintaan"
              >
                <template #header>
                  <div
                    class="flex justify-center items-center w-full font-semibold"
                  >
                    Jumlah Permintaan
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center w-full">
                    <CustomInputNumber
                      v-model="slotProps.data.value.jumlahPermintaan"
                      :showLabel="false"
                      class="min-w-[80px]"
                      @update:modelValue="updateJumlahPermintaan"
                      :invalid="
                        Boolean(
                          (errors as any)[`items[${slotProps.index}].jumlahPermintaan`]
                        )
                      "
                      :invalidMessage="
                        (errors as any)[`items[${slotProps.index}].jumlahPermintaan`]
                      "
                    >
                      <template #appendText>
                        <div class="flex items-center mr-2">
                          {{
                            getSatuanName(
                              slotProps.data.value.selectedSatuanUuid
                            )
                          }}
                        </div>
                      </template>
                    </CustomInputNumber>
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

          <!-- Toolbar bawah -->
          <div
            :class="[
              'mt-3 flex gap-3 justify-center items-center p-5 rounded-lg border border-dashed border-opensimrs-300 flex-shrink-0',
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
              :disabled="!tujuanPermintaan"
              label="Tambah Item Multiple"
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
              backgroundColor="bg-white"
              @click="showTambahItemMultiple = true"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between py-2 border-t border-grey-200">
          <div class="flex gap-10">
            <div>
              <div class="underline">Total Item</div>
              <div>{{ fieldsPermintaan.length }}</div>
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
              @click="onSubmit"
              backgroundColor="bg-opensimrs-300"
              textColor="text-white"
              :disabled="isSubmitting"
            />
          </div>
        </div>
      </template>
    </Card>
    <TambahItemMultiple
      :showHeaderInfo="true"
      v-model:visible="showTambahItemMultiple"
      :fieldData="fieldData"
      :fetchOptions="InventoryStokByLocationPayload"
      @ambil-items="onAmbilItems"
    />
  </div>
</template>

<style lang="scss" scoped></style>
