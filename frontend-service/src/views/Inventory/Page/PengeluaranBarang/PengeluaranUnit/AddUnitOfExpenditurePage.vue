<script setup lang="ts">
import { onMounted, ref, watch, computed } from "vue";
import { useUnitOfExpenditureStore } from "@/stores/inventory/unitOfExpenditure";
import { useStorageLocationStore } from "@/stores/inventory/storageLocation";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { useSupplierStore } from "@/stores/inventory/supplier";
import { useStockTypeStore } from "@/stores/datamasterFarmasi/StockType";
import { utilsStore } from "@/stores/utils";
import { dateToEpoch, formatPrice } from "@/utils/Helpers";
import { useForm, useFieldArray } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import DialogPengeluaranMultiple from "./DialogPengeluaranMultiple.vue";


// Tambahkan definisi props
const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array,
    default: () => [],
  },
  lokasiStokUuid: {
    type: String,
    default: "",
  },
});

const optionKategori = ref([
  { name: "Medis", value: "medis" },
  { name: "Non-Medis", value: "non-medis" },
]);

const optionJenis = ref([
  { name: "Obat", value: "obat" },
  { name: "Alkes", value: "alkes" },
]);

const optionJenisPengeluaran = ref([
  { name: "Pemakaian Unit", value: "pemakaian unit" },
  { name: "Pengeluaran Tanpa Permintaan", value: "pengeluaran tanpa permintaan" },
  { name: "Pemusnahan Barang", value: "pemusnahan barang" },
]);

const optionJenisPemusnahan = ref([
  { name: "Kadaluarsa", value: "kadaluarsa" },
  { name: "Rusak", value: "rusak" },
]);

const emit = defineEmits(["back", "goToDetail", "goToEdit"]);
const showMultipleDialog = ref(false);
const today = new Date();

// Helper untuk mengambil label dari value dropdown (untuk display di dialog)
const getLabel = (options: any[], value: string) => {
  const found = options.find((opt) => (opt.value || opt.uuid) === value);
  return found ? (found.name || found.label) : "-";
};

const schema = toTypedSchema(
  yup
    .object({
      jenisPengeluaran: yup.string().required("Jenis Pengeluaran harus diisi"),
      jenisPemusnahan: yup.string().when('jenis pemusnahan', {
        is: (val: string) => val === 'pemusnahan barang',
        then: (schema) => schema.required("Jenis Pemusnahan harus diisi"),
        otherwise: (schema) => schema.optional().nullable(),
      }),
      tanggalPengeluaran: yup.date().default(new Date()).required("Tanggal Pengeluaran harus diisi"),
      kategoriItem: yup.string().required("Kategori Item harus diisi"),
      jenisStokUuid: yup.string().required("Jenis Stok harus diisi"),
      jenisItem: yup.string().required("Jenis Item harus diisi"),
      lokasiStokTujuanUuid: yup.string().when('jenisPengeluaran', {
        is: 'pengeluaran tanpa permintaan',
        then: (schema) => schema.required("Tujuan Pengeluaran harus diisi"),
        otherwise: (schema) => schema.optional().nullable(),
      }),
      catatan: yup.string().nullable().optional(),
      items: yup.array().of(
        yup.object({
          stockUuid: yup.string().required("Nama Item harus dipilih"),
          expDate: yup.string().optional(),
          hargaSatuan: yup.number().optional(),
          konversiUuid: yup.string().required("Satuan/Isi harus diisi"),
          qty: yup.number().min(1, "Pengeluaran minimal 1").required("Pengeluaran harus diisi"), 
          stokAwalLokasiPengirim: yup.number().optional(),
          satuanOptions: yup.array().optional(),
        })
      ).min(1, "Minimal harus ada 1 item"),
    }).noUnknown()
);

const { errors, handleSubmit, defineField, values, resetForm } = useForm({ // Tambahkan 'values'
  validationSchema: schema,
  initialValues: {
    items: [
      {
        stockUuid: "",
        expDate: "",
        hargaSatuan: 0,
        konversiUuid: "",
        qty: 0,
        stokAwalLokasiPengirim: 0,
        satuanOptions: [],
      },
    ],
  },
});

const [jenisPengeluaran] = defineField("jenisPengeluaran");
const [jenisPemusnahan] = defineField("jenisPemusnahan");
const [tanggalPengeluaran] = defineField("tanggalPengeluaran");
const [kategoriItem] = defineField("kategoriItem");
const [jenisStokUuid] = defineField("jenisStokUuid");
const [jenisItem] = defineField("jenisItem");
const [lokasiStokTujuanUuid] = defineField("lokasiStokTujuanUuid");
const [catatan] = defineField("catatan");

