<script setup lang="ts">
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useGigiStore } from "@/stores/datamaster/gigiFDI";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "",
  },
  method: {
    type: String,
    default: "detail",
  },
  payload: {
    type: Object,
    default: () => ({}),
  },
});

const schema = toTypedSchema(
  yup
    .object({
      code: yup.string().required("Kode SATUSEHAT harus diisi"),
      display: yup.string().required("Display SATUSEHAT harus diisi"),
      name: yup.number().required("Nama Gigi harus diisi"),
      status: yup.bool().default(true),
    })
    .noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const gigiStore = useGigiStore();

const [code] = defineField("code");
const [display] = defineField("display");
const [name] = defineField("name");
const [status] = defineField("status");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values) => {
  try {
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await gigiStore.putApi(uuid, values);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      console.log("Adding new data with values:", values);
      const response = await gigiStore.postApi(values);
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
    <template #header>{{ title }}</template>
    <template #body>
      <div v-if="method !== 'detail'" class="flex flex-col gap-5 mt-5">
        <!-- Keadaan Gigi Input -->
        <CustomTextfield
          v-model="code"
          label="Code SATUSEHAT"
          placeholder="Masukkan Code SATUSEHAT"
          :invalid="!!errors.code"
          :invalidMessage="errors.code"
          :required="errors.code ? true : false"
        />
        <CustomTextfield
          v-model="display"
          label="Display SATUSEHAT"
          placeholder="Masukkan Display SATUSEHAT"
          :invalid="!!errors.display"
          :invalidMessage="errors.display"
          :required="errors.display ? true : false"
        />
        <CustomInputNumber
          v-model="name"
          label="Gigi"
          placeholder="Masukkan Gigi"
          :invalid="!!errors.name"
          :invalidMessage="errors.name"
          :required="errors.name ? true : false"
        />
        <!-- Divider -->
        <hr class="col-span-2 border-gray-200" />
        <!-- Status Switch -->
        <!-- <CustomSwitch
          v-model="status"
          :show-label="true"
          label="Status"
          sideLabel="NON-AKTIF"
          sideLabelTrue="AKTIF"
          class="col-span-2"
        /> -->
      </div>
      <div v-else class="flex flex-col gap-5 mt-5">
        <CustomInfoRow label="Code SATUSEHAT" :value="code" />
        <CustomInfoRow label="Display SATUSEHAT" :value="display" />
        <CustomInfoRow label="Gigi" :value="`${name}`" />
        <hr class="col-span-12 border-grey-200" />
        <!-- <CustomInfoRow label="Status">
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
        </CustomInfoRow> -->
      </div>
    </template>

    <!-- Footer Section for Reset and Save Buttons -->
    <template #footer>
      <div class="flex justify-end space-x-3">
        <CustomButton
          v-if="method !== 'detail'"
          border-color="border-grey-200"
          text-color="text-grey-300"
          background-color="bg-transparent"
          label="Reset"
          @click="resetForm()"
        ></CustomButton>
        <CustomButton
          v-if="method !== 'detail'"
          label="Simpan"
          @click="onSubmit"
        ></CustomButton>
        <CustomButton
          v-if="method === 'detail'"
          label="Edit"
          @click="handleEdit"
        ></CustomButton>
      </div>
    </template>
  </CustomDialog>
</template>
