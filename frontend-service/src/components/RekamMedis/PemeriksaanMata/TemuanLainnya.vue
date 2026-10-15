<script setup lang="ts">
import { computed, onMounted, ref, watch, type PropType } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import HistoriTemuanLainnya from "@/components/RekamMedis/PemeriksaanMata/HistoriTemuanLainnya.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import CustomSelect from "@/components/Base/CustomSelect.vue";

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();

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
    type: Object,
    default: () => ({}),
  },
  rmUuid: {
    type: String,
    default: "",
  },
  sessionUuid: {
    type: String,
    default: "",
  },
});

const temuanLainnya = ref();
const initialTemuanLainnya = ref();
const compareDialog = ref(false);


const resetData = () => {
  temuanLainnya.value = initialTemuanLainnya.value;
};

const getPayloadData = () => {
  return {
    temuanLainnya: temuanLainnya.value
  };
};

const handleSaveButton = async () => {
  try {
    storeUtils.setLoading(true);
    const dataPayload = getPayloadData(); 
    
    const response = await rekamMedisStore.insertAssesment({
      sessionUuid: props.sessionUuid,
      rekamMedisUuid: props.rmUuid,
      isLatest: rekamMedisStore.openedRekamMedis.isLatest,
      key: "pemeriksaan_mata",
      data: dataPayload,
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
  if (props.openedData) {
    temuanLainnya.value = props.openedData.temuanLainnya;
  } else temuanLainnya.value = undefined;
};

const historyData = ref<Array<any> | null>(null);
const historyPageIndex = ref(0);
const filterOptions = ref([
  { name: "Semua", value: "semua" },
  { name: "RJ", value: "rj" },
  { name: "RI", value: "ri" },
  { name: "IGD", value: "igd" },
]);
const selectedFilter = ref("semua");

const resetForm = () => {
  temuanLainnya.value = undefined;
};

const fetchHistoryData = async () => {
  try {
    storeUtils.setLoading(true);
    const openedRekamMedis = rekamMedisStore.openedRekamMedis;

    const selectedDate = openedRekamMedis.dates?.find((d: { isSelected: any; }) => d.isSelected)?.date;
    const selectedSessionOrder = openedRekamMedis.sessions?.find((s: { isSelected: any; }) => s.isSelected)?.order;
    const response = await rekamMedisStore.getCompare({
      noPelayanan:
        props.patientData?.noPelayanan || props.patientData?.no_pelayanan,
      noRm: props.patientData?.patient?.noRm,
      key: "pemeriksaan_mata",
      jenisKunjungan:
        selectedFilter.value === "semua" ? "" : selectedFilter.value,
      dateFilter: selectedDate,
      sessionOrder: selectedSessionOrder,
    });

    if (response && response.payload) {
      const filteredPayload = response.payload.filter(
        (item: any) => item.data && item.data.temuanLainnya
      );
      historyData.value = filteredPayload.map((item: any) => {
        return {
          jenisKunjungan: item.jenisKunjungan,
          date: item.date,
          ...item.data,
          updatedAt: item.data.updatedAt, 
        };
      });

      historyPageIndex.value = 0; 
    } else {
      historyData.value = null;
    }
  } catch (error) {
    console.error("Gagal mengambil data compare untuk Temuan Lainnya:", error);
    historyData.value = null;
  } finally {
    storeUtils.setLoading(false);
  }
};

const showDialogCompare = async () => {
  await fetchHistoryData();
  compareDialog.value = true;
};

watch(selectedFilter, async (newValue, oldValue) => {
  if (compareDialog.value && newValue !== oldValue) {
    await fetchHistoryData();
  }
});

const leftHistoryItem = computed(() => {
  if (!historyData.value || !historyData.value[historyPageIndex.value])
    return null;
  return historyData.value[historyPageIndex.value];
});

const rightHistoryItem = computed(() => {
  if (!historyData.value || !historyData.value[historyPageIndex.value + 1])
    return null;
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

const storedRMData = computed(() => rekamMedisStore.openedRekamMedis);
watch(storedRMData, (newRM) => {
  setFormData();
});

onMounted(() => {
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
const checkFilled = () => {
  return !!temuanLainnya.value;
};

defineExpose({
  open,
  close,
  saveData: getPayloadData,
  props,
  resetForm,
  checkFilled
});
</script>

<template>
  <CustomAccordion ref="accordion" headerClass="bg-opensimrs-50">
    <template #header>Temuan Lainnya</template>
    <template #content>
      <div class="pt-5">
        <div v-if="method == 'form'" class="flex flex-col">
          <CustomButton
            @click="showDialogCompare"
            class="!rounded-md my-[10px] ml-auto"
            label="Mode Compare"
            size="small"
            icon="LayoutIcon"
          />
          <hr class="mb-[30px]" />
        </div>
        <CustomTextArea
          v-if="method == 'form'"
          v-model="temuanLainnya"
          label="Temuan Lainnya"
          placeholder="Masukkan Temuan Lainnya..."
        />
        <CustomInfoRow v-else label="Temuan Lainnya" :value="temuanLainnya" />
      </div>

      <CustomDialog
        class=""
        v-model:visible="compareDialog"
        width="80%"
        noScroll
      >
        <template #header>Temuan Lainnya</template>
        <template #body>
          <div
            class="pt-5 grid grid-cols-[1fr_min-content_1fr] h-full overflow-auto"
          >
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
                <HistoriTemuanLainnya
                  v-if="leftHistoryItem"
                  :history="leftHistoryItem"
                />
                <div
                  v-else
                  class="text-center text-grey-400 self-start pt-4 whitespace-nowrap"
                >
                  Tidak ada riwayat.
                </div>

                <div
                  v-if="rightHistoryItem"
                  class="border border-opensimrs-300"
                ></div>

                <HistoriTemuanLainnya
                  v-if="rightHistoryItem"
                  :history="rightHistoryItem"
                />
                <div
                  v-else
                  class="text-center text-grey-400 self-start pt-4 whitespace-nowrap"
                >
                  Tidak ada riwayat.
                </div>
              </div>
            </div>
            <div class="border border-opensimrs-300 mx-[15px]"></div>
            <div class="flex flex-col overflow-hidden">
              <div class="flex flex-col pb-1 overflow-auto gap-y-5 grow">
                <CustomTextArea
                  v-model="temuanLainnya"
                  label="Temuan Lainnya"
                  placeholder="Masukkan Temuan Lainnya..."
                />
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex items-end justify-end gap-3">
            <CustomButton
              v-if="method == 'form' || compareDialog"
              label="Reset"
              textColor="text-grey-300"
              backgroundColor="bg-transparent"
              borderColor="border-2 border-grey-200"
              @click="resetData"
            />
            <CustomButton
              v-if="method == 'form' || compareDialog"
              label="Simpan"
              @click="handleSaveButton"
            />
            <CustomButton
              v-if="method == 'detail'"
              label="Edit"
              @click="() => {}"
            />
          </div>
        </template>
      </CustomDialog>
    </template>
  </CustomAccordion>
</template>