<script setup lang="ts">
import { onMounted, ref, type PropType, nextTick, computed, watch } from "vue";
import { usePriceConfigurationStore } from "@/stores/datamasterFarmasi/PriceConfiguration";
import { usePurchasingOfSupplierStore } from "@/stores/inventory/purchasingOfSupplier";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { useStorageLocationStore } from "@/stores/inventory/storageLocation";
import { useSupplierStore } from "@/stores/inventory/supplier";
import { useStockTypeStore } from "@/stores/datamasterFarmasi/StockType";
import { utilsStore } from "@/stores/utils";
import { dateToEpoch, formatPrice } from "@/utils/Helpers";
import { useForm, useFieldArray } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useToast } from "primevue/usetoast";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import DialogPermintaanMultiple from "./DialogPermintaanMultiple.vue";

const props = defineProps({
  DetailPayload: {
    type: Object,
    default: null,
  },
});

function generateRandomNoPembelian() {
  const randomNumber = Math.floor(1000 + Math.random() * 9000); // Angka acak 4 digit
  return `PO${randomNumber}`;
}

const optionKategori = ref([
  { name: "Medis", value: "medis" },
  { name: "Non-Medis", value: "non-medis" },
]);

const optionJenis = ref([
  { name: "Obat", value: "obat" },
  { name: "Alkes", value: "alkes" },
]);

const optionPay = ref([
  { name: "Tunai", value: "tunai" },
  { name: "Kredit", value: "kredit" },
]);


const emit = defineEmits(["back", "backEdit", "goToDetail", "goToEdit"]);

const schema = toTypedSchema(
  yup
    .object({
      lokasiStokUuid: yup.string().required("Lokasi Penerima harus diisi"),
      kategoriItem: yup.string().required("Kategori Item harus diisi"),
      jenisItem: yup.string().required("Jenis Item harus diisi"),
      jenisStokUuid: yup.string().required("Jenis Stok harus diisi"),
      supplierUuid: yup.string().required("Supplier harus diisi"),
      tanggalPembelian: yup.date().default(new Date()).required("Tanggal Pembelian harus diisi"),
      metodePembelian: yup.string().required("Cara Bayar harus diisi"),
      catatanPo: yup.string().required("Catatan harus diisi"),
      isCito: yup.bool().default(false),
      items: yup.array().of(
        yup.object({
          itemUuid: yup.string().required("Nama Item harus dipilih"),
          qtyOrder: yup.number().required("Jumlah Beli harus diisi"),
          hargaSatuan: yup.number().required("Harga Satuan harus diisi"),
          konversiUuid: yup.string().required("Satuan Beli harus diisi"),
          satuanOptions: yup.array().optional(),
        })
      ),
    }).noUnknown()
);

// Form State Management
const { errors, handleSubmit, defineField, setValues, values, resetForm } = useForm({
  validationSchema: schema,
  initialValues: {
    items: [
      {
        itemUuid: "",
        qtyOrder: 0,
        hargaSatuan: 0,
        konversiUuid: "",
        satuanOptions: [],
      },
    ],
  },
});

//form fields
const [lokasiStokUuid] = defineField("lokasiStokUuid");
const [kategoriItem] = defineField("kategoriItem");
const [jenisItem] = defineField("jenisItem");
const [jenisStokUuid] = defineField("jenisStokUuid");
const [supplierUuid] = defineField("supplierUuid");
const [tanggalPembelian] = defineField("tanggalPembelian");
const [metodePembelian] = defineField("metodePembelian");
const [catatanPo] = defineField("catatanPo");
const [isCito] = defineField("isCito");

interface penjualanObat {
  itemUuid: string;
  qtyOrder: number;
  hargaSatuan: number;
  konversiUuid: string;
  satuanOptions: any[];
}

const { remove, push, fields: filedsPenjualan } = useFieldArray<penjualanObat>("items");

const addRow = () => {
  push({
    itemUuid: "",
    qtyOrder: 0,
    hargaSatuan: 0,
    konversiUuid: "",
    satuanOptions: [],
  });
};

