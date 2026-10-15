<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { utilsStore } from "@/stores/utils";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useKelompokPemeriksaanStore } from "@/stores/datamasterLaboratorium/kelompokPemeriksaan";
import { useLoincStore } from "@/stores/datamaster/loinc";
import { useIcd9Store } from "@/stores/datamaster/icd9";
import { useSnomedCTStore } from "@/stores/datamaster/snomedCT";
import { useKategoriPemeriksaanStore } from "@/stores/datamasterLaboratorium/kategoriPemeriksaan";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";
import { useForm, ErrorMessage } from "vee-validate";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";

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
  dataItemPemeriksaan: {
    type: Array,
    default: () => [],
  },
});

// Schema validation
const validationSchema = toTypedSchema(
  yup.object({
    code: yup.string().required("Kode Kelompok Pemeriksaan wajib diisi"),
    name: yup.string().required("Nama Kelompok Pemeriksaan wajib diisi"),
    kategoriPemeriksaan: yup
      .string()
      .required("Kategori Pemeriksaan wajib dipilih"),
    selectedItemPemeriksaan: yup
      .array()
      .min(1, "Minimal 1 Item Pemeriksaan harus dipilih")
      .required("Item Pemeriksaan wajib dipilih"),
    loinc: yup.string().required("LOINC wajib dipilih"),
  })
);

// Initialize form with validation
const {
  handleSubmit,
  errors,
  resetForm: resetValidation,
  defineField,
  setFieldValue,
} = useForm({
  validationSchema,
});

const utils = utilsStore();
const kelompokPemeriksaanStore = useKelompokPemeriksaanStore();

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);
const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};
const method = ref(props.method);
const title = ref(props.title);
const handleEdit = () => {
  method.value = "edit";
  title.value = "Edit Data";
};

const closeDialog = () => {
  emit("update:isDialogVisible", false);
  resetForm();
};

// Refs for form fields
const loincStore = useLoincStore();
const loincPayload = ref(<any>[]);
const loincOptions = ref<{ label: string; value: string }[]>([]);
const [loinc, loincAttrs] = defineField("loinc");
const icd9Store = useIcd9Store();
const icd9Payload = ref(<any>[]);
const icd9Options = ref<{ label: string; value: string }[]>([]);
const icd9 = ref();
const snomedCTStore = useSnomedCTStore();
const snomedCTPayload = ref(<any>[]);
const snomedCTOptions = ref<{ label: string; value: string }[]>([]);
const snomedCT = ref();
const kategoriPemeriksaanStore = useKategoriPemeriksaanStore();
const kategoriPemeriksaanPayload = ref(<any>[]);
const kategoriPemeriksaanOptions = ref<{ label: string; value: string }[]>([]);
const kategoriPemeriksaan = ref();
const code = ref("");
const name = ref("");
const status = ref(true);
const selectedItemPemeriksaan = ref<any[]>([]);
const filteredItemPemeriksaan = ref<any[]>([]);

// Sync form fields with vee-validate
watch(code, (newVal) => setFieldValue("code", newVal));
watch(name, (newVal) => setFieldValue("name", newVal));
watch(kategoriPemeriksaan, (newVal) =>
  setFieldValue("kategoriPemeriksaan", newVal)
);
watch(
  selectedItemPemeriksaan,
  (newVal) => {
    setFieldValue("selectedItemPemeriksaan", newVal);
  },
  { deep: true }
);

