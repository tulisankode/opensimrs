<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from "vue";
import Adult from "./BurnSVG/Adult.vue";
import AdultWomen from "./BurnSVG/AdultWomen.vue";
import Child from "./BurnSVG/Child.vue";
import ChildWomen from "./BurnSVG/ChildWomen.vue";
import Baby from "./BurnSVG/Baby.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { epochToDate } from "@/utils/Helpers";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();

const emit = defineEmits(["editAsesmen"]);

const props = defineProps({
  header: {
    type: String,
    default: "Derajat Luka Bakar",
  },
  method: {
    type: String,
    default: "form",
  },
  initialState: {
    type: String,
    default: "null",
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
  },
});


const getJenisKunjunganLabel = (item: any) => {
  if (!item?.jenisKunjungan) return undefined;
  switch (item.jenisKunjungan) {
    case 'rj':
      return 'Rawat Jalan';
    case 'ri':
      return 'Rawat Inap';
    case 'igd':
      return 'IGD';
    default:
      return undefined;
  }
};

const getChipBgColor = (item: any) => {
  return 'bg-white';
};

const getChipTextColor = (item: any) => {
  return 'text-grey-400';
};

const persentaseLukaBakar = ref<number>(0);
const lpt = ref<number>(0);
const petugas = ref<string>("Super Admin");
const updatedAt = ref<number | null>(null);
const adultSvgRefs = ref<any>(null);
const adultWomanSvgRefs = ref<any>(null);

const submit = async () => {
  try {
    storeUtils.setLoading(true);
    const bodiesData =
      props.patientData?.patient.gender == "Male"
        ? adultSvgRefs.value?.submitObject()
        : adultWomanSvgRefs.value?.submitObject();
    const response = await rekamMedisStore.insertAssesment({
      sessionUuid: props.sessionUuid,
      rekamMedisUuid: props.rmUuid,
      isLatest: rekamMedisStore.openedRekamMedis.isLatest,
      key: "luka_bakar",
      data: {
        bodies: bodiesData,
        persentaseLuka: persentaseLukaBakar.value,
        lpt: lpt.value,
        petugas: petugas.value,
      },
    });
    if (response && response.payload) {
      rekamMedisStore.setAsesmentSummaryRekamMedisData(response.payload);
    }
  } catch (error) {
    console.error("Failed to post data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const setFormData = () => {
  if (rekamMedisStore.openedRekamMedis.data.lukaBakar) {
    persentaseLukaBakar.value =
      rekamMedisStore.openedRekamMedis.data.lukaBakar.persentaseLuka;
      lpt.value = rekamMedisStore.openedRekamMedis.data.lukaBakar.lpt;
      petugas.value = rekamMedisStore.openedRekamMedis.data.lukaBakar.petugas;
      updatedAt.value = rekamMedisStore.openedRekamMedis.data.lukaBakar.updatedAt;
    } else {
    persentaseLukaBakar.value = 0;
    lpt.value = 0;
    petugas.value = "Super Admin";
  }
};

onBeforeMount(() => {
  setFormData();
});

const storedRMData = computed(() => rekamMedisStore.openedRekamMedis);
watch(storedRMData, (newRM) => {
  setFormData();
});

const historyData = ref<any>(null);
const historyPageIndex = ref(0);
const historyDialog = ref(false);
const filterOptions = ref([
  { name: "Semua", value: "semua" },
  { name: "RJ", value: "rj" },
  { name: "RI", value: "ri" },
  { name: "IGD", value: "igd" },
]);
const selectedFilter = ref("semua");

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
      key: "luka_bakar",
      dateFilter: selectedDate,
      sessionOrder: selectedSessionOrder,
    });
    if (response && response.payload && response.payload.length > 0) {
      historyData.value = response.payload;
    } else {
      historyData.value = null;
    }
  } catch (error) {
    console.error("Gagal mengambil data perbandingan untuk luka bakar:", error);
    historyData.value = null;
  } finally {
    storeUtils.setLoading(false);
  }
};

const showDialogHistory = async () => {
  await fetchHistoryData();
  historyPageIndex.value = 0; 
  historyDialog.value = true;
};

const resetForm = () => {
  persentaseLukaBakar.value = 0;
  lpt.value = 0;
  if (props.patientData?.patient.gender == "Male") {
    if (adultSvgRefs.value) {
      adultSvgRefs.value.reset();
    }
  } else {
    if (adultWomanSvgRefs.value) {
      adultWomanSvgRefs.value.reset();
    }
  }
};

watch(selectedFilter, async (newValue, oldValue) => {
    if (historyDialog.value && newValue !== oldValue) {
        await fetchHistoryData();
        historyPageIndex.value = 0;
    }
});

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

const adultDetailSvgRefs = ref<any>(null);
const adultWomanDetailSvgRefs = ref<any>(null);

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
const detailDialog = ref(false);


defineExpose({
  open,
  close,
});
</script>

