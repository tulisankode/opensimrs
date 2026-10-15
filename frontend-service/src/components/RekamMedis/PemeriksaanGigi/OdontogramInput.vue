<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import { useItemGigiStore } from "@/stores/datamaster/itemGigi";
import { useToast } from "primevue/usetoast";

const props = defineProps({
  method: {
    type: String,
    default: "form",
  },
});

const itemGigiStore = useItemGigiStore();
const toast = useToast();

const imgTooth1 = new Image();
imgTooth1.src = new URL("@/assets/images/Odontogram/teeth1.svg", import.meta.url).href;

const imgTooth2 = new Image();
imgTooth2.src = new URL("@/assets/images/Odontogram/teeth2.svg", import.meta.url).href;

const imgTooth3 = new Image();
imgTooth3.src = new URL("@/assets/images/Odontogram/teeth3.svg", import.meta.url).href;

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

const selectedTeeth = ref<number[]>([]);
const diagnosisOptions = ref<any[]>([]); 
const selectedDiagnoses = ref<string[]>([]);

const fetchDiagnosisOptions = async () => {
  try {
    const response = await itemGigiStore.getApi(1, 100);
    
    if (response && response.payload) {
      diagnosisOptions.value = response.payload;
    }
  } catch (error) {
    console.error("Gagal mengambil data diagnosa gigi:", error);
  }
};

watch(diagnosisOptions, () => {
  nextTick(() => {
    resizeCanvas();
  });
}, { deep: true });

const itemsOdontogram = ref<{ noGigi: number; keadaanGigi: string[] }[]>([]);

const getImagesForTooth = (toothLabel: number) => {
  const savedTooth = itemsOdontogram.value.find((item) => item.noGigi === toothLabel);
  if (!savedTooth) return [];
  const images: string[] = [];
  savedTooth.keadaanGigi.forEach((diagnosaName) => {
    const option = diagnosisOptions.value.find((opt) => opt.name === diagnosaName);
    if (option && option.image) {
      images.push(option.image);
    }
  });
  return images;
};

const dynamicLabel = computed(() => {
  if (selectedTeeth.value.length === 0) {
    return "Gigi No.";
  }
  return `Gigi No. ${[...selectedTeeth.value].sort((a, b) => a - b).join(", ")}`;
});

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
    const index = selectedTeeth.value.indexOf(clickedTooth.label);
    if (index > -1) {
      selectedTeeth.value.splice(index, 1);
      toast.add({ 
        severity: 'info', 
        summary: 'Info', 
        detail: `Gigi No. ${clickedTooth.label} dibatalkan`, 
        life: 1000 
      });
    } else {
      selectedTeeth.value.push(clickedTooth.label);
      toast.add({ 
        severity: 'success', 
        summary: 'Terpilih', 
        detail: `Gigi No. ${clickedTooth.label} dipilih`, 
        life: 1000 
      });
    }
  }
};
const addDiagnosis = () => {
  if (
    selectedTeeth.value.length === 0 ||
    selectedDiagnoses.value.length === 0
  ) {
    toast.add({ 
        severity: 'warn', 
        summary: 'Peringatan', 
        detail: 'Silakan pilih nomor gigi dan keadaannya terlebih dahulu.', 
        life: 3000 
    });
    return;
  }

  selectedTeeth.value.forEach((toothNumber) => {
    const existingIndex = itemsOdontogram.value.findIndex(i => i.noGigi === toothNumber);
    
    if (existingIndex !== -1) {
       const currentDiagnoses = itemsOdontogram.value[existingIndex].keadaanGigi;
       const newDiagnoses = [...selectedDiagnoses.value];
       itemsOdontogram.value[existingIndex].keadaanGigi = [...new Set([...currentDiagnoses, ...newDiagnoses])];
    } else {
       itemsOdontogram.value.push({
        noGigi: toothNumber,
        keadaanGigi: [...selectedDiagnoses.value],
      });
    }
  });

  itemsOdontogram.value.sort((a, b) => a.noGigi - b.noGigi);

  selectedTeeth.value = [];
  selectedDiagnoses.value = [];
  resizeCanvas();
};

const removeDiagnosis = (index: number) => {
  itemsOdontogram.value.splice(index, 1);
  resizeCanvas();
};

