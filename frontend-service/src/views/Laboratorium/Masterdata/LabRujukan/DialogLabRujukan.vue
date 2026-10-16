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
const selectedLabRujukanId = ref<string | null>(null);

const emit = defineEmits(["submit", "reset"]);

// Schema validasi
const validationSchema = toTypedSchema(
  yup.object({
    kode: yup
      .string()
      .required("Kode laboratorium rujukan wajib diisi")
      .max(20, "Kode maksimal 20 karakter"),
    nama: yup
      .string()
      .required("Nama laboratorium rujukan wajib diisi")
      .max(100, "Nama maksimal 100 karakter"),
    alamat: yup.string().max(255, "Alamat maksimal 255 karakter"),
    telepon: yup.string().max(50, "Telepon maksimal 50 karakter"),
    kontakPerson: yup.string().max(100, "Kontak person maksimal 100 karakter"),
    status: yup.boolean().default(true),
  })
);

const { handleSubmit, resetForm, defineField, errors } = useForm({
  validationSchema,
  initialValues: {
    kode: "",
    nama: "",
    alamat: "",
    telepon: "",
    kontakPerson: "",
    status: true,
  },
});

const [kode, kodeAttrs] = defineField("kode");
const [nama, namaAttrs] = defineField("nama");
const [alamat, alamatAttrs] = defineField("alamat");
const [telepon, teleponAttrs] = defineField("telepon");
const [kontakPerson, kontakPersonAttrs] = defineField("kontakPerson");
const [status, statusAttrs] = defineField("status");

const onDialogClose = (isVisible: boolean) => {
  if (!isVisible) {
    resetForm();
    editMode.value = false;
    selectedLabRujukanId.value = null;
  }
};

const submitLabRujukan = handleSubmit((values) => {
  emit("submit", {
    code: values.kode,
    name: values.nama,
    alamat: values.alamat || null,
    telepon: values.telepon || null,
    kontak_person: values.kontakPerson || null,
    status: values.status,
    id: selectedLabRujukanId.value,
  });
});

const fillForm = (data: any) => {
  kode.value = data.code;
  nama.value = data.name;
  alamat.value = data.alamat;
  telepon.value = data.telepon;
  kontakPerson.value = data.kontakPerson;
  status.value = data.status;
  selectedLabRujukanId.value = data.id;
  editMode.value = true;
};

defineExpose({
  visible,
  editMode,
  selectedLabRujukanId,
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
        <p>
          {{ editMode ? "Edit Data Laboratorium Rujukan" : "Tambah Data Laboratorium Rujukan" }}
        </p>
      </div>
    </template>
    <template #body>
      <div class="flex gap-3">
        <div class="mt-[20px]">
          <CustomTextfield
            v-model="kode"
            v-bind="kodeAttrs"
            label="Kode"
            placeholder="Kode Laboratorium Rujukan"
            class="mr-2"
            :class="{ 'border-red-500': errors.kode }"
          />
          <ErrorMessage name="kode" class="mt-1 text-xs text-red-500" />
        </div>
        <div class="mt-[20px] grow">
          <CustomTextfield
            v-model="nama"
            v-bind="namaAttrs"
            label="Nama"
            placeholder="Nama Laboratorium Rujukan"
            class="mr-2"
            :class="{ 'border-red-500': errors.nama }"
          />
          <ErrorMessage name="nama" class="mt-1 text-xs text-red-500" />
        </div>
      </div>
      <div class="mt-[15px]">
        <CustomTextfield
          v-model="alamat"
          v-bind="alamatAttrs"
          label="Alamat"
          placeholder="Alamat Laboratorium Rujukan"
          :class="{ 'border-red-500': errors.alamat }"
        />
        <ErrorMessage name="alamat" class="mt-1 text-xs text-red-500" />
      </div>
      <div class="flex gap-3 mt-[15px]">
        <div class="grow">
          <CustomTextfield
            v-model="telepon"
            v-bind="teleponAttrs"
            label="Telepon"
            placeholder="080000000000"
            :class="{ 'border-red-500': errors.telepon }"
          />
          <ErrorMessage name="telepon" class="mt-1 text-xs text-red-500" />
        </div>
        <div class="grow">
          <CustomTextfield
            v-model="kontakPerson"
            v-bind="kontakPersonAttrs"
            label="Kontak Person"
            placeholder="Nama Kontak Person"
            :class="{ 'border-red-500': errors.kontakPerson }"
          />
          <ErrorMessage name="kontakPerson" class="mt-1 text-xs text-red-500" />
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
          <CustomButton label="Simpan" @click="submitLabRujukan" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
