<script setup lang="ts">
import { ref } from "vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useForm, ErrorMessage } from "vee-validate";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";

const visible = ref(false);
const editMode = ref(false);
const selectedSpesimenId = ref<string | null>(null);

const emit = defineEmits(["submit", "reset"]);

// Schema validasi
const validationSchema = toTypedSchema(
  yup.object({
    kodeSpesimen: yup
      .string()
      .required("Kode spesimen wajib diisi")
      .max(20, "Kode spesimen maksimal 20 karakter"),
    namaSpesimen: yup
      .string()
      .required("Nama spesimen wajib diisi")
      .max(100, "Nama spesimen maksimal 100 karakter"),
    status: yup.boolean().default(true),
  })
);

const { handleSubmit, resetForm, defineField, errors } = useForm({
  validationSchema,
  initialValues: {
    kodeSpesimen: "",
    namaSpesimen: "",
    status: true,
  },
});

// Deklarasi field dengan defineField
const [kodeSpesimen, kodeSpesimenAttrs] = defineField("kodeSpesimen");
const [namaSpesimen, namaSpesimenAttrs] = defineField("namaSpesimen");
const [status, statusAttrs] = defineField("status");

// Fungsi untuk menangani saat dialog ditutup
const onDialogClose = (isVisible: boolean) => {
  if (!isVisible) {
    resetForm(); // Reset form ketika dialog ditutup
    editMode.value = false;
    selectedSpesimenId.value = null;
  }
};

// Fungsi untuk submit data
const submitSpesimen = handleSubmit((values) => {
  emit("submit", {
    code: values.kodeSpesimen,
    name: values.namaSpesimen,
    status: values.status,
    id: selectedSpesimenId.value,
  });
});

// Fungsi untuk mengisi form saat edit
const fillForm = (data: any) => {
  kodeSpesimen.value = data.code;
  namaSpesimen.value = data.name;
  status.value = data.status;
  selectedSpesimenId.value = data.id;
  editMode.value = true;
};

defineExpose({
  visible,
  editMode,
  selectedSpesimenId,
  resetForm,
  fillForm,
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
        <p>{{ editMode ? "Edit Data Spesimen" : "Tambah Data Spesimen" }}</p>
      </div>
    </template>
    <template #body>
      <div class="flex gap-3">
        <div class="mt-[20px]">
          <CustomTextfield
            v-model="kodeSpesimen"
            v-bind="kodeSpesimenAttrs"
            label="Kode Spesimen"
            placeholder="Kode Spesimen"
            class="mr-2"
            :class="{ 'border-red-500': errors.kodeSpesimen }"
          />
          <ErrorMessage
            name="kodeSpesimen"
            class="mt-1 text-xs text-red-500"
          />
        </div>
        <div class="mt-[20px] grow">
          <CustomTextfield
            v-model="namaSpesimen"
            v-bind="namaSpesimenAttrs"
            label="Nama Spesimen"
            placeholder="Nama Spesimen"
            class="mr-2"
            :class="{ 'border-red-500': errors.namaSpesimen }"
          />
          <ErrorMessage
            name="namaSpesimen"
            class="mt-1 text-xs text-red-500"
          />
        </div>
      </div>

      <hr class="mt-[20px] border border-slate-200" />
      <div class="grid grid-cols-1 mt-[15px]">
        <div>
          <CustomSwitch
            v-model="status"
            v-bind="statusAttrs"
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
            label="Reset"
            textColor="text-grey-300"
            backgroundColor="bg-transparent"
            borderColor="border-2 border-grey-200"
            @click="resetForm"
          />
          <CustomButton label="Simpan" @click="submitSpesimen" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>