const setData = (data: { noGigi: number; keadaanGigi: string[] }[]) => {
  itemsOdontogram.value = data || [];
  nextTick(() => resizeCanvas());
};

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

  let imgToUse = imgTooth1;
  if (tooth1.includes(label)) {
    imgToUse = imgTooth1;
  } else if (tooth2.includes(label)) {
    imgToUse = imgTooth2;
  } else if (tooth3.includes(label)) {
    imgToUse = imgTooth3;
  }

  const doDraw = () => {
    ctx.drawImage(imgToUse, x, y, toothWidth, toothHeight);

    ctx.font = `${10 * scale}px Arial`;
    ctx.fillStyle = "#000";
    ctx.fillText(
      label.toString(),
      x + toothWidth / 2 - 6 * scale,
      y + toothHeight / 2 - 25 * scale
    );
  };

  if (imgToUse.complete) {
    doDraw();
  } else {
    imgToUse.onload = doDraw;
  }

  teethPositions.value.push({
    x,
    y,
    width: toothWidth,
    height: toothHeight,
    label,
  });
};

const drawSymbol = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  imageBase64: string,
  scale: number
) => {
  const symbolWidth = 40 * scale;
  const symbolHeight = 40 * scale;
  let img = new Image();
  img.src = imageBase64;
  
  img.onload = () => {
    ctx.drawImage(img, x, y, symbolWidth, symbolHeight);
  };
};

