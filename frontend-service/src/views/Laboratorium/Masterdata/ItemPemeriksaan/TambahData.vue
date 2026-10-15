<script setup lang="ts">
import { ref, defineEmits, onMounted } from "vue";
import { utilsStore } from "@/stores/utils";
import { useForm, ErrorMessage } from "vee-validate";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomComboBox from "@/components/Base/CustomComboBox.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useKategoriPemeriksaanStore } from "@/stores/datamasterLaboratorium/kategoriPemeriksaan";
import { useLoincStore } from "@/stores/datamaster/loinc";
import { useIcd9Store } from "@/stores/datamaster/icd9";
import { useSnomedCTStore } from "@/stores/datamaster/snomedCT";

const visible = ref(false);
const emit = defineEmits(["submit", "reset"]);

// Store instances
const kategoriPemeriksaanStore = useKategoriPemeriksaanStore();
const loincStore = useLoincStore();
const icd9Store = useIcd9Store();
const snomedCTStore = useSnomedCTStore();
const UseUtilsStore = utilsStore();

// Options data
const kategoriPemeriksaanOptions = ref<{ label: string; value: string }[]>([]);
const loincOptions = ref<{ label: string; value: string }[]>([]);
const icd9Options = ref<{ label: string; value: string }[]>([]);
const snomedCTOptions = ref<{ label: string; value: string }[]>([]);

const optionJenisInput = ref([
  { label: "Angka", value: "angka" },
  { label: "Text", value: "text" },
  { label: "Long Text", value: "long text" },
  { label: "Pilihan", value: "pilihan" },
]);

// Form state
const pilihanHasilItemPemeriksaans = ref([]);
const editMode = ref(false);
const selectedItemId = ref<string | null>(null);

// Validation schema
const validationSchema = toTypedSchema(
  yup.object({
    code: yup.string().required("Kode Item Pemeriksaan wajib diisi"),
    name: yup.string().required("Nama Item Pemeriksaan wajib diisi"),
    noUrut: yup.number().required("No. Urut wajib diisi"),
    kategoriPemeriksaan: yup
      .string()
      .required("Kategori Pemeriksaan wajib dipilih"),
    satuan: yup.string().required("Satuan wajib diisi"),
    metode: yup.string().required("Metode wajib diisi"),
    jenisInput: yup.string().required("Jenis Input wajib dipilih"),
    loinc: yup.string().required("LOINC wajib dipilih"),
    icd9: yup.string().nullable(),
    snomedCT: yup.string().nullable(),
    status: yup.boolean().default(true),
    statusNilaiRujukan: yup.boolean().default(false),
  })
);

const { handleSubmit, errors, resetForm, defineField, values } = useForm({
  validationSchema,
  initialValues: {
    jenisInput: "angka",
    statusNilaiRujukan: false,
    status: true,
  },
});

// Define form fields
const [code, codeAttrs] = defineField("code");
const [name, nameAttrs] = defineField("name");
const [noUrut, noUrutAttrs] = defineField("noUrut");
const [kategoriPemeriksaan, kategoriPemeriksaanAttrs] = defineField(
  "kategoriPemeriksaan"
);
const [satuan, satuanAttrs] = defineField("satuan");
const [metode, metodeAttrs] = defineField("metode");
const [jenisInput, jenisInputAttrs] = defineField("jenisInput");
const [loinc, loincAttrs] = defineField("loinc");
const [icd9, icd9Attrs] = defineField("icd9");
const [snomedCT, snomedCTAttrs] = defineField("snomedCT");
const [status, statusAttrs] = defineField("status");
const [statusNilaiRujukan, statusNilaiRujukanAttrs] =
  defineField("statusNilaiRujukan");

