<script lang="ts" setup>
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";

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

const optionsJenisLokasi = ref([
  { label: "Gudang", value: "gudang" },
  { label: "Depo Pelayanan", value: "depo" },
]);

const optionsDefault = ref([
  { label: "Rawat Inap", value: "0" },
  { label: "Rawat Jalan", value: "1" },
  { label: "IGD", value: "2" },
  { label: "FISIO", value: "3" },
]);

const schema = toTypedSchema(
  yup
    .object({
      code: yup.string().trim().required("Kode Satuan harus diisi"),
      name: yup.string().trim().required("Nama Satuan harus diisi"),
      jenisLokasi: yup.string().required("Jenis Lokasi harus diisi"),
      defaultTujuanOrderPermintaan: yup
        .array()
        .when("jenisLokasi", ([jenisLokasi], schema) =>
          jenisLokasi == "depo"
            ? schema.min(1, "at least 1").required("Tujuan Order harus dipilih")
            : schema.nullable()
        ),
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

const StockLocationStore = useStockLocationStore();

const [code] = defineField("code");
const [name] = defineField("name");
const [jenisLokasi] = defineField("jenisLokasi");
const [defaultTujuanOrderPermintaan] = defineField(
  "defaultTujuanOrderPermintaan"
);
const [status] = defineField("status");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values: any) => {
  try {
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await StockLocationStore.putApi(uuid, values);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      const response = await StockLocationStore.postApi(values);
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
    width="500px"
  >
    <template #header>
      <div class="grid grid-cols-1">
        <p>{{ title }} Lokasi Stok</p>
      </div>
    </template>
    <template #body>
      <div class="grid grid-cols-[30%,70%]">
        <div class="mt-[20px]">
          <CustomTextfield
            v-model="code"
            label="Kode Lokasi Stok"
            placeholder="Kode Lokasi Stok"
            class="mr-2"
            :invalid="!!errors.code"
            :invalidMessage="errors.code"
          />
        </div>
        <div class="mt-[20px]">
          <CustomTextfield
            v-model="name"
            label="Nama Lokasi Stok"
            placeholder="Nama Lokasi Stok"
            class="ml-2"
            :invalid="!!errors.name"
            :invalidMessage="errors.name"
          />
        </div>
      </div>
      <div class="grid grid-cols-1">
        <div class="mt-[20px]">
          <CustomSelect
            place-holder="Pilih Jenis Lokasi"
            label="Pilih Jenis Lokasi"
            v-model="jenisLokasi"
            optionValue="value"
            optionLabel="label"
            :options="optionsJenisLokasi"
            :invalid="!!errors.jenisLokasi"
            :invalidMessage="errors.jenisLokasi"
          />
        </div>
      </div>
      <div class="grid grid-cols-1" v-if="jenisLokasi === 'depo'">
        <div class="mt-[20px]">
          <CustomMultiSelect
            placeholder="Pilih Tujuan Order & Permintaan"
            label="Default Tujuan Order & Permintaan"
            v-model="defaultTujuanOrderPermintaan"
            optionLabel="label"
            optionValue="value"
            :maxSelectedLabels="4"
            :options="optionsDefault"
            :invalid="!!errors.defaultTujuanOrderPermintaan"
            :invalidMessage="errors.defaultTujuanOrderPermintaan"
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
