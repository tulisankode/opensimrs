<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomCanvasDrawer from "../PemeriksaanFisik/CustomCanvasDrawer.vue";
import SkriningMata from "./SkriningMata.vue";
import TemuanLainnya from "./TemuanLainnya.vue";
import { isCanvasEmpty } from "../PemeriksaanFisik/pemeriksaanFisikUtils";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { ref } from "vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import { epochToDate, formatTime } from "@/utils/Helpers";

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();

const emit = defineEmits(["edit", "editAsesmen"]);

const props = defineProps({
  header: {
    type: String,
    default: "Pemeriksaan Mata",
  },
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

const canvasOftalmologis = ref<HTMLCanvasElement | null>(null);
const canvasAnterior = ref<HTMLCanvasElement | null>(null);
const canvasPosterior = ref<HTMLCanvasElement | null>(null);
const skriningMata = ref<any>(null);
const temuanLainnya = ref<any>(null);

const arrRefElement = ref<any[]>([
  canvasOftalmologis,
  canvasAnterior,
  canvasPosterior,
  skriningMata,
  temuanLainnya,
]);

const openFilledCanvas = () => {
  arrRefElement.value.forEach((elementRef) => {
    const component = elementRef.value;
    if (component) {
      let isFilled = false;
      if (typeof component.checkFilled === 'function') {
        isFilled = component.checkFilled();
      } 
      else if (typeof component.checkFilledForm === 'function') {
        isFilled = component.checkFilledForm();
      }
      if (isFilled) {
        component.open();
      } else {
        component.close();
      }
    }
  });
};

const closeAllAccordion = () => {
  arrRefElement.value.forEach((canvasRef) => {
    if (canvasRef.value) {
      (canvasRef.value as any).close();
      if (typeof (canvasRef.value as any).close === "function") {
      }
    }
  });
};

const submitData = () => {
  let tempObjectData: any = {};
  arrRefElement.value.forEach((elementRef) => {
    if (elementRef.value) {
      if (
        (elementRef.value as any).props.type != "skriningMata" &&
        (elementRef.value as any).props.type != "temuanLainnya"
      ) {
        let data = (elementRef.value as any).saveCanvas();
        tempObjectData = { ...tempObjectData, ...data };
      } else {
        let data = (elementRef.value as any).saveData();
        tempObjectData = { ...tempObjectData, ...data };
      }
    }
  });
  return tempObjectData;
};

const onSubmit = async () => {
  try {
    storeUtils.setLoading(true);
    const tempPemeriksaanMataData = submitData();
    const response = await rekamMedisStore.insertAssesment({
      sessionUuid: props.sessionUuid,
      rekamMedisUuid: props.rmUuid,
      isLatest: rekamMedisStore.openedRekamMedis.isLatest,
      key: "pemeriksaan_mata",
      data: tempPemeriksaanMataData,
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

const handleReset = () => {
  arrRefElement.value.forEach((elementRef) => {
    const component = elementRef.value;
    if (component && typeof component.resetForm === 'function') {
      component.resetForm();
    }
  });
};

defineExpose({
  open,
  close,
});
</script>

<template>
  <CustomAccordion headerClass="bg-opensimrs-50">
    <template #header>{{ header }}</template>
    <template #content>
      <div class="pt-5">
        <div v-if="method == 'form'" class="flex justify-end mb-5">
          <div class="flex">
            <CustomButton
              @click="openFilledCanvas"
              class="my-auto !rounded-md ml-5 mx-[10px]"
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
              label="Buka Bagian Yang Sudah Terisi"
              size="small"
              outlined
            />
            <CustomButton
              @click="closeAllAccordion"
              class="my-auto !rounded-md"
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
              label="Tutup Semua"
              size="small"
              outlined
            />
          </div>
        </div>

        <CustomCanvasDrawer
          ref="canvasOftalmologis"
          header="Oftalmologis"
          type="Oftalmologis"
          class="mb-[10px]"
          :method="method"
          :openedData="rekamMedisStore.openedRekamMedis.data.pemeriksaanMata"
          :historyKey="'pemeriksaan_mata'"
          :patientData="patientData"
        />
        <CustomCanvasDrawer
          ref="canvasAnterior"
          header="Anterior"
          type="Anterior"
          class="mb-[10px]"
          :method="method"
          :openedData="rekamMedisStore.openedRekamMedis.data.pemeriksaanMata"
          :historyKey="'pemeriksaan_mata'"
          :patientData="patientData"
        />
        <CustomCanvasDrawer
          ref="canvasPosterior"
          header="Posterior"
          type="Posterior"
          class="mb-[10px]"
          :method="method"
          :openedData="rekamMedisStore.openedRekamMedis.data.pemeriksaanMata"
          :historyKey="'pemeriksaan_mata'"
          :patientData="patientData"
        />
        <SkriningMata
          ref="skriningMata"
          class="mb-[10px]"
          :method="method"
          type="skriningMata"
          :openedData="rekamMedisStore.openedRekamMedis.data.pemeriksaanMata"
          :patientData="props.patientData"
        />
        <TemuanLainnya
          ref="temuanLainnya"
          class="mb-[10px]"
          :method="method"
          type="temuanLainnya"
          :openedData="rekamMedisStore.openedRekamMedis.data.pemeriksaanMata"
          :patientData="props.patientData"
          :rmUuid="rmUuid"
          :sessionUuid="sessionUuid"
        />
        <div class="mt-5 border-t border-grey-200 pt-5">
          <CustomInfoRow
            v-if="props.method == 'detail'"
            label="Petugas Input"
            :value="rekamMedisStore.openedRekamMedis.data.pemeriksaanMata?.petugas ?? '-'"
            class="mb-3"
          />
          <CustomInfoRow
            v-if="props.method == 'detail'"
            label="Jam Input"
            :value="
              rekamMedisStore.openedRekamMedis.data.pemeriksaanMata?.updatedAt
                ? formatTime(
                    epochToDate(
                      rekamMedisStore.openedRekamMedis.data.pemeriksaanMata.updatedAt as number
                    ) as Date
                  )
                : '-'
            "
            class="mb-2"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex items-end justify-end gap-3">
        <CustomButton
          v-if="method == 'form'"
          label="Reset"
          textColor="text-grey-300"
          borderColor="border-2 border-grey-200"
          outlined
          @click="handleReset" 
        />
        <CustomButton
          v-if="method == 'form'"
          @click="onSubmit"
          label="Simpan "
        />
        <CustomButton
          v-if="props.method == 'detail'"
          @click="emit('editAsesmen')"
          label="Edit"
        />
      </div>
    </template>
  </CustomAccordion>
</template>
