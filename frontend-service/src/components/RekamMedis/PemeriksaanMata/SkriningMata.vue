<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomRadio from "@/components/Base/CustomRadio.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { computed, onMounted, ref, watch, type PropType } from "vue";
import HistoriSkriningMata from "@/components/RekamMedis/PemeriksaanMata/HistoriSkriningMata.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { useSnomedCTStore } from "@/stores/datamaster/snomedCT";

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();
const snomedCTStore = useSnomedCTStore();

const props = defineProps({
  method: {
    type: String,
    default: "form",
  },
  type: {
    type: String,
    required: true,
  },
  openedData: {
    type: Object as PropType<any>,
    default: null,
  },
  patientData: {
    type: Object as PropType<any>,
    required: true,
  },
});

const listHasilPinhole = ref([
  { code: "39021009", tampilan: "Kelainan refraksi", range: "6/12 - 6/6" },
  { code: "OI000044", tampilan: "Kelainan organik", range: "3/60 - <6/12" },
]);
const hasilPihnhole = (mata: string) => {
  let tempHasil = 0;
  if (mata == "OD") {
    tempHasil = odPinholeDenominator.value / odPinholeNumerator.value;
  } else if (mata == "OS") {
    tempHasil = osPinholeDenominator.value / osPinholeNumerator.value;
  }

  let tempHasilStr = "";
  if (tempHasil >= 6 / 12 && tempHasil <= 1) {
    tempHasilStr = listHasilPinhole.value[0].tampilan;
  } else if (tempHasil >= 3 / 60 && tempHasil < 6 / 12) {
    tempHasilStr = listHasilPinhole.value[1].tampilan;
  }

  if (mata == "OD") {
    odHasilPinhole.value = tempHasilStr;
  } else if (mata == "OS") {
    osHasilPinhole.value = tempHasilStr;
  }
};

const listFundus = ref([
  { code: "1090009", tampilan: "Tingkat kekeruhan iris mata belum penuh" },
  { code: "34071009", tampilan: "Tingkat kekeruhan iris mata penuh" },
]);
const listShadowTest = ref([
  { code: "10828004", tampilan: "Tingkat kekeruhan iris mata belum penuh" },
  { code: "260385009", tampilan: "Tingkat kekeruhan iris mata penuh" },
]);
const listHasilVisusTajam = ref([
  { code: "45089002", tampilan: "Normal", range: "6/12 - 6/6" },
  {
    code: "397543001",
    tampilan: "Gangguan Penglihatan Ringan",
    range: " 6/18 - <6/12",
  },
  {
    code: "397542006",
    tampilan: "Gangguan Penglihatan Sedang",
    range: "6/60 - <6/18",
  },
  {
    code: "397541004",
    tampilan: "Gangguan Penglihatan Berat",
    range: "3/60 - <6/60",
  },
  { code: "274572000", tampilan: "Buta", range: "<3/60" },
]);
const hasilVisusTajam = (mata: string) => {
  let tempHasil = 0;
  if (mata == "OD") {
    tempHasil = odVisusTajamDenominator.value / odVisusTajamNumerator.value;
  } else if (mata == "OS") {
    tempHasil = osVisusTajamDenominator.value / osVisusTajamNumerator.value;
  }

  let tempHasilStr = "";
  if (tempHasil >= 6 / 12 && tempHasil <= 1) {
    tempHasilStr = listHasilVisusTajam.value[0].tampilan;
  } else if (tempHasil >= 6 / 18 && tempHasil < 6 / 12) {
    tempHasilStr = listHasilVisusTajam.value[1].tampilan;
  } else if (tempHasil >= 6 / 60 && tempHasil < 6 / 18) {
    tempHasilStr = listHasilVisusTajam.value[1].tampilan;
  } else if (tempHasil >= 3 / 60 && tempHasil < 6 / 60) {
    tempHasilStr = listHasilVisusTajam.value[1].tampilan;
  } else if (tempHasil < 3 / 60) {
    tempHasilStr = listHasilVisusTajam.value[1].tampilan;
  }

  if (mata == "OD") {
    odHasilVisusTajam.value = tempHasilStr;
  } else if (mata == "OS") {
    osHasilVisusTajam.value = tempHasilStr;
  }
};

const resetForm = () => {
  fieldList.value.forEach((field) => {
    field.value = undefined;
  });
  

  odPupilIsKatarak.value = false;
  osPupilIsKatarak.value = false;
  odIsRetinopati.value = false;
  osIsRetinopati.value = false;
};

const listPemeriksaanLanjutan = ref([
  { code: "422256009", tampilan: "Counts fingers - distance vision" },
  { code: "260295004", tampilan: "Sees hand movements" },
  { code: "260296003", tampilan: "Light perception" },
  { code: "63063006", tampilan: "Visual acuity, no light perception" },
]);

const listHasilGlaukoma = ref([
  { code: "N", tampilan: "Tidak Dicurigai Glaukoma", range: "10 - 21" },
  { code: "23986001", tampilan: "Dicurigai Glaukoma", range: "> 21" },
]);