// Fetch Data Kategori Pemeriksaan
const fetchKategoriPemeriksaan = async () => {
  utils.setLoading(true);
  try {
    const response = await kategoriPemeriksaanStore.getActive();

    if (response && response.payload) {
      kategoriPemeriksaanPayload.value = response.payload.filter(
        (item: any) => item.status === true
      );

      kategoriPemeriksaanOptions.value = kategoriPemeriksaanPayload.value.map(
        (item: any) => ({
          label: item.name,
          value: item.uuid,
        })
      );
    } else {
      kategoriPemeriksaanPayload.value = [];
      kategoriPemeriksaanOptions.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    kategoriPemeriksaanPayload.value = [];
    kategoriPemeriksaanOptions.value = [];
  } finally {
    utils.setLoading(false);
  }
};

// Fetch Data Loinc
const fetchLoinc = async () => {
  utils.setLoading(true);
  try {
    const response = await loincStore.getApi(1, 9999, "");

    if (response && response.payload) {
      loincPayload.value = response.payload;
      loincOptions.value = loincPayload.value.map((item: any) => ({
        label: item.name,
        value: item.uuid,
      }));
    } else {
      loincPayload.value = [];
      loincOptions.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    loincPayload.value = [];
    loincOptions.value = [];
  } finally {
    utils.setLoading(false);
  }
};

// Fetch Data Icd9
const fetchIcd9 = async () => {
  utils.setLoading(true);
  try {
    const response = await icd9Store.getApi(1, 9999, "");

    if (response && response.payload) {
      icd9Payload.value = response.payload;
      icd9Options.value = icd9Payload.value.map((item: any) => ({
        label: item.name,
        value: item.uuid,
      }));
    } else {
      icd9Payload.value = [];
      icd9Options.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    icd9Payload.value = [];
    icd9Options.value = [];
  } finally {
    utils.setLoading(false);
  }
};

// Fetch Data snomedCT
const fetchSnomed = async () => {
  utils.setLoading(true);
  try {
    const response = await snomedCTStore.getApi(1, 9999, "");

    if (response && response.payload) {
      snomedCTPayload.value = response.payload;
      snomedCTOptions.value = snomedCTPayload.value.map((item: any) => ({
        label: item.name,
        value: item.uuid,
      }));
    } else {
      snomedCTPayload.value = [];
      snomedCTOptions.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    snomedCTPayload.value = [];
    snomedCTOptions.value = [];
  } finally {
    utils.setLoading(false);
  }
};

// Filter item pemeriksaan berdasarkan kategori yang dipilih
watch(kategoriPemeriksaan, (newVal, oldVal) => {
  if (newVal && props.dataItemPemeriksaan) {
    console.log(
      "Filtering item pemeriksaan for category:",
      JSON.stringify(props.dataItemPemeriksaan)
    );
    filteredItemPemeriksaan.value = props.dataItemPemeriksaan.filter(
      (item: any) => item.categoryPemeriksaanUuid === newVal
    );
    if (oldVal !== undefined && oldVal !== newVal) {
      const validSelectedItems = selectedItemPemeriksaan.value.filter(
        (selectedUuid) =>
          filteredItemPemeriksaan.value.some(
            (item) => item.uuid === selectedUuid
          )
      );
      selectedItemPemeriksaan.value = validSelectedItems;
      setFieldValue("selectedItemPemeriksaan", validSelectedItems);
    }
  } else {
    filteredItemPemeriksaan.value = [...props.dataItemPemeriksaan];
  }
});

// Handle form submission with validation
const onSubmit = handleSubmit(async (values) => {
  try {
    if (method.value === "add") {
      const payload = {
        code: values.code,
        name: values.name,
        loincUuid: loinc.value,
        itemPemeriksaans: values.selectedItemPemeriksaan,
        icd9Uuid: icd9.value,
        snomedctUuid: snomedCT.value,
        status: status.value,
        categoryPemeriksaanUuid: values.kategoriPemeriksaan,
      };
      await kelompokPemeriksaanStore.postApi(payload);
      emit("data-updated");
    } else if (method.value === "edit") {
      const uuid = props.payload.uuid;
      const payload = {
        uuid: props.payload.uuid,
        code: values.code,
        name: values.name,
        loincUuid: loinc.value,
        itemPemeriksaans: values.selectedItemPemeriksaan,
        icd9Uuid: icd9.value,
        snomedctUuid: snomedCT.value,
        status: status.value,
        categoryPemeriksaanUuid: values.kategoriPemeriksaan,
      };
      console.log("Submitting edit payload:", payload);
      await kelompokPemeriksaanStore.putApi(uuid, payload);
      emit("data-updated");
    }
    closeDialog();
  } catch (error) {
    console.error("Error submitting form:", error);
  }
});

const resetDialogMode = () => {
  method.value = props.method;
  title.value = props.title;
};

const resetForm = () => {
  code.value = "";
  name.value = "";
  kategoriPemeriksaan.value = null;
  loinc.value = "";
  icd9.value = null;
  snomedCT.value = null;
  selectedItemPemeriksaan.value = [];
  status.value = true;

  // Reset form validation
  setFieldValue("code", "");
  setFieldValue("name", "");
  setFieldValue("kategoriPemeriksaan", "");
  setFieldValue("selectedItemPemeriksaan", []);
  resetValidation();
};

const setValues = (values: any) => {
  console.log("Setting values:", values);
  code.value = values.code || "";
  name.value = values.name || "";
  kategoriPemeriksaan.value = values.categoryPemeriksaanUuid || null;
  loinc.value = values.loincUuid || null;
  icd9.value = values.icd9Uuid || null;
  snomedCT.value = values.snomedCTUuid || null;
  selectedItemPemeriksaan.value = values.itemPemeriksaans || [];
  status.value = values.status !== undefined ? values.status : true;

  // Sync with form values
  setFieldValue("code", code.value);
  setFieldValue("name", name.value);
  setFieldValue("kategoriPemeriksaan", kategoriPemeriksaan.value);
  setFieldValue("selectedItemPemeriksaan", selectedItemPemeriksaan.value);

  // Filter item pemeriksaan saat set values
  if (kategoriPemeriksaan.value && props.dataItemPemeriksaan) {
    filteredItemPemeriksaan.value = props.dataItemPemeriksaan.filter(
      (item: any) => item.categoryPemeriksaanUuid === kategoriPemeriksaan.value
    );
  }
};

watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (newValue) {
      resetDialogMode();
      if (props.method === "edit" && props.payload) {
        // Map itemPemeriksaan UUIDs
        const selectedItemPemeriksaanUuid =
          props.payload.itemPemeriksaan?.map((item: any) => item.uuid) || [];

        console.log(props.payload);
        // Set values from props.payload
        setValues({
          code: props.payload.code,
          name: props.payload.name,
          categoryPemeriksaanUuid: props.payload.categoryPemeriksaanUuid,
          loincUuid: props.payload.loincUuid,
          icd9Uuid: props.payload.icd9Uuid,
          snomedCTUuid: props.payload.snomedUuid,
          itemPemeriksaans: selectedItemPemeriksaanUuid,
          status: props.payload.status,
        });
      }
    } else {
      resetForm();
      resetDialogMode();
    }
  }
);

// Initialize filtered items when dataItemPemeriksaan changes
watch(
  () => props.dataItemPemeriksaan,
  (newVal) => {
    if (newVal && newVal.length > 0) {
      if (kategoriPemeriksaan.value) {
        filteredItemPemeriksaan.value = newVal.filter(
          (item: any) =>
            item.categoryPemeriksaanUuid === kategoriPemeriksaan.value
        );
      } else {
        filteredItemPemeriksaan.value = [...newVal];
      }
    }
  },
  { immediate: true }
);

onMounted(() => {
  fetchKategoriPemeriksaan();
  fetchLoinc();
  fetchIcd9();
  fetchSnomed();
});
</script>

<template>
  <CustomDialog
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    :style="{ width: '600px' }"
  >
    <template #header>
      <div v-if="method !== 'edit'" class="grid grid-cols-1">
        <p>Tambah Data Kelompok Pemeriksaan</p>
      </div>
      <div v-if="method === 'edit'" class="grid grid-cols-1">
        <p>Edit Data Kelompok Pemeriksaan</p>
      </div>
    </template>
    <template #body>
      <div class="flex gap-3">
        <div class="mt-[20px]">
          <CustomTextfield
            v-model="code"
            label="Kode Kelompok Pemeriksaan"
            placeholder="Kode Kelompok Pemeriksaan"
            class="mr-2"
            :error="errors.code"
          />
          <ErrorMessage name="code" class="text-xs text-red-500" />
        </div>
        <div class="mt-[20px] grow">
          <CustomTextfield
            v-model="name"
            label="Nama Kelompok Pemeriksaan"
            placeholder="Nama Kelompok Pemeriksaan"
            class=""
            :error="errors.name"
          />
          <ErrorMessage name="name" class="text-xs text-red-500" />
        </div>
      </div>
      <div>
        <CustomSelect
          v-model="kategoriPemeriksaan"
          :options="kategoriPemeriksaanOptions"
          label="Kategori Pemeriksaan"
          placeHolder="Pilih Kategori Pemeriksaan"
          class="mt-5"
          optionLabel="label"
          optionValue="value"
          :showFilter="false"
          :error="errors.kategoriPemeriksaan"
        />
        <ErrorMessage name="kategoriPemeriksaan" class="text-xs text-red-500" />
      </div>
      <CustomSelect
        v-model="snomedCT"
        label="Snomed - CT"
        placeHolder="Pilih Snomed - CT"
        class="mt-5"
        optionLabel="label"
        optionValue="value"
        :showFilter="true"
        :options="snomedCTOptions"
      />
      <CustomSelect
        v-model="icd9"
        label="ICD 9-CM"
        placeHolder="Pilih ICD 9-CM"
        class="mt-5"
        optionLabel="label"
        optionValue="value"
        :showFilter="false"
        :options="icd9Options"
      />
      <div>
        <CustomSelect
          v-model="loinc"
          v-bind="loincAttrs"
          label="LOINC"
          placeHolder="Pilih LOINC"
          class="mt-5"
          optionLabel="label"
          optionValue="value"
          :showFilter="false"
          :options="loincOptions"
          :error="errors.loinc"
        />
        <ErrorMessage name="loinc" class="text-xs text-red-500" />
      </div>

      <div class="mt-5 mb-5">
        <CustomMultiSelect
          v-model="selectedItemPemeriksaan"
          placeholder="Pilih Item Pemeriksaan"
          label="Item Pemeriksaan"
          optionLabel="name"
          optionValue="uuid"
          :maxSelectedLabels="4"
          :options="filteredItemPemeriksaan"
          :class="{ 'error-field': errors.selectedItemPemeriksaan }"
        />
        <small
          v-if="errors.selectedItemPemeriksaan"
          class="text-xs text-red-500"
        >
          {{ errors.selectedItemPemeriksaan }}
        </small>
      </div>

      <hr class="mt-[40px] border border-slate-200" />

      <div class="grid grid-cols-1 mt-[15px]">
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
    </template>
    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            v-if="method === 'edit'"
            label="Batal"
            border-color="border-grey-200"
            background-color="bg-white"
            text-color="text-grey-300"
            @click="closeDialog"
          />
          <CustomButton
            v-if="method !== 'edit'"
            label="Reset"
            border-color="border-grey-200"
            background-color="bg-white"
            text-color="text-grey-300"
            @click="resetForm"
          />
          <CustomButton label="Simpan" @click="onSubmit" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