const handleReset = () => {
  // Reset Form Vee-Validate (Inputan & Tabel Item)
  resetForm();

  // Reset State Manual (Kalkulasi Harga)
  diskon.value = 0;
  materai.value = 0;
  ppn.value = 0;
  grandTotal.value = 0;
  totalItem.value = 0;

  //  Generate Ulang No Pembelian
  noPembelian.value = generateRandomNoPembelian();
  SupplierPayload.value = [];
  MedicalItemPayload.value = [];
};

// State Management
const diskon = ref(0);
const materai = ref(0);
const ppn = ref(0);
const grandTotal = ref(0);
const petugasPembelian = ref("-");
const totalItem = ref(0);
const noPembelian = ref("");
const StockLocationStore = useStorageLocationStore();
const StockLocationPayload = ref<any[]>([]);
const UseUtilsStore = utilsStore();
const toast = useToast();

// State Management PPN Dinamis
const PriceConfigurationStore = usePriceConfigurationStore();
const ppnPercentage = ref(0);

// Fetch Konfigurasi PPN
const fetchPpnConfig = async () => {
  try {
    const response = await PriceConfigurationStore.getApiKonfig();
    if (response && response.payload) {
      ppnPercentage.value = response.payload.ppn || 0;
    }
  } catch (error) {
    console.error("Gagal mengambil konfigurasi PPN", error);
    ppnPercentage.value = 11; // Fallback jika gagal fetch
  }
};

// Hitung nilai PPN berdasarkan grandTotal dan diskon
const ppnAmount = computed(() => {
  let subTotal = 0;
  filedsPenjualan.value.forEach((item) => {
    subTotal += item.value.qtyOrder * item.value.hargaSatuan;
  });
  const totalSetelahDiskon = subTotal - diskon.value;
  const nilaiPpn = totalSetelahDiskon * (ppnPercentage.value / 100);// ppnPercentage.value DARI STATE

  return nilaiPpn > 0 ? nilaiPpn : 0;
});


// Fetch Stock Location
const fetchStockLocation = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await StockLocationStore.getApi(1, "gudang", 9999);

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

// State Management
const SupplierStore = useSupplierStore();
const SupplierPayload = ref<any[]>([]);