const countHasilGlaukoma = (mata: string) => {
  let tempGlaukoma;
  let tempHasilStr;
  if (mata == "OD") {
    tempGlaukoma = odGlaukoma.value;
  } else if (mata == "OS") {
    tempGlaukoma = osGlaukoma.value;
  }

  if (tempGlaukoma >= 10 && tempGlaukoma <= 21) {
    tempHasilStr = listHasilGlaukoma.value[0].tampilan;
  } else if (tempGlaukoma > 21) {
    tempHasilStr = listHasilGlaukoma.value[1].tampilan;
  }

  if (mata == "OD") {
    odHasilGlaukoma.value = tempHasilStr;
  } else if (mata == "OS") {
    osHasilGlaukoma.value = tempHasilStr;
  }
};

// Kanan
const odVisusDenominator = ref();
const odVisusNumerator = ref();

const odPinholeDenominator = ref();
const odPinholeNumerator = ref();
const odHasilPinhole = ref();
const odPupilIsKatarak = ref(false);
const odSnomed = ref();
const snomedUuid = ref();

const odFundus = ref();
const odShadowTest = ref();

const odSphJauh = ref();
const odCyl = ref();
const odAxis = ref();
const odVisusTajamDenominator = ref();
const odVisusTajamNumerator = ref();
const odHasilVisusTajam = ref();

const odPemeriksaanLanjutan = ref();

const odSphDekat = ref();
const odGlaukoma = ref();
const odHasilGlaukoma = ref();
const odIsRetinopati = ref(false);
// Kiri
const osVisusDenominator = ref();
const osVisusNumerator = ref();

const osPinholeDenominator = ref();
const osPinholeNumerator = ref();
const osHasilPinhole = ref();
const osPupilIsKatarak = ref(false);
const osSnomed = ref();
const osSnomedUuid = ref();

const osFundus = ref();
const osShadowTest = ref();

const osSphJauh = ref();
const osCyl = ref();
const osAxis = ref();
const osVisusTajamDenominator = ref();
const osVisusTajamNumerator = ref();
const osHasilVisusTajam = ref();

const osPemeriksaanLanjutan = ref();

const osSphDekat = ref();
const osGlaukoma = ref();
const osHasilGlaukoma = ref();
const osIsRetinopati = ref(false);


const historyData = ref<any>(null);
const historyDialog = ref(false);
const historyPageIndex = ref(0);

const fetchHistoryData = async () => {
  if (!props.patientData?.patient) {
    console.warn("Data Pasien tidak lengkap untuk mengambil riwayat.");
    historyData.value = null;
    return;
  }
  
  try {
    storeUtils.setLoading(true);
    const openedRekamMedis = rekamMedisStore.openedRekamMedis;
    const selectedDate = openedRekamMedis.dates?.find((d: { isSelected: any; }) => d.isSelected)?.date;
    const selectedSessionOrder = openedRekamMedis.sessions?.find((s: { isSelected: any; }) => s.isSelected)?.order;
    const response = await rekamMedisStore.getCompare({
      noPelayanan: props.patientData.noPelayanan || props.patientData.no_pelayanan,
      noRm: props.patientData.patient.noRm,
      jenisKunjungan: selectedFilter.value === 'semua' ? '' : selectedFilter.value,
      key: "pemeriksaan_mata",
      dateFilter: selectedDate,
      sessionOrder: selectedSessionOrder,
    });

    if (response && response.payload && response.payload.length > 0) {
      historyData.value = response.payload;
    } else {
      historyData.value = null;
    }
    historyPageIndex.value = 0; 

  } catch (error) {
    console.error("Gagal mengambil data perbandingan untuk skrining mata:", error);
    historyData.value = null;
  } finally {
    storeUtils.setLoading(false);
  }
};

const showDialogHistory = async () => {
  await fetchHistoryData();
  historyDialog.value = true;
};

const filterOptions = ref([
  { name: "Semua", value: "semua" },
  { name: "RJ", value: "rj" },
  { name: "RI", value: "ri" },
  { name: "IGD", value: "igd" },
]);
const selectedFilter = ref("semua");

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

// NOTE Get Text
const getFundusText = (code: string) => {
  const selectedFundus = listFundus.value.find((fundus) => fundus.code == code);
  return selectedFundus?.tampilan;
};
const getShadowTestText = (code: string) => {
  const selectedShadowTest = listShadowTest.value.find(
    (shadowTest) => shadowTest.code == code
  );
  return selectedShadowTest?.tampilan;
};
const getPemeriksaanLanjutanText = (code: string) => {
  const selectedPemeriksaanLanjutan = listPemeriksaanLanjutan.value.find(
    (pemeriksaanLanjutan) => pemeriksaanLanjutan.code == code
  );
  return selectedPemeriksaanLanjutan?.tampilan;
};