// Fetch Data Functions
const fetchKategoriPemeriksaan = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await kategoriPemeriksaanStore.getActive();

    if (response?.payload) {
      kategoriPemeriksaanOptions.value = response.payload
        .filter((item: any) => item.status === true)
        .map((item: any) => ({
          label: item.name,
          value: item.uuid,
        }));
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    kategoriPemeriksaanOptions.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const fetchLoinc = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await loincStore.getApi(1, 9999, "");
    if (response?.payload) {
      loincOptions.value = response.payload.map((item: any) => ({
        label: item.name,
        value: item.uuid,
      }));
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    loincOptions.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const fetchIcd9 = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await icd9Store.getApi(1, 9999, "");
    if (response?.payload) {
      icd9Options.value = response.payload.map((item: any) => ({
        label: item.name,
        value: item.uuid,
      }));
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    icd9Options.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const fetchSnomed = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await snomedCTStore.getAktifApi();
    if (response?.payload) {
      snomedCTOptions.value = response.payload.map((item: any) => ({
        label: item.name,
        value: item.uuid,
      }));
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    snomedCTOptions.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Form handlers
const onDialogClose = (isVisible: boolean) => {
  if (!isVisible) {
    handleReset();
  }
};

const handleReset = () => {
  resetForm({
    values: {
      code: "",
      name: "",
      noUrut: undefined,
      kategoriPemeriksaan: "",
      satuan: "",
      metode: "",
      jenisInput: "angka",
      loinc: "",
      icd9: "",
      snomedCT: "",
      status: true,
      statusNilaiRujukan: false,
    },
  });
  pilihanHasilItemPemeriksaans.value = [];
  selectedItemId.value = null;
};

const onSubmit = handleSubmit((values) => {
  emit("submit", {
    ...values,
    pilihanHasilItemPemeriksaans: pilihanHasilItemPemeriksaans.value,
    id: selectedItemId.value,
  });
});

defineExpose({
  visible,
  values,
  editMode,
  selectedItemId,
  pilihanHasilItemPemeriksaans,
  resetForm: handleReset,
  setValues: (data: any) => {
    console.log("Received data in child:", data);
    resetForm({
      values: {
        ...data,
        kategoriPemeriksaan: data.categoryPemeriksaanUuid,
        loinc: data.loinc?.uuid || data.loincUuid || data.loinc,
        icd9: data.icd9?.uuid || data.icd9Uuid || data.icd9,
        snomedCT: data.snomedCT?.uuid || data.snomedUuid || data.snomedCT,
      },
    });
    selectedItemId.value = data.id;
    pilihanHasilItemPemeriksaans.value =
      data.pilihanHasilItemPemeriksaans || [];
  },
});

onMounted(() => {
  fetchKategoriPemeriksaan();
  fetchLoinc();
  fetchIcd9();
  fetchSnomed();
});
</script>

<template>
  <CustomDialog
    v-model:visible="visible"
    @update:visible="onDialogClose"
    :style="{ width: '600px' }"
  >
    <template #header>
      <div class="grid grid-cols-1">
        <p>
          {{
            editMode
              ? "Edit Data Item Pemeriksaan"
              : "Tambah Data Item Pemeriksaan"
          }}
        </p>
      </div>
    </template>
    <template #body>
      <div class="grid grid-cols-[35%,45%,15%] gap-3 mt-5">
        <div>
          <CustomTextfield
            v-model="code"
            v-bind="codeAttrs"
            label="Kode Item Pemeriksaan"
            placeholder="Kode Item Pemeriksaan"
            :error="errors.code"
          />
          <ErrorMessage class="text-sm text-red-500" name="code" />
        </div>
        <div>
          <CustomTextfield
            v-model="name"
            v-bind="nameAttrs"
            label="Nama Item Pemeriksaan"
            placeholder="Nama Item Pemeriksaan"
            :error="errors.name"
          />
          <ErrorMessage class="text-sm text-red-500" name="name" />
        </div>
        <div>
          <CustomInputNumber
            v-model="noUrut"
            v-bind="noUrutAttrs"
            label="No. Urut"
            :show-buttons="false"
            class="text-center"
            :error="errors.noUrut"
          />
          <ErrorMessage class="text-sm text-red-500" name="noUrut" />
        </div>
      </div>
      <div class="grid gap-6 mt-5 grid-cols-[50%,45%]">
        <div>
          <CustomSelect
            v-model="kategoriPemeriksaan"
            v-bind="kategoriPemeriksaanAttrs"
            label="Kategori Pemeriksaan"
            placeHolder="Pilih Kategori Pemeriksaan"
            optionLabel="label"
            optionValue="value"
            :options="kategoriPemeriksaanOptions"
            :error="errors.kategoriPemeriksaan"
          />
          <ErrorMessage
            class="text-sm text-red-500"
            name="kategoriPemeriksaan"
          />
        </div>
        <div>
          <CustomTextfield
            v-model="satuan"
            v-bind="satuanAttrs"
            label="Satuan"
            placeholder="Satuan"
            :error="errors.satuan"
          />
          <ErrorMessage class="text-sm text-red-500" name="satuan" />
        </div>
      </div>
      <div class="grid gap-6 mt-5 grid-cols-[50%,45%]">
        <div>
          <CustomTextfield
            v-model="metode"
            v-bind="metodeAttrs"
            label="Metode"
            placeholder="Metode"
            :error="errors.metode"
          />
          <ErrorMessage class="text-sm text-red-500" name="metode" />
        </div>
        <div>
          <CustomSelect
            v-model="jenisInput"
            v-bind="jenisInputAttrs"
            label="Jenis Input"
            placeHolder="Pilih Jenis Input"
            optionLabel="label"
            optionValue="value"
            :options="optionJenisInput"
            :error="errors.jenisInput"
          />
          <ErrorMessage class="text-sm text-red-500" name="jenisInput" />
        </div>
      </div>
      <CustomComboBox
        v-if="jenisInput === 'pilihan'"
        v-model="pilihanHasilItemPemeriksaans"
        label="Pilihan Hasil"
        placeholder="Input Hasil"
        class="mt-5 mb-5"
      />
      <div>
        <CustomSelect
          v-model="snomedCT"
          v-bind="snomedCTAttrs"
          label="Snomed - CT"
          placeHolder="Pilih Snomed - CT"
          class="mt-5"
          optionLabel="label"
          optionValue="value"
          :showFilter="false"
          :options="snomedCTOptions"
        />
      </div>
      <div>
        <CustomSelect
          v-model="icd9"
          v-bind="icd9Attrs"
          label="ICD 9-CM"
          placeHolder="Pilih ICD 9-CM"
          class="mt-5"
          optionLabel="label"
          optionValue="value"
          :showFilter="false"
          :options="icd9Options"
          :error="errors.icd9"
        />
        <ErrorMessage class="text-sm text-red-500" name="icd9" />
      </div>
      <div>
        <CustomSelect
          v-model="loinc"
          v-bind="loincAttrs"
          label="LOINC"
          placeHolder="Pilih LOINC"
          class="mt-5 mb-5"
          optionLabel="label"
          optionValue="value"
          :showFilter="false"
          :options="loincOptions"
          :error="errors.loinc"
        />
        <ErrorMessage class="text-sm text-red-500" name="loinc" />
      </div>
      <hr class="mt-[20px] border border-slate-200" />
      <div class="grid grid-cols-2 mt-[15px]">
        <CustomSwitch
          v-model="status"
          v-bind="statusAttrs"
          :show-label="true"
          label="Status"
          sideLabel="NON-AKTIF"
          sideLabelTrue="AKTIF"
        />
        <CustomSwitch
          v-model="statusNilaiRujukan"
          v-bind="statusNilaiRujukanAttrs"
          :show-label="true"
          label="Nilai Rujukan"
          sideLabel="NON-AKTIF"
          sideLabelTrue="AKTIF"
        />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2.5 mt-5">
        <CustomButton
          label="Reset"
          textColor="text-grey-300"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-grey-200"
          @click="handleReset"
        />
        <CustomButton label="Simpan" @click="onSubmit" />
      </div>
    </template>
  </CustomDialog>
</template>