// Fetch RulesOfUse
const fetchSupplierByCategory = async () => {
  // Ambil value kategoriItem dari form
  const currentCategory = values.kategoriItem || "";

  // Opsional: Jika belum pilih kategori, kosongkan list supplier (atau biarkan fetch semua jika API support string kosong)
  if (!currentCategory && props.DetailPayload === null) {
    SupplierPayload.value = [];
    return;
  }

  UseUtilsStore.setLoading(true);
  try {
    // Panggil API baru dari PurchasingOfSupplierStore
    const response = await PurchasingOfSupplierStore.getSupplierByCategory(currentCategory);

    if (response && response.payload) {
      SupplierPayload.value = response.payload;
    } else {
      SupplierPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch supplier data", error);
    SupplierPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

watch(() => values.kategoriItem, (newVal) => {
  // Reset pilihan supplier sebelumnya karena mungkin tidak valid untuk kategori baru
  // (Kecuali saat pertama kali load edit data)
  if (values.supplierUuid) {
    values.supplierUuid = "";
  }
  fetchSupplierByCategory();
});

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


// State Management
const MedicalItemStore = useMedicalItemStore();
const MedicalItemPayload = ref<any[]>([]);


// Fetch Item Medis
const fetchItemMedis = async () => {
  // Ambil value dari form
  const currentJenisStok = values.jenisStokUuid || "";
  const currentJenisItem = values.jenisItem || "";

  try {
    const response = await PurchasingOfSupplierStore.getItemMedic(
      currentJenisStok,
      currentJenisItem
    );

    if (response && response.payload) {
      MedicalItemPayload.value = response.payload;
    } else {
      MedicalItemPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    MedicalItemPayload.value = [];
  }
};

watch(
  [() => values.jenisStokUuid, () => values.jenisItem],
  () => {
    fetchItemMedis();
  }
);

// Fetch Item Medis
const fetchSatuanItem = async (uuid: string): Promise<any[]> => {
  try {
    const response = await MedicalItemStore.getItemUnitApi(uuid);
    if (response && response.payload) {
      // Langsung return hasilnya
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

// untuk dilog multiple item
const isMultipleItemDialogVisible = ref(false);
const openMultipleItemDialog = () => {
  isMultipleItemDialogVisible.value = true;
};

// Handler untuk menerima item dari dialog multiple item
const handleMultipleItemsAdd = async (itemsFromDialog: any[]) => {
  for (const item of itemsFromDialog) {
    const isExist = filedsPenjualan.value.some(field => field.value.itemUuid === item.uuid);
    if (!isExist) {
      const satuanOptions = await fetchSatuanItem(item.uuid);
      push({
        itemUuid: item.uuid,
        qtyOrder: 1,
        hargaSatuan: 0,
        konversiUuid: "",
        satuanOptions: satuanOptions, // Langsung isi dengan data yang sudah di-fetch
      });
    }
  }
};

// State Management
const PurchasingOfSupplierStore = usePurchasingOfSupplierStore();
const selectedJenisStokName = computed(() => {
  const stok = StockTypePayload.value.find(s => s.uuid === values.jenisStokUuid);
  return stok ? stok.name : '';
});


const onSubmit = handleSubmit(async (values: any) => {
  if (values.tanggalPembelian instanceof Date && !isNaN(values.tanggalPembelian.getTime())) {
    values.tanggalPembelian = dateToEpoch(values.tanggalPembelian);
  } else {
    values.tanggalPembelian = null;
  }

  values.totalItem = totalItem.value;
  values.grandTotal = grandTotal.value;


  // Buat payload final dengan items yang sudah diproses
  const finalPayload = {
    lokasiStokUuid: values.lokasiStokUuid,
    kategoriItem: values.kategoriItem,
    jenisItem: values.jenisItem,
    jenisStokUuid: values.jenisStokUuid,
    supplierUuid: values.supplierUuid,
    tanggalPembelian: values.tanggalPembelian,
    metodePembelian: values.metodePembelian,
    catatanPo: values.catatanPo,
    isCito: values.isCito,
    diskon: diskon.value,
    materai: materai.value,
    ppn: ppn.value > 0,
    items: (values.items || []).map((item: any) => {
      return {
        item_uuid: item.itemUuid,
        qty_order: item.qtyOrder,
        harga_satuan: item.hargaSatuan,
        satuan_uuid: item.konversiUuid,
      };
    }),
  };
  UseUtilsStore.setLoading(true);
  try {
    let response;
    if (props.DetailPayload !== null) {
      response = await PurchasingOfSupplierStore.putApi(props.DetailPayload.uuid, finalPayload);
      toast.add({ severity: 'success', summary: 'Sukses', detail: 'Data pengadaan berhasil diupdate', life: 3000 });
      emit("backEdit");
    } else {
      response = await PurchasingOfSupplierStore.postApi(finalPayload);
      toast.add({ severity: 'success', summary: 'Sukses', detail: 'Supplier Berhasil ditambahkan', life: 3000 });
      emit("back");
    }
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
});

// Update satuanOptions ketika itemUuid berubah
const updateNameItem = async (index: number) => {
  const selectedItem = MedicalItemPayload.value.find(
    (item) => filedsPenjualan.value[index].value.itemUuid === item.uuid
  );

  if (selectedItem) {
    const satuanOptions = await fetchSatuanItem(selectedItem.uuid);
    // Simpan opsi ke state baris yang bersangkutan
    filedsPenjualan.value[index].value.satuanOptions = satuanOptions;
    // Reset pilihan satuan jika item diubah
    filedsPenjualan.value[index].value.konversiUuid = "";
  }
};



//calculate all totals
const calculateAllTotals = () => {
  let subTotal = 0;
  filedsPenjualan.value.forEach((item) => {
    subTotal += item.value.qtyOrder * item.value.hargaSatuan;
  });
  const totalSetelahDiskon = subTotal - diskon.value;
  // Cek apakah switch nyala (nilainya > 0)
  const ppnYangDitambahkan = ppn.value > 0 ? ppnAmount.value : 0;

  const finalTotal = totalSetelahDiskon + materai.value + ppnYangDitambahkan;
  grandTotal.value = Math.max(0, finalTotal);
  totalItem.value = filedsPenjualan.value.length;
};

// delete row
const handleDelete = (index: number) => {
  remove(index);
  calculateAllTotals();
};

onMounted(async () => {
  await fetchPpnConfig();
  fetchStockLocation();
  fetchStockType();
  fetchItemMedis();
  noPembelian.value = generateRandomNoPembelian();

  if (props.DetailPayload !== null) {
    const itemsFromPayload = props.DetailPayload.items.map((item: any) => ({
      itemUuid: item.itemUuid,
      qtyOrder: item.qtyOrder,
      hargaSatuan: item.hargaSatuan,
      konversiUuid: item.konversiUuid,
      nilaiKonversi: item.konversi || 1,
      satuanOptions: [],
    }));

    setValues({
      lokasiStokUuid: props.DetailPayload.lokasiStokUuid,
      kategoriItem: props.DetailPayload.kategoriItem,
      jenisItem: props.DetailPayload.jenisItem,
      jenisStokUuid: props.DetailPayload.jenisStokUuid,
      supplierUuid: props.DetailPayload.supplierUuid,
      tanggalPembelian: new Date(props.DetailPayload.tanggalPembelian * 1000),
      metodePembelian: props.DetailPayload.paymentMethod,
      catatanPo: props.DetailPayload.catatan,
      isCito: props.DetailPayload.cito,
      items: itemsFromPayload, // Gunakan data yang sudah di-map
    });

    ppn.value = props.DetailPayload.ppn ? ppnPercentage.value : 0;
    grandTotal.value = props.DetailPayload.grandTotal;
    await nextTick();
    await fetchSupplierByCategory();
    values.supplierUuid = props.DetailPayload.supplierUuid;

    // Fetch satuan untuk setiap item yang sudah ada
    const fetchPromises = filedsPenjualan.value.map(async (field, index) => {
      if (field.value.itemUuid) {
        const options = await fetchSatuanItem(field.value.itemUuid);
        field.value.satuanOptions = options;
      }
    });

    // Jalankan semua fetch secara paralel
    await Promise.all(fetchPromises);
  }
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
                  label: 'Pengadaan Barang',
                  home: true,
                }" />
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-opensimrs-300" />
                <div class="">
                  <p class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]">
                    Pembelian Barang Supplier
                  </p>
                </div>
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-grey-300" />
                <div class="">
                  <p class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]">
                    Tambah Pembelian
                  </p>
                </div>
              </div>
              <div class="flex">
                <CustomButton @click="emit('back')" icon="PhCaretLeft" label="Kembali" class="mr-[10px]" outlined
                  borderColor="border-opensimrs-300" textColor="text-opensimrs-300" />
              </div>
            </div>
          </template>
          <template #content>
            <div class="flex flex-col gap-2.5">
              <div class="flex gap-5 pt-2.5">
                <CustomTextfield label="No Pembelian" v-model="noPembelian" class="w-[200px]" disabled />
                <CustomSelect label="Lokasi Penerima" placeHolder="Pilih Lokasi Penerima" v-model="lokasiStokUuid"
                  :options="StockLocationPayload" class="w-[270px]" optionLabel="name" optionValue="uuid"
                  :invalid="!!errors.lokasiStokUuid" :invalidMessage="errors.lokasiStokUuid"
                  :required="errors.lokasiStokUuid ? true : false" />
                <CustomSelect label="Kategori Item" placeHolder="Pilih Kategori Item" v-model="kategoriItem"
                  :options="optionKategori" class="w-[200px]" optionLabel="name" optionValue="value"
                  :invalid="!!errors.kategoriItem" :invalidMessage="errors.kategoriItem"
                  :required="errors.kategoriItem ? true : false" />
                <CustomSelect label="Jenis Item" placeHolder="Pilih Jenis Item" v-model="jenisItem"
                  :options="optionJenis" class="w-[200px]" optionLabel="name" optionValue="value"
                  :invalid="!!errors.jenisItem" :invalidMessage="errors.jenisItem"
                  :required="errors.jenisItem ? true : false" />
                <CustomSelect label="Jenis Stok" placeHolder="Pilih Jenis Stok" class="grow" v-model="jenisStokUuid"
                  :options="StockTypePayload" optionLabel="name" optionValue="uuid" :invalid="!!errors.jenisStokUuid"
                  :invalidMessage="errors.jenisStokUuid" :required="errors.jenisStokUuid ? true : false" />
              </div>
              <div class="flex gap-5">
                <CustomSelect label="Supplier" v-model="supplierUuid" class="w-[270px]" placeHolder="Pilih Supplier"
                  :options="SupplierPayload" optionLabel="nama" optionValue="uuid" :invalid="!!errors.supplierUuid"
                  :invalidMessage="errors.supplierUuid" :required="errors.supplierUuid ? true : false" />
                <CustomDatePicker v-model="tanggalPembelian" label="Tgl. PO" class="w-[150px]"
                  :invalid="!!errors.tanggalPembelian" :invalidMessage="errors.tanggalPembelian"
                  :required="errors.tanggalPembelian ? true : false" />
                <CustomSelect label="Cara Bayar" placeHolder="Cara Bayar" v-model="metodePembelian" class="w-[150px]"
                  optionLabel="name" optionValue="value" :options="optionPay" :invalid="!!errors.metodePembelian"
                  :invalidMessage="errors.metodePembelian" :required="errors.metodePembelian ? true : false" />
                <CustomTextfield label="Catatan" placeholder="Catatan" class="grow" v-model="catatanPo"
                  :invalid="!!errors.catatanPo" :invalidMessage="errors.catatanPo"
                  :required="errors.catatanPo ? true : false" />
                <CustomSwitch label="Cito" v-model="isCito" />
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
            <DataTable :value="filedsPenjualan" class="text-black" stripedRows scrollable scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }">
              <Column field="No." headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold text-center">No.</div>
                </template>
                <template #body="slotProps">
                  <div class="text-center">
                    <div class="text-sm">{{ slotProps.index + 1 }}</div>
                  </div>
                </template>
              </Column>

              <Column header="Nama Item" headerClass="bg-opensimrs-50" style="width: 30%">
                <template #body="slotProps">
                  <CustomSelect v-model="slotProps.data.value.itemUuid"
                    @update:model-value="updateNameItem(slotProps.index)" :showLabel="false"
                    prependIcon="PhMagnifyingGlass" place-holder="Cari Item" optionLabel="nama" optionValue="uuid"
                    :options="MedicalItemPayload"
                    :invalid="(errors as any)[`items[${slotProps.index}].itemUuid`] ? true : false"
                    :invalidMessage="(errors as any)[`items[${slotProps.index}].itemUuid`]" />
                </template>
              </Column>

              <Column header="Jumlah Beli" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <CustomInputNumber class="w-[130px]" :showLabel="false" :show-buttons="true"
                    v-model="slotProps.data.value.qtyOrder"
                    :invalid="Boolean((errors as any)[`items[${slotProps.index}].qtyOrder`])"
                    :invalidMessage="(errors as any)[`items[${slotProps.index}].qtyOrder`] || ''" />
                </template>
              </Column>

              <Column header="Harga Satuan" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <CustomInputNumber v-model="slotProps.data.value.hargaSatuan" @update:model-value="calculateAllTotals"
                    :showLabel="false" placeholder="0" class="w-[150px]"
                    :invalid="(errors as any)[`items[${slotProps.index}].hargaSatuan`] ? true : false"
                    :invalidMessage="(errors as any)[`items[${slotProps.index}].hargaSatuan`]">
                    <template #prependText>
                      <div
                        class="font-semibold text-sm text-white rounded-l-lg bg-opensimrs-300 w-[50px] flex items-center justify-center border-r">
                        Rp.
                      </div>
                    </template>
                  </CustomInputNumber>
                </template>
              </Column>

              <Column header="Satuan Beli" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <CustomSelect v-model="slotProps.data.value.konversiUuid" :showLabel="false"
                    place-holder="Pilih Satuan Beli" optionLabel="satuanPembelian" optionValue="satuanPembelianUuid"
                    :options="slotProps.data.value.satuanOptions"
                    :invalid="(errors as any)[`items[${slotProps.index}].konversiUuid`] ? true : false"
                    :invalidMessage="(errors as any)[`items[${slotProps.index}].konversiUuid`]" />
                </template>
              </Column>

              <Column header="Total" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-center">
                    <div class="text-sm">
                      {{ formatPrice(slotProps.data.value.qtyOrder * slotProps.data.value.hargaSatuan *
                        (slotProps.data.value.nilaiKonversi || 1)) }}
                    </div>
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
          <div class="flex items-center justify-center p-3 border border-dashed rounded-lg border-opensimrs-300 mt-2">
            <CustomButton icon="PhPlus" label="Tambah Item" outlined borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300" @click="addRow" />
            <CustomButton icon="PhPlus" label="Tambah Item Multiple" outlined borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300" class="ml-2" @click="openMultipleItemDialog" />
          </div>
        </div>
      </template>

      <template #footer>
        <div class="p-4 border-t border-grey-200 bg-white">
          <div class="flex justify-between w-full">
            <div class="flex">
              <div>
                <p class="font-bold">Diskon</p>
                <CustomInputNumber v-model="diskon" @update:model-value="calculateAllTotals" :showLabel="false"
                  placeholder="0" class="mt-[10px]">
                  <template #prependText>
                    <div
                      class="font-semibold text-sm text-white rounded-l-lg bg-opensimrs-300 w-[50px] flex items-center justify-center border-r">
                      Rp.
                    </div>
                  </template>
                </CustomInputNumber>
              </div>
              <div class="ml-[20px]">
                <p class="font-bold">Materai</p>
                <CustomInputNumber v-model="materai" @update:model-value="calculateAllTotals" :showLabel="false"
                  placeholder="0" class="mt-[10px]">
                  <template #prependText>
                    <div
                      class="font-semibold text-sm text-white rounded-l-lg bg-opensimrs-300 w-[50px] flex items-center justify-center border-r">
                      Rp.
                    </div>
                  </template>
                </CustomInputNumber>
              </div>
              <div class="ml-[20px]">
                <p class="font-bold">PPN {{ ppnPercentage }}%</p>
                <div class="flex items-center mt-[10px]">
                  <CustomSwitch v-model="ppn" @update:model-value="calculateAllTotals" :show-label="false"
                    :binary="true" :trueValue="ppnPercentage" :falseValue="0" sideLabel="" sideLabelTrue="" />
                  <p class="ml-2 text-sm text-gray-600">{{ formatPrice(ppnAmount) }}</p>
                </div>
              </div>
            </div>
            <div class="flex">
              <div class="bg-opensimrs-300 w-[1.5px] h-[50px] mr-[20px] mt-[20px]"></div>
              <div class="mt-[20px] mr-[60px]">
                <p class="font-bold underline underline-offset-2">Grand Total</p>
                <p>{{ formatPrice(grandTotal) }}</p>
              </div>
            </div>
          </div>
          <hr class="mt-[20px] border-1 border-grey-200" />
          <div class="flex justify-between w-full mt-[10px]">
            <div class="flex items-center gap-6">
              <div>
                <p class="font-bold underline underline-offset-2">Total Item</p>
                <p>{{ totalItem }} item</p>
              </div>
              <div>
                <p class="font-bold underline underline-offset-2">Petugas Pembelian</p>
                <p>{{ petugasPembelian }}</p>
              </div>
            </div>
            <div class="flex">
              <CustomButton @click="emit('back')" label="Batal" outlined borderColor="border-mediumGrey-300"
                textColor="text-mediumGrey-400" class="mt-auto" />
              <CustomButton v-show="DetailPayload == null" label="Simpan Pembelian" class="mt-auto ml-[10px]"
                @click="onSubmit" />
              <CustomButton v-show="DetailPayload !== null" label="Ubah Pembelian" class="mt-auto ml-[10px]"
                @click="onSubmit" />
            </div>
          </div>
        </div>
      </template>
    </Card>

    <DialogPermintaanMultiple v-model:isDialogVisible="isMultipleItemDialogVisible" :kategori-item="values.kategoriItem"
      :jenis-stok="selectedJenisStokName" :jenis-item="values.jenisItem" :available-items="MedicalItemPayload"
      @add-items="handleMultipleItemsAdd" />
  </div>
</template>
