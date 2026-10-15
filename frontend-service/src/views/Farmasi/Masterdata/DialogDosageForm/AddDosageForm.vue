<script lang="ts" setup>
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useDosageFormStore } from "@/stores/datamasterFarmasi/DosageForm";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
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

const schema = toTypedSchema(
  yup
    .object({
      code: yup.string().trim().required("Kode Satuan harus diisi"),
      name: yup.string().trim().required("Nama Satuan harus diisi"),
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
const bentukSediaanStore = useDosageFormStore();

const [code] = defineField("code");
const [name] = defineField("name");
const [status] = defineField("status");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values: any) => {
  try {
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await bentukSediaanStore.putApi(uuid, values);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      const response = await bentukSediaanStore.postApi(values);
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
      <div class="grid grid-cols-1">
        <p>{{ title }} Bentuk Sediaan</p>
      </div>
    </template>
    <template #body>
      <div class="grid grid-cols-[30%,70%]">
        <div class="mt-[20px]">
          <CustomTextfield
            v-model="code"
            label="Kode Bentuk Sediaan"
            placeholder="Kode Bentuk Sediaan"
            class="mr-2"
            :invalid="!!errors.code"
            :invalidMessage="errors.code"
          />
        </div>
        <div class="mt-[20px]">
          <CustomTextfield
            v-model="name"
            label="Nama Bentuk Sediaan"
            placeholder="Nama Bentuk Sediaan"
            class="ml-2"
            :invalid="!!errors.name"
            :invalidMessage="errors.name"
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
    </template>
    <template #footer>
      <div class="w-full">
        <!-- <hr class="-mx-5 border-grey-200" /> -->
        <div class="flex gap-2.5 justify-end mt-5">
          <CustomButton
            label="Reset"
            textColor="text-grey-300"
            backgroundColor="bg-transparent"
            borderColor="border-2 border-grey-200"
            @click="resetForm"
          />
          <CustomButton label="Simpan" @click="onSubmit" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