<template>
  <div>
    <CustomAccordion
      ref="accordion"
      headerClass="bg-opensimrs-50"
      :initialState="initialState"
    >
      <template #header>{{ header }}</template>
      <template #content>
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
        <div v-if="method == 'form'" class="flex justify-between pt-5">
          <div class="grow mr-[30px]">
            <CustomInputNumber
              v-model="persentaseLukaBakar"
              label="Presentase Luka Bakar"
              type="number"
            >
              <template #appendText>
                <div class="flex items-center mr-2">%</div>
              </template>
            </CustomInputNumber>
            <CustomInputNumber
              v-model="lpt"
              label="LPT"
              type="number"
              class="mt-5"
            >
              <template #appendText>
                <div class="flex items-center mr-2">M²</div>
              </template>
            </CustomInputNumber>
          </div>
          <Adult
            v-if="patientData?.patient.gender == 'Male'"
            :openedData="rekamMedisStore.openedRekamMedis.data.lukaBakar"
            ref="adultSvgRefs"
            class="w-[800px]"
          />
          <AdultWomen
            v-else
            :openedData="rekamMedisStore.openedRekamMedis.data.lukaBakar"
            ref="adultWomanSvgRefs"
            class="w-[800px]"
          />
          <div class="font-semibold text-normal grow ml-[30px]">
            <div class="flex bg-opensimrs-50 rounded-[10px] h-10 w-full px-5">
              <span class="my-auto text-opensimrs-300"> Derajat Luka Bakar </span>
            </div>
            <div class="flex px-5 mt-4 text-sunFlower-300">
              <PhFire :size="20" weight="fill" class="mr-[5px]" />
              Grade 1
            </div>
            <div class="flex px-5 mt-6 text-warning-300">
              <PhFire :size="20" weight="fill" class="mr-[5px]" />
              Grade 2
            </div>
            <div class="flex px-5 mt-6 text-danger-300">
              <PhFire :size="20" weight="fill" class="mr-[5px]" />
              Grade 3
            </div>
          </div>
        </div>
        <div v-else class="pt-5">
          <div class="py-5 flex flex-col gap-[19px]">
            <CustomInfoRow
              label="Presentase Luka Bakar"
              :value="`${persentaseLukaBakar} %`"
            />
            <CustomInfoRow label="LPT" :value="`${lpt} M²`" />
            <hr class="border-grey-200" />
            <CustomInfoRow label="Petugas Input" :value="petugas" />
            <CustomInfoRow
              label="Jam Input"
              :value="String(epochToDate(updatedAt ?? 0, 'time'))"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div v-if="method == 'detail'" class="flex justify-between">
          <CustomButton
            @click="detailDialog = true"
            label="Detail"
            icon="DetailIcon"
          />
          <CustomButton @click="emit('editAsesmen')" label="Edit" />
        </div>
        <div v-else class="flex items-end justify-end gap-3">
          <CustomButton
            label="Reset"
            @click="resetForm"
            textColor="text-grey-300"
            backgroundColor="bg-transparent"
            borderColor="border-2 border-grey-200"
          />
          <CustomButton @click="submit" label="Simpan" />
        </div>
      </template>
    </CustomAccordion>
    <CustomDialog class="" v-model:visible="detailDialog" width="1036px">
      <template #header>Detail Derajat Luka Bakar (RON)</template>
      <template #body>
        <div class="pt-5">
          <div class="flex justify-between pt-5">
            <Adult
              v-if="patientData?.patient?.gender === 'Male' || patientData?.patient?.gender === 'Laki-Laki'"
              :openedData="rekamMedisStore.openedRekamMedis.data.lukaBakar"
              ref="adultDetailSvgRefs"
              class="w-[800px]"
            />
            <AdultWomen
              v-else-if="patientData?.patient?.gender === 'Female' || patientData?.patient?.gender === 'Perempuan'"
              :openedData="rekamMedisStore.openedRekamMedis.data.lukaBakar"
              ref="adultWomanDetailSvgRefs"
              class="w-[800px]"
            />
            <div v-else class="w-[800px] flex items-center justify-center border border-dashed text-grey-400">
              Data Gender Tidak Ditemukan
            </div>
            <div class="font-semibold text-normal grow ml-[30px]">
              <div class="flex bg-opensimrs-50 rounded-[10px] h-10 w-full px-5">
                <span class="my-auto text-opensimrs-300">
                  Derajat Luka Bakar
                </span>
              </div>
              <div class="flex px-5 mt-4 text-sunFlower-300">
                <PhFire :size="20" weight="fill" class="mr-[5px]" />
                Grade 1
              </div>
              <div class="flex px-5 mt-6 text-warning-300">
                <PhFire :size="20" weight="fill" class="mr-[5px]" />
                Grade 2
              </div>
              <div class="flex px-5 mt-6 text-danger-300">
                <PhFire :size="20" weight="fill" class="mr-[5px]" />
                Grade 3
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton @click="emit('editAsesmen')" label="Edit" />
        </div>
      </template>
    </CustomDialog>
    <!-- Dialog History -->
     <CustomDialog class="" v-model:visible="historyDialog" width="80%">
      <template #header>Pemeriksaan Fisik</template>
      <template #body>
        <div class="pt-5 grid grid-cols-[1fr_min-content_1fr]">
          <div class="mb-[18px] flex justify-between col-span-3 items-center">
            <div class="font-semibold text-grey-400">Riwayat Sebelumnya</div>
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

          <div>
            <div v-if="leftHistoryItem">
              <CustomAccordion headerClass="bg-opensimrs-50" :initialState="'0'">
                <template #header>
                  <span class="shrink-0 text-sm mr-2 mt-1">
                    {{ epochToDate(leftHistoryItem.date, 'date') || "Data Riwayat" }}
                  </span>
                  <div class="flex flex-wrap">
                    <CustomChip
                        v-if="getJenisKunjunganLabel(leftHistoryItem)"
                        :label="getJenisKunjunganLabel(leftHistoryItem)"
                        :bgColor="getChipBgColor(leftHistoryItem)"
                        :textColor="getChipTextColor(leftHistoryItem)"
                        customClass="h-5 px-2 text-xs font-semibold border-none shrink-0 mt-1"
                        :showCheckedIcon="false"
                      />
                    <CustomChip
                        v-if="leftHistoryItem.session && getJenisKunjunganLabel(leftHistoryItem) !== 'Rawat Jalan'"
                        :label="`Sesi ${leftHistoryItem.session}`"
                        bgColor="bg-blue-200"
                        textColor="text-blue-800"
                        customClass="h-5 px-2 text-xs font-semibold border-none shrink-0 mt-1"
                        :showCheckedIcon="false"
                      />
                  </div>
                </template>
                <template #content>
                  <Adult
                    v-if="patientData?.patient.gender == 'Male'"
                    :openedData="leftHistoryItem.data"
                    class="w-full mt-4"
                  />
                  <AdultWomen
                    v-else
                    :openedData="leftHistoryItem.data"
                    class="w-full mt-4"
                  />
                  <div class="py-5 flex flex-col gap-[19px]">
                    <CustomInfoRow label="Presentase Luka Bakar" :value="`${leftHistoryItem.data.persentaseLuka || '0'} %`" />
                    <CustomInfoRow label="LPT" :value="`${leftHistoryItem.data.lpt || '0'} M²`" />
                    <hr class="border-grey-200" />
                    <CustomInfoRow label="Petugas Input" :value="leftHistoryItem.data.petugas || '-'" />
                    <CustomInfoRow label="Jam Input" :value="String(epochToDate(leftHistoryItem.data.updatedAt, 'time'))" />
                  </div>
                </template>
              </CustomAccordion>
            </div>
            <div v-else class="text-center text-grey-400 p-4">
              Tidak ada riwayat.
            </div>
          </div>

          <div class="border border-opensimrs-300 mx-[15px]"></div>

          <div>
            <div v-if="rightHistoryItem">
              <CustomAccordion headerClass="bg-opensimrs-50" :initialState="'0'">
                <template #header>
                  <span class="shrink-0 text-sm mr-2 mt-1">                   
                    {{ epochToDate(rightHistoryItem.date, 'date') || "Data Riwayat" }}
                  </span>
                  <div class="flex flex-wrap">                   
                    <CustomChip
                        v-if="getJenisKunjunganLabel(rightHistoryItem)"
                        :label="getJenisKunjunganLabel(rightHistoryItem)"
                        :bgColor="getChipBgColor(rightHistoryItem)"
                        :textColor="getChipTextColor(rightHistoryItem)"
                        customClass="h-5 px-2 text-xs font-semibold border-none shrink-0 mt-1"
                        :showCheckedIcon="false"
                      />
                    <CustomChip
                        v-if="rightHistoryItem.session && getJenisKunjunganLabel(rightHistoryItem) !== 'Rawat Jalan'"
                        :label="`Sesi ${rightHistoryItem.session}`"
                        bgColor="bg-blue-200"
                        textColor="text-blue-800"
                        customClass="h-5 px-2 text-xs font-semibold border-none shrink-0 mt-1"
                        :showCheckedIcon="false"
                      />
                  </div>
                </template>
                <template #content>
                  <Adult
                    v-if="patientData?.patient.gender == 'Male'"
                    :openedData="rightHistoryItem.data"
                    class="w-full mt-4"
                  />
                  <AdultWomen
                    v-else
                    :openedData="rightHistoryItem.data"
                    class="w-full mt-4"
                  />
                  <div class="py-5 flex flex-col gap-[19px]">
                    <CustomInfoRow label="Presentase Luka Bakar" :value="`${rightHistoryItem.data.persentaseLuka || '0'} %`" />
                    <CustomInfoRow label="LPT" :value="`${rightHistoryItem.data.lpt || '0'} M²`" />
                    <hr class="border-grey-200" />
                    <CustomInfoRow label="Petugas Input" :value="rightHistoryItem.data.petugas || '-'" />
                    <CustomInfoRow label="Jam Input" :value="String(epochToDate(rightHistoryItem.data.updatedAt, 'time'))" />
                  </div>
                </template>
              </CustomAccordion>
            </div>
            <div v-else class="text-center text-grey-400 p-4">
              Tidak ada data riwayat selanjutnya.
            </div>
          </div>
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
