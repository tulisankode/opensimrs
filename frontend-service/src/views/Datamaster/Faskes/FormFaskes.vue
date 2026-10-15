<script lang="ts" setup>
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useFaskesStore } from "@/stores/datamaster/faskes";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

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
  yup.object({
    code: yup.string().required("Kode Faskes harus diisi"),
    name: yup.string().required("Nama Faskes harus diisi"),
    organizationIhsNumber: yup.string().required("IHS Number Organisasi harus diisi"),
    clientId: yup.string().required("Client ID harus diisi"),
    clientSecret: yup.string().required("Client Secret harus diisi"),
    status: yup.bool().default(true),
  }).noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const faskesStore = useFaskesStore();

const [code] = defineField("code");
const [name] = defineField("name");
const [organizationIhsNumber] = defineField("organizationIhsNumber");
const [clientId] = defineField("clientId");
const [clientSecret] = defineField("clientSecret");
const [status] = defineField("status");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values: any) => {
  try {
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await faskesStore.putApi(uuid, values);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      console.log("Adding new data with values:", values);
      const response = await faskesStore.postApi(values);
      emit("data-updated");
    }
    closeDialog();
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
});

const method = ref(props.method);
const title = ref(props.title);

function updateVisibility(value: any) {
  emit("update:isDialogVisible", value);
}

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
    <template #header>{{ title }} Faskes</template>
    <template #body>
      <!-- Form Input -->
      <div v-if="method !== 'detail'" class="grid grid-cols-12 gap-5 mt-5">
        <CustomTextfield
          label="Kode Faskes"
          v-model="code"
          placeholder="Kode Faskes"
          :invalid="!!errors.code"
          :invalidMessage="errors.code"
          class="col-span-4"
          :required="errors.code ? true : false"
        />
        <CustomTextfield
          label="Nama Faskes"
          v-model="name"
          placeholder="Nama Faskes"
          class="col-span-8"
          :invalid="!!errors.name"
          :invalidMessage="errors.name"
          :required="errors.name ? true : false"
        />
        <CustomTextfield
          label="IHS Number Organization"
          v-model="organizationIhsNumber"
          placeholder="IHS Number Organization"
          class="col-span-12"
          :invalid="!!errors.organizationIhsNumber"
          :invalidMessage="errors.organizationIhsNumber"
          :required="errors.organizationIhsNumber ? true : false"
        />
        <CustomTextfield
          label="Client ID"
          v-model="clientId"
          placeholder="Client ID"
          class="col-span-12"
          :invalid="!!errors.clientId"
          :invalidMessage="errors.clientId"
          :required="errors.clientId ? true : false"
        />
        <CustomTextfield
          label="Client Secret"
          v-model="clientSecret"
          placeholder="Client Secret"
          class="col-span-12"
          :invalid="!!errors.clientSecret"
          :invalidMessage="errors.clientSecret"
          :required="errors.clientSecret ? true : false"
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
        <CustomInfoRow label="Kode Faskes" :value="code" />
        <CustomInfoRow label="Nama Faskes" :value="name" />
        <CustomInfoRow label="IHS Number Organisasi" :value="organizationIhsNumber" />
        <CustomInfoRow label="Client ID" :value="clientId" />
        <CustomInfoRow label="Client Secret" :value="clientSecret" />
        <hr class="col-span-12 border-grey-200" />
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
