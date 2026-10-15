<script lang="ts" setup>
import { ref, watch,onMounted,computed } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useTindakanStore } from "@/stores/datamaster/tindakan";
import { useIcd9Store } from "@/stores/datamaster/icd9";
import { useSnomedCTStore } from "@/stores/datamaster/snomedCT";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
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

const tindakanStore=useTindakanStore();
const icd9Store=useIcd9Store();
const snomedStore=useSnomedCTStore();
const icd9Payload= ref<any[]>([]); 
const snomedPayload= ref<any[]>([]); 

const fetchIcd9 = async () => {
  try {
    const response = await icd9Store.getAktifApi();
    if (response && response.payload) {
      icd9Payload.value = response.payload;
    } else {
      icd9Payload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch ICD9", error);
    icd9Payload.value = [];
  }
};
const fetchSnomed = async () => {
  try {
    const response = await snomedStore.getAktifApi();
    if (response && response.payload) {
      snomedPayload.value = response.payload;
    } else {
      snomedPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch Snomed CT", error);
    snomedPayload.value = [];
  }
};
onMounted(() => {
  fetchIcd9();
  fetchSnomed();
});

const schema = toTypedSchema(
  yup.object({
    code: yup.string().required("Kode Tindakan harus diisi"),
    name: yup.string().required("Nama Tindakan harus diisi"),
    snomedUuid: yup.string().notRequired(),
    icd9Uuid: yup.string().notRequired(),
    status: yup.bool().default(true),
  }).noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const [code] = defineField("code");
const [name] = defineField("name");
const [snomedUuid] = defineField("snomedUuid");
const [icd9Uuid] = defineField("icd9Uuid");
const [status] = defineField("status");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values: any) => {
  try {
    if (values.snomedUuid === "") {
      delete values.snomedUuid;
    }
    if (values.icd9Uuid === "") {
      delete values.icd9Uuid;
    }
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      console.log("edit data with values:", values);
      const response = await tindakanStore.putApi(uuid, values);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      console.log("Adding new data with values:", values);
      const response = await tindakanStore.postApi(values);
      emit("data-updated");
    }
    closeDialog();
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
});


const method = ref(props.method);
const title = ref(props.title);

const updateVisibility= (value: any) => {
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
          snomedUuid: props.payload.snomedDetail?.uuid || '',
            icd9Uuid: props.payload.icd9Detail?.uuid || ''
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
    <template #header>{{ title }} Tindakan</template>
    <template #body>
      <!-- Form Input -->
      <div v-if="method !== 'detail'" class="grid grid-cols-12 gap-5 mt-5">
        <CustomTextfield
          label="Kode Tindakan"
          v-model="code"
          placeholder="Kode Tindakan"
          :invalid="!!errors.code"
          :invalidMessage="errors.code"
          class="col-span-4"
          :required="errors.code ? true : false"
        />
        <CustomTextfield
          label="Nama Tindakan"
          v-model="name"
          placeholder="Nama Tindakan"
          :invalid="!!errors.name"
          :invalidMessage="errors.name"
          class="col-span-8"
          :required="errors.name ? true : false"
        />
        <CustomSelect
          label="Snomed CT"
          place-holder="Pilih Snomed CT"
          v-model="snomedUuid"
          :options="snomedPayload"
          optionValue="uuid"
          optionLabel="name"
          class="col-span-12"
        />
        <CustomSelect
          label="ICD-9 CM"
          place-holder="Pilih ICD-9 CM"
          v-model="icd9Uuid"
          :options="icd9Payload"
          optionValue="uuid"
          optionLabel="name"
          class="col-span-12"
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
        <CustomInfoRow label="Kode Tindakan" :value="code" />
        <CustomInfoRow label="Nama Tindakan" :value="name" />
        <CustomInfoRow label="Snomed CT" :value="payload.snomedDetail?.name ?? '-'" />
        <CustomInfoRow label="ICD-9 CM" :value="payload.icd9Detail?.name ?? '-'" />
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
