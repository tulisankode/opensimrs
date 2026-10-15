<script lang="ts" setup>
import { onMounted, computed, nextTick, watchEffect, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useSupplierStore } from "@/stores/inventory/supplier";
import { useDistrictStore } from "@/stores/datamaster/district";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
  },
  method: {
    type: String,
  },
  payload: {
    type: Object,
    default: () => ({}),
  },
});

const kategoriItem = ref([
  { name: "Medis", value: "medis" },
  { name: "Non-Medis", value: "non-medis" },
]);

// State untuk mode dialog
const method = ref(props.method);
const title = ref(props.title);

// schema validation dinamis berdasarkan mode
const schema = computed(() => {
  const isEditMode = method.value === 'edit';

  return toTypedSchema(
    yup.object({
      // Jika mode 'edit', buat opsional. Jika 'add', tetap required.
      code: isEditMode
        ? yup.string().optional()
        : yup.string().trim().required("Kode Supplier harus diisi"),
      name: isEditMode
        ? yup.string().optional()
        : yup.string().trim().required("Nama Supplier harus diisi"),
      alamat: isEditMode
        ? yup.string().optional()
        : yup.string().required("Alamat harus diisi"),
      noTlp: isEditMode
        ? yup.string().optional()
        : yup.string().required("No. Telepon harus diisi"),
      kategori: isEditMode
        ? yup.array().optional() // Boleh kosong saat edit
        : yup.array().min(1, "Minimal 1 kategori item harus dipilih").required("Kategori Item harus dipilih"),

      // Field alamat (provinsi, dll) sudah opsional (notRequired)
      provinsiCode: yup.string().notRequired(),
      kabupatenCode: yup.string().notRequired(),
      kecamatanCode: yup.string().notRequired(),
      kelurahanCode: yup.string().notRequired(),
      status: yup.bool().default(true),
    }).noUnknown()
  );
});

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema, // Gunakan skema dinamis
});

const [code] = defineField("code");
const [name] = defineField("name");
const [provinsiCode] = defineField("provinsiCode");
const [kabupatenCode] = defineField("kabupatenCode");
const [kecamatanCode] = defineField("kecamatanCode");
const [kelurahanCode] = defineField("kelurahanCode");
const [alamat] = defineField("alamat");
const [noTlp] = defineField("noTlp");
const [kategori] = defineField("kategori");
const [status] = defineField("status");

// State Management
const districtStore = useDistrictStore();
const provinsiPayload = ref<any[]>([]);
const kabupatenPayload = ref<any[]>([]);
const kecamatanPayload = ref<any[]>([]);
const kelurahanPayload = ref<any[]>([]);
const isUpdating = ref(false);

