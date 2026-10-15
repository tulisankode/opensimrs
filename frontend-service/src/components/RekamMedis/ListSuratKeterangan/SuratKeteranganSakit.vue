<script setup lang="ts">
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
const emit = defineEmits(["onDelete", "update:dataSurat"]);

const props = defineProps({
  nomorSurat: {
    type: String,
    default: "",
  },
});

const schema = toTypedSchema(
  yup.object({
    noSurat: yup.string().default("No. 12345").notRequired(),
    lamaIstirahat: yup.number().required("Lama Istirahat harus diisi"),
    tanggalMulai: yup.date().required("Tanggal Mulai harus dipilih"),
    larangan: yup.string().required("Larangan harus diisi"),
    keterangan: yup.string().required("Keterangan Sakit harus diisi"),
  }).noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setFieldValue } = useForm({
  validationSchema: schema,
});

const [noSurat] = defineField("noSurat");
const [lamaIstirahat] = defineField("lamaIstirahat");
const [tanggalMulai] = defineField("tanggalMulai");
const [larangan] = defineField("larangan");
const [keterangan] = defineField("keterangan");

const minDate = ref(new Date());

const submitForm = handleSubmit((values) => {
  emit("update:dataSurat", values);
  return values;
});
const accordion = ref<HTMLCanvasElement | null>(null);
const open = () => {
  if (accordion.value) {
    (accordion.value as any).open();
  }
};
const close = () => {
  if (accordion.value) {
    (accordion.value as any).close();
  }
};

watch(
  () => props.nomorSurat,
  (newVal) => {
    if (newVal) {
      setFieldValue("noSurat", newVal);
    }
  },
  { immediate: true } //
);


defineExpose({
  submitForm,
  open,
  close,
});

</script>
<template>
  <CustomAccordion headerClass="bg-opensimrs-50" initial-state="0" ref="accordion">
    <template #header>
      <div class="flex items-center justify-between w-full pr-2.5">
        Surat Keterangan Sakit
        <PhX :size="20" @click="emit('onDelete')" />
      </div>
    </template>
    <template #content>
      <div class="grid grid-cols-12 gap-5 pt-5">
        <CustomTextfield
          label="No. Surat"
          v-model="noSurat"
          class="col-span-6"
          :disabled="true"
        />
        <CustomInputNumber
          v-model="lamaIstirahat"
          label="Istirahat Selama"
          class="col-span-6"
          :invalid="!!errors.lamaIstirahat"
          :invalidMessage="errors.lamaIstirahat"
        >
          <template #appendText>
            <div class="flex items-center mr-2.5">Hari</div>
          </template>
        </CustomInputNumber>
        <CustomDatePicker
          v-model="tanggalMulai"
          label="Mulai dari Tanggal"
          class="col-span-7"
          :invalid="!!errors.tanggalMulai"
          :invalidMessage="errors.tanggalMulai"
          :min-date="minDate"
        />
        <CustomTextfield
          v-model="larangan"
          label="Larangan"
          placeholder="Larangan"
          class="col-span-5"
          :invalid="!!errors.larangan"
          :invalidMessage="errors.larangan"
        />
        <CustomTextArea
          v-model="keterangan"
          label="Keterangan Sakit"
          placeholder="Keterangan Sakit ..."
          class="col-span-12"
          :invalid="!!errors.keterangan"
          :invalidMessage="errors.keterangan"
        />
      </div>
    </template>
  </CustomAccordion>
</template>
