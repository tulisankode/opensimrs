<script lang="ts" setup>
import { onMounted, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { utilsStore } from "@/stores/utils";
import { useLokasiStore } from "@/stores/datamaster/lokasi";

const props = defineProps({
  nomorSurat: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["onDelete", "update:dataSurat"]);

const schema = toTypedSchema(
  yup
    .object({
      noSurat: yup.string().default("No. 12345").notRequired(),
      tanggalPeriksa: yup.date().required("Tanggal Kontrol harus dipilih"),
      poli: yup.string().required("Poli harus dipilih"),
      dokter: yup.string().required("Dokter harus dipilih"),
      keterangan: yup.string().optional(),
    })
    .noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setFieldValue } = useForm({
  validationSchema: schema,
});

const [noSurat] = defineField("noSurat");
const [tanggalPeriksa] = defineField("tanggalPeriksa");
const [poli] = defineField("poli");
const [dokter] = defineField("dokter");
const [keterangan] = defineField("keterangan");

const poliOptions = ref<any[]>([]);
const doctorOptions = ref<any[]>([]);
const minDate = ref(new Date());

// STORE
const praktisiStore = usePraktisiStore();
const UseUtilsStore = utilsStore();
const lokasiStore = useLokasiStore();

const loadDropdownData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const [doctorResponse, lokasiResponse] = await Promise.all([
      praktisiStore.getApi({ page: 1, limit: 9999, name: "", isDoctor: true }),
      lokasiStore.getApi(1, 9999)
    ]);
    if (doctorResponse && doctorResponse.payload) {
      doctorOptions.value = doctorResponse.payload;
    } else {
      doctorOptions.value = [];
    }
    if (lokasiResponse && lokasiResponse.payload) {
      poliOptions.value = lokasiResponse.payload
        .filter((lokasi: any) => {
          return (
            lokasi.locationType?.toLowerCase() === "ward" &&
            Boolean(lokasi.isPoli) === true
          );
        })
        .map((lokasi: any) => ({
          name: lokasi.name,
          uuid: lokasi.uuid
        }));
    } else {
      poliOptions.value = [];
    }
  } catch (error) {
    console.error("Gagal mengambil data untuk dropdown:", error);
    doctorOptions.value = [];
    poliOptions.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

onMounted(() => {
  loadDropdownData();
});

const submitForm = handleSubmit((currentValues) => {
  const selectedPoli = poliOptions.value.find(p => p.uuid === currentValues.poli);
  const finalPoliName = selectedPoli ? selectedPoli.name : currentValues.poli; 

  const selectedDoctor = doctorOptions.value.find(d => d.uuid === currentValues.dokter);
  const finalDokterName = selectedDoctor ? selectedDoctor.pegawai?.name : currentValues.dokter; 

  const dataToEmit = {
    ...currentValues,
    poliName: finalPoliName,
    dokterName: finalDokterName,
  };

  setFieldValue("poli", finalPoliName);
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
const selectedTab = ref("non-bpjs");

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
  <CustomAccordion
    headerClass="bg-opensimrs-50"
    initial-state="0"
    ref="accordion"
  >
    <template #header>
      <div class="flex items-center justify-between w-full pr-2.5">
        Surat Kontrol Rawat Jalan
        <PhX :size="20" @click="emit('onDelete')" />
      </div>
    </template>
    <template #content>
      <div class="grid grid-cols-12 gap-5 pt-5">
        <div class="col-span-12 flex gap-2.5">
          <CustomButton
            label="NON-BPJS"
            class="grow"
            :text-color="
              selectedTab === 'non-bpjs' ? 'text-white' : 'text-opensimrs-300'
            "
            :border-color="
              selectedTab === 'non-bpjs' ? 'border-none' : 'border-opensimrs-300'
            "
            :class="selectedTab === 'non-bpjs' ? 'bg-opensimrs-300' : 'bg-white'"
            @click="selectedTab = 'non-bpjs'"
            :outlined="selectedTab !== 'non-bpjs'"
          />
          <CustomButton
            label="BPJS"
            class="grow"
            :text-color="
              selectedTab === 'bpjs' ? 'text-white' : 'text-opensimrs-300'
            "
            :border-color="
              selectedTab === 'bpjs' ? 'border-none' : 'border-opensimrs-300'
            "
            :class="selectedTab === 'bpjs' ? 'bg-opensimrs-300' : 'bg-white'"
            @click="selectedTab = 'bpjs'"
            :outlined="selectedTab !== 'bpjs'"
            :disabled="true"
          />
        </div>
        <hr class="col-span-12 border-grey-200" />
        <CustomTextfield
          label="No. Surat"
          v-model="noSurat"
          class="col-span-6"
          :disabled="true"
        />
        <CustomDatePicker
          v-model="tanggalPeriksa"
          label="Tanggal Kontrol"
          class="col-span-6"
          :invalid="!!errors.tanggalPeriksa"
          :invalidMessage="errors.tanggalPeriksa"
          :minDate="minDate"
        />
        <CustomSelect
          v-model="poli"
          label="Poli"
          :options="poliOptions"
          option-label="name"
          option-value="uuid"
          place-holder="Pilih Poli"
          class="col-span-7"
          :invalid="!!errors.poli"
          :invalidMessage="errors.poli"
        />
        <CustomSelect
          v-model="dokter"
          label="Dokter"
          :options="doctorOptions"
          option-label="pegawai.name"
          option-value="uuid"
          place-holder="Pilih Dokter"
          class="col-span-5"
          :invalid="!!errors.dokter"
          :invalidMessage="errors.dokter"
        />
        <CustomTextArea
          v-model="keterangan"
          label="Keterangan / Catatan"
          placeholder="Keterangan / Catatan ..."
          class="col-span-12"
          :invalid="!!errors.keterangan"
          :invalidMessage="errors.keterangan"
        />
      </div>
    </template>
  </CustomAccordion>
</template>
