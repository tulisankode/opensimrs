<script setup lang="ts">
import { onMounted, ref, watch, type PropType, nextTick, computed } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { isCanvasEmpty } from "./pemeriksaanFisikUtils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { epochToDate } from "@/utils/Helpers";
import { utilsStore } from "@/stores/utils";
import CustomChip from "@/components/Base/CustomChip.vue";


const rekamMedisStore = useRekamMedisStore();
const emit = defineEmits(["editAsesmen"]);
const storeUtils = utilsStore();

const props = defineProps({
  header: { type: String, required: true },
  type: { type: String, required: true },
  method: { type: String, default: "form" },
  openedData: { type: Object as PropType<any>, default: null },
  jenisKelamin: { type: String, default: "Male" },
  rmUuid: { type: String, default: "" },
  sessionUuid: { type: String, default: "" },
  patientData: { type: Object, default: () => ({}) },
  historyKey: { type: String, required: true },
});

const getKeteranganKey = (type: string) => `ket${type.replace(/ /g, "")}`;
const getImageKey = (type: string) => `gambar${type.replace(/ /g, "")}`;

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);
const canvas2 = ref<HTMLCanvasElement | null>(null);
const ctx2 = ref<CanvasRenderingContext2D | null>(null);

const detailCanvas = ref<HTMLCanvasElement | null>(null);
const historyCanvasCurrent = ref<HTMLCanvasElement | null>(null);
const historyCanvasPrevious = ref<HTMLCanvasElement | null>(null);

const historyData = ref<any>(null);
const historyPageIndex = ref(0);
const historyDialog = ref(false);

const filterOptions = ref([
  { name: "Semua", value: "semua" },
  { name: "RJ", value: "rj" },
  { name: "RI", value: "ri" },
  { name: "IGD", value: "igd" },
]);

const isCanvasHasContent = () => {
  if (!canvas.value) return false;
  const ctx = canvas.value.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  const imageData = ctx.getImageData(0, 0, canvas.value.width, canvas.value.height);
  const data = imageData.data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) { 
      return true;
    }
  }
  return false;
};

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

const painting = ref(false);
const isStartPainting = ref(false);
const selectedTool = ref("pencil");
const selectedArrow = ref("");
const colors = ref("e9594c");
const lineWidth = ref(5);
const startX = ref(0);
const startY = ref(0);
const keterangan = ref("");
const keteranganOd = ref("");
const keteranganOs = ref("");
const detailDialog = ref(false);

const getSVG = (svgType: string) => {
  const gender = props.jenisKelamin === "Male" ? "Laki-laki" : "Perempuan";
  const genderSpecific = ["Dada", "Abdomen", "Urogenital", "Muskuloskeletal"];
  const fileName = genderSpecific.includes(svgType) ? `${svgType} - ${gender}` : svgType;
  try {
    return new URL(`../../../assets/images/PhisicalExam/${fileName}.svg`, import.meta.url).href;
  } catch (e) { return ""; }
};

const saveCanvas = () => {
  let tempData: any = {};
  if (!canvas.value) return tempData;
  
  const flagKey = (props.type.charAt(0).toLowerCase() + props.type.slice(1)).replace(/ /g, "");

  if (props.type === "Anterior") {
    tempData.gambarAnterior = canvas.value.toDataURL("image/png");
    tempData.ketOd = keteranganOd.value;
    tempData.ketOs = keteranganOs.value;
  } else {
    const imageKey = getImageKey(props.type);
    const ketKey = getKeteranganKey(props.type);
    const hasImage = isCanvasHasContent(); 
    const dataURL = hasImage ? canvas.value.toDataURL("image/png") : "";
    if (keterangan.value || hasImage) {
      tempData[flagKey] = true;
      tempData[imageKey] = dataURL; 
      tempData[ketKey] = keterangan.value;
    } else {
      tempData[flagKey] = false;
      tempData[imageKey] = "";
      tempData[ketKey] = "";
    }
  }
  return tempData;
};

