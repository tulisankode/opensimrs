<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useSupplierReturnsStore } from "@/stores/inventory/supplierReturns";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { utilsStore } from "@/stores/utils";
import { useForm, useFieldArray } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { epochToDate, formatPrice, dateToEpoch, formatDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";

const props = defineProps({
  selectedData: {
    type: Object,
    default: () => ({}),
  },
});

const nominalPenggantian = ref(0);
const tglPenggantian = ref<Date>(new Date());
const jenisPenggantian = ref("barang");
const options = ref([
  { name: "Barang", value: "barang" },
  { name: "Uang", value: "uang" },
]);

const listAlasanReturs = ref([
  { id: 1, value: "Rusak" },
  { id: 2, value: "Kadaluarsa" },
  { id: 3, value: "Salah/Ingin diganti" },
  { id: 4, value: "Sisa Pemakaian Ruangan" },
]);

const isReturMode = computed(() => DetailPayload.value?.status === 'retur' || !DetailPayload.value?.status);

// Alasan Retur Text
const alasanReturText = computed(() => {
  const idAlasan = DetailPayload.value.alasanRetur;
  if (!idAlasan) return '-';

  const alasan = listAlasanReturs.value.find(item => item.id === idAlasan);
  return alasan ? alasan.value : '-';
});

// Format Date
function formatDateString(date: any) {
  if (!date) return '-'; // Jika data tidak ada, kembalikan '-'
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return '-'; // Jika tanggal tidak valid, kembalikan '-'

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${day}-${month}-${year}`;
}

// Fetch Satuan Item
const fetchSatuanItem = async (uuid: string): Promise<any[]> => {
  try {
    const response = await MedicalItemStore.getItemUnitApi(uuid);
    if (response && response.payload) {
      return Array.isArray(response.payload) ? response.payload : [response.payload];
    }
    return [];
  } catch (error) {
    console.error("Gagal mengambil data satuan item:", error);
    return [];
  }
};

const schema = toTypedSchema(
  yup
    .object({
      items: yup.array().of(
        yup.object({
          itemUuid: yup.string().required("Nama Item harus dipilih"),
          qty: yup.number().required("Jumlah Beli harus diisi"),
          harga: yup.number().required("Harga Satuan harus diisi"),
          konversiUuid: yup.string().required("Satuan Beli harus diisi"),
        })
      ),
    })
    .noUnknown()
);

const { errors, handleSubmit, defineField, setValues } = useForm({
  validationSchema: schema,
});

// Form Fields
interface retur {
  itemUuid: string;
  qty: number;
  konversiUuid: string;
  harga: number;
  // Tambahan untuk display
  name?: string;
  expDate?: string;
  konversi?: string;
  totalHarga?: number;
  satuanOptions?: any[];
}

const { remove, push, fields: filedsRetur } = useFieldArray<retur>("items");

const addRow = () => {
  push({
    itemUuid: "",
    qty: 1,
    harga: 0,
    konversiUuid: "",
  });
};

const handleDelete = (index: number) => {
  remove(index);
};

// State Management
const SupplierReturnsStore = useSupplierReturnsStore();
const UseUtilsStore = utilsStore();
const DetailPayload = ref<any>({});
const ppnPercentage = ref(0);
const emit = defineEmits(["back"]);

// Fetch Detail
const fetchDetail = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await SupplierReturnsStore.getApiDetail(props.selectedData.uuid);
    if (response && response.payload) {
      DetailPayload.value = response.payload;
      nominalPenggantian.value = response.payload.nominalPenggantian || 0;
      diskon.value = response.payload.diskon || 0;
      materai.value = response.payload.materai || 0;
      ppnPercentage.value = response.payload.ppn || 0;
      ppn.value = (ppnPercentage.value > 0) ? ppnPercentage.value : 0;
      while (filedsRetur.value.length) {
        remove(0);
      }

      if (response.payload.items && response.payload.items.length > 0) {
        for (const item of response.payload.items) {
          // [BARU] Ambil data satuan untuk item ini
          const satuanOptions = await fetchSatuanItem(item.itemUuid);

          push({
            itemUuid: item.itemUuid,
            qty: item.qty,
            harga: item.harga,
            konversiUuid: item.konversiUuid,
            name: item.name,
            expDate: item.expDate,
            konversi: item.konversi,
            totalHarga: item.qty * item.harga,
            satuanOptions: satuanOptions,
          });
        }
      }
    } else {
      DetailPayload.value = {};
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};
// State Management
const MedicalItemStore = useMedicalItemStore();
const MedicalItemPayload = ref<any[]>([]);
const SatuanItemPayload = ref<any[]>([]);

// Fetch Item Medis
const fetchItemMedis = async () => {
  try {
    const response = await MedicalItemStore.getItemMedisApi(1, 9999);

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

// Update Nama Item
const updateNameItem = async (index: number) => {
  const selectedItemUuid = filedsRetur.value[index].value.itemUuid;
  const selectedItem = MedicalItemPayload.value.find(
    (item) => item.uuid === selectedItemUuid
  );

  if (selectedItem) {
    const satuanOptions = await fetchSatuanItem(selectedItem.uuid);
    filedsRetur.value[index].value.satuanOptions = satuanOptions;
    filedsRetur.value[index].value.harga = selectedItem.harga || 0;
    filedsRetur.value[index].value.konversiUuid = "";
  }
};

// Perhitungan Grand Total
const diskon = ref(0);
const materai = ref(0);
const ppn = ref(0); // Untuk state switch PPN (bernilai 0 atau 11)
const grandTotal = ref(0);

// Menghitung subtotal berdasarkan mode (barang atau uang)
const subTotal = computed(() => {
  if (jenisPenggantian.value === 'uang') {
    return nominalPenggantian.value;
  }
  // Jika mode barang, hitung dari total item
  return (filedsRetur.value || []).reduce((total, item) => {
    return total + (item.value.qty * item.value.harga);
  }, 0);
});

// Menghitung nilai PPN 11% dari subtotal setelah diskon
const ppnAmount = computed(() => {
  const totalSetelahDiskon = subTotal.value - diskon.value;

  // Gunakan nilai switch (ppn.value). 
  // Jika switch ON, nilainya adalah ppnPercentage (misal 2).
  // Jika OFF, nilainya 0.
  const nilaiPpn = totalSetelahDiskon * (ppn.value / 100);

  return Math.max(0, nilaiPpn);
});

// 3. Tambahan Computed untuk Mode 'Terima' (Read Only)
// Karena di mode terima kita perlu menghitung manual nominalnya dari payload
const ppnNominalReadMode = computed(() => {
  if (!DetailPayload.value.items) return 0;

  // Hitung total item dari detail
  const subTotalItems = DetailPayload.value.items.reduce((acc: number, item: any) => {
    return acc + (item.qty * item.harga); // Sesuaikan field API jika beda (qty vs qty_retur)
  }, 0);

  // Logic: (SubTotal - Diskon) * (PersenPPN / 100)
  const taxable = subTotalItems - (DetailPayload.value.diskon || 0);
  const percent = DetailPayload.value.ppn || 0;

  return taxable * (percent / 100);
});

// Watcher yang akan otomatis menghitung ulang Grand Total jika ada perubahan
watch([subTotal, diskon, materai, ppn], () => {
  const totalSetelahDiskon = subTotal.value - diskon.value;

  // Hitung PPN dinamis: (Total - Diskon) * (Nilai Switch / 100)
  const ppnYangDitambahkan = ppn.value > 0 ? ppnAmount.value : 0;

  const finalTotal = totalSetelahDiskon + materai.value + ppnYangDitambahkan;
  grandTotal.value = Math.max(0, finalTotal);
}, { immediate: true });

// Submit Form
const onSubmit = async () => {
  UseUtilsStore.setLoading(true);

  // Siapkan payload dasar
  const payload: any = {
    tanggal_penggantian: dateToEpoch(tglPenggantian.value),
    type: jenisPenggantian.value,
  };

  // Sesuaikan payload berdasarkan tipe penggantian
  if (jenisPenggantian.value === 'uang') {
    payload.harga = nominalPenggantian.value;
  } else {
    payload.items = filedsRetur.value
      .filter(item => item.value.qty > 0)
      .map(itemField => {
        const item = itemField.value; // Akses value dari field
        let formattedExpDate: string | null = null;
        // Cek jika item.expDate adalah string DD-MM-YYYY
        if (typeof item.expDate === 'string' && item.expDate.match(/^\d{2}-\d{2}-\d{4}$/)) {
          try {
            // Parse DD-MM-YYYY secara manual
            const parts = item.expDate.split('-');
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Bulan di JS mulai dari 0
            const year = parseInt(parts[2], 10);
            const dateObj = new Date(year, month, day);

            // Cek lagi apakah tanggal valid setelah parsing manual
            if (!isNaN(dateObj.getTime()) && dateObj.getDate() === day && dateObj.getMonth() === month && dateObj.getFullYear() === year) {
              formattedExpDate = formatDate(dateObj, true);
            } else {
              console.warn(`Format DD-MM-YYYY tidak valid: ${item.expDate}`);
            }
          } catch (e) {
            console.error(`Error parsing DD-MM-YYYY (${item.expDate}):`, e);
          }
        } else if (item.expDate) {
          try {
            const dateObj = new Date(item.expDate);
            if (!isNaN(dateObj.getTime())) {
              formattedExpDate = formatDate(dateObj, true);
            } else {
              console.warn(`Format expDate lain tidak valid: ${item.expDate}`);
            }
          } catch (e) {
            console.error(`Error parsing expDate lain (${item.expDate}):`, e);
          }
        }
        return {
          item_uuid: item.itemUuid,
          qty_retur: item.qty,
          konversi_uuid: item.konversiUuid,
          harga_satuan: item.harga,
          exp_date: formattedExpDate, // Kirim YYYY-MM-DD atau null
        };
      });

    // Tambahkan validasi jika tidak ada item yang diretur setelah filter
    if (payload.items.length === 0) {
      alert("Peringatan: Tidak ada item dengan jumlah retur lebih dari 0.");
      UseUtilsStore.setLoading(false);
      return;
    }
  }

  try {
    console.log("Mengirim payload:", JSON.stringify(payload, null, 2));
    await SupplierReturnsStore.putApi(props.selectedData.uuid, payload);
    emit("back");
  } catch (error: any) {
    console.error("GAGAL MENYIMPAN PENGGANTIAN RETUR:", error.response?.data || error.message || error);
    // Tampilkan pesan error ke user jika perlu
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

onMounted(() => {
  fetchDetail();
  fetchItemMedis();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 pb-0 overflow-auto" pt:content:class="h-full overflow-hidden"
      class="h-full overflow-hidden overflow-y-auto">
      <template #header>
        <CustomAccordion :openWithHeader="false" noBorder initialState="0">
          <template #header>
            <div class="flex justify-between w-full align-middle">
              <div class="flex">
                <CustomButton icon="PhArrowClockwise" class="mr-5" @click="fetchDetail()" />
                <CustomBreadCrumb :home="{
                  label: 'Pengadaan Barang',
                  home: true,
                }" />
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-opensimrs-300" />
                <div class="">
                  <p class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]">Retur & penggantian Barang
                    Supplier</p>
                </div>
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-grey-300" />
                <div class="ml-[10px] mt-[5px]">
                  <CustomChip :label="DetailPayload.noReturSupplier || '-'" :showCheckedIcon="false"
                    borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" />
                </div>
                <div v-if="DetailPayload.status == 'retur'" class="ml-[10px] mt-[5px]">
                  <CustomChip label="RETUR" :showCheckedIcon="false" borderColor="border-lavender-300"
                    bgColor="bg-lavender-300" textColor="text-white" />
                </div>
                <div v-if="DetailPayload.status == 'terima'" class="ml-[10px] mt-[5px]">
                  <CustomChip label="DITERIMA" :showCheckedIcon="false" borderColor="border-info-300"
                    bgColor="bg-info-300" textColor="text-white" />
                </div>
              </div>
              <div class="flex">
                <CustomButton @click="emit('back')" icon="PhCaretLeft" label="Kembali" class="mr-[10px]" outlined
                  borderColor="border-opensimrs-300" textColor="text-opensimrs-300" />
              </div>
            </div>
          </template>
          <template #content>
            <template v-if="isReturMode">
              <div class="grid grid-cols-[1fr_1fr_auto_1fr_1fr_1fr] items-start gap-5 mt-[20px]">
                <div>
                  <p class="text-xs font-bold underline underline-offset-2">Tgl. Retur</p>
                  <p>{{ DetailPayload.tanggalRetur ? epochToDate(DetailPayload.tanggalRetur, "date") : '-' }}</p>
                  <div class="mt-[5px]">
                    <p class="text-xs font-bold underline underline-offset-2">Alasan Retur</p>
                    <p>{{ alasanReturText }}</p>
                  </div>
                </div>
                <div>
                  <p class="text-xs font-bold underline underline-offset-2">Lokasi Gudang</p>
                  <p>{{ DetailPayload.lokasiGudang || '-' }}</p>
                  <div class="mt-[5px]">
                    <p class="text-xs font-bold underline underline-offset-2">Catatan</p>
                    <p>{{ DetailPayload.catatan || '-' }}</p>
                  </div>
                </div>
                <div class="h-16 w-px bg-opensimrs-300 self-center"></div>
                <div>
                  <CustomSelect label="Jenis Penggantian" placeHolder="Pilih Jenis Penggantian"
                    v-model="jenisPenggantian" :options="options" optionLabel="name" optionValue="value" />
                </div>
                <div>
                  <CustomDatePicker v-model="tglPenggantian" label="Tgl. Penggantian" />
                </div>
              </div>
              <hr class="mt-[20px] border-1 border-grey-200" />
              <div class="grid grid-cols-[1fr_1fr_auto_1fr_1fr_1fr] items-start gap-5 mt-[20px]">
                <div>
                  <p class="text-xs font-bold underline underline-offset-2">No. Penerimaan</p>
                  <p>{{ DetailPayload.noPenerimaan || '-' }}</p>
                  <div class="mt-[5px]">
                    <p class="text-xs font-bold underline underline-offset-2">No. Faktur</p>
                    <p>{{ DetailPayload.noFaktur || '-' }}</p>
                  </div>
                </div>
                <div>
                  <p class="text-xs font-bold underline underline-offset-2">Tgl. Penerimaan</p>
                  <p>{{ DetailPayload.tanggalPenerimaan ? epochToDate(DetailPayload.tanggalPenerimaan, "date") : '-' }}
                  </p>
                  <div class="mt-[5px]">
                    <p class="text-xs font-bold underline underline-offset-2">Tgl. Faktur</p>
                    <p>{{ DetailPayload.tanggalFaktur ? epochToDate(DetailPayload.tanggalFaktur, "date") : '-' }}</p>
                  </div>
                </div>
                <div class="h-20 w-px bg-opensimrs-300 self-center"></div>
                <div>
                  <p class="text-xs font-bold underline underline-offset-2">Supplier</p>
                  <p>{{ DetailPayload.supplier || '-' }}</p>
                  <div class="mt-[5px]">
                    <p class="text-xs font-bold underline underline-offset-2">Jenis Item</p>
                    <p>{{ DetailPayload.jenisItem || '-' }}</p>
                  </div>
                </div>
                <div>
                  <p class="text-xs font-bold underline underline-offset-2">Kategori</p>
                  <p>{{ DetailPayload.kategoriItem || '-' }}</p>
                  <div class="mt-[5px]">
                    <p class="text-xs font-bold underline underline-offset-2">Cara Bayar</p>
                    <p>{{ DetailPayload.jenisPembayaran || '-' }}</p>
                  </div>
                </div>
                <div>
                  <p class="text-xs font-bold underline underline-offset-2">Jenis Stok</p>
                  <p>{{ DetailPayload.jenisStok || '-' }}</p>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="grid grid-cols-[1fr_1fr_auto_1fr_1fr_1fr] items-start gap-x-5 mt-5">
                <div>
                  <div>
                    <p class="text-xs font-bold underline underline-offset-2">No. Penerimaan</p>
                    <p>{{ DetailPayload.noPenerimaan || '-' }}</p>
                  </div>
                  <div class="mt-3">
                    <p class="text-xs font-bold underline underline-offset-2">No. Faktur</p>
                    <p>{{ DetailPayload.noFaktur || '-' }}</p>
                  </div>
                </div>
                <div>
                  <div>
                    <p class="text-xs font-bold underline underline-offset-2">Tgl. Penerimaan</p>
                    <p>{{ DetailPayload.tanggalPenerimaan ? epochToDate(DetailPayload.tanggalPenerimaan, "date") : '-'
                    }}</p>
                  </div>
                  <div class="mt-3">
                    <p class="text-xs font-bold underline underline-offset-2">Tgl. Faktur</p>
                    <p>{{ DetailPayload.tanggalFaktur ? epochToDate(DetailPayload.tanggalFaktur, "date") : '-' }}</p>
                  </div>
                </div>

                <div class="h-full w-px bg-gray-300"></div>

                <div>
                  <div>
                    <p class="text-xs font-bold underline underline-offset-2">Supplier</p>
                    <p>{{ DetailPayload.supplier || '-' }}</p>
                  </div>
                  <div class="mt-3">
                    <p class="text-xs font-bold underline underline-offset-2">Jenis Item</p>
                    <p>{{ DetailPayload.jenisItem || '-' }}</p>
                  </div>
                </div>
                <div>
                  <div>
                    <p class="text-xs font-bold underline underline-offset-2">Kategori</p>
                    <p>{{ DetailPayload.kategoriItem || '-' }}</p>
                  </div>
                  <div class="mt-3">
                    <p class="text-xs font-bold underline underline-offset-2">Cara Bayar</p>
                    <p>{{ DetailPayload.jenisPembayaran || '-' }}</p>
                  </div>
                </div>
                <div>
                  <p class="text-xs font-bold underline underline-offset-2">Jenis Stok</p>
                  <p>{{ DetailPayload.jenisStok || '-' }}</p>
                </div>
              </div>

              <hr class="mt-5 border-gray-200" />

              <div class="grid grid-cols-[1fr_1fr_auto_1fr_1fr_1fr] items-start gap-x-5 mt-5">
                <div>
                  <div>
                    <p class="text-xs font-bold underline underline-offset-2">Tgl. Retur</p>
                    <p>{{ DetailPayload.tanggalRetur ? epochToDate(DetailPayload.tanggalRetur, "date") : '-' }}</p>
                  </div>
                  <div class="mt-3">
                    <p class="text-xs font-bold underline underline-offset-2">Alasan Retur</p>
                    <p>{{ alasanReturText }}</p>
                  </div>
                </div>
                <div>
                  <div>
                    <p class="text-xs font-bold underline underline-offset-2">Lokasi Gudang</p>
                    <p>{{ DetailPayload.lokasiGudang || '-' }}</p>
                  </div>
                  <div class="mt-3">
                    <p class="text-xs font-bold underline underline-offset-2">Catatan</p>
                    <p>{{ DetailPayload.catatan || '-' }}</p>
                  </div>
                </div>

                <div class="h-full w-px bg-gray-300"></div>

                <div>
                  <div>
                    <p class="text-xs font-bold underline underline-offset-2">Jenis Penggantian</p>
                    <p class="capitalize">{{ DetailPayload.jenisPenggantian || '-' }}</p>
                  </div>
                  <div class="mt-3">
                    <p class="text-xs font-bold underline underline-offset-2">Tgl. Penggantian</p>
                    <p>{{ DetailPayload.tanggalPenggantian ? epochToDate(DetailPayload.tanggalPenggantian, "date") :
                      '-' }}</p>
                  </div>
                </div>
              </div>
            </template>
            <hr class="mt-[20px] border-1 border-grey-200" />
            <template v-if="isReturMode">
              <div v-if="jenisPenggantian == 'barang'" class="mt-5">
                <DataTable :value="filedsRetur" scrollable scrollHeight="200px" :pt="{ headerRow: 'text-SM' }">
                  <Column header="No." headerClass="bg-opensimrs-50 w-12"><template #body="slotProps">{{ slotProps.index +
                    1 }}</template>
                  </Column>
                  <Column header="Nama Item" headerClass="bg-opensimrs-50" style="width: 25%"><template #body="slotProps">
                      <CustomSelect v-model="slotProps.data.value.itemUuid" :showLabel="false"
                        :placeholder="slotProps.data.value.name || 'Cari Item'" prependIcon="PhMagnifyingGlass"
                        optionLabel="name" optionValue="uuid" :options="MedicalItemPayload"
                        @update:model-value="updateNameItem(slotProps.index)" />
                    </template>
                  </Column>
                  <Column header="Exp. Date" headerClass="bg-opensimrs-50"><template #body="slotProps">{{
                    formatDateString(slotProps.data.value.expDate) }}</template></Column>
                  <Column header="Terima Retur" headerClass="bg-opensimrs-50"><template #body="slotProps">
                      <CustomInputNumber v-model="slotProps.data.value.qty" class="w-[130px]" :showLabel="false"
                        :show-buttons="true" />
                    </template>
                  </Column>
                  <Column header="Satuan/Isi" headerClass="bg-opensimrs-50"><template #body="slotProps">
                      <CustomSelect v-model="slotProps.data.value.konversiUuid" :showLabel="false"
                        :placeholder="slotProps.data.value.konversi || 'Pilih Satuan'" optionLabel="satuanPembelian"
                        optionValue="uuid" :options="slotProps.data.value.satuanOptions" />
                    </template>
                  </Column>
                  <Column header="Harga Satuan" headerClass="bg-opensimrs-50"><template #body="slotProps">
                      <CustomInputNumber v-model="slotProps.data.value.harga" :showLabel="false" placeholder="0"
                        class="w-[150px]"><template #prependText>
                          <div
                            class="font-semibold text-sm text-white rounded-l-lg bg-opensimrs-300 w-12 flex items-center justify-center border-r">
                            Rp.</div>
                        </template>
                      </CustomInputNumber>
                    </template></Column>
                  <Column header="Total" headerClass="bg-opensimrs-50"><template #body="slotProps">{{
                    formatPrice(slotProps.data.value.qty * slotProps.data.value.harga) }}</template></Column>
                  <Column header="Action" headerClass="bg-opensimrs-50"><template #body="slotProps">
                      <div class="flex justify-center">
                        <CustomButton @click="handleDelete(slotProps.index)" :showLabel="false"
                          background-color="bg-danger-300 rounded-lg" class="h-6 w-6 p-0">
                          <PhTrash :size="15" weight="fill" class="text-white" />
                        </CustomButton>
                      </div>
                    </template>
                  </Column>
                </DataTable>
                <div
                  class="flex items-center justify-center gap-4 p-5 mt-4 border border-dashed rounded-lg border-opensimrs-300">
                  <CustomButton icon="PhPlus" label="Tambah Item" outlined borderColor="border-opensimrs-300"
                    textColor="text-opensimrs-300" @click="addRow" />
                </div>
              </div>
              <div v-if="jenisPenggantian == 'uang'" class="mt-5 flex justify-between items-center">
                <p class="font-bold whitespace-nowrap">Nominal Penggantian</p>
                <CustomInputNumber v-model="nominalPenggantian" :showLabel="false" placeholder="0" class="w-1/3">
                  <template #prependText>
                    <div
                      class="font-semibold text-sm text-white rounded-l-lg bg-opensimrs-300 w-12 flex items-center justify-center border-r">
                      Rp.</div>
                  </template>
                </CustomInputNumber>
              </div>
            </template>

            <template v-else>
              <div class="mt-5">
                <div v-if="DetailPayload.jenisPenggantian === 'barang'">
                  <DataTable :value="DetailPayload.items" :pt="{ headerRow: 'text-SM' }">
                    <Column header="No." headerClass="bg-opensimrs-50 w-12"><template #body="slotProps">{{ slotProps.index
                      + 1 }}</template>
                    </Column>
                    <Column field="name" header="Nama Item" headerClass="bg-opensimrs-50"></Column>
                    <Column header="Exp. Date" headerClass="bg-opensimrs-50"><template #body="slotProps">{{
                      formatDateString(slotProps.data.expDate) }}</template></Column>
                    <Column field="qty" header="Terima Retur" headerClass="bg-opensimrs-50"></Column>
                    <Column field="konversi" header="Satuan/Isi" headerClass="bg-opensimrs-50"></Column>
                    <Column header="Harga Satuan" headerClass="bg-opensimrs-50"><template #body="slotProps">{{
                      formatPrice(slotProps.data.harga) }}</template></Column>
                    <Column header="Total" headerClass="bg-opensimrs-50"><template #body="slotProps">{{
                      formatPrice(slotProps.data.qty * slotProps.data.harga) }}</template></Column>
                  </DataTable>
                </div>
                <div v-if="DetailPayload.jenisPenggantian === 'uang'" class="mt-5 flex justify-between items-center">
                  <p class="font-bold whitespace-nowrap">Nominal Penggantian</p>
                  <p class="font-semibold">{{ formatPrice(DetailPayload.nominalPenggantian) }}</p>
                </div>
              </div>
            </template>
          </template>
          <template #footer>
            <div class="p-2 ">
              <template v-if="isReturMode">
                <div class="flex justify-between w-full">
                  <div class="flex gap-5">
                    <div>
                      <p class="font-bold">Diskon</p>
                      <CustomInputNumber v-model="diskon" :showLabel="false" placeholder="0" class="mt-2.5">
                        <template #prependText>
                          <div
                            class="font-semibold text-sm text-white rounded-l-lg bg-opensimrs-300 w-12 flex items-center justify-center border-r">
                            Rp.</div>
                        </template>
                      </CustomInputNumber>
                    </div>
                    <div>
                      <p class="font-bold">Materai</p>
                      <CustomInputNumber v-model="materai" :showLabel="false" placeholder="0" class="mt-2.5">
                        <template #prependText>
                          <div
                            class="font-semibold text-sm text-white rounded-l-lg bg-opensimrs-300 w-12 flex items-center justify-center border-r">
                            Rp.</div>
                        </template>
                      </CustomInputNumber>
                    </div>
                    <div>
                      <p class="font-bold">PPN {{ ppnPercentage }}%</p>
                      <div class="flex items-center mt-2.5">
                        <CustomSwitch v-model="ppn" :show-label="false" :binary="true" :trueValue="ppnPercentage"
                          :falseValue="0" sideLabel="" sideLabelTrue="" />
                        <p class="ml-3 text-sm text-gray-600">{{ formatPrice(ppnAmount) }}</p>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center">
                    <div class="bg-opensimrs-300 w-px h-12 mr-5"></div>
                    <div>
                      <p class="font-bold underline underline-offset-2">Grand Total</p>
                      <p class="text-lg font-bold">{{ formatPrice(grandTotal) }}</p>
                    </div>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="flex justify-between w-full">
                  <div class="flex gap-10">
                    <div>
                      <p class="font-bold">Diskon</p>
                      <p class="mt-2.5">{{ formatPrice(DetailPayload.diskon) }}</p>
                    </div>
                    <div>
                      <p class="font-bold">Materai</p>
                      <p class="mt-2.5">{{ formatPrice(DetailPayload.materai) }}</p>
                    </div>
                    <div>
                      <p class="font-bold">PPN {{ DetailPayload.ppn }}%</p>
                      <p class="mt-2.5">{{ formatPrice(ppnNominalReadMode) }}</p>
                    </div>
                  </div>
                  <div class="flex items-center">
                    <div class="bg-opensimrs-300 w-px h-12 mr-5"></div>
                    <div>
                      <p class="font-bold underline underline-offset-2">Grand Total</p>
                      <p class="text-lg font-bold">{{ formatPrice(grandTotal) }}</p>
                    </div>
                  </div>
                </div>
              </template>

              <hr class="my-4" />

              <div class="flex justify-between">
                <div class="flex gap-16">
                  <div>
                    <p class="font-bold underline underline-offset-2">Total Item</p>
                    <p>{{ DetailPayload.totalItem || '-' }}</p>
                  </div>
                  <div>
                    <p class="font-bold underline underline-offset-2">Petugas Retur</p>
                    <p>{{ DetailPayload.petugasRetur || '-' }}</p>
                  </div>
                  <div>
                    <p class="font-bold underline underline-offset-2">Petugas Penerima Penggantian</p>
                    <p>{{ DetailPayload.petugasPenerimaPenggantian || '-' }}</p>
                  </div>
                </div>

                <div v-if="isReturMode" class="flex gap-3">
                  <CustomButton label="Reset" outlined borderColor="border-grey-300" textColor="text-grey-300" />
                  <CustomButton label="Simpan & Terima Penggantian" backgroundColor="bg-opensimrs-300"
                    borderColor="border-opensimrs-300" textColor="text-white" @click="onSubmit" />
                </div>
              </div>
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
    </Card>
  </div>
</template>