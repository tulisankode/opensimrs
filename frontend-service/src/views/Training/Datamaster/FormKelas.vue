<script lang="ts" setup>
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useIcd9Store } from "@/stores/datamaster/icd9";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";

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
      kode: yup.string().required("Kode Kelas harus diisi"),
      nama: yup.string().required("Nama Kelas harus diisi"),
      isSesi: yup.bool().default(false),
      jumlahSlot: yup.number().required("Jumlah Slot harus diisi"),
      harga: yup.number().required("Harga harus diisi"),
      status: yup.bool().default(false),
      kelasSesi: yup.array().of(
        yup.string().when("isSesi", {
          is: (value: boolean) => value === true,
          then: (schema) => schema.required("Kelas Sesi harus dipilih"),
          otherwise: (schema) => schema.notRequired(),
        })
      ),
    })
    .noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const icd9Store = useIcd9Store();

const [kode] = defineField("kode");
const [nama] = defineField("nama");
const [isSesi] = defineField("isSesi");
const [jumlahSlot] = defineField("jumlahSlot");
const [harga] = defineField("harga");
const [kelasSesi] = defineField("kelasSesi");
const [status] = defineField("status");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values: any) => {
  try {
    if (method.value === "edit") {
      console.log("Data updated successfully:", values);
      emit("data-updated");
    } else if (method.value === "add") {
      console.log("Adding new data with values:", values);
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
    <template #header>{{ title }} ICD 9 CM</template>
    <template #body>
      <!-- Form Input -->
      <div v-if="method !== 'detail'" class="grid grid-cols-12 gap-5 mt-5">
        <CustomTextfield
          label="Kode Kelas"
          v-model="kode"
          placeholder="Kode Kelas"
          :invalid="!!errors.kode"
          :invalidMessage="errors.kode"
          class="col-span-4"
          :required="errors.kode ? true : false"
        />
        <CustomTextfield
          label="Nama Kelas"
          v-model="nama"
          placeholder="Nama Kelas"
          :invalid="!!errors.nama"
          :invalidMessage="errors.nama"
          class="col-span-8"
          :required="errors.nama ? true : false"
        />
        <CustomInputNumber
          v-model="harga"
          class="col-span-6"
          label="Harga"
          :invalid="!!errors.harga"
          :invalidMessage="errors.harga"
          :required="errors.harga ? true : false"
        >
          <template #prependText>
            <div
              class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD text-opensimrs-300 bg-opensimrs-300 rounded-l-md"
            >
              Rp.
            </div>
          </template>
        </CustomInputNumber>
        <CustomInputNumber
          v-model="jumlahSlot"
          label="Jumlah Slot"
          class="col-span-3"
          :invalid="!!errors.jumlahSlot"
          :invalidMessage="errors.jumlahSlot"
          :required="errors.jumlahSlot ? true : false"
        />
        <CustomSwitch
          v-model="isSesi"
          :show-label="true"
          label="Sesi"
          sideLabel="NON-AKTIF"
          sideLabelTrue="AKTIF"
          class="col-span-3"
        />
        <CustomMultiSelect
          v-if="isSesi"
          v-model="kelasSesi"
          label="Sesi Kelas"
          placeholder="Sesi Kelas"
          class="col-span-12"
          :invalid="!!errors.kelasSesi"
          :invalidMessage="errors.kelasSesi"
          :required="errors.kelasSesi ? true : false"
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
        <CustomInfoRow label="Kode ICD 9 CM" :value="kode" />
        <CustomInfoRow label="Nama ICD 9 CM" :value="nama" />
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
