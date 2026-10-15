<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { computed, nextTick, ref, watch, type PropType } from "vue";
import { onBeforeUnmount, onMounted } from "vue";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import HistoriOhis from "@/components/RekamMedis/PemeriksaanFisik/HistoriOhis.vue";

// NOTE Store
const rekamMedisStore = useRekamMedisStore();
const storeUtils = utilsStore();

interface ToothCondition {
  debrisIndex?: any;
  calculusIndex?: any;
}

interface OhisItem {
  noGigi: string;
  debrisIndeks?: any;
  kalkulusIndeks?: any;
}

const props = defineProps({
  header: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  method: {
    type: String,
    default: "form",
  },
  openedData: {
    type: Object as PropType<any>,
    default: null,
  },
  rmUuid: { type: String, default: "" },
  sessionUuid: { type: String, default: "" },
  patientData: { type: Object, default: () => ({}) },
  historyKey: { type: String, default: "pemeriksaan_fisik" },
}); 

const canvas = ref<HTMLCanvasElement | null>(null);
const teethPositions = ref<
  {
    x: number;
    y: number;
    width: number;
    height: number;
    label: number;
    diagnosis?: string;
  }[]
>([]);
let originalWidth = 700;
let originalHeight = 300;

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
      key: props.historyKey,
      dateFilter: selectedDate,
      sessionOrder: selectedSessionOrder,
    });
    if (response && response.payload && response.payload.length > 0) {
      historyData.value = response.payload.reverse();
    } else {
      historyData.value = null;
    }
  } catch (error) {
    console.error(`Gagal mengambil data perbandingan untuk key: ${props.historyKey}`, error);
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

const checkFilled = () => {
  return itemsOhis.value.length > 0;
};

const resetForm = () => {
  itemsOhis.value = [];

  totalDebrisIndex.value = 0;
  totalCalculusIndex.value = 0;
  totalOhis.value = 0;
  ohisIntepretation.value = {};

  selectedTooth.value = "18";
  selectedDebrisIndex.value = null;
  selectedKalkulusIndex.value = null;
  resizeCanvas();
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

const previousHistory = () => { if (canGoToPrevious.value) { historyPageIndex.value -= 2; } };
const nextHistory = () => { if (canGoToNext.value) { historyPageIndex.value += 2; } };

const drawTooth = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: number,
  scale: number
) => {
  const tooth1 = [
    16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48, 55, 65, 75, 85,
  ];
  const tooth2 = [14, 15, 24, 25, 34, 35, 44, 45, 54, 64, 84, 74];
  const tooth3 = [
    11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 43, 51, 52, 53, 61, 62, 63, 71,
    72, 73, 81, 82, 83,
  ];
  const toothWidth = 40 * scale;
  const toothHeight = 40 * scale;

  ctx.fillStyle = "#FFF";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  let img = new Image();
  if (tooth1.includes(label)) {
    img.src = new URL(
      "@/assets/images/Odontogram/teeth1.svg",
      import.meta.url
    ).href;
  } else if (tooth2.includes(label)) {
    img.src = new URL(
      "@/assets/images/Odontogram/teeth2.svg",
      import.meta.url
    ).href;
  } else if (tooth3.includes(label)) {
    img.src = new URL(
      "@/assets/images/Odontogram/teeth3.svg",
      import.meta.url
    ).href;
  }
  img.onload = () => {
    ctx.drawImage(img, x, y, toothWidth, toothHeight);
  };

  teethPositions.value.push({
    x,
    y,
    width: toothWidth,
    height: toothHeight,
    label,
  });

  ctx.font = `${10 * scale}px Arial`;
  ctx.fillStyle = "#000";
  ctx.fillText(
    label.toString(),
    x + toothWidth / 2 - 6 * scale,
    y + toothHeight / 2 - 25 * scale
  );
};

const drawOdontogram = (ctx: CanvasRenderingContext2D, scale: number) => {
  const startX = 10 * scale;
  const startY = 20 * scale;

  const upperTeeth = [
    { x: 0, y: 0, label: 18, symbol: [] },
    { x: 40, y: 0, label: 17, symbol: [] },
    { x: 80, y: 0, label: 16, symbol: [] },
    { x: 120, y: 0, label: 15, symbol: [] },
    { x: 160, y: 0, label: 14, symbol: [] },
    { x: 200, y: 0, label: 13, symbol: [] },
    { x: 240, y: 0, label: 12, symbol: [] },
    { x: 280, y: 0, label: 11, symbol: [] },
    { x: 320, y: 0, label: 21, symbol: [] },
    { x: 360, y: 0, label: 22, symbol: [] },
    { x: 400, y: 0, label: 23, symbol: [] },
    { x: 440, y: 0, label: 24, symbol: [] },
    { x: 480, y: 0, label: 25, symbol: [] },
    { x: 520, y: 0, label: 26, symbol: [] },
    { x: 560, y: 0, label: 27, symbol: [] },
    { x: 600, y: 0, label: 28, symbol: [] },
  ];

  const middleUpperTeeth = [
    { x: 120, y: 60, label: 55, symbol: [] },
    { x: 160, y: 60, label: 54, symbol: [] },
    { x: 200, y: 60, label: 53, symbol: [] },
    { x: 240, y: 60, label: 52, symbol: [] },
    { x: 280, y: 60, label: 51, symbol: [] },
    { x: 320, y: 60, label: 61, symbol: [] },
    { x: 360, y: 60, label: 62, symbol: [] },
    { x: 400, y: 60, label: 63, symbol: [] },
    { x: 440, y: 60, label: 64, symbol: [] },
    { x: 480, y: 60, label: 65, symbol: [] },
  ];

  const middleLowerTeeth = [
    { x: 120, y: 120, label: 85, symbol: [] },
    { x: 160, y: 120, label: 84, symbol: [] },
    { x: 200, y: 120, label: 83, symbol: [] },
    { x: 240, y: 120, label: 82, symbol: [] },
    { x: 280, y: 120, label: 81, symbol: [] },
    { x: 320, y: 120, label: 71, symbol: [] },
    { x: 360, y: 120, label: 72, symbol: [] },
    { x: 400, y: 120, label: 73, symbol: [] },
    { x: 440, y: 120, label: 74, symbol: [] },
    { x: 480, y: 120, label: 75, symbol: [] },
  ];

  const lowerTeeth = [
    { x: 0, y: 180, label: 48, symbol: [] },
    { x: 40, y: 180, label: 47, symbol: [] },
    { x: 80, y: 180, label: 46, symbol: [] },
    { x: 120, y: 180, label: 45, symbol: [] },
    { x: 160, y: 180, label: 44, symbol: [] },
    { x: 200, y: 180, label: 43, symbol: [] },
    { x: 240, y: 180, label: 42, symbol: [] },
    { x: 280, y: 180, label: 41, symbol: [] },
    { x: 320, y: 180, label: 31, symbol: [] },
    { x: 360, y: 180, label: 32, symbol: [] },
    { x: 400, y: 180, label: 33, symbol: [] },
    { x: 440, y: 180, label: 34, symbol: [] },
    { x: 480, y: 180, label: 35, symbol: [] },
    { x: 520, y: 180, label: 36, symbol: [] },
    { x: 560, y: 180, label: 37, symbol: [] },
    { x: 600, y: 180, label: 38, symbol: [] },
  ];

  teethPositions.value = [];

  [
    ...upperTeeth,
    ...middleUpperTeeth,
    ...middleLowerTeeth,
    ...lowerTeeth,
  ].forEach((tooth) => {
    drawTooth(
      ctx,
      (startX + tooth.x) * scale,
      (startY + tooth.y) * scale,
      tooth.label,
      scale
    );
  });
};

const resizeCanvas = () => {
  if (!canvas.value) return;

  const ctx = canvas.value.getContext("2d");
  if (!ctx) return;

  const parentWidth = canvas.value.parentElement?.clientWidth || originalWidth;
  const scale = parentWidth / originalWidth;

  canvas.value.width = parentWidth;
  canvas.value.height = originalHeight * scale;

  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
  drawOdontogram(ctx, scale);
};

const handleClick = (event: MouseEvent) => {
  if (!canvas.value) return;

  const rect = canvas.value.getBoundingClientRect();
  const scaleX = canvas.value.width / rect.width;
  const scaleY = canvas.value.height / rect.height;

  const clickX = (event.clientX - rect.left) * scaleX;
  const clickY = (event.clientY - rect.top) * scaleY;

  const clickedTooth = teethPositions.value.find(
    (tooth) =>
      clickX >= tooth.x &&
      clickX <= tooth.x + tooth.width &&
      clickY >= tooth.y &&
      clickY <= tooth.y + tooth.height
  );

  if (clickedTooth) {
    selectedTooth.value = `${clickedTooth.label}`;
    let findOhisIndex = itemsOhis.value.findIndex(
      (ohis: OhisItem) => ohis.noGigi == selectedTooth.value
    );
    if (findOhisIndex == -1) {
      selectedDebrisIndex.value = null;
      selectedKalkulusIndex.value = null;
    } else {
      selectedDebrisIndex.value = itemsOhis.value[findOhisIndex].debrisIndeks;
      selectedKalkulusIndex.value =
        itemsOhis.value[findOhisIndex].kalkulusIndeks;
    }
  }
};

const itemsOhis = ref<OhisItem[]>([]);
const addOhis = () => {
  const tempOhisData: OhisItem = {
    noGigi: selectedTooth.value,
    debrisIndeks: null,
    kalkulusIndeks: null,
  };

  if (selectedDebrisIndex.value) {
    tempOhisData.debrisIndeks = selectedDebrisIndex.value;
  } else tempOhisData.debrisIndeks = null;

  if (selectedKalkulusIndex.value) {
    tempOhisData.kalkulusIndeks = selectedKalkulusIndex.value;
  } else tempOhisData.kalkulusIndeks = null;

  let findOhisIndex = itemsOhis.value.findIndex(
    (ohis: OhisItem) => ohis.noGigi == selectedTooth.value
  );

  if (findOhisIndex == -1) {
    itemsOhis.value.push(tempOhisData);
  } else {
    itemsOhis.value[findOhisIndex] = tempOhisData;
  }

  countIndex();
};
const deleteOhis = (toothNumber: string) => {
  let findOhisIndex = itemsOhis.value.findIndex(
    (ohis: OhisItem) => ohis.noGigi == toothNumber
  );
  if (findOhisIndex != -1) {
    itemsOhis.value.splice(findOhisIndex, 1);
  }
  countIndex();
};

const totalDebrisIndex = ref(0);
const totalCalculusIndex = ref(0);
const totalOhis = ref(0);
const ohisIntepretation = ref<any>({});
const countIndex = () => {
  let tempTotalToothDebris = 0;
  let tempTotalToothCalculus = 0;
  let tempTotalDebrisScore = 0;
  let tempTotalCalculusScore = 0;
  itemsOhis.value.forEach((ohis: OhisItem) => {
    if (ohis.debrisIndeks) {
      tempTotalToothDebris++;
      tempTotalDebrisScore += ohis.debrisIndeks.score;
    }
    if (ohis.kalkulusIndeks) {
      tempTotalToothCalculus++;
      tempTotalCalculusScore += ohis.kalkulusIndeks.score;
    }
  });
  totalDebrisIndex.value = tempTotalDebrisScore
    ? tempTotalDebrisScore / tempTotalToothDebris
    : 0;
  totalCalculusIndex.value = tempTotalCalculusScore
    ? tempTotalCalculusScore / tempTotalToothCalculus
    : 0;
  totalOhis.value = totalDebrisIndex.value + totalCalculusIndex.value;
  if (totalOhis.value >= 0 && totalOhis.value <= 1.2) {
    ohisIntepretation.value = { code: "OI000029", name: "baik" };
  } else if (totalOhis.value >= 1.3 && totalOhis.value <= 3.0) {
    ohisIntepretation.value = { code: "OI000030", name: "sedang/cukup baik" };
  } else if (totalOhis.value >= 3.1 && totalOhis.value <= 6.0) {
    ohisIntepretation.value = { code: "OI000031", name: "buruk" };
  }
};

const selectedTooth = ref("18");
const selectedDebrisIndex = ref();
const selectedKalkulusIndex = ref();

const listDebrisIndex = ref([
  {
    code: "OV000097",
    name: "skor 1 : bila terapat debris pada 1/3 permukaan servikal gigi atau dijumpai stain ekstrinsik",
    score: 1,
  },
  {
    code: "OV000098",
    name: "skor 2 : bila terdapat debris pada 1/3 - 2/3 permukaan gigi",
    score: 2,
  },
  {
    code: "OV000099",
    name: "skor 3 : bila terdapat debris pada > 2/3 permukaan gigi",
    score: 3,
  },
]);
const listKalkulusIndex = ref([
  {
    code: "OV000100",
    name: "skor 1 : bila terdapat kalkulus supragingiva pada 1/3 permukaan servikal gigi tanpa kalkulus subgingiva.",
    score: 1,
  },
  {
    code: "OV000101",
    name: "skor 2 : bila terdapat kalkulus supragingiva pada 1/3 – 2/3 permukaan gigi dan/atau terdapat kalkulus subgingiva berupa titik- titik yang tidak melingkari leher gigi.",
    score: 2,
  },
  {
    code: "OV000102",
    name: "skore 3 : bila terdapat kalkulus supragingiva pada > 2/3 permukaan gigi dan/atau terdapat kalkulus subgingiva yang melingkari leher gigi.",
    score: 3,
  },
]);

const setFormData = () => {
  let tempOhisItem: any[] = [];
  if (props.openedData && props.openedData.ohis) {
    props.openedData.ohis.ohisItem.forEach((ohis: any) => {
      const findedDebrisData = listDebrisIndex.value.find(
        (debrisData: any) => debrisData.score == ohis.debrisIndeks
      );
      if (findedDebrisData) {
        ohis.debrisIndeks = findedDebrisData;
      }
      const findedKalkulusData = listKalkulusIndex.value.find(
        (kalulusData: any) => kalulusData.score == ohis.kalkulusIndeks
      );
      if (findedKalkulusData) {
        ohis.kalkulusIndeks = findedKalkulusData;
      }
      tempOhisItem.push(ohis);
    });
    itemsOhis.value = tempOhisItem;
    totalDebrisIndex.value = props.openedData.ohis.skorDi;
    totalCalculusIndex.value = props.openedData.ohis.skorCi;
    totalOhis.value = props.openedData.ohis.skorTotal;
    if (totalOhis.value >= 0 && totalOhis.value <= 1.2) {
      ohisIntepretation.value = { code: "OI000029", name: "baik" };
    } else if (totalOhis.value >= 1.3 && totalOhis.value <= 3.0) {
      ohisIntepretation.value = { code: "OI000030", name: "sedang/cukup baik" };
    } else if (totalOhis.value >= 3.1 && totalOhis.value <= 6.0) {
      ohisIntepretation.value = { code: "OI000031", name: "buruk" };
    }
  } else {
    itemsOhis.value = tempOhisItem;
    totalDebrisIndex.value = 0;
    totalCalculusIndex.value = 0;
    totalOhis.value = 0;
    ohisIntepretation.value = {};
  }
}

onMounted(() => {
  nextTick(() => {
    if (canvas.value) {
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
    }
  });
  setFormData()
});

const storedRMData = computed(() => rekamMedisStore.openedRekamMedis);
watch(storedRMData, (newRM) => {
  setFormData();
});

const saveOhis = () => {
  const tempOhisItem = itemsOhis.value.map((item: OhisItem) => ({
    noGigi: item.noGigi,
    debrisIndeks: item.debrisIndeks ? item.debrisIndeks.score : null,
    kalkulusIndeks: item.kalkulusIndeks ? item.kalkulusIndeks.score : null,
  }));

  let tempOhis = {
    ohisItem: tempOhisItem,
    skorDi: totalDebrisIndex.value,
    skorCi: totalCalculusIndex.value,
    skorTotal: totalOhis.value,
    interpretasiOhis: ohisIntepretation.value.name ?? "",
  };
  return tempOhis;
};

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeCanvas);
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