interface itemPengeluaran {
  stockUuid: string;
  hiddenStockUuid: string;
  expDate: string;
  hargaSatuan: number;
  konversiUuid: string;
  qty: number;
  stokAwalLokasiPengirim: number;
  satuanOptions: any[];
}

const { remove, push, fields: fieldPengeluaran } = useFieldArray<itemPengeluaran>("items");

const addRow = () => {
  push({
    stockUuid: "",
    hiddenStockUuid: "",
    expDate: "",
    hargaSatuan: 0,
    konversiUuid: "",
    qty: 0,
    stokAwalLokasiPengirim: 0,
    satuanOptions: [],
  });
};

const UnitOfExpenditureStore = useUnitOfExpenditureStore();

const onSubmit = handleSubmit(async (formValues: any) => {
  console.log("✅ Validasi Berhasil! Payload yang akan dikirim:", formValues);
  UseUtilsStore.setLoading(true);

  const finalPayload = {
    jenisPengeluaran: formValues.jenisPengeluaran,
    jenisPemusnahan: formValues.jenisPemusnahan,
    jenisItem: formValues.jenisItem,
    kategoriItem: formValues.kategoriItem,
    jenisStokUuid: formValues.jenisStokUuid,
    lokasiStokTujuanUuid: formValues.lokasiStokTujuanUuid,
    lokasiStokAwalUuid: props.lokasiStokUuid,
    tanggalPengeluaran: dateToEpoch(formValues.tanggalPengeluaran),
    catatan: formValues.catatan,
    items: (formValues.items || []).map((item: any) => ({
      stockUuid: item.hiddenStockUuid,
      expDate: item.expDate,
      hargaSatuan: item.hargaSatuan,
      konversiUuid: item.konversiUuid,
      qty: item.qty,
      stokAwalLokasiPengirim: item.stokAwalLokasiPengirim,
    })),
  };
  try {
    await UnitOfExpenditureStore.postApi(finalPayload);
    console.log("🚀 API Berhasil di-hit!");
    emit("back");
  } catch (error) {
    console.error("❌ Gagal mengirim data pengeluaran:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
},
  // Blok ini HANYA berjalan jika validasi GAGAL
  (context) => {
    console.log("❌ Validasi Gagal!", context.errors);
  }
);

// Fungsi Handler Save dari Dialog Multiple
const handleMultipleSave = async (selectedItems: any[]) => {
  UseUtilsStore.setLoading(true);
  try {
    // Kita perlu fetch satuan untuk setiap item baru agar dropdown satuannya terisi
    // Menggunakan Promise.all agar fetch berjalan paralel
    const processedItems = await Promise.all(
      selectedItems.map(async (item) => {
        let satuanOptions = [];
        try {
          // Re-use fungsi fetchSatuanItem yang sudah ada
          satuanOptions = await fetchSatuanItem(item.uuid);
        } catch (e) {
          console.error(`Gagal fetch satuan untuk item ${item.name}`, e);
        }

        // Format object sesuai interface itemPengeluaran di vee-validate
        return {
          stockUuid: item.uuid, // ID Item Medis
          hiddenStockUuid: item.stockMedisUuid, // ID Stok Spesifik
          expDate: item.expDate || "",
          hargaSatuan: item.hargaDasar || 0,
          konversiUuid: "", // User harus memilih satuan manual nanti, atau default ke index 0 jika mau
          qty: 1, // Default qty 1
          stokAwalLokasiPengirim: item.stok || 0,
          satuanOptions: satuanOptions,
        };
      })
    );

    // Push semua item ke fieldPengeluaran (Vee-Validate Field Array)
    processedItems.forEach((newItem) => {
      push(newItem);
    });

  } catch (error) {
    console.error("Error processing multiple items:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};


const handleDelete = (index: number) => {
  remove(index);
};

// State Management
const StockLocationStore = useStockLocationStore();
const StockLocationPayload = ref<any[]>([]);
const UseUtilsStore = utilsStore();

// Fetch Stock Location
const fetchStockLocation = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await StockLocationStore.getApi(1, 9999);

    if (response && response.payload) {
      StockLocationPayload.value = response.payload;
    } else {
      StockLocationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StockLocationPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};


// kalkulasi garand total
const grandTotal = computed(() => {
  if (!values.items || values.items.length === 0) {
    return 0;
  }
  return values.items.reduce((total, item) => {
    const itemTotal = (item.qty || 0) * (item.hargaSatuan || 0);
    return total + itemTotal;
  }, 0);
});

// Hitung Total Item secara dinamis
const totalItem = computed(() => {
  return values.items ? values.items.length : 0;
});

// State Management
const MedicalItemStore = useMedicalItemStore();
const MedicalItemPayload = ref<any[]>([]);



// fungsi fetchItemMedis
const fetchItemMedis = async () => {
  const tgl = values.tanggalPengeluaran ? dateToEpoch(values.tanggalPengeluaran) : 0;
  const jenisStok = values.jenisStokUuid || "";
  const lokasiStok = props.lokasiStokUuid || "";
  const jenisItem = values.jenisItem || "";
  const kategoriItem = values.kategoriItem || "";

  if (!tgl || !jenisStok || !lokasiStok || !jenisItem || !kategoriItem) {
    console.warn("Parameter fetchItemMedis belum lengkap:", { tgl, jenisStok, lokasiStok, jenisItem, kategoriItem });
    MedicalItemPayload.value = [];
    return;
  }

  try {
    // Panggil API getApiAvailable dari store
    const response = await UnitOfExpenditureStore.getApiAvailable(
      tgl,
      jenisStok,
      lokasiStok,
      jenisItem,
      kategoriItem
    );

    if (response && response.payload) {
      MedicalItemPayload.value = response.payload.map((item: any) => ({
        ...item,
        stockMedisUuid: item.stockMedisUuid
      }));

    } else {
      MedicalItemPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch available items", error);
    MedicalItemPayload.value = [];
  }
};

// Watcher agar fetchItemMedis dipanggil saat filter berubah
watch(
  [
    () => values.tanggalPengeluaran,
    () => values.jenisStokUuid,
    () => values.jenisItem,
    () => values.kategoriItem,
  ],
  () => {
    // Reset item yang sudah dipilih di tabel jika filter utama berubah? 
    fetchItemMedis();
  },
  { deep: true } // Deep true agar mendeteksi perubahan tanggal object
);

// Ambil Data Satuan
const fetchSatuanItem = async (uuid: string): Promise<any[]> => {
  try {
    const response = await MedicalItemStore.getItemUnitApi(uuid);
    if (response && response.payload) {
      return Array.isArray(response.payload)
        ? response.payload
        : [response.payload];
    } else {
      return [];
    }
  } catch (error) {
    console.error("Failed to fetch item unit data:", error);
    return [];
  }
};

// fungsi baru untuk di-trigger saat item dipilih
const updateNameItem = async (index: number) => {
  const selectedItemUuid = fieldPengeluaran.value[index].value.stockUuid;
  const selectedItem = MedicalItemPayload.value.find(
    (item) => item.uuid === selectedItemUuid
  );

  if (selectedItem) {
    fieldPengeluaran.value[index].value.hiddenStockUuid = selectedItem.stockMedisUuid;
    fieldPengeluaran.value[index].value.hargaSatuan = selectedItem.hargaDasar || 0;
    fieldPengeluaran.value[index].value.expDate = selectedItem.expDate || "";
    const satuanOptions = await fetchSatuanItem(selectedItem.uuid);
    fieldPengeluaran.value[index].value.satuanOptions = satuanOptions;
    fieldPengeluaran.value[index].value.konversiUuid = "";
  }
};

// State Management
const SupplierStore = useSupplierStore();
const SupplierPayload = ref<any[]>([]);

// Fetch RulesOfUse
const fetchSupplier = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await SupplierStore.getApi(1, 9999);

    if (response && response.payload) {
      SupplierPayload.value = response.payload;
    } else {
      SupplierPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    SupplierPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// State Management
const StockTypeStore = useStockTypeStore();
const StockTypePayload = ref<any[]>([]);

// Fetch Stock Type
const fetchStockType = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await StockTypeStore.getApi(1, 9999);

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

// Watcher untuk reset lokasiStokTujuanUuid jika jenisPengeluaran berubah
watch(() => values.jenisPengeluaran, (newVal) => {
  if (newVal !== 'pengeluaran tanpa permintaan') {
    values.lokasiStokTujuanUuid = "";
  }
});

const handleReset = () => {
  resetForm();
  console.log("Form berhasil di-reset");
};

onMounted(() => {
  fetchStockLocation();
  fetchSupplier();
  fetchStockType();
  fetchItemMedis();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 pb-0 overflow-hidden" pt:content:class="h-full flex flex-col overflow-hidden"
      class="h-full overflow-hidden">
      
      <template #header>
        <CustomAccordion :openWithHeader="false" noBorder initialState="0">
          <template #header>
            <div class="flex justify-between w-full align-middle">
              <div class="flex">
                <CustomButton icon="PhArrowClockwise" class="mr-5" @click="handleReset" v-tooltip="'Reset Form'" />
                <CustomBreadCrumb :home="{
                  label: 'Pengeluaran Barang',
                  home: true,
                }" />
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-opensimrs-300" />
                <div class="">
                  <p class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]">Pengeluaran Unit</p>
                </div>
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-grey-300" />
                <div class="">
                  <p class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]">Tambah Pengeluaran</p>
                </div>
              </div>
              <div class="flex">
                <CustomButton @click="emit('back')" icon="PhCaretLeft" label="Kembali" class="mr-[10px]" outlined
                  borderColor="border-opensimrs-300" textColor="text-opensimrs-300" />
              </div>
            </div>
          </template>
          
          <template #content>
            <div class="grid grid-cols-4 gap-4 mt-[10px]">
              <div>
                <CustomSelect label="Jenis Pengeluaran" placeHolder="Pilih Lokasi Penerima" v-model="jenisPengeluaran"
                  :options="optionJenisPengeluaran" optionLabel="name" optionValue="value"
                  :invalid="!!errors.jenisPengeluaran" :invalidMessage="errors.jenisPengeluaran"
                  :required="errors.jenisPengeluaran ? true : false" />
              </div>
              <div>
                <CustomDatePicker v-model="tanggalPengeluaran" label="Tanggal Pengeluaran"
                  :invalid="!!errors.tanggalPengeluaran" :invalidMessage="errors.tanggalPengeluaran"
                  :required="errors.tanggalPengeluaran ? true : false" :maxDate="today" />
              </div>
              <div>
                <CustomSelect label="Kategori Item" placeHolder="Pilih Kategori Item" v-model="kategoriItem"
                  :options="optionKategori" optionLabel="name" optionValue="value" :invalid="!!errors.kategoriItem"
                  :invalidMessage="errors.kategoriItem" :required="errors.kategoriItem ? true : false" />
              </div>
              <div>
                <CustomSelect label="Jenis Stok" placeHolder="Pilih Jenis Stok" v-model="jenisStokUuid"
                  :options="StockTypePayload" optionLabel="name" optionValue="uuid" :invalid="!!errors.jenisStokUuid"
                  :invalidMessage="errors.jenisStokUuid" :required="errors.jenisStokUuid ? true : false" />
              </div>
              <div>
                <CustomSelect label="Jenis Item" placeHolder="Pilih Jenis Item" v-model="jenisItem"
                  :options="optionJenis" optionLabel="name" optionValue="value" :invalid="!!errors.jenisItem"
                  :invalidMessage="errors.jenisItem" :required="errors.jenisItem ? true : false" />
              </div>
              <div v-if="jenisPengeluaran === 'pengeluaran tanpa permintaan'">
                <CustomSelect label="Tujuan Pengeluaran" placeHolder="Pilih Tujuan Pengeluaran"
                  v-model="lokasiStokTujuanUuid" :options="StockLocationPayload" optionLabel="name" optionValue="uuid"
                  :invalid="!!errors.lokasiStokTujuanUuid" :invalidMessage="errors.lokasiStokTujuanUuid"
                  :required="errors.lokasiStokTujuanUuid ? true : false" />
              </div>
              <div v-if="jenisPengeluaran === 'pemusnahan barang'">
                <CustomSelect label="Jenis Pemusnahan" placeHolder="Pilih Jenis Pemusnahan" v-model="jenisPemusnahan"
                  :options="optionJenisPemusnahan" optionLabel="name" optionValue="value"
                  :invalid="!!errors.jenisPemusnahan" :invalidMessage="errors.jenisPemusnahan"
                  :required="errors.jenisPemusnahan ? true : false" />
              </div>
              <div>
                <CustomTextfield label="Catatan" placeholder="Catatan" v-model="catatan" :invalid="!!errors.catatan"
                  :invalidMessage="errors.catatan" :required="false" />
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
        <div class="flex flex-col h-full">
          <div class="flex-grow min-h-0 relative overflow-hidden">
            <DataTable :value="fieldPengeluaran" class="text-black" stripedRows scrollable :scrollHeight="'flex'"
              :pt="{ headerRow: 'text-SM' }">
              <Column field="No." headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold">No.</div>
                </template>
                <template #body="slotProps">
                  <div class="text-sm">{{ slotProps.index + 1 }}</div>
                </template>
              </Column>
              <Column header="Nama Item" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <CustomSelect v-model="slotProps.data.value.stockUuid"
                    @update:model-value="updateNameItem(slotProps.index)" class="w-[250px]" :showLabel="false"
                    prependIcon="PhMagnifyingGlass" place-holder="Cari Item" optionLabel="name" optionValue="uuid"
                    :options="MedicalItemPayload"
                    :invalid="(errors as any)[`items[${slotProps.index}].stockUuid`] ? true : false"
                    :invalidMessage="(errors as any)[`items[${slotProps.index}].stockUuid`]" />
                </template>
              </Column>
              <Column header="EXP. Date" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-sm">
                    {{ slotProps.data.value.expDate ? slotProps.data.value.expDate.split('T')[0] : '-' }}
                  </div>
                </template>
              </Column>
              <Column header="Pengeluaran" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <CustomInputNumber v-model="slotProps.data.value.qty" :showLabel="false" placeholder="0"
                    class="w-[60px]" :invalid="(errors as any)[`items[${slotProps.index}].qty`] ? true : false"
                    :invalidMessage="(errors as any)[`items[${slotProps.index}].qty`]" />
                </template>
              </Column>
              <Column header="Satuan/Isi" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <CustomSelect v-model="slotProps.data.value.konversiUuid" :showLabel="false" class="w-[150px]"
                    place-holder="Pilih Satuan" optionLabel="satuanPembelian" optionValue="uuid"
                    :options="slotProps.data.value.satuanOptions"
                    :invalid="(errors as any)[`items[${slotProps.index}].konversiUuid`] ? true : false"
                    :invalidMessage="(errors as any)[`items[${slotProps.index}].konversiUuid`]" />
                </template>
              </Column>
              <Column header="Harga Dasar" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-sm">
                    {{ formatPrice(slotProps.data.value.hargaSatuan) }}
                  </div>
                </template>
              </Column>
              <Column header="Total" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-sm">
                    {{ formatPrice(slotProps.data.value.qty * slotProps.data.value.hargaSatuan) }}
                  </div>
                </template>
              </Column>
              <Column header="Action" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="flex items-center justify-center">
                    <CustomButton :showLabel="false" background-color="bg-danger-300 rounded-lg"
                      class="h-[25px] pr-[5px] pl-[5px]" @click="handleDelete(slotProps.index)">
                      <PhTrash :size="15" weight="fill" />
                    </CustomButton>
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
          <div class="flex items-center justify-center p-5 border border-dashed rounded-lg border-opensimrs-300 mt-2">
            <CustomButton icon="PhPlus" label="Tambah Item" outlined borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300" @click="addRow" />
            <CustomButton icon="PhPlus" label="Tambah Item Multiple" outlined borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300" class="ml-[10px]" @click="() => {
                showMultipleDialog = true;
              }" />
          </div>
        </div>
      </template>

      <template #footer>
        <div class="p-4 border-t border-grey-200 bg-white">
          <div class="flex justify-between w-full">
            <div class="flex">
              <div>
                <p class="font-bold underline underline-offset-2">
                  Total Item
                </p>
                <p>{{ totalItem }}</p>
              </div>
              <div class="ml-[70px]">
                <p class="font-bold underline underline-offset-2">
                  Grand Total
                </p>
                <p>{{ formatPrice(grandTotal) }}</p>
              </div>
            </div>
            <div class="flex">
              <CustomButton @click="emit('back')" label="Batal" outlined borderColor="border-mediumGrey-300"
                textColor="text-mediumGrey-400" class="mt-auto" />
              <CustomButton label="Simpan" class="mt-auto ml-[10px]" @click="onSubmit" />
            </div>
          </div>
        </div>
      </template>
    </Card>
    
    <DialogPengeluaranMultiple v-model:visible="showMultipleDialog" :tanggal-pengeluaran="values.tanggalPengeluaran"
      :jenis-stok-uuid="values.jenisStokUuid" :lokasi-stok-uuid="props.lokasiStokUuid" :jenis-item="values.jenisItem" :kategori-item="values.kategoriItem"
      :kategori-item-label="getLabel(optionKategori, values.kategoriItem || '')"
      :jenis-stok-label="getLabel(StockTypePayload, values.jenisStokUuid || '')"
      :jenis-item-label="getLabel(optionJenis, values.jenisItem || '')" 
      @save="handleMultipleSave" />
  </div>
</template>