const showDialogHistory = async () => {
  await fetchHistoryData();
  historyPageIndex.value = 0; 
  historyDialog.value = true;
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


const drawImageOnCanvas = (targetCanvas: HTMLCanvasElement | null, imageUrl: string) => {
  if (!targetCanvas || !imageUrl || isCanvasEmpty(imageUrl)) {
    return;
  }
  const targetCtx = targetCanvas.getContext("2d");
  if (!targetCtx) return;

  const img = new Image();
  img.src = imageUrl;
  img.onload = () => {
    const currentCtx = targetCanvas.getContext("2d");
    if (currentCtx) {
      currentCtx.drawImage(img, 0, 0);
    }
  };
};

const drawHistoryCanvases = () => {
  nextTick(() => {
    const imageKey = getImageKey(props.type);

    const prevCanvas = historyCanvasPrevious.value;
    const prevCtx = prevCanvas?.getContext("2d");
    const currentCanvas = historyCanvasCurrent.value;
    const currentCtx = currentCanvas?.getContext("2d");

    if (prevCtx && prevCanvas) {
      prevCtx.clearRect(0, 0, prevCanvas.width, prevCanvas.height);
    }
    if (currentCtx && currentCanvas) {
      currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
    }

    if (leftHistoryItem.value && leftHistoryItem.value.data) {
      const previousImageUrl = leftHistoryItem.value.data[imageKey] || "";
      drawImageOnCanvas(prevCanvas, previousImageUrl);
    }

    if (rightHistoryItem.value && rightHistoryItem.value.data) {
      const currentImageUrl = rightHistoryItem.value.data[imageKey] || "";
      drawImageOnCanvas(currentCanvas, currentImageUrl);
    }
  });
};

watch(historyDialog, (isVisible) => {
  if (isVisible) {
    drawHistoryCanvases();
  }
});

watch(historyPageIndex, () => {
    if (historyDialog.value) {
        drawHistoryCanvases();
    }
});

const loadImage = () => {
  if (!props.openedData) return;
  const imageKey = getImageKey(props.type);
  const imageUrl = props.openedData[imageKey] || "";
  drawImageOnCanvas(canvas.value, imageUrl);
};


const setFormData = () => {
  if (props.openedData) {
    const ketKey = getKeteranganKey(props.type);
    if (props.type === "Anterior") {
      keteranganOd.value = props.openedData.ketOd || "";
      keteranganOs.value = props.openedData.ketOs || "";
    } else {
      keterangan.value = props.openedData[ketKey] || "";
    }
    loadImage();
  } else {
    keterangan.value = "";
    keteranganOd.value = "";
    keteranganOs.value = "";
    if (canvas.value) {
      const mainCtx = canvas.value.getContext('2d');
      if (mainCtx) mainCtx.clearRect(0,0, canvas.value.width, canvas.value.height);
    };
  }
};

const resetForm = () => {
  keterangan.value = "";
  keteranganOd.value = "";
  keteranganOs.value = "";
  if (ctx.value && canvas.value) {
    ctx.value.clearRect(0, 0, canvas.value.width, canvas.value.height);
  }

  if (ctx2.value && canvas2.value) {
    ctx2.value.clearRect(0, 0, canvas2.value.width, canvas2.value.height);
  }

  isStartPainting.value = false;
  selectedTool.value = "pencil";
  painting.value = false;
};

const checkFilled = () => {
  let hasText = false;
  if (props.type === "Anterior") {
    hasText = !!(keteranganOd.value || keteranganOs.value);
  } else {
    hasText = !!keterangan.value;
  }
  
  let hasImage = false;
  if (canvas.value) {
    const ctx = canvas.value.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.value.width, canvas.value.height);
      const data = imageData.data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) { 
          hasImage = true;
          break;
        }
      }
    }
  }
  
  return hasText || hasImage;
};

