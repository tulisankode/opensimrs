<script lang="ts" setup>
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { usePriceConfigurationStore } from "@/stores/datamasterFarmasi/PriceConfiguration";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
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
  yup.object({
    namaBentukRacikan: yup.string().required("Bentuk Racikan harus diisi"),
    jumlah: yup.number().required("Jumlah harus diisi"),
    tarifEmbalase: yup.number().required("Tarif Embalase harus diisi"),
    tarifRacik: yup.number().required("Tarif Racik harus diisi"),
  }).noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const PriceConfigurationStore = usePriceConfigurationStore();

const [namaBentukRacikan] = defineField("namaBentukRacikan");
const [jumlah] = defineField("jumlah");
const [tarifEmbalase] = defineField("tarifEmbalase");
const [tarifRacik] = defineField("tarifRacik");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values: any) => {
  try {
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await PriceConfigurationStore.putApi(uuid, values);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      const response = await PriceConfigurationStore.postApi(values);
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
    width="600px">
      <template #header>
        <div class="grid grid-cols-1">
          <p>Tambah Bentuk Racikan & Jasa</p>
        </div>
      </template>
      <template #body>
        <div class="grid grid-cols-[70%,30%]">
          <!-- Bentuk Racikan -->
          <div class="mt-[20px]">
            <CustomTextfield
              v-model = "namaBentukRacikan"
              :invalid="!!errors.namaBentukRacikan"
              :invalidMessage="errors.namaBentukRacikan"
              label="Bentuk Racikan"
              placeholder="Bentuk Racikan"
              class="mr-4"
            />
          </div>
            <!-- Range Jumlah Paket -->
          <div class="mt-[20px]">
            <CustomInputNumber 
              label="Range Jumlah Paket" 
              placeholder="0"
              v-model = "jumlah"
              :invalid="!!errors.jumlah"
              :invalidMessage="errors.jumlah"
              >
              <template #prependText>
                <div class="font-bold text-sm text-white bg-opensimrs-300 rounded-l-lg w-[53.34px] flex items-center justify-center">
                  ≤
                </div>
              </template>
            </CustomInputNumber>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <!-- Tarif Embalase -->
            <div class="mt-[20px]">
                <CustomInputNumber 
                    v-model = "tarifEmbalase"
                    :invalid="!!errors.tarifEmbalase"
                    :invalidMessage="errors.tarifEmbalase"
                    label="Tarif Embalase" 
                    placeholder="0"
                    >
                        <template #prependText>
                            <div class="font-semibold text-sm text-white bg-opensimrs-300 rounded-l-lg w-[53.34px] flex items-center justify-center">
                            Rp.
                        </div>
                        </template>
                </CustomInputNumber>
            </div>
            <!-- Tarif Racik -->
            <div class="mt-[20px]">
                <CustomInputNumber 
                    v-model = "tarifRacik"
                    :invalid="!!errors.tarifRacik"
                    :invalidMessage="errors.tarifRacik"
                    label="Tarif Racik" 
                    placeholder="0"
                    >
                        <template #prependText>
                            <div class="font-semibold text-sm text-white bg-opensimrs-300 rounded-l-lg w-[53.34px] flex items-center justify-center">
                            Rp.
                        </div>
                        </template>
                </CustomInputNumber>
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
            <CustomButton label="Simpan" @click="onSubmit"/>
          </div>
        </div>
      </template>
    </CustomDialog>
</template>
