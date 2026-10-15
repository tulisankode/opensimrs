<script lang="ts" setup>
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useRulesOfUseStore } from "@/stores/datamasterFarmasi/RulesOfUse";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";

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

const schema = toTypedSchema(
  yup
    .object({
      code: yup.string().trim().required("Kode Satuan harus diisi"),
      name: yup.string().trim().required("Nama Satuan harus diisi"),
      periodeUnit: yup.string().required("Periode Unit harus diisi"),
      periode: yup
        .number()
        .typeError("Periode harus diisi dengan angka")
        .positive("Periode tidak boleh minus atau nol")
        .required("Periode harus diisi"),
      frekuensi: yup
        .number()
        .typeError("Frekuensi harus diisi dengan angka")
        .positive("Frekuensi tidak boleh minus atau nol")
        .required("Frekuensi harus diisi"),
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
const RulesOfUseStore = useRulesOfUseStore();

const [code] = defineField("code");
const [name] = defineField("name");
const [periodeUnit] = defineField("periodeUnit");
const [periode] = defineField("periode");
const [frekuensi] = defineField("frekuensi");
const [status] = defineField("status");

watch(periodeUnit, (val) => {
  if (typeof val === "string") {
    const lower = val.toLowerCase();
    if (lower !== val) {
      periodeUnit.value = lower;
    }
  }
});

const optionsPeriode = ref([
  { label: "Hari", value: "hari" },
  { label: "Jam", value: "jam" },
  { label: "Minggu", value: "minggu" },
  { label: "Tiap", value: "tiap" },
  { label: "Khusus", value: "khusus" },
]);

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values: any) => {
  try {
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await RulesOfUseStore.putApi(uuid, values);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      const response = await RulesOfUseStore.postApi(values);
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

watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (newValue) {
      resetDialogMode();
      if (props.method !== "add" && props.payload) {
        setValues({
          ...props.payload,
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
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    width="600px"
  >
    <template #header>
      <div v-if="method !== 'detail'" class="grid grid-cols-1">
        <p>{{ title }} Data Aturan Pakai</p>
      </div>
      <div v-if="method === 'detail'" class="grid grid-cols-1">
        <p>Detail Data Aturan Pakai</p>
      </div>
    </template>
    <template #body>
      <div v-if="method !== 'detail'">
        <div class="grid grid-cols-[30%,70%]">
          <div class="mt-[20px]">
            <CustomTextfield
              v-model="code"
              :invalid="!!errors.code"
              :invalidMessage="errors.code"
              label="Kode Aturan Pakai"
              placeholder="Kode Aturan Pakai"
              class="mr-2"
            />
          </div>
          <div class="mt-[20px]">
            <CustomTextfield
              v-model="name"
              :invalid="!!errors.name"
              :invalidMessage="errors.name"
              label="Nama Aturan Pakai"
              placeholder="Nama Aturan Pakai"
              class="ml-2"
            />
          </div>
        </div>
        <div class="grid grid-cols-[30%,30%,10%,30%] mt-[20px]">
          <div class="">
            <CustomSelect
              label="Periode Unit"
              v-model="periodeUnit"
              :options="optionsPeriode"
              optionValue="value"
              optionLabel="label"
              place-holder="Pilih Periode Unit"
              :invalid="!!errors.periodeUnit"
              :invalidMessage="errors.periodeUnit"
            />
          </div>
          <div class="ml-[10px]">
            <CustomInputNumber
              v-model="frekuensi"
              :invalid="!!errors.frekuensi"
              :invalidMessage="errors.frekuensi"
              label="Frekuensi"
              placeholder="3"
            />
          </div>
          <div class="text-center ml-[10px]">
            <p class="font-bold mt-[30px]">X</p>
          </div>
          <div class="ml-[10px]">
            <CustomInputNumber
              v-model="periode"
              :invalid="!!errors.periode"
              :invalidMessage="errors.periode"
              label="Periode"
              placeholder="1"
              class=""
            />
          </div>
        </div>
        <div class="grid grid-cols-1 p-3 rounded-lg bg-opensimrs-50 mt-[20px]">
          <div>
            <p>Contoh Pengisian Aturan Pakai :</p>
          </div>
          <hr class="mt-[10px] border border-slate-300" />
          <div class="grid grid-cols-[30%,30%,10%,30%] mt-[10px]">
            <div>
              <p class="text-xs font-bold underline underline-offset-2">
                Periode Unit
              </p>
              <p class="">Hari</p>
            </div>
            <div class="ml-[10px]">
              <p class="text-xs font-bold underline underline-offset-2">
                Frekuensi
              </p>
              <p>3</p>
            </div>
            <div class="text-center ml-[10px]">
              <p class="font-bold mt-[10px]">X</p>
            </div>
            <div class="ml-[10px]">
              <p class="text-xs font-bold underline underline-offset-2">
                Periode
              </p>
              <p>1</p>
            </div>
          </div>
          <div class="grid grid-cols-1 rounded-lg bg-opensimrs-300 mt-[20px]">
            <div class="mt-[5px] ml-[10px] mb-[5px]">
              <p class="italic font-semibold text-white">
                Cara Baca : sehari 3 kali
              </p>
            </div>
          </div>
        </div>
        <hr class="mt-[20px] border border-slate-300" />
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
      </div>
      <div v-if="method === 'detail'">
        <div class="grid grid-cols-[40%,60%]">
          <!-- Kode Aturan Pakai -->
          <div>
            <p class="mt-[10px] font-bold">Kode Aturan Pakai</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.code }}</p>
          </div>
          <!-- Nama Item Medis -->
          <div>
            <p class="mt-[10px] font-bold">Nama Item Medis</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.name }}</p>
          </div>
          <!-- Periode Unit -->
          <div>
            <p class="mt-[10px] font-bold">Periode Unit</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.periodeUnit }}</p>
          </div>
          <!-- Frekuensi -->
          <div>
            <p class="mt-[10px] font-bold">Frekuensi</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.frekuensi }}</p>
          </div>
          <!-- Periode -->
          <div>
            <p class="mt-[10px] font-bold">Periode</p>
          </div>
          <div>
            <p class="mt-[10px]">: {{ payload.periode }}</p>
          </div>
        </div>
        <hr class="mt-[20px] border border-slate-300" />
        <div class="grid grid-cols-1">
          <div class="flex">
            <p class="mt-[20px] font-bold">
              Status <span class="font-normal ml-[170px]">:</span>
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
