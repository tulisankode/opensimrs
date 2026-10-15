<script lang="ts" setup>
import { ref, watch, onMounted } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useManufacturingStore } from "@/stores/datamasterFarmasi/manufacturing";
import { useDistrictStore } from "@/stores/datamaster/district";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";

const props = defineProps({
  isDialogVisible: {
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

const districtStore = useDistrictStore();
const provinsiPayload = ref<any[]>([]);
const kabupatenPayload = ref<any[]>([]);
const kecamatanPayload = ref<any[]>([]);
const kelurahanPayload = ref<any[]>([]);

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

// Fetch Kecamatan
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

// Fetch Kelurahan
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

const schema = toTypedSchema(
  yup
    .object({
      code: yup.string().trim().required("Kode Satuan harus diisi"),
      name: yup.string().trim().required("Nama Satuan harus diisi"),
      kodePos: yup
        .string()
        .required("Kode Pos harus diisi")
        .matches(
          /^\d{5}$/,
          "Kode Pos harus tepat 5 angka dan harus berupa angka"
        ),
      alamat: yup
        .string()
        .required("Alamat harus diisi")
        .test(
          "no-only-spaces",
          "Alamat tidak boleh hanya berisi spasi",
          (value) => !!value && value.trim().length > 0
        ),
      provinsiCode: yup.string().required("Provinsi harus dipilih"),
      kabupatenCode: yup.string().required("Kabupaten harus dipilih"),
      kecamatanCode: yup.string().required("Kecamatan harus dipilih"),
      kelurahanCode: yup.string().required("Kelurahan harus dipilih"),
      status: yup.bool().default(true),
    })
    .noUnknown()
);

const {
  errors,
  handleSubmit,
  defineField,
  resetForm,
  setValues,
  setFieldError,
} = useForm({
  validationSchema: schema,
});
const ManufacturingStore = useManufacturingStore();

const [code] = defineField("code");
const [name] = defineField("name");
const [kodePos] = defineField("kodePos");
const [provinsiCode] = defineField("provinsiCode");
const [kabupatenCode] = defineField("kabupatenCode");
const [kecamatanCode] = defineField("kecamatanCode");
const [kelurahanCode] = defineField("kelurahanCode");
const [alamat] = defineField("alamat");
const [status] = defineField("status");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values: any) => {
  try {
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await ManufacturingStore.putApi(uuid, values);
      emit("data-updated");
    } else if (method.value === "add") {
      const response = await ManufacturingStore.postApi(values);
      emit("data-updated");
    }
    closeDialog();
  } catch (error: any) {
    console.error("Failed to process the data:", error);
  }
});

const method = ref(props.method);
const title = ref(props.title);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

const resetDialogMode = () => {
  method.value = props.method;
  title.value = props.title;
};

const closeDialog = () => {
  emit("update:isDialogVisible", false);
  resetDialogMode();
  resetForm();
};

const handleEdit = () => {
  method.value = "edit";
  title.value = "Edit Data";
};

// Watcher untuk Provinsi
watch(provinsiCode, (newProvinsi) => {
  if (newProvinsi) {
    fetchKabupaten(newProvinsi); // Ambil data kabupaten ketika provinsi berubah
    kabupatenCode.value = ""; // Reset kabupaten dan kecamatan saat provinsi berubah
    kecamatanCode.value = "";
    kelurahanPayload.value = [];
  }
});

// Watcher untuk Kabupaten
watch(kabupatenCode, (newKabupaten) => {
  if (newKabupaten) {
    fetchKecamatan(newKabupaten);
    kecamatanCode.value = "";
    kelurahanPayload.value = [];
  }
});

// Watcher untuk Kecamatan
watch(kecamatanCode, (newKecamatan) => {
  if (newKecamatan) {
    fetchKelurahan(newKecamatan);
  }
});