const fieldList = ref([
  { name: "odVisusDenominator", value: odVisusDenominator },
  { name: "odVisusNumerator", value: odVisusNumerator },
  { name: "odPinholeDenominator", value: odPinholeDenominator },
  { name: "odPinholeNumerator", value: odPinholeNumerator },
  { name: "odHasilPinhole", value: odHasilPinhole },
  { name: "odPupilIsKatarak", value: odPupilIsKatarak },
  { name: "odSnomed", value: odSnomed },
  { name: "snomedUuid", value: snomedUuid },
  { name: "odFundus", value: odFundus },
  { name: "odShadowTest", value: odShadowTest },
  { name: "odSphJauh", value: odSphJauh },
  { name: "odCyl", value: odCyl },
  { name: "odAxis", value: odAxis },
  { name: "odVisusTajamDenominator", value: odVisusTajamDenominator },
  { name: "odVisusTajamNumerator", value: odVisusTajamNumerator },
  { name: "odHasilVisusTajam", value: odHasilVisusTajam },
  { name: "odPemeriksaanLanjutan", value: odPemeriksaanLanjutan },
  { name: "odSphDekat", value: odSphDekat },
  { name: "odGlaukoma", value: odGlaukoma },
  { name: "odHasilGlaukoma", value: odHasilGlaukoma },
  { name: "odIsRetinopati", value: odIsRetinopati },
  { name: "osVisusDenominator", value: osVisusDenominator },
  { name: "osVisusNumerator", value: osVisusNumerator },
  { name: "osPinholeDenominator", value: osPinholeDenominator },
  { name: "osPinholeNumerator", value: osPinholeNumerator },
  { name: "osHasilPinhole", value: osHasilPinhole },
  { name: "osPupilIsKatarak", value: osPupilIsKatarak },
  { name: "osSnomed", value: osSnomed },
  { name: "osSnomedUuid", value: osSnomedUuid },
  { name: "osFundus", value: osFundus },
  { name: "osShadowTest", value: osShadowTest },
  { name: "osSphJauh", value: osSphJauh },
  { name: "osCyl", value: osCyl },
  { name: "osAxis", value: osAxis },
  { name: "osVisusTajamDenominator", value: osVisusTajamDenominator },
  { name: "osVisusTajamNumerator", value: osVisusTajamNumerator },
  { name: "osHasilVisusTajam", value: osHasilVisusTajam },
  { name: "osPemeriksaanLanjutan", value: osPemeriksaanLanjutan },
  { name: "osSphDekat", value: osSphDekat },
  { name: "osGlaukoma", value: osGlaukoma },
  { name: "osHasilGlaukoma", value: osHasilGlaukoma },
  { name: "osIsRetinopati", value: osIsRetinopati },
]);

const saveData = () => {
  const tempData: any = {};

  fieldList.value.forEach((field) => {
    tempData[field.name] = field.value;
  });
  if (tempData.odSnomed) {
    tempData.snomedUuid = tempData.odSnomed.uuid;
    tempData.odSnomed = tempData.odSnomed.name;
  }
  if (tempData.osSnomed) {
    tempData.osSnomedUuid = tempData.osSnomed.uuid;
    tempData.osSnomed = tempData.osSnomed.name;
  }
  return tempData;
};

const checkFilledForm = () => {
  let isFilled = false;
  fieldList.value.forEach((fieldData) => {
    if (fieldData.value && typeof fieldData.value != "boolean") {
      isFilled = true;
    }
  });
  return isFilled;
};

const setFormData = () => {
  if (props.openedData) {
    odVisusDenominator.value = props.openedData.odVisusDenominator;
    odVisusNumerator.value = props.openedData.odVisusNumerator;
    odPinholeDenominator.value = props.openedData.odPinholeDenominator;
    odPinholeNumerator.value = props.openedData.odPinholeNumerator;
    odHasilPinhole.value = props.openedData.odHasilPinhole;
    odPupilIsKatarak.value = props.openedData.odPupilIsKatarak;
    odSnomed.value = props.openedData.odSnomed;
    snomedUuid.value = props.openedData.snomedUuid;
    odFundus.value = props.openedData.odFundus;
    odShadowTest.value = props.openedData.odShadowTest;
    odSphJauh.value = props.openedData.odSphJauh;
    odCyl.value = props.openedData.odCyl;
    odAxis.value = props.openedData.odAxis;
    odVisusTajamDenominator.value = props.openedData.odVisusTajamDenominator;
    odVisusTajamNumerator.value = props.openedData.odVisusTajamNumerator;
    odHasilVisusTajam.value = props.openedData.odHasilVisusTajam;
    odPemeriksaanLanjutan.value = props.openedData.odPemeriksaanLanjutan;
    odSphDekat.value = props.openedData.odSphDekat;
    odGlaukoma.value = props.openedData.odGlaukoma;
    odHasilGlaukoma.value = props.openedData.odHasilGlaukoma;
    odIsRetinopati.value = props.openedData.odIsRetinopati;
    osVisusDenominator.value = props.openedData.osVisusDenominator;
    osVisusNumerator.value = props.openedData.osVisusNumerator;
    osPinholeDenominator.value = props.openedData.osPinholeDenominator;
    osPinholeNumerator.value = props.openedData.osPinholeNumerator;
    osHasilPinhole.value = props.openedData.osHasilPinhole;
    osPupilIsKatarak.value = props.openedData.osPupilIsKatarak;
    osSnomed.value = props.openedData.osSnomed;
    osSnomedUuid.value = props.openedData.osSnomedUuid;
    osFundus.value = props.openedData.osFundus;
    osShadowTest.value = props.openedData.osShadowTest;
    osSphJauh.value = props.openedData.osSphJauh;
    osCyl.value = props.openedData.osCyl;
    osAxis.value = props.openedData.osAxis;
    osVisusTajamDenominator.value = props.openedData.osVisusTajamDenominator;
    osVisusTajamNumerator.value = props.openedData.osVisusTajamNumerator;
    osHasilVisusTajam.value = props.openedData.osHasilVisusTajam;
    osPemeriksaanLanjutan.value = props.openedData.osPemeriksaanLanjutan;
    osSphDekat.value = props.openedData.osSphDekat;
    osGlaukoma.value = props.openedData.osGlaukoma;
    osHasilGlaukoma.value = props.openedData.osHasilGlaukoma;
    osIsRetinopati.value = props.openedData.osIsRetinopati;
    if (odSnomed.value) {
      odSnomed.value = {
        uuid: snomedUuid.value,
        name: odSnomed.value,
      };
    }
    if (osSnomed.value) {
      osSnomed.value = {
        uuid: osSnomedUuid.value,
        name: osSnomed.value,
      };
    }
  } else {
    fieldList.value.forEach((field) => {
      field.value = undefined;
    });
    odPupilIsKatarak.value = false;
    osPupilIsKatarak.value = false;
    odIsRetinopati.value = false;
    osIsRetinopati.value = false;
  }
};

