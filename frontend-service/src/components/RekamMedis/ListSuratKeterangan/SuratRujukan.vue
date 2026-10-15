<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { utilsStore } from "@/stores/utils";
import { useLokasiStore } from "@/stores/datamaster/lokasi";

const emit = defineEmits(["onDelete", "update:dataSurat"]);

const props = defineProps({
  nomorSurat: {
    type: String,
    default: "",
  },
});

const schema = toTypedSchema(
  yup.object({
    noSurat: yup.string().default("No. 123456").notRequired(),
    tglRujukan: yup.date().required("Tgl. Rujukan harus dipilih"),
    tanggalRencana: yup.date().required("Tanggal Rencana harus dipilih"),
    jenisPelayanan: yup.string().required("Jenis Pelayanan harus dipilih"),
    poli: yup.string().required("Poli/Lokasi Rujukan harus dipilih"),
    dirujuk: yup.string().required("Dirujuk Ke harus diisi"),
    diagnosaRujukan: yup.string().required("Diagnosa Rujukan harus diisi"),
    catatan: yup.string().optional(),
  }).noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setFieldValue } = useForm({
  validationSchema: schema,
});

const [noSurat] = defineField("noSurat");
const [tglRujukan] = defineField("tglRujukan");
const [tanggalRencana] = defineField("tanggalRencana");
const [jenisPelayanan] = defineField("jenisPelayanan");
const [poli] = defineField("poli");
const [dirujuk] = defineField("dirujuk");
const [diagnosaRujukan] = defineField("diagnosaRujukan");
const [catatan] = defineField("catatan");

const itemsPelayanan = ref(["Rawat Jalan", "Rawat Inap"]);
const poliOptions = ref<any[]>([]);

const UseUtilsStore = utilsStore();
const lokasiStore = useLokasiStore();

const minDate = ref(new Date());

const fetchPoliOptions = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const responseLokasi = await lokasiStore.getApi(1, 9999);
    if (responseLokasi && responseLokasi.payload) {
      poliOptions.value = responseLokasi.payload
        .filter((lokasi: any) => {
          return (
            lokasi.locationType?.toLowerCase() === "ward"
          );
        })
        .map((lokasi: any) => ({
          name: lokasi.name,
          uuid: lokasi.uuid,
        }));
    }
  } catch (error) {
    console.error("Gagal mengambil data poli:", error);
    poliOptions.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

onMounted(() => {
  fetchPoliOptions();
  if (!tglRujukan.value) {
    setFieldValue('tglRujukan', new Date());
  }
});


const submitForm = handleSubmit((currentValues) => {
  const selectedPoli = poliOptions.value.find(p => p.uuid === currentValues.poli);
  const finalPoliName = selectedPoli ? selectedPoli.name : currentValues.poli; 

  const dataToEmit = {
    ...currentValues,
    poliName: finalPoliName,
  };

  setFieldValue("poli", finalPoliName);

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
  <CustomAccordion headerClass="bg-opensimrs-50" initial-state="0" ref="accordion">
    <template #header>
      <div class="flex items-center justify-between w-full pr-2.5">
        Surat Rujukan Keluar Klinik
        <PhX :size="20" @click="emit('onDelete')" />
      </div>
    </template>
    
    <template #content>
      <div class="grid grid-cols-12 pt-5 gap-x-[30px] gap-y-5">
        
        <div class="col-span-12 flex gap-2.5">
          <CustomButton
            label="NON-BPJS"
            class="grow"
            :text-color="selectedTab === 'non-bpjs' ? 'text-white' : 'text-opensimrs-300'"
            :border-color="selectedTab === 'non-bpjs' ? 'border-none' : 'border-opensimrs-300'"
            :class="selectedTab === 'non-bpjs' ? 'bg-opensimrs-300' : 'bg-white'"
            @click="selectedTab = 'non-bpjs'"
            :outlined="selectedTab !== 'non-bpjs'"
          />
          <CustomButton
            label="BPJS"
            class="grow"
            :text-color="selectedTab === 'bpjs' ? 'text-white' : 'text-opensimrs-300'"
            :border-color="selectedTab === 'bpjs' ? 'border-none' : 'border-opensimrs-300'"
            :class="selectedTab === 'bpjs' ? 'bg-opensimrs-300' : 'bg-white'"
            @click="selectedTab = 'bpjs'"
            :outlined="selectedTab !== 'bpjs'"
            :disabled="true"
          />
        </div>

        <hr class="col-span-12 border-grey-200">

        <div class="col-span-6">
           <CustomTextfield
            label="No. Surat"
            v-model="noSurat"
            class="w-full"
            :disabled="true"
            placeholder="No. 123456"
           />
        </div>
        <div class="col-span-6">
           <CustomDatePicker
            label="Tgl. Rujukan"
            v-model="tglRujukan"
            class="w-full"
            :invalid="!!errors.tglRujukan"
            :invalidMessage="errors.tglRujukan"
            :minDate="minDate"
           />
        </div>

        <div class="col-span-6">
           <CustomDatePicker
            label="Tgl. Rencana Rujukan"
            v-model="tanggalRencana"
            class="w-full"
            :invalid="!!errors.tanggalRencana"
            :invalidMessage="errors.tanggalRencana"
            :minDate="minDate"
           />
        </div>
        <div class="col-span-6">
            <CustomSelect
              label="Jenis Pelayanan"
              v-model="jenisPelayanan"
              place-holder="Pilih Jenis Pelayanan"
              :options="itemsPelayanan"
              option-label=""
              option-value=""
              class="w-full"
              :invalid="!!errors.jenisPelayanan"
              :invalidMessage="errors.jenisPelayanan"
            />
        </div>
        <div class="col-span-6">
           <CustomSelect
            label="Poli/Lokasi Rujukan"
            v-model="poli"
            :options="poliOptions"
            option-label="name"
            option-value="uuid"
            place-holder="Pilih Poli/Lokasi Rujukan"
            class="w-full"
            :invalid="!!errors.poli"
            :invalidMessage="errors.poli"
          />
        </div>
        <div class="col-span-6">
           <CustomTextfield
            v-model="dirujuk"
            label="Dirujuk Ke"
            placeholder="Dirujuk Ke"
            class="w-full"
            :invalid="!!errors.dirujuk"
            :invalidMessage="errors.dirujuk"
          />
        </div>
        <div class="col-span-12">
           <CustomTextfield
            v-model="diagnosaRujukan"
            label="Diagnosa Rujukan"
            placeholder="Diagnosa Rujukan"
            class="w-full"
            :invalid="!!errors.diagnosaRujukan"
            :invalidMessage="errors.diagnosaRujukan"
          />
        </div>
        <div class="col-span-12">
          <CustomTextArea
            v-model="catatan"
            label="Catatan Rujukan"
            placeholder="Catatan Rujukan ..."
            class="w-full"
            :invalid="!!errors.catatan"
            :invalidMessage="errors.catatan"
          />
        </div>
      </div>
    </template>
  </CustomAccordion>
</template>