// Fetch Provinsi
const fetchProvinsi = async () => {
  try {
    const response = await districtStore.getProvinsiApi(); // Ambil data provinsi
    if (response && response.payload) {
      provinsiPayload.value = response.payload;
    } else {
      provinsiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch provinsi", error);
    provinsiPayload.value = [];
  }
};

// Fetch Kabupaten
const fetchKabupaten = async (provinsiId: string) => {
  try {
    const response = await districtStore.getKabupatenApi(provinsiId); // Berikan ID provinsi sebagai parameter
    if (response && response.payload) {
      kabupatenPayload.value = response.payload;
    } else {
      kabupatenPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kabupaten", error);
    kabupatenPayload.value = [];
  }
};

// Fetch Kecamatan berdasarkan Kabupaten terpilih
const fetchKecamatan = async (kabupatenId: string) => {
  try {
    const response = await districtStore.getKecamatanApi(kabupatenId); // Berikan ID kabupaten sebagai parameter
    if (response && response.payload) {
      kecamatanPayload.value = response.payload;
    } else {
      kecamatanPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kecamatan", error);
    kecamatanPayload.value = [];
  }
};

// Fetch Kelurahan berdasarkan Kecamatan terpilih
const fetchKelurahan = async (kecamatanId: string) => {
  try {
    const response = await districtStore.getKelurahanApi(kecamatanId); // Berikan ID kecamatan sebagai parameter
    if (response && response.payload) {
      kelurahanPayload.value = response.payload;
    } else {
      kelurahanPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kelurahan", error);
    kelurahanPayload.value = [];
  }
};

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const SupplierStore = useSupplierStore();

// Handle Submit
const onSubmit = handleSubmit(async (values: any) => {
  try {
    // Tentukan payload berdasarkan mode
    let newPayload: { [key: string]: any } = {};

    if (method.value === 'add') {
      // Mode ADD: Kirim semua pakai validasi yup
      newPayload = {
        name: values.name,
        code: values.code,
        provinsi_code: values.provinsiCode,
        kabupaten_code: values.kabupatenCode,
        kelurahan_code: values.kelurahanCode,
        kecamatan_code: values.kecamatanCode,
        alamat: values.alamat,
        no_tlp: values.noTlp,
        supllier_items: values.kategori.map((kategori: string) => ({
          kategori_item: kategori
        })),
        status: values.status
      };
    } else {
      // Mode EDIT: Kirim hanya yang ada nilainya
      newPayload = {}; // Mulai kosong
      if (values.name) newPayload.name = values.name;
      if (values.code) newPayload.code = values.code;
      if (values.provinsiCode) newPayload.provinsi_code = values.provinsiCode;
      if (values.kabupatenCode) newPayload.kabupaten_code = values.kabupatenCode;
      if (values.kelurahanCode) newPayload.kelurahan_code = values.kelurahanCode;
      if (values.kecamatanCode) newPayload.kecamatan_code = values.kecamatanCode;
      if (values.alamat) newPayload.alamat = values.alamat;
      if (values.noTlp) newPayload.no_tlp = values.noTlp;

      // Selalu kirim status
      newPayload.status = values.status;

      // Kirim array kategori (termasuk array kosong jika user menghapus semua)
      if (values.kategori) {
        newPayload.supllier_items = values.kategori.map((kategori: string) => ({
          kategori_item: kategori
        }));
      }
    }

    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await SupplierStore.putApi(uuid, newPayload);
      emit("data-updated");
    } else if (method.value === "add") {
      const response = await SupplierStore.postApi(newPayload);
      emit("data-updated");
    }
    closeDialog();
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
});

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

// Fungsi untuk mereset mode dialog
const resetDialogMode = () => {
  method.value = props.method;
  if (props.method === 'add') {
    title.value = "Tambah Data Supplier";
  } else if (props.method === 'edit') {
    title.value = "Ubah Data Supplier"; // Ganti judul edit
  } else {
    title.value = props.title; // Fallback
  }
};

const closeDialog = () => {
  emit("update:isDialogVisible", false);
  resetDialogMode();
  resetForm();
};

const handleEdit = () => {
  method.value = "edit";
  title.value = "Ubah Data Supplier"; // Ganti judul edit
};

// Watcher Provinsi
watch(provinsiCode, async (newProvinsi) => {
  if (isUpdating.value) return; // Hindari trigger watcher saat edit

  if (newProvinsi) {
    kabupatenCode.value = ""; // Reset kabupaten
    kecamatanCode.value = "";
    kelurahanCode.value = "";
    kelurahanPayload.value = [];

    await fetchKabupaten(newProvinsi);
  }
});

// Watcher Kabupaten
watch(kabupatenCode, async (newKabupaten) => {
  if (isUpdating.value) return;

  if (newKabupaten) {
    kecamatanCode.value = "";
    kelurahanCode.value = "";
    kelurahanPayload.value = [];

    await fetchKecamatan(newKabupaten);
  }
});

// Watcher Kecamatan
watch(kecamatanCode, async (newKecamatan) => {
  if (isUpdating.value) return;

  if (newKecamatan) {
    kelurahanCode.value = "";
    await fetchKelurahan(newKecamatan);
  }
});

// Watcher untuk Dialog (Edit)
watchEffect(async () => {
  if (props.isDialogVisible) {
    isUpdating.value = true;

    resetDialogMode();

    if (props.method !== "add" && props.payload) {
      const selectedKategoriItem = props.payload.supplierItems?.map(
        (item: any) =>
          item.kategoriItem
      ) || [];

      setValues({
        ...props.payload,
        kategori: selectedKategoriItem
      });


      await nextTick(); // Tunggu Vue menyelesaikan update sebelum lanjut

      // Atur kode wilayah tanpa memicu watcher
      provinsiCode.value = props.payload.provinsiCode || "";
      kabupatenCode.value = props.payload.kabupatenCode || "";
      kecamatanCode.value = props.payload.kecamatanCode || "";
      kelurahanCode.value = props.payload.kelurahanCode || "";

      // Setelah semua nilai di-set, baru panggil API
      if (provinsiCode.value) await fetchKabupaten(provinsiCode.value);
      if (kabupatenCode.value) await fetchKecamatan(kabupatenCode.value);
      if (kecamatanCode.value) await fetchKelurahan(kecamatanCode.value);
    }

    isUpdating.value = false; // Matikan flag setelah update selesai
  } else {
    resetForm();
    resetDialogMode();
  }
});

onMounted(() => {
  fetchProvinsi();
});
</script>

<template>
  <CustomDialog :visible="isDialogVisible" @update:visible="updateVisibility" width="750px">
    <template #header>
      <div v-if="method !== 'detail'" class="grid grid-cols-1">
        <p>{{ title }}</p>
      </div>
      <div v-if="method === 'detail'" class="grid grid-cols-1">
        <p>Detail Data Supplier</p>
      </div>
    </template>
    <template #body>
      <div v-if="method !== 'detail'">
        <div class="grid grid-cols-[25%,75%]">
          <div class="mt-[20px]">
            <CustomTextfield label="Kode Supplier" placeholder="Kode Supplier" class="mr-2" v-model="code"
              :invalid="!!errors.code" :invalidMessage="errors.code" />
          </div>
          <div class="mt-[20px]">
            <CustomTextfield label="Nama Supplier" placeholder="Nama Supplier" class="ml-2" v-model="name"
              :invalid="!!errors.name" :invalidMessage="errors.name" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="mt-[20px]">
            <CustomSelect label="Provinsi" placeHolder="Pilih Provinsi" v-model="provinsiCode"
              :options="provinsiPayload" optionValue="code" optionLabel="name" :invalid="!!errors.provinsiCode"
              :invalidMessage="errors.provinsiCode" />
          </div>
          <div class="mt-[20px]">
            <CustomSelect label="Kab/Kota" placeHolder="Pilih Kab/Kota" v-model="kabupatenCode"
              :options="kabupatenPayload" optionValue="code" optionLabel="name" :invalid="!!errors.kabupatenCode"
              :invalidMessage="errors.kabupatenCode" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="mt-[20px]">
            <CustomSelect label="Kecamatan" placeHolder="Pilih Kecamatan" v-model="kecamatanCode"
              :options="kecamatanPayload" optionValue="code" optionLabel="name" :invalid="!!errors.kecamatanCode"
              :invalidMessage="errors.kecamatanCode" />
          </div>
          <div class="mt-[20px]">
            <CustomSelect label="Kel/Desa" placeHolder="Pilih Kel/Desa" v-model="kelurahanCode"
              :options="kelurahanPayload" optionValue="code" optionLabel="name" :invalid="!!errors.kelurahanCode"
              :invalidMessage="errors.kelurahanCode" />
          </div>
        </div>
        <div class="grid grid-cols-1">
          <div class="mt-[20px]">
            <CustomTextfield label="Alamat" placeholder="Alamat" v-model="alamat" :invalid="!!errors.alamat"
              :invalidMessage="errors.alamat" />
          </div>
        </div>
        <div class="grid grid-cols-[25%,75%]">
          <div class="mt-[20px]">
            <CustomTextfield label="No. Telepon" placeholder="0812-XXXX-XXXX" class="mr-2" v-model="noTlp"
              :invalid="!!errors.noTlp" :invalidMessage="errors.noTlp" />
          </div>
          <div class="mt-[20px]">
            <CustomMultiSelect class="ml-2" label="Kategori Item" v-model="kategori" :options="kategoriItem"
              placeholder="Pilih Kategori Item" optionValue="value" optionLabel="name" :invalid="!!errors.kategori"
              :invalidMessage="errors.kategori" />
          </div>
        </div>
        <hr class="mt-[20px] border-grey-200" />
        <div class="mt-[10px]">
          <CustomSwitch label="Status" v-model="status" sideLabel="Tidak Aktif" sideLabelTrue="Aktif" />
        </div>
      </div>
      <div v-if="method === 'detail'">
        <div class="grid grid-cols-[25%,75%]">
          <!-- Kode Supplier -->
          <div>
            <p class="mt-[10px] font-bold">Kode Supplier</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.code }}</p>
          </div>
          <!-- Nama Supplier -->
          <div>
            <p class="mt-[10px] font-bold">Nama Supplier</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.name }}</p>
          </div>
          <!-- Provinsi -->
          <div>
            <p class="mt-[10px] font-bold">Provinsi</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.province.name }}</p>
          </div>
          <!-- Kabupaten -->
          <div>
            <p class="mt-[10px] font-bold">Kabupaten</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.kabupaten.name }}</p>
          </div>
          <!-- Kecamatan -->
          <div>
            <p class="mt-[10px] font-bold">Kecamatan</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.kecamatan.name }}</p>
          </div>
          <!-- Kelurahan -->
          <div>
            <p class="mt-[10px] font-bold">Kelurahan</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.kelurahan.name }}</p>
          </div>
          <!-- Alamat -->
          <div>
            <p class="mt-[10px] font-bold">Alamat</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.alamat }}</p>
          </div>
          <!-- No. Telepon -->
          <div>
            <p class="mt-[10px] font-bold">No. Telepon</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.noTlp }}</p>
          </div>
          <!-- No. Telepon -->
          <div>
            <p class="mt-[10px] font-bold">Kategori Item</p>
          </div>
          <div class="flex mt-[10px]">
            :
            <div class="ml-[5px]" v-for="items in payload.supplierItems" :key="items">
              <CustomChip :label="items.kategoriItem" :showCheckedIcon="false" borderColor="border-opensimrs-300"
                bgColor="bg-opensimrs-300" textColor="text-white" customClass="h-6" />
            </div>
          </div>
        </div>
        <hr class="mt-[20px] border border-slate-300" />
        <div class="grid grid-cols-1">
          <div class="flex">
            <p class="mt-[20px] font-bold">
              Status <span class="font-normal ml-[120px]">:</span>
            </p>
            <CustomChip :label="status ? 'AKTIF' : 'NON-AKTIF'" :textColor="status ? 'text-white' : 'text-[#80868d]'"
              :bgColor="status ? 'bg-opensimrs-300' : 'bg-white'"
              :borderColor="status ? 'border-none' : 'border-[#80868d]'" :icon-color="status ? 'white' : '#80868d'"
              customClass="text-xs font-semibold h-5 flex" class="mt-[23px] ml-[5px]" />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton v-if="method !== 'detail'" label="Reset" textColor="text-grey-300"
            backgroundColor="bg-transparent" borderColor="border-2 border-grey-200" @click="resetForm" />
          <CustomButton v-if="method !== 'detail'" label="Simpan" @click="onSubmit" />
          <CustomButton v-if="method === 'detail'" label="Ubah Data" @click="handleEdit" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
