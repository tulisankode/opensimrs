<script lang="ts" setup>
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { parse } from "date-fns";
import { usePegawaiStore } from "@/stores/datamaster/pegawai";
import { dateToEpoch, formatDate } from "@/utils/Helpers";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";

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

const optionsPegawai = ref([
  { label: "NAKES", value: 1 },
  { label: "NON NAKES", value: 2 },
]);

const optionsGender = ref(["Perempuan", "Laki-laki"]);

const schema = toTypedSchema(
  yup
    .object({
      name: yup.string().required("Nama Pegawai harus diisi"),
      nik: yup
        .string()
        .required("NIK harus diisi")
        .matches(/^[0-9]+$/, "NIK harus berupa angka")
        .length(16, "NIK harus terdiri dari 16 digit"),
      tipe: yup.number().required("Tipe Pegawai harus diisi"),
      firstTitle: yup.string().notRequired(),
      lastTitle: yup.string().notRequired(),
      gender: yup.string().required("Jenis Kelamin harus diisi"),
      tanggalLahir: yup.date().required("Tanggal Lahir harus diisi"),
      status: yup.bool().default(true),
    })
    .noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const pegawaiStore = usePegawaiStore();

const [name] = defineField("name");
const [nik] = defineField("nik");
const [tipe] = defineField("tipe");
const [firstTitle] = defineField("firstTitle");
const [lastTitle] = defineField("lastTitle");
const [gender] = defineField("gender");
const [tanggalLahir] = defineField("tanggalLahir");
const [status] = defineField("status");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values: any) => {
  try {
    values.tanggalLahir = formatDate(new Date(values.tanggalLahir));
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await pegawaiStore.putApi(uuid, values);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      console.log("Adding new data with values:", values);
      const response = await pegawaiStore.postApi(values);
      emit("data-updated");
    }
    closeDialog();
  } catch (error) {
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

const handleEdit = () => {
  method.value = "edit";
  title.value = "Edit Data";
};

const closeDialog = () => {
  emit("update:isDialogVisible", false);
  resetDialogMode();
  resetForm();
};

watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (newValue) {
      resetDialogMode();
      if (props.method !== "add" && props.payload) {
        setValues({
          ...props.payload,
          tanggalLahir: parse(
            props.payload.tanggalLahir,
            "dd-MM-yyyy",
            new Date()
          ),
        });
      }
    } else {
      resetForm();
      resetDialogMode();
    }
  }
);
</script>

<template>
  <CustomDialog
    width="600px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
  >
    <template #header>{{ title }} Pegawai</template>
    <template #body>
      <div v-if="method !== 'detail'" class="grid grid-cols-12 gap-5 mt-5">
        <!-- Form Input -->
        <CustomSelect
          label="Tipe Pegawai"
          v-model="tipe"
          :options="optionsPegawai"
          option-label="label"
          option-value="value"
          place-holder="Tipe Pegawai"
          class="col-span-6"
          :invalid="!!errors.tipe"
          :invalidMessage="errors.tipe"
          :required="errors.tipe ? true : false"
        />
        <hr class="col-span-12 border-grey-200" />
        <div class="col-span-12 -mb-5 font-semibold text-normal">
          Nama Lengkap Pegawai
        </div>
        <CustomTextfield
          v-model="firstTitle"
          label=""
          placeholder="Gelar Awal"
          class="col-span-4"
        />
        <CustomTextfield
          label=""
          v-model="name"
          placeholder="Nama Lengkap"
          class="col-span-4"
          :invalid="!!errors.name"
          :invalidMessage="errors.name"
        />
        <CustomTextfield
          label=""
          v-model="lastTitle"
          placeholder="Gelar Akhir"
          class="col-span-4"
        />
        <CustomTextfield
          label="NIK"
          v-model="nik"
          placeholder="0"
          class="col-span-12"
          :invalid="!!errors.nik"
          :invalidMessage="errors.nik"
          :required="errors.nik === 'NIK harus diisi'"
        />
        <CustomDatePicker
          v-model="tanggalLahir"
          class="col-span-6"
          placeHolder="01-01-2024"
          label="Tanggal Lahir"
          :invalid="!!errors.tanggalLahir"
          :invalidMessage="errors.tanggalLahir"
          :required="errors.tanggalLahir ? true : false"
        />
        <CustomSelect
          label="Jenis Kelamin"
          v-model="gender"
          :options="optionsGender"
          option-label=""
          option-value=""
          place-holder="Pilih Jenis Kelamin"
          class="col-span-6"
          :invalid="!!errors.gender"
          :invalidMessage="errors.gender"
          :required="errors.gender ? true : false"
        />
        <hr class="col-span-12 border-grey-200" />
        <CustomSwitch
          v-model="status"
          :show-label="true"
          label="Status"
          sideLabel="NON-AKTIF"
          sideLabelTrue="AKTIF"
          class="col-span-12"
        />
      </div>
      <!-- Detail Data -->
      <div v-if="method === 'detail'" class="flex flex-col gap-5 mt-5">
        <div class="font-bold text-heading">
          Data Pegawai -
          {{
            Number(tipe) === 1
              ? "NAKES"
              : Number(tipe) === 2
              ? "NON NAKES"
              : "Unknown"
          }}
        </div>
        <hr class="border-grey-2 00" />
        <CustomInfoRow
          label="Nama Lengkap"
          :value="`${
            payload.firstTitle
              ? payload.firstTitle + '. '
              : ''
          }${payload.name}${
            payload.lastTitle
              ? ', ' + payload.lastTitle
              : ''
          }`"
        />
        <CustomInfoRow label="NIK" :value="nik" />
        <CustomInfoRow label="Tanggal Lahir" :value="payload.tanggalLahir" />
        <CustomInfoRow label="Jenis Kelamin" :value="gender" />
        <hr class="border-grey-200" />
        <CustomInfoRow label="Status">
          <template #value>
            <CustomChip
              :label="status ? 'AKTIF' : 'NON-AKTIF'"
              :textColor="status ? 'text-white' : 'text-[#80868d]'"
              :bgColor="status ? 'bg-opensimrs-300' : 'bg-white'"
              :borderColor="status ? 'border-none' : 'border-[#80868d]'"
              :icon-color="status ? 'white' : '#80868d'"
              customClass="text-xs font-semibold h-5 flex w-fit"
            />
          </template>
        </CustomInfoRow>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            v-if="method !== 'detail'"
            label="Batal"
            border-color="border-grey-200"
            background-color="bg-white"
            text-color="text-grey-300"
            @click="closeDialog"
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
