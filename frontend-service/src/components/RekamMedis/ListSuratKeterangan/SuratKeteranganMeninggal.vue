<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
const emit = defineEmits(["onDelete", "update:dataSurat"]);
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { utilsStore } from "@/stores/utils";

const props = defineProps({
  nomorSurat: {
    type: String,
    default: "",
  },
});

const schema = toTypedSchema(
  yup.object({
    noSurat: yup.string().default("No. 12345").notRequired(),
    tanggalMeninggal: yup.date().required("Tanggal Meninggal harus dipilih"),
    lokasiMeniggal: yup.string().required("Lokasi Meninggal harus dipilih"),
    dokter: yup
      .string()
      .required("Dokter Yang Menyatakan Meninggal harus dipilih"),
    penyebabKematian: yup.string().required("Penyebab Kematian harus dipilih"),

    keterangan: yup.string().optional(),
  }).noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setFieldValue } = useForm({
  validationSchema: schema,
});

const [noSurat] = defineField("noSurat");
const [tanggalMeninggal] = defineField("tanggalMeninggal");
const [lokasiMeniggal] = defineField("lokasiMeniggal");
const [dokter] = defineField("dokter");
const [penyebabKematian] = defineField("penyebabKematian");
const [keterangan] = defineField("keterangan");

const itemsLokasiMeninggal = ref([
  "Rumah Sakit",
  "PUSKESMAS",
  "Rumah Bersalin",
  "Rumah Tempat Tinggal",
  "DOA",
  "Lainnya",
]);
const itemsPenyebabKematian = ref([
  "Penyakit Khusus",
  "Penyakit Menular",
  "Penyakit Tidak Menular",
  "Gangguan Maternal",
  "Gangguan Perinatal(0-6 Hari)",
  "Gejala, Tanda dan Kondisi Lainnya",
  "Cedera Kecelakaan Lalu Lintas",
  "Cedera Kecelakaan Kerja",
  "Cedera Kecelakaan Lainnya",
  "Lain-Lain",
]);
const doctorOptions = ref<any[]>([]);

const praktisiStore = usePraktisiStore();
const UseUtilsStore = utilsStore();
const maxDateTime = new Date();

const loadDropdownData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const params = {
      page: 1,
      limit: 9999,
      name: "",
      isDoctor: true,
    };
    const response = await praktisiStore.getApi(params);
    if (response && response.payload) {
      doctorOptions.value = response.payload;
    } else {
      doctorOptions.value = [];
    }
  } catch (error) {
    console.error("Gagal mengambil data dokter:", error);
    doctorOptions.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

onMounted(() => {
  loadDropdownData();
});


const submitForm = handleSubmit((currentValues) => {
  const selectedDoctor = doctorOptions.value.find(d => d.uuid === currentValues.dokter);
  const finalDokterName = selectedDoctor ? selectedDoctor.pegawai?.name : currentValues.dokter;

  const dataToEmit = {
    ...currentValues,
    dokterName: finalDokterName,
  };

  setFieldValue("dokter", finalDokterName);
  emit("update:dataSurat", dataToEmit);
  return dataToEmit;
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
        Surat Keterangan Meninggal
        <PhX :size="20" @click="emit('onDelete')" />
      </div>
    </template>
    <template #content>
      <div class="grid grid-cols-12 gap-5 pt-5">
        <CustomTextfield
          label="No. Surat"
          v-model="noSurat"
          class="col-span-4"
          :disabled="true"
        />
        <CustomDatePicker
          v-model="tanggalMeninggal"
          label="Tanggal & Waktu Meninggal"
          class="col-span-4"
          :invalid="!!errors.tanggalMeninggal"
          :invalidMessage="errors.tanggalMeninggal"
          showTime
          :maxDate="maxDateTime"
        />
        <CustomSelect
          label="Lokasi Meninggal"
          v-model="lokasiMeniggal"
          place-holder="Pilih Lokasi Meninggal"
          class="col-span-4"
          :options="itemsLokasiMeninggal"
          option-label=""
          option-value=""
          :invalid="!!errors.lokasiMeniggal"
          :invalidMessage="errors.lokasiMeniggal"
        />
        <CustomSelect
          label="Dokter Yang Menyatakan Meninggal"
          v-model="dokter"
          place-holder="Pilih Dokter Yang Menyatakan Meninggal"
          class="col-span-6"
          :options="doctorOptions"
          option-label="pegawai.name"
          option-value="uuid"
          :invalid="!!errors.dokter"
          :invalidMessage="errors.dokter"
        />
        <CustomSelect
          label="Penyebab Kematian"
          v-model="penyebabKematian"
          place-holder="Pilih Penyebab Kematian"
          class="col-span-6"
          :options="itemsPenyebabKematian"
          option-label=""
          option-value=""
          :invalid="!!errors.penyebabKematian"
          :invalidMessage="errors.penyebabKematian"
        />
        <CustomTextArea
          label="Keterangan/Catatan"
          v-model="keterangan"
          placeholder="Keterangan/Catatan..."
          class="col-span-12"
          :invalid="!!errors.keterangan"
          :invalidMessage="errors.keterangan"
        />
      </div>
    </template>
  </CustomAccordion>
</template>
