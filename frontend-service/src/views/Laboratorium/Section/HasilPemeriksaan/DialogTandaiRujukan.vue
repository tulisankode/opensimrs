<script setup lang="ts">
import { ref, onMounted } from "vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useForm, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useLabRujukanStore } from "@/stores/datamasterLaboratorium/labRujukan";
import { useRujukanLabStore } from "@/stores/Laboratorium/rujukanLab";
import { utilsStore } from "@/stores/utils";

const labRujukanStore = useLabRujukanStore();
const rujukanLabStore = useRujukanLabStore();
const storeUtils = utilsStore();

const visible = ref(false);
const observationItemUuid = ref<string | null>(null);
const daftarLabRujukan = ref<any[]>([]);

const emit = defineEmits(["submitted"]);

const validationSchema = toTypedSchema(
  yup.object({
    labRujukanUuid: yup.string().required("Laboratorium rujukan wajib dipilih"),
    catatanRujukan: yup.string().max(255, "Catatan maksimal 255 karakter"),
  })
);

const { handleSubmit, resetForm, defineField, errors } = useForm({
  validationSchema,
  initialValues: { labRujukanUuid: "", catatanRujukan: "" },
});

const [labRujukanUuid, labRujukanUuidAttrs] = defineField("labRujukanUuid");
const [catatanRujukan, catatanRujukanAttrs] = defineField("catatanRujukan");

const fetchDaftarLabRujukan = async () => {
  try {
    const response = await labRujukanStore.getActiveApi();
    daftarLabRujukan.value = response?.payload ?? [];
  } catch (error) {
    console.error("Gagal mengambil daftar laboratorium rujukan", error);
    daftarLabRujukan.value = [];
  }
};

const buka = (uuid: string) => {
  resetForm();
  observationItemUuid.value = uuid;
  visible.value = true;
};

const submit = handleSubmit(async (values) => {
  if (!observationItemUuid.value) return;
  storeUtils.setLoading(true);
  try {
    const response = await rujukanLabStore.tandaiApi(observationItemUuid.value, {
      lab_rujukan_uuid: values.labRujukanUuid,
      catatan_rujukan: values.catatanRujukan || null,
    });
    if (response) {
      visible.value = false;
      emit("submitted");
    }
  } catch (error) {
    console.error("Gagal menandai rujukan", error);
  } finally {
    storeUtils.setLoading(false);
  }
});

onMounted(fetchDaftarLabRujukan);

defineExpose({ buka });
</script>

<template>
  <CustomDialog v-model:visible="visible" :style="{ width: '500px' }">
    <template #header>
      <p>Tandai Rujukan ke Laboratorium Luar</p>
    </template>
    <template #body>
      <div class="mt-[20px]">
        <CustomSelect
          v-model="labRujukanUuid"
          v-bind="labRujukanUuidAttrs"
          :options="daftarLabRujukan"
          label="Laboratorium Rujukan"
          optionLabel="name"
          optionValue="uuid"
          place-holder="Pilih Laboratorium Rujukan"
          :class="{ 'border-red-500': errors.labRujukanUuid }"
        />
        <ErrorMessage name="labRujukanUuid" class="mt-1 text-xs text-red-500" />
      </div>
      <div class="mt-[15px]">
        <CustomTextfield
          v-model="catatanRujukan"
          v-bind="catatanRujukanAttrs"
          label="Catatan (opsional)"
          placeholder="Nomor sampel di lab luar, dsb."
          :class="{ 'border-red-500': errors.catatanRujukan }"
        />
        <ErrorMessage name="catatanRujukan" class="mt-1 text-xs text-red-500" />
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            label="Batal"
            textColor="text-grey-300"
            backgroundColor="bg-transparent"
            borderColor="border-2 border-grey-200"
            @click="visible = false"
          />
          <CustomButton label="Simpan" @click="submit" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