const clearCanvas = () => { if (ctx.value && canvas.value) ctx.value.clearRect(0, 0, canvas.value.width, canvas.value.height); };
const startPainting = (e: MouseEvent) => { if (!isStartPainting.value || !ctx.value) return; ctx.value.globalCompositeOperation = selectedTool.value === "eraser" ? "destination-out" : "source-over"; if (selectedTool.value.includes("arrow-")) { drawArrow(e); } else { painting.value = true; ctx.value.strokeStyle = `#${colors.value}`; startX.value = e.offsetX; startY.value = e.offsetY; } };
const finishedPainting = (e: MouseEvent) => { if (!isStartPainting.value || !ctx.value || !ctx2.value || !canvas2.value) return; ctx.value.beginPath(); if (selectedTool.value === "line") { ctx.value.moveTo(startX.value, startY.value); ctx.value.lineTo(e.offsetX, e.offsetY); } else if (selectedTool.value === "circle") { const r = Math.sqrt((e.offsetX - startX.value) ** 2 + (e.offsetY - startY.value) ** 2); ctx.value.arc(startX.value, startY.value, r, 0, 2 * Math.PI); } else if (selectedTool.value === "square") { ctx.value.rect(startX.value, startY.value, e.offsetX - startX.value, e.offsetY - startY.value); } ctx.value.stroke(); ctx2.value.clearRect(0, 0, canvas2.value.width, canvas2.value.height); painting.value = false; ctx.value.beginPath(); };
const draw = (e: MouseEvent) => { if (!painting.value || !isStartPainting.value || !ctx.value || !canvas.value) return; const rect = canvas.value.getBoundingClientRect(); ctx.value.lineTo(e.clientX - rect.left, e.clientY - rect.top); ctx.value.stroke(); ctx.value.beginPath(); ctx.value.moveTo(e.clientX - rect.left, e.clientY - rect.top); ctx.value.stroke(); };
const drawing = (e: MouseEvent) => { if (!ctx.value || !ctx2.value) return; ctx.value.lineCap = "round"; ctx.value.strokeStyle = `#${colors.value}`; ctx.value.lineWidth = lineWidth.value; ctx2.value.lineCap = "round"; ctx2.value.strokeStyle = `#${colors.value}`; ctx2.value.lineWidth = lineWidth.value; if (selectedTool.value === "pencil" || selectedTool.value === "eraser") draw(e); };
onMounted(() => { if (canvas.value && canvas2.value) { ctx.value = canvas.value.getContext("2d"); ctx2.value = canvas2.value.getContext("2d"); setFormData(); } });
watch(() => props.openedData, () => setFormData(), { deep: true });
const listTidakAdaHambatanGerak = ref(["arrow-up-left-bold", "arrow-up-bold", "arrow-up-right-bold", "arrow-left-bold", "arrow-right-bold", "arrow-down-left-bold", "arrow-down-bold", "arrow-down-right-bold"]);
const listTerdapatHambatanGerak = ref(["arrow-line-up-left-bold", "arrow-line-up-bold", "arrow-line-up-right-bold", "arrow-line-left-bold", "arrow-line-right-bold", "arrow-line-down-left-bold", "arrow-line-down-bold", "arrow-line-right-bold"]);
const listTidakDapatGerak = ref(["arrow-T-line-up-left-bold", "arrow-T-line-up-bold", "arrow-T-line-up-right-bold", "arrow-T-line-left-bold", "arrow-T-line-right-bold", "arrow-T-line-down-left-bold", "arrow-T-line-down-bold", "arrow-T-line-down-right-bold"]);
const getArrowSVG = (path: string, svg: string) => new URL(`../../../assets/icons/medical-record/pemeriksaan-mata/${path}/${svg}.svg`, import.meta.url).href;
const drawArrow = async (e: MouseEvent) => { const svgPath = getArrowSVG(selectedArrow.value, selectedTool.value); const response = await fetch(svgPath); let svgData = await response.text(); svgData = svgData.replace(/stroke="black"|fill="black"/g, (match) => match.includes("stroke") ? `stroke="#${colors.value}"` : `fill="#${colors.value}"`); const img = new Image(); img.src = URL.createObjectURL(new Blob([svgData], { type: "image/svg+xml" })); img.onload = () => { if (canvas.value && ctx.value) { const rect = canvas.value.getBoundingClientRect(); ctx.value.drawImage(img, e.clientX - rect.left - 18, e.clientY - rect.top - 18); } }; };
const accordion = ref<any>(null);
const open = () => accordion.value?.open();
const close = () => accordion.value?.close();
defineExpose({ open, close, saveCanvas, props, resetForm, checkFilled });