defineExpose({
  open,
  close,
  saveOhis,
  props,
  checkFilled,
  resetForm
});
</script>

<template>
  <div> 
    <CustomAccordion
      ref="accordion"
      headerClass="bg-opensimrs-50"
      @open="
        nextTick(() => {
          resizeCanvas();
        })
      "
    >
      <template #header>{{ header }}</template>
      <template #content>
        <div class="pt-5">
          <div v-if="method == 'form'" class="flex flex-col">
            <CustomButton @click="showDialogHistory" class="!rounded-md my-[10px] ml-auto" label="Riwayat Pemeriksaan" size="small" icon="PhClockCounterClockwise" />
            <hr class="mb-[10px]" />
          </div>

          <div class="border-2 border-opensimrs-75 rounded-[10px]">
            <canvas ref="canvas" @click="handleClick"></canvas>
          </div>
          <div
            class="grid grid-cols-[min-content_1fr_min-content] gap-[10px] mt-5"
          >
            <CustomTextfield
              v-model="selectedTooth"
              label="Gigi"
              placeholder="Gigi"
              class="w-14"
              readOnly
            />
            <div class="grid grid-cols-2 gap-[10px] w-full">
              <CustomSelect
                v-model="selectedDebrisIndex"
                label="Debris Index"
                placeHolder="Pilih Debris Index"
                class=""
                optionLabel="name"
                optionValue=""
                :options="listDebrisIndex"
                :showFilter="false"
              />
              <CustomSelect
                v-model="selectedKalkulusIndex"
                label="Kalkulus Index"
                placeHolder="Pilih Kalkulus Index"
                class=""
                optionLabel="name"
                optionValue=""
                :options="listKalkulusIndex"
                :showFilter="false"
              />
            </div>
            <CustomButton
              @click="addOhis()"
              class="mt-auto w-28"
              icon="PhPlus"
              label="Tambah"
              :disabled="!selectedDebrisIndex && !selectedKalkulusIndex"
            />
          </div>
          <DataTable
            :value="itemsOhis"
            class="mt-5"
            tableStyle="min-width: 50rem"
            scrollable
            scrollHeight="flex"
            :pt="{ headerRow: 'text-SM' }"
          >
            <Column field="nomor" headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-semibold text-center">Nomor Gigi</div>
              </template>
              <template #body="slotProps">
                <div class="text-center">
                  <div class="text-SM">{{ slotProps.data.noGigi }}</div>
                </div>
              </template>
            </Column>
            <Column header="Keadaan Gigi" headerClass="bg-opensimrs-50">
              <template #body="slotProps">
                <div class="text-SM">
                  <div
                    v-if="slotProps.data.debrisIndeks"
                    class="grid content-center grid-cols-[100px_min-content_max-content] auto-cols-min"
                  >
                    Debris Indeks
                    <ArrowRightBrokenIcon
                      :size="18"
                      class="text-opensimrs-400 mr-[5px]"
                    />
                    {{ slotProps.data.debrisIndeks.name }}
                  </div>
                  <div
                    v-if="slotProps.data.kalkulusIndeks"
                    class="grid content-center grid-cols-[100px_min-content_max-content] mt-[5px]"
                  >
                    Kalkulus Indeks
                    <ArrowRightBrokenIcon
                      :size="18"
                      class="text-opensimrs-400 mr-[5px]"
                    />
                    {{ slotProps.data.kalkulusIndeks.name }}
                  </div>
                </div>
              </template>
            </Column>
            <Column field="action" headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-semibold text-center">Action</div>
              </template>
              <template #body="slotProps">
                <div class="flex justify-center">
                  <CustomButton
                    @click="deleteOhis(slotProps.data.noGigi)"
                    icon="PhTrash"
                    label=""
                    class="h-[30px]"
                    backgroundColor="bg-danger-300"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
          <div
            class="border-2 border-opensimrs-300 rounded-[10px] grid grid-cols-[1fr_min-content_1fr_min-content_1fr_min-content_1fr] gap-[25px] p-5 mt-5"
          >
            <CustomInputNumber
              v-model="totalDebrisIndex"
              label="Skor Total Debris Indeks"
              placeholder="0"
              class=""
              readOnly
            />
            <PhPlus
              :size="24"
              weight="bold"
              class="mt-auto mb-2 text-opensimrs-300"
            />
            <CustomInputNumber
              v-model="totalCalculusIndex"
              label="Skor Total Kalkulus Indeks"
              placeholder="0"
              class=""
              readOnly
            />
            <PhEquals
              :size="24"
              weight="bold"
              class="mt-auto mb-2 text-opensimrs-300"
            />
            <CustomInputNumber
              v-model="totalOhis"
              label="Skor Total OHIS"
              placeholder="0"
              class=""
              readOnly
            />
            <PhArrowRight
              :size="24"
              weight="bold"
              class="mt-auto mb-2 text-opensimrs-300"
            />
            <CustomTextfield
              v-model="ohisIntepretation.name"
              label="Interpretasi OHIS (Kesimpulan)"
              placeholder="Interpretasi OHIS"
              class=""
              readOnly
            />
          </div>
        </div>
      </template>
    </CustomAccordion>

    <CustomDialog class="" v-model:visible="historyDialog" width="80%">
      <template #header>Riwayat Pemeriksaan OHI-S</template>
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

          <div class="overflow-auto pr-4">
            <HistoriOhis :history="leftHistoryItem" />
          </div>

          <div class="border border-opensimrs-300 mx-[15px]"></div>

          <div class="overflow-auto pl-4">
            <HistoriOhis :history="rightHistoryItem" />
          </div>
        </div>
      </template>
    </CustomDialog>
  </div>
</template>