const drawOdontogram = (ctx: CanvasRenderingContext2D, scale: number) => {
  const startX = 10 * scale;
  const startY = 20 * scale;
  const upperTeeth = [
    { x: 0, y: 0, label: 18, symbol: [] }, { x: 40, y: 0, label: 17, symbol: [] },
    { x: 80, y: 0, label: 16, symbol: [] }, { x: 120, y: 0, label: 15, symbol: [] },
    { x: 160, y: 0, label: 14, symbol: [] }, { x: 200, y: 0, label: 13, symbol: [] },
    { x: 240, y: 0, label: 12, symbol: [] }, { x: 280, y: 0, label: 11, symbol: [] },
    { x: 320, y: 0, label: 21, symbol: [] }, { x: 360, y: 0, label: 22, symbol: [] },
    { x: 400, y: 0, label: 23, symbol: [] }, { x: 440, y: 0, label: 24, symbol: [] },
    { x: 480, y: 0, label: 25, symbol: [] }, { x: 520, y: 0, label: 26, symbol: [] },
    { x: 560, y: 0, label: 27, symbol: [] }, { x: 600, y: 0, label: 28, symbol: [] },
  ];
  const middleUpperTeeth = [
    { x: 120, y: 60, label: 55, symbol: [] }, { x: 160, y: 60, label: 54, symbol: [] },
    { x: 200, y: 60, label: 53, symbol: [] }, { x: 240, y: 60, label: 52, symbol: [] },
    { x: 280, y: 60, label: 51, symbol: [] }, { x: 320, y: 60, label: 61, symbol: [] },
    { x: 360, y: 60, label: 62, symbol: [] }, { x: 400, y: 60, label: 63, symbol: [] },
    { x: 440, y: 60, label: 64, symbol: [] }, { x: 480, y: 60, label: 65, symbol: [] },
  ];
  const middleLowerTeeth = [
    { x: 120, y: 120, label: 85, symbol: [] }, { x: 160, y: 120, label: 84, symbol: [] },
    { x: 200, y: 120, label: 83, symbol: [] }, { x: 240, y: 120, label: 82, symbol: [] },
    { x: 280, y: 120, label: 81, symbol: [] }, { x: 320, y: 120, label: 71, symbol: [] },
    { x: 360, y: 120, label: 72, symbol: [] }, { x: 400, y: 120, label: 73, symbol: [] },
    { x: 440, y: 120, label: 74, symbol: [] }, { x: 480, y: 120, label: 75, symbol: [] },
  ];
  const lowerTeeth = [
    { x: 0, y: 180, label: 48, symbol: [] }, { x: 40, y: 180, label: 47, symbol: [] },
    { x: 80, y: 180, label: 46, symbol: [] }, { x: 120, y: 180, label: 45, symbol: [] },
    { x: 160, y: 180, label: 44, symbol: [] }, { x: 200, y: 180, label: 43, symbol: [] },
    { x: 240, y: 180, label: 42, symbol: [] }, { x: 280, y: 180, label: 41, symbol: [] },
    { x: 320, y: 180, label: 31, symbol: [] }, { x: 360, y: 180, label: 32, symbol: [] },
    { x: 400, y: 180, label: 33, symbol: [] }, { x: 440, y: 180, label: 34, symbol: [] },
    { x: 480, y: 180, label: 35, symbol: [] }, { x: 520, y: 180, label: 36, symbol: [] },
    { x: 560, y: 180, label: 37, symbol: [] }, { x: 600, y: 180, label: 38, symbol: [] },
  ];

  teethPositions.value = [];
  const allTeeth = [
    ...upperTeeth, ...middleUpperTeeth, ...middleLowerTeeth, ...lowerTeeth,
  ];
  allTeeth.forEach((tooth) => {
    drawTooth(ctx, (startX + tooth.x) * scale, (startY + tooth.y) * scale, tooth.label, scale);
    const imagesToDraw = getImagesForTooth(tooth.label);
    imagesToDraw.forEach((imgBase64) => {
       drawSymbol(ctx, (startX + tooth.x) * scale, (startY + tooth.y) * scale, imgBase64, scale);
    });
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

onMounted(() => {
  fetchDiagnosisOptions();
  nextTick(() => {
    if (canvas.value) {
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
    }
  });
});

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

const getCanvasImage = () => {
  if (!canvas.value) return "";
  return canvas.value.toDataURL("image/png");
};

const emit = defineEmits(["print"]);

const handlePrint = () => {
  emit("print", {
    image: getCanvasImage(),
    items: itemsOdontogram.value,
  });
};

defineExpose({
  open,
  close,
  itemsOdontogram,
  setData,
  getCanvasImage,
});
</script>

<template>
  <CustomAccordion ref="accordion" headerClass="bg-opensimrs-50" initialState="0" @open="
    nextTick(() => {
      resizeCanvas();
    })
  ">
    <template #header>Odontogram</template>
    <template #content>
      <div class="pt-5">
        <div v-if="
          method == 'form' || method == 'detail-gigi' || method == 'print'
        " class="border-2 border-opensimrs-75 rounded-[10px]">
          <canvas ref="canvas" @click="handleClick"></canvas>
        </div>
        <div v-if="method == 'form'">
          <div class="flex mt-5">
            <CustomMultiSelect 
              v-model="selectedDiagnoses" 
              :options="diagnosisOptions" 
              option-label="name" 
              option-value="name" 
              :label="dynamicLabel" 
              class="grow mr-[30px]" 
              placeholder="Pilih Keadaan Gigi" 
            />
            <CustomButton @click="addDiagnosis" class="mt-auto w-28" icon="PhPlus" label="Tambah" />
          </div>
        </div>
        <DataTable :value="itemsOdontogram" class="mt-5" tableStyle="" scrollable scrollHeight="flex"
          :pt="{ headerRow: 'text-SM' }">
          <Column field="nomor" headerClass="bg-opensimrs-50" headerStyle="width: 120px">
            <template #header>
              <div class="w-full font-semibold text-center">No. Gigi</div>
            </template>
            <template #body="slotProps">
              <div class="text-center">
                <div class="text-SM">
                  {{ slotProps.data.noGigi }}
                </div>
              </div>
            </template>
          </Column>
          <Column field="keadaanGigi" header="Keadaan Gigi" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="flex flex-wrap gap-2">
                <CustomChip v-for="condition in slotProps.data.keadaanGigi" :key="condition" :label="condition"
                  :show-checked-icon="false" bg-color="bg-opensimrs-300" borderColor="border-none"
                  text-color="text-white" />
              </div>
            </template>
          </Column>
          <Column v-if="method == 'form'" field="action" headerClass="bg-opensimrs-50" headerStyle="width: 85px">
            <template #header>
              <div class="w-full font-semibold text-center">Action</div>
            </template>
            <template #body="slotProps">
              <div class="flex justify-center">
                <CustomButton @click="removeDiagnosis(slotProps.index)" icon="PhTrash" label="" class="h-[30px]"
                  backgroundColor="bg-danger-300" size="small" />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
    <template #footer v-if="method == 'print'">
      <div class="flex justify-end">
        <CustomButton @click="handlePrint" icon="PhPrinter" label="Cetak Hasil" />
      </div>
    </template>
  </CustomAccordion>
</template>