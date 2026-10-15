<script lang="ts" setup>
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { computed, onBeforeMount, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import HistoriTandaVital from "@/components/RekamMedis/TandaVital/HistoriTandaVital.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import {
  dateToEpoch,
  epochToDate,
  formatDate,
  formatTime,
  setTimeForDate,
} from "@/utils/Helpers";

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();

const props = defineProps({
  method: {
    type: String,
    default: "form",
  },
  rmUuid: {
    type: String,
    default: "",
  },
  sessionUuid: {
    type: String,
    default: "",
  },
  patientData: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(["edit", "editAsesmen"]);
const currentMethod = ref(props.method);

const criterias = ref([
  { name: "Checkup" },
  { name: "Pra Operasi" },
  { name: "Pasca Anestesi" },
]);

const respirasis = ref([
  { name: "Tidak ada retraksi / RR normal" },
  {
    name: "Takipnea, RR > 10, di atas nilai normal usianya atau menggunakan otot bantu pernapasan",
  },
  { name: "Takipnea, RR > 20  diatas nilai normal usianya ATAU ada Retraksi" },
  {
    name: "RR < 5 dibawah normal usianya ATAU ada retraksi berat  ATAU merintih",
  },
]);

const kardiovaskulers = ref([
  { name: "Tidak sianosis atau cRT 1 - 2 detik" },
  { name: "Tampak pucat atau cRT 3 detik" },
  {
    name: "Tampak sianotik / CRT > 4 detik atau takikardi, HR >= 20 di atas nilai normal sesuai usia",
  },
  {
    name: "Sianotik & motlet atau CRT > 5 detik atau tachicardi, HR > 30, di atas Nilai normal usianya",
  },
]);
const keadaanUmums = ref([
  { name: "Interaksi Biasa" },
  { name: "Somnolen dan dapat diterangkan" },
  { name: "Irritable" },
  { name: "Letargi, gelisah penurunan terhadap nyeri" },
]);

// Skor PEWS (respirasi, kardiovaskuler, keadaan umum) hanya relevan untuk pasien anak (< 18 tahun)
const umurTahun = computed<number | null>(() => {
  const p: any = props.patientData ?? {};
  const umur = p.birthDetail?.ageYear ?? p.patient?.birthDetail?.ageYear ?? p.ageYear;
  if (umur !== undefined && umur !== null && umur !== "") return Number(umur);
  const lahir = p.birthDetail?.birthDate ?? p.patient?.birthDetail?.birthDate;
  if (!lahir) return null;
  return Math.floor((Date.now() - new Date(lahir).getTime()) / (365.25 * 86400000));
});
const pasienAnak = computed(() => umurTahun.value === null || umurTahun.value < 18);

const schemaTandaVital = computed(() =>
  toTypedSchema(
    yup.object({
      respirasiAnak: pasienAnak.value ? yup.string().required("Respirasi Anak harus diisi") : yup.string().nullable(),
      kardiovaskulerAnak: pasienAnak.value ? yup.string().required("Kardiovaskuler Anak harus diisi") : yup.string().nullable(),
      keadaanUmum: pasienAnak.value ? yup.string().required("Keadaan Umum harus diisi") : yup.string().nullable(),
      kriteriaPemantauan: yup.string().required("Kriteria Pemantauan harus diisi"),
      waktuAsesmen: yup.date().required("Waktu Asesmen harus diisi"),
      jamAsesmen: yup.date().required("Jam Asesmen harus diisi"),
      frekuensiNafas: yup.number().typeError("Frekuensi Nafas harus diisi").required("Frekuensi Nafas harus diisi"),
      frekuensiNadi: yup.number().typeError("Frekuensi Nadi harus diisi").required("Frekuensi Nadi harus diisi"),
      suhu: yup.number().typeError("Suhu harus diisi").required("Suhu harus diisi"),
      bloodOxygen: yup.number().typeError("Blood Oxygen harus diisi").required("Blood Oxygen harus diisi"),
      // gula darah tidak selalu diperiksa
      gulaDarah: yup.number().nullable().transform((v, asli) => (asli === "" || asli === null || Number.isNaN(v) ? null : v)),
      tekananDarahSistole: yup.number().typeError("Sistole harus diisi").required("Sistole harus diisi"),
      tekananDarahDiastole: yup.number().typeError("Diastole harus diisi").required("Diastole harus diisi"),
      crt: yup.boolean().default(false),
      oksigenTambahan: yup.boolean().default(false),
      petugas: yup.string().default("Super Admin"),
      updatedAt: yup.number().optional(),
    })
  )
);

const {
  resetForm,
  handleSubmit: handleSubmitTandaVital,
  defineField: defineFieldTandaVital,
  setValues,
  errors,
} = useForm({
  validationSchema: schemaTandaVital,
});

const [kriteriaPemantauan] = defineFieldTandaVital("kriteriaPemantauan");
const [respirasiAnak] = defineFieldTandaVital("respirasiAnak");
const [kardiovaskulerAnak] = defineFieldTandaVital("kardiovaskulerAnak");
const [keadaanUmum] = defineFieldTandaVital("keadaanUmum");

const [waktuAsesmen] = defineFieldTandaVital("waktuAsesmen");
const [jamAsesmen] = defineFieldTandaVital("jamAsesmen");
const [frekuensiNafas] = defineFieldTandaVital("frekuensiNafas");
const [frekuensiNadi] = defineFieldTandaVital("frekuensiNadi");
const [suhu] = defineFieldTandaVital("suhu");
const [bloodOxygen] = defineFieldTandaVital("bloodOxygen");
const [gulaDarah] = defineFieldTandaVital("gulaDarah");
const [crt] = defineFieldTandaVital("crt");
const [oksigenTambahan] = defineFieldTandaVital("oksigenTambahan");
const [tekananDarahSistole] = defineFieldTandaVital("tekananDarahSistole");
const [tekananDarahDiastole] = defineFieldTandaVital("tekananDarahDiastole");
const [petugas] = defineFieldTandaVital("petugas");
const [updatedAt] = defineFieldTandaVital("updatedAt");

const onSubmitTandaVital = handleSubmitTandaVital(async (values: any) => {
  values.waktuAsesmen = dateToEpoch(
    setTimeForDate(
      values.waktuAsesmen,
      values.jamAsesmen.getHours(),
      values.jamAsesmen.getMinutes(),
      values.jamAsesmen.getSeconds()
    )
  );
  delete values.jamAsesmen;
  delete values.updatedAt;
  try {
    storeUtils.setLoading(true);
    const response = await rekamMedisStore.insertAssesment({
      sessionUuid: props.sessionUuid,
      rekamMedisUuid: props.rmUuid,
      isLatest: rekamMedisStore.openedRekamMedis.isLatest,
      key: "tanda_vital",
      data: values,
    });
    if (response && response.payload) {
      rekamMedisStore.setAsesmentSummaryRekamMedisData(response.payload);
    }
  } catch (error) {
    console.error("Failed to post data", error);
  } finally {
    storeUtils.setLoading(false);
  }
});

const setFormData = () => {
  if (rekamMedisStore.openedRekamMedis.data.tandaVital) {
    const tempTandaVital = rekamMedisStore.openedRekamMedis.data.tandaVital;
    setValues({
      kriteriaPemantauan: tempTandaVital.kriteriaPemantauan,
      respirasiAnak: tempTandaVital.respirasiAnak,
      kardiovaskulerAnak: tempTandaVital.kardiovaskulerAnak,
      keadaanUmum: tempTandaVital.keadaanUmum,
      waktuAsesmen: epochToDate(tempTandaVital.waktuAsesmen as number) as Date,
      jamAsesmen: epochToDate(tempTandaVital.waktuAsesmen as number) as Date,
      frekuensiNafas: tempTandaVital.frekuensiNafas,
      frekuensiNadi: tempTandaVital.frekuensiNadi,
      suhu: tempTandaVital.suhu,
      bloodOxygen: tempTandaVital.bloodOxygen,
      gulaDarah: tempTandaVital.gulaDarah,
      crt: tempTandaVital.crt,
      oksigenTambahan: tempTandaVital.oksigenTambahan,
      tekananDarahSistole: tempTandaVital.tekananDarahSistole,
      tekananDarahDiastole: tempTandaVital.tekananDarahDiastole,
      petugas: tempTandaVital.petugas,
      updatedAt: tempTandaVital.updatedAt,
    });
  } else
    // asesmen baru: waktu = sekarang, kriteria bawaan Checkup
    resetForm({ values: { kriteriaPemantauan: "Checkup", waktuAsesmen: new Date(), jamAsesmen: new Date(), crt: false, oksigenTambahan: false } });
};

onBeforeMount(async () => {
  setFormData();
});

const storedRMData = computed(() => rekamMedisStore.openedRekamMedis);
watch(storedRMData, (newRM) => {
  setFormData();
});

const compareDialog = ref(false);
const historyData = ref<Array<any> | null>(null);
const historyPageIndex = ref(0);
const filterOptions = ref([
  { name: "Semua", value: "semua" },
  { name: "RJ", value: "rj" },
  { name: "RI", value: "ri" },
  { name: "IGD", value: "igd" },
]);
const selectedFilter = ref("semua");

const showDialogCompare = async () => {
  try {
    storeUtils.setLoading(true);
    const openedRekamMedis = rekamMedisStore.openedRekamMedis;

    const selectedDate = openedRekamMedis.dates?.find((d: { isSelected: any; }) => d.isSelected)?.date;
    const selectedSessionOrder = openedRekamMedis.sessions?.find((s: { isSelected: any; }) => s.isSelected)?.order;
    const response = await rekamMedisStore.getCompare({
      noPelayanan: props.patientData?.noPelayanan || props.patientData?.no_pelayanan,
      noRm: props.patientData?.patient?.noRm,
      key: "tanda_vital",
      dateFilter: selectedDate,
      sessionOrder: selectedSessionOrder,
      jenisKunjungan: selectedFilter.value === 'semua' ? '' : selectedFilter.value
    });

    if (response && response.payload) {
      historyData.value = response.payload;
      historyPageIndex.value = 0;
    } else {
      historyData.value = null;
    }
    compareDialog.value = true;
  } catch (error) {
    console.error("Gagal mengambil data compare:", error);
    historyData.value = null;
  } finally {
    storeUtils.setLoading(false);
  }
};

const leftHistoryItem = computed(() => {
  if (!historyData.value || !historyData.value[historyPageIndex.value]) return null;
  return historyData.value[historyPageIndex.value];
});

const rightHistoryItem = computed(() => {
  if (!historyData.value || !historyData.value[historyPageIndex.value + 1]) return null;
  return historyData.value[historyPageIndex.value + 1];
});

const canGoToPrevious = computed(() => historyPageIndex.value > 0);

const canGoToNext = computed(() => {
  if (!historyData.value) return false;
  return historyPageIndex.value + 2 < historyData.value.length;
});

const previousHistory = () => {
  if (canGoToPrevious.value) {
    historyPageIndex.value -= 2;
  }
};

const nextHistory = () => {
  if (canGoToNext.value) {
    historyPageIndex.value += 2;
  }
};

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

watch(selectedFilter, () => {
  if (compareDialog.value) {
    showDialogCompare();
  }
});

defineExpose({
  open,
  close,
});
</script>

<template>
  <CustomAccordion headerClass="bg-opensimrs-50" ref="accordion">
    <template #header> Tanda Vital</template>
    <template #content>
      <div v-if="currentMethod == 'form'">
        <div class="flex flex-col">
          <CustomButton
            @click="showDialogCompare"
            class="!rounded-md my-[10px] ml-auto"
            label="Mode Compare"
            size="small"
            icon="LayoutIcon"
          />
          <hr class="mb-[30px]" />
        </div>
        <div class="grid grid-cols-4 gap-[30px] py-3">
          <CustomSelect
            label="Kriteria Pemantauan"
            v-model="kriteriaPemantauan"
            :options="criterias"
            option-label="name"
            option-value="name"
            :invalid="!!errors.kriteriaPemantauan" 
            :invalidMessage="errors.kriteriaPemantauan"
            :disabled="false"
            customSelectClass="border-[#C7CBD2]"
          />
          <div class="flex gap-[30px]">
            <CustomDatePicker v-model="waktuAsesmen" label="Waktu Asesmen" :invalid="!!errors.waktuAsesmen" />
            <CustomDatePicker
              v-model="jamAsesmen"
              label="Jam Asesmen"
              timeOnly
              :invalid="!!errors.jamAsesmen"
              :invalidMessage="errors.jamAsesmen"
            />
          </div>
          <CustomInputNumber
            label="Frekuensi Nafas"
            placeholder="46"
            v-model:modelValue="frekuensiNafas"
            type="number"
            :invalid="!!errors.frekuensiNafas"
            :invalidMessage="errors.frekuensiNafas"
          >
            <template #appendText>
              <div class="flex items-center mr-2">x/mnt</div>
            </template>
          </CustomInputNumber>
          <CustomInputNumber
            label="Frekuensi Nadi"
            placeholder="158"
            v-model:modelValue="frekuensiNadi"
            type="number"
            :invalid="!!errors.frekuensiNadi"
            :invalidMessage="errors.frekuensiNadi"
          >
            <template #appendText>
              <div class="flex items-center mr-2">x/mnt</div>
            </template>
          </CustomInputNumber>
          <CustomInputNumber
            label="Suhu"
            placeholder="37"
            v-model:modelValue="suhu"
            :maxFractionDigits="1"
            type="number"
            :invalid="!!errors.suhu"
            :invalidMessage="errors.suhu"
          >
            <template #appendText>
              <div class="flex items-center mr-2">°C</div>
            </template>
          </CustomInputNumber>
          <CustomSwitch
            v-model="crt"
            label=" Capillary Refill Time (CRT > 2 Detik)"
          />
          <CustomInputNumber
            label="Blood Oxygen"
            placeholder="98"
            v-model:modelValue="bloodOxygen"
            type="number"
            :invalid="!!errors.bloodOxygen"
            :invalidMessage="errors.bloodOxygen"
          >
            <template #appendText>
              <div class="flex items-center mr-2">%</div>
            </template>
          </CustomInputNumber>
          <CustomInputNumber
            label="Gula Darah"
            placeholder="98"
            v-model:modelValue="gulaDarah"
            type="number"
            :invalid="!!errors.gulaDarah"
            :invalidMessage="errors.gulaDarah"
          >
            <template #appendText>
              <div class="flex items-center mr-2">mg/dL</div>
            </template>
          </CustomInputNumber>
          <CustomSwitch v-model="oksigenTambahan" label="Oxygen Tambahan" />
          <div class="grid grid-cols-[1fr_min-content_1fr]">
            <CustomInputNumber
              label="Tekanan Darah"
              placeholder="98"
              v-model:modelValue="tekananDarahSistole"
              type="number"
              :invalid="!!errors.tekananDarahSistole"
              :invalidMessage="errors.tekananDarahSistole"
            />
            <span class="text-opensimrs-300 mx-[30px] mt-auto mb-2">/</span>
            <CustomInputNumber
              :showLabel="false"
              placeholder="98"
              v-model:modelValue="tekananDarahDiastole"
              type="number"
              class="mt-auto"
              :invalid="!!errors.tekananDarahDiastole"
              :invalidMessage="errors.tekananDarahDiastole"
            >
              <template #appendText>
                <div class="flex items-center mr-2">mmHg</div>
              </template>
            </CustomInputNumber>
          </div>
          <CustomSelect
            v-if="pasienAnak"
            label="Respirasi Anak"
            v-model="respirasiAnak"
            :invalid="!!errors.respirasiAnak"
            :options="respirasis"
            option-label="name"
            option-value="name"
            :invalidMessage="errors.respirasiAnak"
            :disabled="false"
            placeHolder="Tidak ada retraksi / RR Normal"
            customSelectClass="border-[#C7CBD2]"
            class="col-span-2"
          />
          <CustomSelect
            v-if="pasienAnak"
            label="Kardiovaskuler Anak"
            v-model="kardiovaskulerAnak"
            :invalid="!!errors.kardiovaskulerAnak"
            :options="kardiovaskulers"
            option-label="name"
            option-value="name"
            :invalidMessage="errors.kardiovaskulerAnak"
            :disabled="false"
            placeHolder="Mungkin Sianosis"
            customSelectClass="border-[#C7CBD2]"
            class="col-span-2"
          />
          <CustomSelect
            label="Keadaan Umum"
            v-model="keadaanUmum"
            :invalid="!!errors.keadaanUmum"
            :options="keadaanUmums"
            option-label="name"
            option-value="name"
            :invalidMessage="errors.keadaanUmum"
            :disabled="false"
            placeHolder="Interaksi Mungkin Biasa"
            customSelectClass="border-[#C7CBD2]"
            class="col-span-2"
          />
        </div>
      </div>

      <div
        v-if="currentMethod == 'detail' || currentMethod == 'detailPerpindahan'"
        class="py-5"
        :class="[
          currentMethod == 'detail'
            ? 'flex flex-col gap-[19px]'
            : 'grid grid-cols-4 gap-y-[30px]',
        ]"
      >
        <CustomInfoRow
          label="Kriteria Pemantauan"
          :value="kriteriaPemantauan"
          :type="
            currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
          "
        />
        <CustomInfoRow
          label="Tgl. Asesmen"
          :value="`${formatDate(waktuAsesmen as Date)}`"
          :type="
            currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
          "
        />
        <CustomInfoRow
          label="Waktu Asesmen"
          :value="`${formatTime(waktuAsesmen as Date)}`"
          :type="
            currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
          "
        />
        <CustomInfoRow
          label="Frekuensi Napas"
          :value="`${frekuensiNafas} x/menit`"
          :type="
            currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
          "
        />
        <CustomInfoRow
          label="Frekuensi Nadi"
          :value="`${frekuensiNadi} x/menit`"
          :type="
            currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
          "
        />
        <CustomInfoRow
          label="Suhu"
          :value="`${suhu} °C`"
          :type="
            currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
          "
        />
        <CustomInfoRow
          label="Capillary Refill Time (CRT > 2 Detik)"
          :value="`${crt}`"
          :type="
            currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
          "
        />
        <CustomInfoRow
          label="Blood Oxygen"
          :value="`${bloodOxygen} %`"
          :type="
            currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
          "
        />
        <CustomInfoRow
          label="Gula Darah"
          :value="`${gulaDarah} mg/dL`"
          :type="
            currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
          "
        />
        <div
          class="py-5"
          :class="[
            currentMethod == 'detail'
              ? 'flex flex-col gap-[19px]'
              : 'grid grid-cols-6 col-span-4',
          ]"
        >
          <CustomInfoRow
            label="Oksigen Tambahan"
            :value="`${oksigenTambahan}`"
            :type="
              currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
            "
            :class="{ 'col-span-2': currentMethod == 'detailPerpindahan' }"
          />
          <CustomInfoRow
            label="Tekanan Darah"
            :value="`${tekananDarahSistole} mmHg`"
            :type="
              currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
            "
            :class="{ 'col-span-2': currentMethod == 'detailPerpindahan' }"
          />
          <CustomInfoRow
            label="Respirasi Anak"
            :value="`${respirasiAnak}`"
            :type="
              currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
            "
            :class="{ 'col-span-2': currentMethod == 'detailPerpindahan' }"
          />
        </div>
        <CustomInfoRow
          label="Kardiovaskuler Anak"
          :value="`${kardiovaskulerAnak}`"
          :type="
            currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
          "
          :class="{ 'col-span-2': currentMethod == 'detailPerpindahan' }"
        />
        <CustomInfoRow
          label="Keadaan Umum"
          :value="`${keadaanUmum}`"
          :type="
            currentMethod == 'detailPerpindahan' ? 'vertical' : 'horizontal'
          "
          :class="{ 'col-span-2': currentMethod == 'detailPerpindahan' }"
        />
        <hr v-if="currentMethod == 'detail'" class="border-grey-200" />
        <CustomInfoRow
          v-if="currentMethod == 'detail'"
          label="Petugas Input"
          :value="petugas"
        />
        <CustomInfoRow
          v-if="currentMethod == 'detail'"
          label="Jam Input"
          :value="updatedAt ? formatTime(epochToDate(updatedAt as number) as Date) : '-'"
        />
      </div>

      <CustomDialog
        class=""
        v-model:visible="compareDialog"
        width="80%"
        noScroll
      >
        <template #header>Tanda Vital</template>
        <template #body>
          <div class="pt-5 grid grid-cols-[1fr_min-content_1fr] h-full overflow-auto">
            <div class="flex flex-col overflow-auto pr-4">
              <div class="mb-[18px] flex justify-between items-center">
                <div class="font-semibold text-grey-400">
                  Riwayat Sebelumnya
                </div>
                <div class="flex items-center">
                   <CustomSelect
                    v-model="selectedFilter"
                    :options="filterOptions"
                    optionLabel="name"
                    optionValue="value"
                    :show-label="false"
                    class="w-40 mr-4"
                  />
                  <CustomButton
                    @click="previousHistory"
                    :disabled="!canGoToPrevious"
                    class="!rounded-md mr-[10px]"
                    size="small"
                    icon="PhCaretLeft"
                  />
                  <CustomButton
                    @click="nextHistory"
                    :disabled="!canGoToNext"
                    class="!rounded-md"
                    size="small"
                    icon="PhCaretRight"
                  />
                </div>
              </div>
              <div
                class="grid grid-cols-[1fr_min-content_1fr] grow overflow-auto gap-x-4"
              >
                <HistoriTandaVital v-if="leftHistoryItem" :history="leftHistoryItem" />
                <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">Tidak ada riwayat.</div>

                <div v-if="rightHistoryItem" class="border border-opensimrs-300"></div>
                
                <HistoriTandaVital v-if="rightHistoryItem" :history="rightHistoryItem" />
                <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">Tidak ada riwayat.</div>
              </div>
            </div>
            <div class="border border-opensimrs-300 mx-[15px]"></div>
            <div class="flex flex-col overflow-hidden">
              <div class="flex flex-col pb-1 overflow-auto gap-y-5 grow">
                <CustomSelect
                  label="Kriteria Pemantauan"
                  v-model="kriteriaPemantauan"
                  :options="criterias"
                  option-label="name"
                  option-value="name"
                  invalidMessage="Wajib diisi"
                  :disabled="false"
                  placeHolder="PEWS"
                  customSelectClass="border-[#C7CBD2]"
                />
                <div class="grid grid-cols-2 gap-[30px]">
                  <CustomDatePicker
                    v-model="waktuAsesmen"
                    label="Waktu Asesmen"
                  />
                  <CustomDatePicker
                    v-model="jamAsesmen"
                    label="Jam Asesmen"
                    timeOnly
                  />
                </div>
                <div class="grid grid-cols-2 gap-[30px]">
                  <CustomInputNumber
                    label="Frekuensi Nafas"
                    placeholder="46"
                    v-model:modelValue="frekuensiNafas"
                    type="number"
                  >
                    <template #appendText>
                      <div class="flex items-center mr-2">x/mnt</div>
                    </template>
                  </CustomInputNumber>
                  <CustomInputNumber
                    label="Frekuensi Nadi"
                    placeholder="158"
                    v-model:modelValue="frekuensiNadi"
                    type="number"
                  >
                    <template #appendText>
                      <div class="flex items-center mr-2">x/mnt</div>
                    </template>
                  </CustomInputNumber>
                </div>
                <div class="grid grid-cols-2 gap-[30px]">
                  <CustomInputNumber
                    label="Suhu"
                    placeholder="37"
                    v-model:modelValue="suhu"
            :maxFractionDigits="1"
                    type="number"
                  >
                    <template #appendText>
                      <div class="flex items-center mr-2">°C</div>
                    </template>
                  </CustomInputNumber>
                  <CustomSwitch
                    v-model="crt"
                    label=" Capillary Refill Time (CRT > 2 Detik)"
                  />
                </div>
                <div class="grid grid-cols-2 gap-[30px]">
                  <CustomInputNumber
                    label="Blood Oxygen"
                    placeholder="98"
                    v-model:modelValue="bloodOxygen"
                    type="number"
                  >
                    <template #appendText>
                      <div class="flex items-center mr-2">%</div>
                    </template>
                  </CustomInputNumber>
                  <CustomInputNumber
                    label="Gula Darah"
                    placeholder="98"
                    v-model:modelValue="gulaDarah"
                    type="number"
                  >
                    <template #appendText>
                      <div class="flex items-center mr-2">mg/dL</div>
                    </template>
                  </CustomInputNumber>
                </div>
                <div class="grid grid-cols-2 gap-[30px]">
                  <CustomSwitch
                    v-model="oksigenTambahan"
                    label="Oxygen Tambahan"
                  />
                  <div class="grid grid-cols-[1fr_min-content_1fr]">
                    <CustomInputNumber
                      label="Tekanan Darah"
                      placeholder="98"
                      v-model:modelValue="tekananDarahSistole"
                      type="number"
                    />
                    <span class="text-opensimrs-300 mx-[30px] mt-auto mb-2"
                      >/</span
                    >
                    <CustomInputNumber
                      :showLabel="false"
                      placeholder="98"
                      v-model:modelValue="tekananDarahDiastole"
                      type="number"
                      class="mt-auto"
                    >
                      <template #appendText>
                        <div class="flex items-center mr-2">mmHg</div>
                      </template>
                    </CustomInputNumber>
                  </div>
                </div>
                <CustomSelect
                  label="Respirasi Anak"
                  v-model="respirasiAnak"
                  :options="respirasis"
                  option-label="name"
                  option-value="name"
                  invalidMessage="Wajib diisi"
                  :disabled="false"
                  placeHolder="Tidak ada retraksi / RR Normal"
                  customSelectClass="border-[#C7CBD2]"
                  class="col-span-2"
                />
                <CustomSelect
                  label="Kardiovaskuler Anak"
                  v-model="kardiovaskulerAnak"
                  :options="kardiovaskulers"
                  option-label="name"
                  option-value="name"
                  invalidMessage="Wajib diisi"
                  :disabled="false"
                  placeHolder="Mungkin Sianosis"
                  customSelectClass="border-[#C7CBD2]"
                  class="col-span-2"
                />
                <CustomSelect
                  label="Keadaan Umum"
                  v-model="keadaanUmum"
                  :options="keadaanUmums"
                  option-label="name"
                  option-value="name"
                  invalidMessage="Wajib diisi"
                  :disabled="false"
                  placeHolder="Interaksi Mungkin Biasa"
                  customSelectClass="border-[#C7CBD2]"
                  class="col-span-2"
                />
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex items-end justify-end gap-3">
            <CustomButton
              v-if="currentMethod == 'form'"
              @click="resetForm"
              label="Reset"
              textColor="text-grey-300"
              backgroundColor="bg-transparent"
              borderColor="border-2 border-grey-200"
            />
            <CustomButton
              v-if="currentMethod == 'form'"
              label="Simpan"
              @click="onSubmitTandaVital"
            />
            <CustomButton
              v-if="currentMethod == 'detail'"
              @click="emit('editAsesmen')"
              label="Edit"
            />
          </div>
        </template>
      </CustomDialog>
    </template>
    <template #footer>
      <div class="flex items-end justify-end gap-3">
        <CustomButton
          v-if="currentMethod == 'form'"
          @click="resetForm"
          label="Reset"
          textColor="text-[#9DA4B1]"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-[#9DA4B1]"
        />
        <CustomButton
          v-if="currentMethod == 'form'"
          label="Simpan"
          @click="onSubmitTandaVital"
        />
        <CustomButton
          v-if="currentMethod == 'detail'"
          @click="emit('editAsesmen')"
          label="Edit"
        />
      </div>
    </template>
  </CustomAccordion>
</template>