<script setup lang="ts">
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomRadio from "@/components/Base/CustomRadio.vue";
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
    tanggalPemeriksaan: yup
      .date()
      .required("Tanggal Pemeriksaan harus dipilih"),
    beratBadan: yup.number().required("Berat Badan harus diisi"),
    tinggiBadan: yup.number().required("Tinggi Badan harus diisi"),
    visus: yup.string().required("Visus OD/OS harus diisi"),
    golonganDarah: yup.string().required("Golongan Darah harus diisi"),
    butaWarna: yup.bool().default(false),
    pernyataan: yup.string().required("Pernyataan harus dipilih"),
    keperluan: yup.string().required("Keperluan harus diisi"),
  }).noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setFieldValue } = useForm({
  validationSchema: schema,
  initialValues: {
    pernyataan: 'Sehat',
    butaWarna: false,
  }
});

const [noSurat] = defineField("noSurat");
const [tanggalPemeriksaan] = defineField("tanggalPemeriksaan");
const [beratBadan] = defineField("beratBadan");
const [tinggiBadan] = defineField("tinggiBadan");
const [visus] = defineField("visus");
const [golonganDarah] = defineField("golonganDarah");
const [butaWarna] = defineField("butaWarna");
const [pernyataan] = defineField("pernyataan");
const [keperluan] = defineField("keperluan");

const maxDate = ref(new Date());

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
  { immediate: true }
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
        Surat Keterangan Sehat
        <PhX :size="20" @click="emit('onDelete')" />
      </div>
    </template>
    <template #content>
      <div class="grid grid-cols-12 gap-5 pt-5">
        <CustomTextfield
          label="No. Surat"
          v-model="noSurat"
          class="col-span-5"
          :disabled="true"
        />
        <CustomDatePicker
          v-model="tanggalPemeriksaan"
          label="Tanggal Pemeriksaan"
          class="col-span-7"
          :invalid="!!errors.tanggalPemeriksaan"
          :invalidMessage="errors.tanggalPemeriksaan"
          :max-date="maxDate"
        />
        <CustomInputNumber
          v-model="beratBadan"
          label="Berat Badan"
          class="col-span-3"
          :invalid="!!errors.beratBadan"
          :invalidMessage="errors.beratBadan"
        >
          <template #appendText>
            <div class="flex items-center mr-2.5">Kg</div>
          </template>
        </CustomInputNumber>
        <CustomInputNumber
          v-model="tinggiBadan"
          label="Tinggi Badan"
          class="col-span-3"
          :invalid="!!errors.tinggiBadan"
          :invalidMessage="errors.tinggiBadan"
        >
          <template #appendText>
            <div class="flex items-center mr-2.5">Cm</div>
          </template>
        </CustomInputNumber>
        <CustomTextfield
          v-model="visus"
          label="Visus OD/OS"
          placeholder="Visus OD/OS"
          class="col-span-6"
          :invalid="!!errors.visus"
          :invalidMessage="errors.visus"
        />
        <CustomTextfield
          v-model="golonganDarah"
          label="Golongan Darah"
          placeholder="Golongan Darah"
          class="col-span-3"
          :invalid="!!errors.golonganDarah"
          :invalidMessage="errors.golonganDarah"
        />
        <CustomSwitch
          v-model="butaWarna"
          label="Buta Warna"
          class="col-span-3"
        />
        <div class="grid grid-cols-2 gap-x-2.5 col-span-6">
          <div class="col-span-2 font-semibold text-normal">
            Setelah Diperiksa Dinyatakan
          </div>
          <CustomRadio
            v-for="data in ['Sehat', 'Tidak Sehat']"
            v-model="pernyataan"
            :sideLabel="data"
            :value="data"
          />
        </div>
        <CustomTextArea
          label="Untuk Keperluan"
          v-model="keperluan"
          placeholder="Untuk Keperluan ..."
          class="col-span-12"
          :invalid="!!errors.keperluan"
          :invalidMessage="errors.keperluan"
        />
      </div>
    </template>
  </CustomAccordion>
</template>
