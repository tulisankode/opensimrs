<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { watch } from "vue";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";
import { useForm } from "vee-validate";
import { ref } from "vue";
import { usePermintaanBarangStore } from "@/stores/stok/PermintaanBarang";

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  data: {
    type: Object,
    default: () => ({}),
  },
});

const isSubmitting = ref(false);

const schema = toTypedSchema(
  yup.object({
    alasanBatal: yup.string().optional().trim(),
  })
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const [alasanBatal] = defineField("alasanBatal");

const PermintaanBarangStore = usePermintaanBarangStore();

const onSubmit = handleSubmit(async (values) => {
  isSubmitting.value = true;
  try {
    const payload = {
      status: "cancel",
      alasan_batal: values.alasanBatal,
    };

    await PermintaanBarangStore.batalPermintaanBarang(props.data.uuid, payload);
    emit("cancel", values.alasanBatal || "");
    emit("update:isDialogVisible", false);
    resetForm();
  } catch (error) {
    console.log(error);
  } finally {
    isSubmitting.value = false;
  }
});

const emit = defineEmits(["update:isDialogVisible", "close", "cancel"]);

const alasanPembatalan = ref("");

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

const closeDialog = () => {
  alasanPembatalan.value = "";
  emit("update:isDialogVisible", false);
};

watch(
  () => props.data,
  (newVal) => {
    console.log("ini dari delete dialog", newVal);
  },
  { immediate: true }
);

watch(
  () => props.isDialogVisible,
  (visible) => {
    if (visible) {
      setValues({ alasanBatal: "" });
    }
  }
);
</script>

<template>
  <CustomDialog
    width="600px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-danger-300"
  >
    <template #header>
      <div class="flex justify-between items-center w-full">
        <span class="font-semibold text-white">Batal Permintaan</span>
      </div>
    </template>
    <template #body>
      <div class="pt-5">
        <div class="mb-4">
          <label class="block mb-2 text-sm font-extrabold text-gray-700">
            Alasan Pembatalan
          </label>
          <CustomTextfield
            v-model="alasanBatal"
            placeholder="Alasan Pembatalan"
            :showLabel="false"
            class="w-full"
          />
        </div>
        <div class="text-sm text-red-500">
          <span class="text-red-500">*</span>Setelah membatalkan, riwayat
          permintaan akan masuk ke tab menu
          <span class="font-extrabold text-red-500">DIBATALKAN</span>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="flex gap-3 justify-end mt-5">
          <CustomButton
            label="Tidak"
            border-color="border-grey-200"
            background-color="bg-white"
            text-color="text-grey-300"
            @click="closeDialog"
          />
          <CustomButton
            label="Iya, Batalkan"
            backgroundColor="bg-danger-300"
            textColor="text-white"
            @click="onSubmit"
            :disabled="isSubmitting"
          />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