watch(
  () => props.isDialogVisible,
  async (newValue) => {
    if (newValue) {
      resetDialogMode();

      // Check if we are editing, and if so, set initial values
      if (props.method !== "add" && props.payload) {
        setValues({
          ...props.payload,
        });

        // Set provinsi, kabupaten, kecamatan, and kelurahan based on payload data
        if (props.payload) {
          // Set provinsi
          provinsiCode.value = props.payload.provinsiCode;
          await fetchKabupaten(provinsiCode.value as string); // Fetch kabupaten after provinsi is set

          // Set kabupaten
          kabupatenCode.value = props.payload.kabupatenCode;
          await fetchKecamatan(kabupatenCode.value as string);

          // Set kecamatan
          kecamatanCode.value = props.payload.kecamatanCode;
          await fetchKelurahan(kecamatanCode.value as string);

          // Set kelurahan
          kelurahanCode.value = props.payload.kelurahanCode;
        }
      }
    } else {
      resetForm();
      resetDialogMode();
    }
  }
);

onMounted(() => {
  fetchProvinsi();
});
</script>

<template>
  <CustomDialog
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    width="600px"
  >
    <template #header>
      <div v-if="method !== 'detail'" class="grid grid-cols-1">
        <p>{{ title }} Data Manufaktur</p>
      </div>
      <div v-if="method === 'detail'" class="grid grid-cols-1">
        <p>Detail Data Manufaktur</p>
      </div>
    </template>
    <template #body>
      <div v-if="method !== 'detail'">
        <!-- Kode Organisasi & Nama -->
        <div class="grid grid-cols-[30%,70%]">
          <div class="mt-[20px]">
            <CustomTextfield
              label="Kode Manufaktur"
              v-model="code"
              placeholder="Kode Manufaktur"
              :invalid="!!errors.code"
              :invalidMessage="errors.code"
              :required="errors.code ? true : false"
            />
          </div>
          <div class="mt-[20px]">
            <CustomTextfield
              label="Nama Manufaktur"
              v-model="name"
              placeholder="Nama Manufaktur"
              class="ml-[20px]"
              :invalid="!!errors.name"
              :invalidMessage="errors.name"
              :required="errors.name ? true : false"
            />
          </div>
        </div>
        <!-- Alamat -->
        <div class="grid grid-cols-2">
          <div class="mt-[20px] mr-[10px]">
            <CustomSelect
              label="Provinsi"
              v-model="provinsiCode"
              place-holder="Pilih Provinsi"
              class=""
              :options="provinsiPayload"
              option-label="name"
              option-value="code"
              :invalid="!!errors.provinsiCode"
              :invalidMessage="errors.provinsiCode"
              :required="errors.provinsiCode ? true : false"
            />
          </div>
          <div class="mt-[20px] ml-[10px]">
            <CustomSelect
              label="Kab / Kota"
              v-model="kabupatenCode"
              place-holder="Pilih Kab / Kota"
              class=""
              :options="kabupatenPayload"
              option-label="name"
              option-value="code"
              :invalid="!!errors.kabupatenCode"
              :invalidMessage="errors.kabupatenCode"
              :required="errors.kabupatenCode ? true : false"
            />
          </div>
          <div class="mt-[20px] mr-[10px]">
            <CustomSelect
              label="Kecamatan"
              v-model="kecamatanCode"
              place-holder="Pilih Kecamatan"
              class=""
              :options="kecamatanPayload"
              option-label="name"
              option-value="code"
              :invalid="!!errors.kecamatanCode"
              :invalidMessage="errors.kecamatanCode"
              :required="errors.kecamatanCode ? true : false"
            />
          </div>
          <div class="mt-[20px] ml-[10px]">
            <CustomSelect
              label="Kelurahan / Desa"
              v-model="kelurahanCode"
              place-holder="Pilih Kelurahan / Desa"
              class=""
              :options="kelurahanPayload"
              option-label="name"
              option-value="code"
              :invalid="!!errors.kelurahanCode"
              :invalidMessage="errors.kelurahanCode"
              :required="errors.kelurahanCode ? true : false"
            />
          </div>
        </div>
        <div class="grid grid-cols-[30%,70%]">
          <div class="mt-[20px]">
            <CustomTextfield
              v-model="kodePos"
              label="Kode Pos"
              placeholder="Kode Pos"
              class=""
              :invalid="!!errors.kodePos"
              :invalidMessage="errors.kodePos"
              :required="errors.kodePos ? true : false"
            />
          </div>
          <div class="mt-[20px]">
            <CustomTextArea
              label="Alamat"
              v-model="alamat"
              placeholder="Alamat"
              class="ml-[20px]"
              :invalid="!!errors.alamat"
              :invalidMessage="errors.alamat"
              :required="errors.alamat ? true : false"
            />
          </div>
        </div>
        <hr class="mt-[20px] border border-slate-300" />
        <div class="grid grid-cols-2 mt-[15px]">
          <div>
            <CustomSwitch
              v-model="status"
              :show-label="true"
              label="Status"
              sideLabel="NON-AKTIF"
              sideLabelTrue="AKTIF"
            />
          </div>
        </div>
      </div>
      <div v-if="method === 'detail'">
        <div class="grid grid-cols-[40%,60%]">
          <!-- Kode Manufaktur -->
          <div>
            <p class="mt-[10px] font-bold">Kode Manufaktur</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.code }}</p>
          </div>
          <!-- Nama Manufaktur -->
          <div>
            <p class="mt-[10px] font-bold">Nama Manufaktur</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.name }}</p>
          </div>
          <!-- Provinsi -->
          <div>
            <p class="mt-[10px] font-bold">Provinsi</p>
          </div>
          <div>
            <p class="mt-[10px]">
              : {{ payload?.province?.name || payload?.provinsiCode || "-" }}
            </p>
          </div>
          <!-- Kab / Kota -->
          <div>
            <p class="mt-[10px] font-bold">Kab / Kota</p>
          </div>
          <div>
            <p class="mt-[10px]">
              : {{ payload?.kabupaten?.name || payload?.kabupatenCode || "-" }}
            </p>
          </div>
          <!-- Kecamatan -->
          <div>
            <p class="mt-[10px] font-bold">Kecamatan</p>
          </div>
          <div>
            <p class="mt-[10px]">
              : {{ payload?.kecamatan?.name || payload?.kecamatanCode || "-" }}
            </p>
          </div>
          <!-- Kelurahan / Desa -->
          <div>
            <p class="mt-[10px] font-bold">Kelurahan / Desa</p>
          </div>
          <div>
            <p class="mt-[10px]">
              : {{ payload?.kelurahan?.name || payload?.kelurahanCode || "-" }}
            </p>
          </div>
          <!-- Kode Pos -->
          <div>
            <p class="mt-[10px] font-bold">Kode Pos</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.kodePos }}</p>
          </div>
          <!-- Alamat -->
          <div>
            <p class="mt-[10px] font-bold">Alamat</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.alamat }}</p>
          </div>
        </div>
        <hr class="mt-[20px] border border-slate-300" />
        <div class="grid grid-cols-1">
          <div class="flex">
            <p class="mt-[20px] font-bold">
              Status <span class="font-normal ml-[165px]">:</span>
            </p>
            <CustomChip
              :label="status ? 'AKTIF' : 'NON-AKTIF'"
              :textColor="status ? 'text-white' : 'text-[#80868d]'"
              :bgColor="status ? 'bg-opensimrs-300' : 'bg-white'"
              :borderColor="status ? 'border-none' : 'border-[#80868d]'"
              :icon-color="status ? 'white' : '#80868d'"
              customClass="text-xs font-semibold h-5 flex"
              class="mt-[23px] ml-[5px]"
            />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <!-- <hr class="-mx-5 border-grey-200" /> -->
        <div class="flex gap-2.5 justify-end mt-5">
          <CustomButton
            v-if="method !== 'detail'"
            label="Reset"
            textColor="text-grey-300"
            backgroundColor="bg-transparent"
            borderColor="border-2 border-grey-200"
            @click="resetForm"
          />
          <CustomButton
            v-if="method !== 'detail'"
            label="Simpan"
            @click="onSubmit"
          />
          <CustomButton
            v-if="method === 'detail'"
            label="Edit"
            @click="handleEdit"
          />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