watch(detailDialog, (isVisible) => {
  if (isVisible) {
    nextTick(() => {
      if (detailCanvas.value) {
        const imageKey = getImageKey(props.type);
        const imageUrl = props.openedData?.[imageKey] || "";
        drawImageOnCanvas(detailCanvas.value, imageUrl);
      }
    });
  }
});
</script>

<template>
  <div>
    <CustomAccordion ref="accordion" headerClass="bg-opensimrs-50">
      <template #header>{{ header }}</template>
      <template #content>
        <div v-if="method == 'form'" class="flex flex-col">
          <CustomButton @click="showDialogHistory" class="!rounded-md my-[10px] ml-auto" label="Riwayat Pemeriksaan" size="small" icon="PhClockCounterClockwise" />
          <hr class="mb-[30px]" />
        </div>
        <div v-if="method == 'form'" class="flex pt-5">
          <div class="relative h-[400px] w-[800px]">
            <img :src="getSVG(type)" class="w-full h-full object-contain" alt="" />
            <canvas height="400" width="800" ref="canvas" class="absolute top-0 left-0 z-10 w-full"></canvas>
            <canvas height="400" width="800" @mousedown="startPainting" @mouseup="finishedPainting" @mousemove="drawing" ref="canvas2" class="absolute top-0 left-0 z-20 w-full border-2 border-opensimrs-75 rounded-[10px]" :class="[isStartPainting ? 'cursor-crosshair' : 'cursor-default']"></canvas>
          </div>
          <div class="px-[30px] grow">
            <CustomButton @click="isStartPainting = true" class="w-full mb-[10px]" icon="PhPaintBrush" label="Mulai Menggambar" :disabled="isStartPainting" />
            <div v-if="isStartPainting">
              <div class="grid grid-cols-[13%_13%_13%_13%_13%_13%_22%] h-[54px] bg-opensimrs-50 rounded-[10px] mb-[10px]">
                <div @click="selectedTool = 'pencil'" class="p-2 m-auto rounded-full cursor-pointer" :class="{ 'bg-opensimrs-75': selectedTool == 'pencil' }"><PhPencilSimple :size="25" color="#000000" weight="fill" /></div>
                <div @click="selectedTool = 'eraser'" class="p-2 m-auto rounded-full cursor-pointer" :class="{ 'bg-opensimrs-75': selectedTool == 'eraser' }"><PhEraser :size="25" color="#000000" weight="fill" /></div>
                <div @click="selectedTool = 'line'" class="p-2 m-auto rounded-full cursor-pointer" :class="{ 'bg-opensimrs-75': selectedTool == 'line' }"><PhLineVertical :size="25" color="#000000" weight="bold" /></div>
                <div @click="selectedTool = 'circle'" class="p-2 m-auto rounded-full cursor-pointer" :class="{ 'bg-opensimrs-75': selectedTool == 'circle' }"><PhCircle :size="25" color="#000000" weight="bold" /></div>
                <div @click="selectedTool = 'square'" class="p-2 m-auto rounded-full cursor-pointer" :class="{ 'bg-opensimrs-75': selectedTool == 'square' }"><PhSquare :size="25" color="#000000" weight="bold" /></div>
                <ColorPicker class="m-auto" v-model="colors" />
                <Slider v-model="lineWidth" :min="0" :max="20" class="h-[10px] my-auto" :dt="{ handleContentWidth: '25px', handleContentHeight: '25px', handleWidth: '25px', handleHeight: '25px', handleContentBackground: 'rgb(var(--opensimrs-300))' }" pt:root="rounded-lg" pt:range="rounded-lg bg-opensimrs-300" />
              </div>
              <div v-if="type == 'Oftalmologis'">
                <div class="font-semibold text-normal">Tidak Ada Hambatan Gerak</div>
                <div class="grid grid-cols-8 h-[54px] bg-opensimrs-50 rounded-[10px] mb-[10px]">
                  <div v-for="(list, index) in listTidakAdaHambatanGerak" @click="selectedTool = list; selectedArrow = 'TidakAdaHambatanGerak'" class="p-2 m-auto rounded-full cursor-pointer" :class="{ 'bg-opensimrs-75': selectedTool == list }" :key="`${list}-${index}`"><img :src="getArrowSVG('TidakAdaHambatanGerak', list)" alt="" /></div>
                </div>
                <div class="font-semibold text-normal">Terdapat Hambatan Gerak</div>
                <div class="grid grid-cols-8 h-[54px] bg-opensimrs-50 rounded-[10px] mb-[10px]">
                  <div v-for="(list, index) in listTerdapatHambatanGerak" @click="selectedTool = list; selectedArrow = 'TerdapatHambatanGerak'" class="p-2 m-auto rounded-full cursor-pointer" :class="{ 'bg-opensimrs-75': selectedTool == list }" :key="`${list}-${index}`"><img :src="getArrowSVG('TerdapatHambatanGerak', list)" alt="" /></div>
                </div>
                <div class="font-semibold text-normal">Tidak Dapat Gerak</div>
                <div class="grid grid-cols-8 h-[54px] bg-opensimrs-50 rounded-[10px] mb-[10px]">
                  <div v-for="(list, index) in listTidakDapatGerak" @click="selectedTool = list; selectedArrow = 'TidakDapatGerak'" class="p-2 m-auto rounded-full cursor-pointer" :class="{ 'bg-opensimrs-75': selectedTool == list }" :key="`${list}-${index}`"><img :src="getArrowSVG('TidakDapatGerak', list)" alt="" /></div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-[10px]">
                <CustomButton @click="clearCanvas" class="w-full mb-[10px]" label="Reset" outlined borderColor="border-grey-200" textColor="text-grey-300" />
                <CustomButton @click="isStartPainting = false; selectedTool = 'pencil'" class="w-full mb-[10px]" label="Selesai" />
              </div>
            </div>
            <div v-if="type == 'Anterior'">
              <CustomTextArea v-model="keteranganOd" label="Keterangan Oculus Dextra" class="mt-[30px]" placeholder="Keterangan oculus dextra" height="h-10" />
              <CustomTextArea v-model="keteranganOs" label="Keterangan Oculus Sinistra" class="mt-[30px]" placeholder="Keterangan oculus sinistra" height="h-10" />
            </div>
            <CustomTextArea v-else-if="type != 'Posterior' && type != 'Oftalmologis'" v-model="keterangan" :label="'Keterangan ' + header" class="mt-[30px]" :placeholder="'Keterangan ' + header.toLowerCase()" height="h-10" />
          </div>
        </div>
        <div v-if="props.method == 'detail'" class="py-5 flex flex-col gap-[19px]">
          <CustomInfoRow 
            :label="`Tanda Pada Gambar`" 
            :value="openedData && openedData[getImageKey(props.type)] ? 'Ada' : 'Tidak Ada'" 
          />
          <div v-if="type == 'Anterior'">
            <CustomInfoRow label="Keterangan Oculus Dextra" :value="openedData?.ketOd || '-'" class="mb-[19px]" />
            <CustomInfoRow label="Keterangan Oculus Sinistra" :value="openedData?.ketOs || '-'" />
          </div>
          <CustomInfoRow v-else-if="type != 'Posterior' && type != 'Oftalmologis'" :label="`Keterangan ${type}`" :value="openedData?.[getKeteranganKey(props.type)] || '-'" />
          <hr class="border-grey-200" />
          <CustomInfoRow label="Petugas Input" :value="openedData?.petugas || '-'" />
          <CustomInfoRow label="Jam Input" :value="String(epochToDate(openedData?.updatedAt ?? 0, 'time')) || '-'" />
        </div>
      </template>
      <template v-if="method != 'form'" #footer>
        <div class="flex justify-between">
          <CustomButton @click="detailDialog = true" label="Detail" icon="DetailIcon" />
          <CustomButton v-if="type != 'Oftalmologis' && type != 'Anterior' && type != 'Posterior'" label="Edit" @click="emit('editAsesmen')" />
        </div>
      </template>
    </CustomAccordion>

    <CustomDialog v-model:visible="detailDialog" width="840px">
      <template #header>Detail Pemeriksaan Fisik - {{ type }}</template>
      <template #body>
        <div class="pt-5 relative h-[400px] w-[800px]">
          <img :src="getSVG(type)" alt="" class="w-full h-full object-contain"/>
          <canvas height="400" width="800" ref="detailCanvas" class="absolute top-0 left-0 z-10 w-full"></canvas>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton v-if="type != 'Oftalmologis' && type != 'Anterior' && type != 'Posterior'" label="Edit" @click="emit('editAsesmen')" />
        </div>
      </template>
    </CustomDialog>
    <CustomDialog class="" v-model:visible="historyDialog" width="80%" noScroll>
      <template #header>Pemeriksaan Fisik</template>
      <template #body>
        <div class="pt-5 flex flex-col h-full overflow-hidden">
          <div class="mb-[18px] flex justify-between items-center flex-shrink-0">
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

          <div class="grid grid-cols-[1fr_min-content_1fr] grow overflow-auto gap-x-4">
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
                    <div class="relative h-[400px] w-[800px] mt-4">
                      <img :src="getSVG(type)" alt="" class="w-full h-full object-contain"/>
                      <canvas height="400" width="800" ref="historyCanvasPrevious" class="absolute top-0 left-0 z-10 w-full"></canvas>
                    </div>
                    <div class="py-5 flex flex-col gap-[19px]">
                      <div v-if="type == 'Anterior'">
                        <CustomInfoRow label="Keterangan Oculus Dextra" :value="leftHistoryItem?.data.ketOd || '-'" class="mb-[19px]" />
                        <CustomInfoRow label="Keterangan Oculus Sinistra" :value="leftHistoryItem?.data.ketOs || '-'" />
                      </div>
                      <CustomInfoRow v-else-if="type != 'Posterior' && type != 'Oftalmologis'" :label="`Keterangan ${type}`" :value="leftHistoryItem?.data[getKeteranganKey(props.type)] || '-'" />
                      <hr class="border-grey-200" />
                      <CustomInfoRow label="Petugas Input" :value="leftHistoryItem?.data.petugas || '-'" />
                      <CustomInfoRow label="Jam Input" :value="String(epochToDate(leftHistoryItem.data.updatedAt, 'time'))" />
                    </div>
                  </template>
                </CustomAccordion>
              </div>
              <div v-else class="text-center text-grey-400 p-4">
                Tidak ada riwayat.
              </div>
            </div>

            <div class="border border-opensimrs-300"></div>

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
                    <div class="relative h-[400px] w-[800px] mt-4">
                      <img :src="getSVG(type)" alt="" class="w-full h-full object-contain" />
                      <canvas height="400" width="800" ref="historyCanvasCurrent" class="absolute top-0 left-0 z-10 w-full"></canvas>
                    </div>
                    <div class="py-5 flex flex-col gap-[19px]">
                      <div v-if="type == 'Anterior'">
                        <CustomInfoRow label="Keterangan Oculus Dextra" :value="rightHistoryItem?.data.ketOd || '-'" class="mb-[19px]" />
                        <CustomInfoRow label="Keterangan Oculus Sinistra" :value="rightHistoryItem?.data.ketOs || '-'" />
                      </div>
                      <CustomInfoRow v-else-if="type != 'Posterior' && type != 'Oftalmologis'" :label="`Keterangan ${type}`" :value="rightHistoryItem?.data[getKeteranganKey(props.type)] || '-'" />
                      <hr class="border-grey-200" />
                      <CustomInfoRow label="Petugas Input" :value="rightHistoryItem?.data.petugas || '-'" />
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
        </div>
      </template>
    </CustomDialog>
  </div>
</template>