// NOTE Untuk merefresh form yang sedang dibuka jika ada perubahan data
const storedRMData = computed(() => rekamMedisStore.openedRekamMedis);
watch(storedRMData, (newRM) => {
  setFormData();
});

const listSnomedData = ref<any[]>([]);
onMounted(async () => {
  storeUtils.setLoading(true);
  try {
    const response = await snomedCTStore.getAktifApi();
    if (response && response.payload) {
      listSnomedData.value = response.payload;
    } else {
      listSnomedData.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    listSnomedData.value = [];
  } finally {
    storeUtils.setLoading(false);
  }
  setFormData();
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

watch(selectedFilter, async (newValue, oldValue) => {
  if (historyDialog.value && newValue !== oldValue) {
    await fetchHistoryData();
  }
});

defineExpose({
  open,
  close,
  saveData,
  checkFilledForm,
  props,
  resetForm,
});
</script>

<template>
  <CustomAccordion ref="accordion" headerClass="bg-opensimrs-50">
    <template #header>Skrining Mata</template>
    <template #content>
      <div class="pt-5">
        <div v-if="method == 'form'" class="flex flex-col">
          <CustomButton
            @click="showDialogHistory"
            class="!rounded-md my-[10px] ml-auto"
            label="Riwayat Pemeriksaan"
            size="small"
            icon="PhClockCounterClockwise"
          />
          <hr class="mb-[30px]" />
        </div>
        <!-- Tajam Penglihatan -->
        <div
          class="border-opensimrs-300 rounded-[10px] mb-[30px]"
          :class="[method == 'form' ? 'border p-5' : '']"
        >
          <div class="font-semibold text-opensimrs-300 text-normal mb-[30px]">
            Tajam Penglihatan menggunakan Tes Uncorrected Snelled Chart
          </div>
          <div
            v-if="method == 'form'"
            class="grid grid-cols-[1fr_min-content_1fr_min-content_1fr_min-content_1fr]"
          >
            <CustomInputNumber
              v-model="odVisusDenominator"
              label="Pemeriksaan Visus Kanan"
            />
            <span class="text-opensimrs-300 mx-[30px] mt-auto mb-2">/</span>
            <CustomInputNumber
              v-model="odVisusNumerator"
              :showLabel="false"
              class="mt-auto"
            />
            <div class="border border-gray-200 mx-[35px]"></div>
            <CustomInputNumber
              v-model="osVisusDenominator"
              label="Pemeriksaan Visus Kiri"
            />
            <span class="text-opensimrs-300 mx-[30px] mt-auto mb-2">/</span>
            <CustomInputNumber
              v-model="osVisusNumerator"
              :showLabel="false"
              class="mt-auto"
            />
          </div>
          <div v-else>
            <div class="flex flex-col gap-[19px]">
              <CustomInfoRow
                label="Pemeriksaan Visus Kanan"
                :value="`${odVisusDenominator ?? '-'}/${
                  odVisusNumerator ?? '-'
                }`"
              />
              <hr class="border-opensimrs-300" />
              <CustomInfoRow
                label="Pemeriksaan Visus Kiri"
                :value="`${osVisusDenominator ?? '-'}/${
                  osVisusNumerator ?? '-'
                }`"
              />
            </div>
            <hr class="-mx-4 border-grey-200 mt-[10px]" />
          </div>
        </div>
        <!-- Katarak -->
        <div
          class="border-opensimrs-300 rounded-[10px] mb-[30px]"
          :class="[method == 'form' ? 'border p-5' : '']"
        >
          <div class="font-semibold text-opensimrs-300 text-normal mb-[30px]">
            Katarak
          </div>
          <div
            v-if="method == 'form'"
            class="grid grid-cols-[1fr_min-content_1fr]"
          >
            <div class="grid grid-cols-2 gap-5">
              <div>
                <label class="block font-semibold mb-[5px] text-normal">
                  Pemeriksaan Pinhole Kanan
                </label>
                <div class="grid grid-cols-[1fr_min-content_1fr]">
                  <CustomInputNumber
                    v-model="odPinholeDenominator"
                    :showLabel="false"
                    class=""
                    @update:model-value="hasilPihnhole('OD')"
                  />
                  <span class="text-opensimrs-300 mx-[30px] mt-auto mb-2">/</span>
                  <CustomInputNumber
                    v-model="odPinholeNumerator"
                    :showLabel="false"
                    class="mt-auto"
                    @update:model-value="hasilPihnhole('OD')"
                  />
                </div>
              </div>
              <CustomTextfield
                v-model="odHasilPinhole"
                :showLabel="false"
                placeholder="Hasil Pemeriksaan Pinhole Kanan"
                class="mt-auto"
                readOnly
              />
              <div class="col-span-2">
                <label class="block font-semibold mb-[5px] text-normal">
                  Pemeriksaan Segment Anterior (Pupil) Kanan
                </label>
                <div class="flex">
                  <!-- OV000393 -->
                  <CustomRadio
                    v-model="odPupilIsKatarak"
                    :value="true"
                    sideLabel="Curiga Katarak"
                    class="mr-5"
                  />
                  <CustomRadio
                    v-model="odPupilIsKatarak"
                    :value="false"
                    sideLabel="Kelainan Mata Lainnya"
                  />
                </div>
              </div>
              <CustomSelect
                v-if="!odPupilIsKatarak"
                v-model="odSnomed"
                :showLabel="false"
                :placeHolder="
                  odSnomed?.name ?? 'Kelainan Mata Lain (Snomed-CT)'
                "
                class="col-span-2"
                optionLabel="name"
                optionValue=""
                :options="listSnomedData"
                customValue
              >
                <template #customOptions="{ option }">
                  {{ option.name }} ({{ option.code }})
                </template>
                <template #customValue="{ value, placeholder, selectedData }">
                  {{
                    value && selectedData
                      ? `${selectedData?.name} (${selectedData?.code})`
                      : placeholder
                  }}
                </template>
              </CustomSelect>
            </div>
            <div class="border border-gray-200 mx-[35px]"></div>
            <div class="grid grid-cols-2 gap-5">
              <div>
                <label class="block font-semibold mb-[5px] text-normal">
                  Pemeriksaan Pinhole Kiri
                </label>
                <div class="grid grid-cols-[1fr_min-content_1fr]">
                  <CustomInputNumber
                    v-model="osPinholeDenominator"
                    :showLabel="false"
                    class=""
                    @update:model-value="hasilPihnhole('OS')"
                  />
                  <span class="text-opensimrs-300 mx-[30px] mt-auto mb-2">/</span>
                  <CustomInputNumber
                    v-model="osPinholeNumerator"
                    :showLabel="false"
                    class="mt-auto"
                    @update:model-value="hasilPihnhole('OS')"
                  />
                </div>
              </div>
              <CustomTextfield
                :showLabel="false"
                v-model="osHasilPinhole"
                placeholder="Hasil Pemeriksaan Pinhole Kiri"
                class="mt-auto"
                readOnly
              />
              <div class="col-span-2">
                <label class="block font-semibold mb-[5px] text-normal">
                  Pemeriksaan Segment Anterior (Pupil) Kiri
                </label>
                <div class="flex">
                  <!-- OV000393 -->
                  <CustomRadio
                    v-model="osPupilIsKatarak"
                    :value="true"
                    sideLabel="Curiga Katarak"
                    class="mr-5"
                  />
                  <CustomRadio
                    v-model="osPupilIsKatarak"
                    :value="false"
                    sideLabel="Kelainan Mata Lainnya"
                  />
                </div>
              </div>
              <CustomSelect
                v-if="!osPupilIsKatarak"
                v-model="osSnomed"
                :showLabel="false"
                :placeHolder="
                  odSnomed?.name ?? 'Kelainan Mata Lain (Snomed-CT)'
                "
                class="col-span-2"
                optionLabel="uuid"
                optionValue=""
                :options="listSnomedData"
                :placeholder="osSnomed"
                customValue
              >
                <template #customOptions="{ option }">
                  {{ option.name }} ({{ option.code }})
                </template>
                <template #customValue="{ value, placeholder, selectedData }">{{
                  value && selectedData
                    ? `${selectedData.name} (${selectedData.code})`
                    : placeholder
                }}</template>
              </CustomSelect>
            </div>
          </div>
          <div v-else>
            <div class="flex flex-col gap-[19px]">
              <CustomInfoRow
                label="Pemeriksaan Pinhole Kanan"
                :value="odHasilPinhole"
              />
              <CustomInfoRow
                label="Pemeriksaan Segment Anterior (Pupil) Kanan*"
                :value="
                  odPupilIsKatarak
                    ? 'Curiga Katarak'
                    : odSnomed?.name ?? 'Kelainan mata lainnya'
                "
              />
              <hr class="border-opensimrs-300" />
              <CustomInfoRow
                label="Pemeriksaan Pinhole Kiri"
                :value="osHasilPinhole"
              />
              <CustomInfoRow
                label="Pemeriksaan Segment Anterior (Pupil) Kiri*"
                :value="
                  osPupilIsKatarak
                    ? 'Curiga Katarak'
                    : osSnomed?.name ?? 'Kelainan mata lainnya'
                "
              />
            </div>
            <hr class="-mx-4 border-grey-200 mt-[10px]" />
          </div>
        </div>
        <!-- Jika Pemeriksaan Pupil -->
        <div
          class="border-opensimrs-300 rounded-[10px] mb-[30px]"
          :class="[method == 'form' ? 'border p-5' : '']"
        >
          <div class="font-semibold text-opensimrs-300 text-normal mb-[30px]">
            Jika Pemeriksaan Pupil hasilnya Positif, maka dilanjutkan
            pemeriksaan dengan Oftalmoskop/Shadow test
          </div>
          <div
            v-if="method == 'form'"
            class="grid grid-cols-[1fr_min-content_1fr]"
          >
            <div>
              <CustomSelect
                v-model="odFundus"
                label="Pemeriksaan Refleks Fundus Kanan"
                placeHolder="Pilih Pemeriksaan Refleks Fundus Kanan"
                class="mb-5"
                optionLabel="tampilan"
                optionValue="code"
                :options="listFundus"
              />
              <CustomSelect
                v-model="odShadowTest"
                label="Pemeriksaan Shadow Test Kanan"
                placeHolder="Pilih Pemeriksaan Shadow Test Kanan"
                class=""
                optionLabel="tampilan"
                optionValue="code"
                :options="listShadowTest"
              />
            </div>
            <div class="border border-gray-200 mx-[35px]"></div>
            <div>
              <CustomSelect
                v-model="osFundus"
                label="Pemeriksaan Refleks Fundus Kiri"
                placeHolder="Pilih Pemeriksaan Refleks Fundus Kiri"
                class="mb-5"
                optionLabel="tampilan"
                optionValue="code"
                :options="listFundus"
              />
              <CustomSelect
                v-model="osShadowTest"
                label="Pemeriksaan Shadow Test Kiri"
                placeHolder="Pilih Pemeriksaan Shadow Test Kiri"
                class=""
                optionLabel="tampilan"
                optionValue="code"
                :options="listShadowTest"
              />
            </div>
          </div>
          <div v-else>
            <div class="flex flex-col gap-[19px]">
              <CustomInfoRow
                label="Pemeriksaan Reflek Fundus Kanan"
                :value="odFundus ? getFundusText(odFundus) : '-'"
              />
              <CustomInfoRow
                label="Pemeriksaan Shadow Test Kanan"
                :value="odShadowTest ? getShadowTestText(odShadowTest) : '-'"
              />
              <hr class="border-opensimrs-300" />
              <CustomInfoRow
                label="Pemeriksaan Reflek Fundus Kiri"
                :value="osFundus ? getFundusText(osFundus) : '-'"
              />
              <CustomInfoRow
                label="Pemeriksaan Shadow Test Kiri"
                :value="osShadowTest ? getShadowTestText(osShadowTest) : '-'"
              />
            </div>
            <hr class="-mx-4 border-grey-200 mt-[10px]" />
          </div>
        </div>
        <!-- Kelainan Refraksi Mata -->
        <div
          class="border-opensimrs-300 rounded-[10px] mb-[30px]"
          :class="[method == 'form' ? 'border p-5' : '']"
        >
          <div class="font-semibold text-opensimrs-300 text-normal mb-[30px]">
            Kelainan Refraksi Mata Jauh
          </div>
          <div
            v-if="method == 'form'"
            class="grid grid-cols-[1fr_min-content_1fr]"
          >
            <div>
              <label class="block mb-5 font-semibold text-normal">
                Pemeriksaan Refraksi Subjektif Jauh Mata Kanan
              </label>
              <CustomInputNumber 
                v-model="odSphJauh" 
                label="Sph" 
                class="mb-5"
                :minFractionDigits="0"
                :maxFractionDigits="2"
                :step="0.25" 
              />
              <CustomInputNumber 
                v-model="odCyl" 
                label="Cyl" 
                class="mb-5"
                :minFractionDigits="0"
                :maxFractionDigits="2"
                :step="0.25"
              />
              <CustomInputNumber v-model="odAxis" label="Axis" class="mb-5" />
              <div class="grid grid-cols-2">
                <label
                  class="block font-semibold mb-[5px] text-normal col-span-2"
                >
                  Pemeriksaan Visus Tajam Penglihatan Jarak Jauh Mata Kanan
                </label>
                <div class="grid grid-cols-[1fr_min-content_1fr]">
                  <CustomInputNumber
                    v-model="odVisusTajamDenominator"
                    @update:model-value="hasilVisusTajam('OD')"
                    :showLabel="false"
                    class=""
                  />
                  <span class="text-opensimrs-300 mx-[30px] mt-auto mb-2">/</span>
                  <CustomInputNumber
                    v-model="odVisusTajamNumerator"
                    @update:model-value="hasilVisusTajam('OD')"
                    :showLabel="false"
                    class="mt-auto"
                  />
                </div>
                <CustomTextfield
                  v-model="odHasilVisusTajam"
                  :showLabel="false"
                  placeholder="Hasil Pemeriksaan Visus Tajam"
                  class="mt-auto ml-5"
                  readOnly
                />
              </div>
            </div>
            <div class="border border-gray-200 mx-[35px]"></div>
            <div>
              <label class="block mb-5 font-semibold text-normal">
                Pemeriksaan Refraksi Subjektif Jauh Mata Kiri
              </label>
              <CustomInputNumber 
                v-model="osSphJauh" 
                label="Sph" 
                class="mb-5"
                :minFractionDigits="0"
                :maxFractionDigits="2"
                :step="0.25" 
              />
              <CustomInputNumber 
                v-model="osCyl" 
                label="Cyl" 
                class="mb-5"
                :minFractionDigits="0"
                :maxFractionDigits="2"
                :step="0.25" 
              />
              <CustomInputNumber v-model="osAxis" label="Axis" class="mb-5" />
              <div class="grid grid-cols-2">
                <label
                  class="block font-semibold mb-[5px] text-normal col-span-2"
                >
                  Pemeriksaan Visus Tajam Penglihatan Jarak Jauh Mata Kiri
                </label>
                <div class="grid grid-cols-[1fr_min-content_1fr]">
                  <CustomInputNumber
                    v-model="osVisusTajamDenominator"
                    @update:model-value="hasilVisusTajam('OS')"
                    :showLabel="false"
                    class=""
                  />
                  <span class="text-opensimrs-300 mx-[30px] mt-auto mb-2">/</span>
                  <CustomInputNumber
                    v-model="osVisusTajamNumerator"
                    @update:model-value="hasilVisusTajam('OS')"
                    :showLabel="false"
                    class="mt-auto"
                  />
                </div>
                <CustomTextfield
                  v-model="osHasilVisusTajam"
                  :showLabel="false"
                  placeholder="Hasil Pemeriksaan Visus Tajam"
                  class="mt-auto ml-5"
                  readOnly
                />
              </div>
            </div>
          </div>
          <div v-else>
            <div class="flex flex-col gap-[19px]">
              <div class="font-semibold underline text-normal">
                Pemeriksaan Refraksi Subjektif Jauh Mata Kanan
              </div>
              <div class="grid grid-cols-2 gap-y-[19px]">
                <CustomInfoRow label="Sph" :value="`${odSphJauh ?? '-'}`" />
                <CustomInfoRow label="Cyl" :value="`${odCyl ?? '-'}`" />
                <CustomInfoRow label="Axis" :value="`${odAxis ?? '-'}`" />
              </div>
              <div class="font-semibold underline text-normal">
                Pemeriksaan Visus Tajam Penglihatan Jarak Jauh Mata Kanan
              </div>
              <div class="grid grid-cols-2">
                <CustomInfoRow
                  label="Nilai"
                  :value="`${odVisusTajamDenominator ?? '-'}/${
                    odVisusTajamNumerator ?? '-'
                  }`"
                />
                <CustomInfoRow label="Hasil" :value="odHasilVisusTajam" />
              </div>
              <hr class="border-opensimrs-300" />
              <div class="font-semibold underline text-normal">
                Pemeriksaan Refraksi Subjektif Jauh Mata Kiri
              </div>
              <div class="grid grid-cols-2 gap-y-[19px]">
                <CustomInfoRow label="Sph" :value="`${osSphJauh ?? '-'}`" />
                <CustomInfoRow label="Cyl" :value="`${osCyl ?? '-'}`" />
                <CustomInfoRow label="Axis" :value="`${osAxis ?? '-'}`" />
              </div>
              <div class="font-semibold underline text-normal">
                Pemeriksaan Visus Tajam Penglihatan Jarak Jauh Mata Kiri
              </div>
              <div class="grid grid-cols-2">
                <CustomInfoRow
                  label="Nilai"
                  :value="`${osVisusTajamDenominator ?? '-'}/${
                    osVisusTajamNumerator ?? '-'
                  }`"
                />
                <CustomInfoRow label="Hasil" :value="osHasilVisusTajam" />
              </div>
            </div>
            <hr class="-mx-4 border-grey-200 mt-[10px]" />
          </div>
        </div>
        <!-- Jika hasil pemeriksaan adalah buta -->
        <div
          class="border-opensimrs-300 rounded-[10px] mb-[30px]"
          :class="[method == 'form' ? 'border p-5' : '']"
        >
          <div class="font-semibold text-opensimrs-300 text-normal mb-[30px]">
            Jika hasil pemeriksaan adalah buta, maka dilakukan pemeriksaan
            lanjutan
          </div>
          <div
            v-if="method == 'form'"
            class="grid grid-cols-[1fr_min-content_1fr]"
          >
            <CustomSelect
              v-model="odPemeriksaanLanjutan"
              label="Pemeriksaan Lanjutan Jika Dinyatakan Buta Mata Kanan"
              placeHolder="Pilih Pemeriksaan Lanjutan Jika Dinyatakan Buta Mata Kanan"
              class="mb-5"
              optionLabel="tampilan"
              optionValue="code"
              :options="listPemeriksaanLanjutan"
            />
            <div class="border border-gray-200 mx-[35px]"></div>
            <CustomSelect
              v-model="osPemeriksaanLanjutan"
              label="Pemeriksaan Lanjutan Jika Dinyatakan Buta Mata Kiri"
              placeHolder="Pilih Pemeriksaan Lanjutan Jika Dinyatakan Buta Mata Kiri"
              class="mb-5"
              optionLabel="tampilan"
              optionValue="code"
              :options="listPemeriksaanLanjutan"
            />
          </div>
          <div v-else>
            <div class="flex flex-col gap-[19px]">
              <CustomInfoRow
                label="Pemeriksaan Lanjutan Jika Dinyatakan Buta Warna Kanan"
                :value="
                  odPemeriksaanLanjutan
                    ? getPemeriksaanLanjutanText(odPemeriksaanLanjutan)
                    : '-'
                "
              />
              <hr class="border-opensimrs-300" />
              <CustomInfoRow
                label="Pemeriksaan Lanjutan Jika Dinyatakan Buta Warna Kiri"
                :value="
                  osPemeriksaanLanjutan
                    ? getPemeriksaanLanjutanText(odPemeriksaanLanjutan)
                    : '-'
                "
              />
            </div>
            <hr class="-mx-4 border-grey-200 mt-[10px]" />
          </div>
        </div>
        <!-- Kelainan Refraksi Mata Dekat -->
        <div
          class="border-opensimrs-300 rounded-[10px]"
          :class="[method == 'form' ? 'border p-5' : '']"
        >
          <div class="font-semibold text-opensimrs-300 text-normal mb-[30px]">
            Kelainan Refraksi Mata Dekat
          </div>
          <div
            v-if="method == 'form'"
            class="grid grid-cols-[1fr_min-content_1fr]"
          >
            <div>
              <label class="block mb-5 font-semibold text-normal">
                Pemeriksaan Refraksi Dekat Mata Kanan
              </label>
              <CustomInputNumber
                v-model="odSphDekat"
                label="Koreksi Lensa addisi untuk penglihatan dekat (Sph +)"
                class="mb-5"
                :minFractionDigits="0"
                :maxFractionDigits="2"
                :step="0.25"
              />
              <div class="grid grid-cols-2 mb-5 gap-x-5">
                <label
                  class="block col-span-2 mb-[5px] font-semibold text-normal"
                >
                  Dicurigai Glaukoma pada Mata Kanan
                </label>
                <CustomInputNumber
                  v-model="odGlaukoma"
                  @update:model-value="countHasilGlaukoma('OD')"
                  :showLabel="false"
                  class=""
                />
                <CustomTextfield
                  v-model="odHasilGlaukoma"
                  :showLabel="false"
                  placeholder="Hasil Pemeriksaan Glukoma"
                  class="mt-auto"
                  readOnly
                />
              </div>
              <div class="col-span-2">
                <label class="block font-semibold mb-[5px] text-normal">
                  Dicurigai Retinopati pada Mata Kanan
                </label>
                <div class="flex">
                  <CustomRadio
                    v-model="odIsRetinopati"
                    :value="false"
                    sideLabel="Normal"
                    class="mr-5"
                  />
                  <CustomRadio
                    v-model="odIsRetinopati"
                    :value="true"
                    sideLabel="Suspek Retinopati"
                  />
                </div>
              </div>
            </div>
            <div class="border border-gray-200 mx-[35px]"></div>
            <div>
              <label class="block mb-5 font-semibold text-normal">
                Pemeriksaan Refraksi Dekat Mata Kiri
              </label>
              <CustomInputNumber
                v-model="osSphDekat"
                label="Koreksi Lensa addisi untuk penglihatan dekat (Sph +)"
                class="mb-5"
                :minFractionDigits="0"
                :maxFractionDigits="2"
                :step="0.25"
              />
              <div class="grid grid-cols-2 mb-5 gap-x-5">
                <label
                  class="block col-span-2 mb-[5px] font-semibold text-normal"
                >
                  Dicurigai Glaukoma pada Mata Kiri
                </label>
                <CustomInputNumber
                  v-model="osGlaukoma"
                  @update:model-value="countHasilGlaukoma('OS')"
                  :showLabel="false"
                  class=""
                />
                <CustomTextfield
                  v-model="osHasilGlaukoma"
                  :showLabel="false"
                  placeholder="Hasil Pemeriksaan Glukoma"
                  class="mt-auto"
                  readOnly
                />
              </div>
              <div class="col-span-2">
                <label class="block font-semibold mb-[5px] text-normal">
                  Dicurigai Retinopati pada Mata Kiri
                </label>
                <div class="flex">
                  <CustomRadio
                    v-model="osIsRetinopati"
                    :value="false"
                    sideLabel="Normal"
                    class="mr-5"
                  />
                  <CustomRadio
                    v-model="osIsRetinopati"
                    :value="true"
                    sideLabel="Suspek Retinopati"
                  />
                </div>
              </div>
            </div>
          </div>
          <div v-else>
            <div class="flex flex-col gap-[19px]">
              <div class="font-semibold underline text-normal">
                Pemeriksaan Refraksi Dekat Mata Kanan
              </div>
              <CustomInfoRow
                label="Koreksi Lensa addisi untuk penglihatan dekat (Sph +) Kanan"
                :value="`${odSphDekat ?? '-'}`"
              />
              <CustomInfoRow
                label="Dicurigai Glaukoma pada mata Kanan"
                :value="odHasilGlaukoma"
              />
              <CustomInfoRow
                label="Dicurigai Retinopati pada Mata Kanan"
                :value="osIsRetinopati ? 'Normal' : 'Suspek Retinopati'"
              />
              <hr class="border-opensimrs-300" />
              <div class="font-semibold underline text-normal">
                Pemeriksaan Refraksi Dekat Mata Kiri
              </div>
              <CustomInfoRow
                label="Koreksi Lensa addisi untuk penglihatan dekat (Sph +) Kiri"
                :value="`${osSphDekat ?? '-'}`"
              />
              <CustomInfoRow
                label="Dicurigai Glaukoma pada mata Kiri"
                :value="osHasilGlaukoma"
              />
              <CustomInfoRow
                label="Dicurigai Retinopati pada Mata Kiri"
                :value="odIsRetinopati ? 'Normal' : 'Suspek Retinopati'"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Dialog History -->
       <CustomDialog class="" v-model:visible="historyDialog" width="80%">
        <template #header>Pemeriksaan Fisik</template>
        <template #body>
          <div class="pt-5 grid grid-cols-[1fr_min-content_1fr]">
            <div class="mb-[18px] flex justify-between col-span-3">
              <div class="font-semibold text-grey-400">Riwayat Sebelumnya</div>
              <div class="flex">
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

            <div class="overflow-auto pr-4">
              <HistoriSkriningMata :history="leftHistoryItem" />
            </div>

            <div class="border border-opensimrs-300 mx-[15px]"></div>

            <div class="overflow-auto pl-4">
              <HistoriSkriningMata :history="rightHistoryItem" />
            </div>
          </div>
        </template>
      </CustomDialog>
    </template>
  </CustomAccordion>
</template>
