<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { epochToDate } from "@/utils/Helpers";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import OdontogramInput from "./OdontogramInput.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import HistoriOdontogram from "@/components/RekamMedis/PemeriksaanGigi/HistoriOdontogram.vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import CustomChip from "@/components/Base/CustomChip.vue";
import { useOklusiGigiStore } from "@/stores/datamaster/oklusiGigi";

const props = defineProps({
  header: {
    type: String,
    default: "Pemeriksaan Gigi",
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
    default: null,
  },
});

const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();
const oklusiGigiStore = useOklusiGigiStore();

const listOklusi = ref([]);
const detailDialog = ref(false);
const isHistoryDetail = ref(false);

const showCurrentDetail = () => {
  isHistoryDetail.value = false;
  setFormData();
  detailDialog.value = true;
};


const fetchOklusiData = async () => {
  try {
    const response = await oklusiGigiStore.getApi(1, 9999);
    if (response && response.payload) {
      listOklusi.value = response.payload;
    }
  } catch (error) {
    console.error("Gagal mengambil data Oklusi Gigi:", error);
  }
};

const odontogramInputRef = ref<InstanceType<typeof OdontogramInput> | null>(
  null
);

const odontogramItemsForDetail = ref<{ noGigi: number; keadaanGigi: string[] }[]>(
  []
);

const odontogramDetailRef = ref<InstanceType<typeof OdontogramInput> | null>(null);

watch(detailDialog, (isVisible) => {
  if (isVisible) {
    nextTick(() => {
      if (odontogramDetailRef.value) {
        odontogramDetailRef.value.setData(odontogramItemsForDetail.value);
      }
    });
  }
});

const listTorusPalatinus = ref([
  { code: "OV000074", tampilan: "Tidak Ada" },
  { code: "OV000075", tampilan: "Kecil" },
  { code: "OV000076", tampilan: "Sedang" },
  { code: "OV000077", tampilan: "Besar" },
  { code: "OV000078", tampilan: "Multiple" },
]);
const listTorusMandibularis = ref([
  { code: "OV000079", tampilan: "Tidak Ada" },
  { code: "OV000080", tampilan: "Sisi Kiri" },
  { code: "OV000081", tampilan: "Sisi Kanan" },
  { code: "OV000082", tampilan: "Kedua Sisi" },
]);
const listPalatum = ref([
  { code: "OV000083", tampilan: "Dalam" },
  { code: "OV000084", tampilan: "Sedang" },
  { code: "OV000085", tampilan: "Rendah" },
]);
const listFrenulumLabialisLingualis = ref([
  { tampilan: "Normal" },
  { tampilan: "Tinggi" },
  { tampilan: "Rendah" },
]);

const schema = toTypedSchema(
  yup.object({
    oklusiGigiUuid: yup.string(),
    torusPalatinus: yup.string(),
    torusMandibularis: yup.string(),
    palatum: yup.string(),
    diastema: yup.bool().default(false),
    diastemaKeterangan: yup.string().nullable(),
    gigiAnomali: yup.bool().default(false),
    gigiAnomaliKet: yup.string().nullable(),
    frenulumLabialis: yup.string(),
    frenulumLingualis: yup.string(),
    gigiDecayed: yup.number().min(0).default(undefined),
    gigiMissing: yup.number().min(0).default(undefined),
    gigiFilled: yup.number().min(0).default(undefined),
    temuanLain: yup.string().nullable(),
    ketTindakanGigi: yup.string().nullable(),
    petugas: yup.string(),
    updatedAt: yup.mixed(),
  })
);

const { handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const emit = defineEmits(["editAsesmen"]);

const [oklusiGigiUuid] = defineField("oklusiGigiUuid");
const [torusPalatinus] = defineField("torusPalatinus");
const [torusMandibularis] = defineField("torusMandibularis");
const [palatum] = defineField("palatum");
const [diastema] = defineField("diastema");
const [diastemaKeterangan] = defineField("diastemaKeterangan");
const [gigiAnomali] = defineField("gigiAnomali");
const [gigiAnomaliKet] = defineField("gigiAnomaliKet");
const [frenulumLabialis] = defineField("frenulumLabialis");
const [frenulumLingualis] = defineField("frenulumLingualis");
const [gigiDecayed] = defineField("gigiDecayed");
const [gigiMissing] = defineField("gigiMissing");
const [gigiFilled] = defineField("gigiFilled");
const [temuanLain] = defineField("temuanLain");
const [ketTindakanGigi] = defineField("ketTindakanGigi");
const [petugas] = defineField("petugas");
const [updatedAt] = defineField("updatedAt");

const torusPalatinusDisplay = computed(() => {
  const selected = listTorusPalatinus.value.find(
    (item) => item.code === torusPalatinus.value
  );
  return selected ? selected.tampilan : torusPalatinus.value;
});

const torusMandibularisDisplay = computed(() => {
  const selected = listTorusMandibularis.value.find(
    (item) => item.code === torusMandibularis.value
  );
  return selected ? selected.tampilan : torusMandibularis.value;
});

const palatumDisplay = computed(() => {
  const selected = listPalatum.value.find(
    (item) => item.code === palatum.value
  );
  return selected ? selected.tampilan : palatum.value;
});

const onSubmit = handleSubmit(async (values) => {
  delete values.updatedAt;
  try {
    storeUtils.setLoading(true);
    const odontogramData = odontogramInputRef.value?.itemsOdontogram || [];
    const payload = {
      ...values,
      odontogramItems: odontogramData,
    };
    const response = await rekamMedisStore.insertAssesment({
      sessionUuid: props.sessionUuid,
      rekamMedisUuid: props.rmUuid,
      isLatest: rekamMedisStore.openedRekamMedis.isLatest,
      key: "pemeriksaan_gigi",
      data: payload,
    });
    if (response && response.payload) {
      rekamMedisStore.setAsesmentSummaryRekamMedisData(response.payload);
    }
  } catch (error) {
    console.error("Gagal menyimpan data Pemeriksaan Gigi:", error);
  } finally {
    storeUtils.setLoading(false);
  }
});

const setFormData = () => {
  const data = rekamMedisStore.openedRekamMedis.data.pemeriksaanGigi;
  if (data) {
    setValues({
      oklusiGigiUuid: data.oklusiGigiUuid,
      torusPalatinus: data.torusPalatinus,
      torusMandibularis: data.torusMandibularis,
      palatum: data.palatum,
      diastema: data.diastema,
      diastemaKeterangan: data.diastemaKeterangan,
      gigiAnomali: data.gigiAnomali,
      gigiAnomaliKet: data.gigiAnomaliKet,
      frenulumLabialis: data.frenulumLabialis,
      frenulumLingualis: data.frenulumLingualis,
      gigiDecayed: data.gigiDecayed,
      gigiMissing: data.gigiMissing,
      gigiFilled: data.gigiFilled,
      temuanLain: data.temuanLain,
      ketTindakanGigi: data.ketTindakanGigi,
      petugas: data.petugas,
      updatedAt: data.updatedAt,
    });

    const rawItems = data.odontogramItems || [];
    const mappedOdontogramItems = rawItems.map((item: any) => ({
      noGigi: item.noGigi,
      keadaanGigi: item.keadaanGigi || []
    }));

    odontogramItemsForDetail.value = mappedOdontogramItems;

    if (odontogramInputRef.value) {
      odontogramInputRef.value.setData(mappedOdontogramItems);
    }
  } else {
    resetForm();
    odontogramItemsForDetail.value = [];
    if (odontogramInputRef.value) {
      odontogramInputRef.value.setData([]);
    }
  }
};

onMounted(() => {
  setFormData();
  fetchOklusiData();
});

const storedRMData = computed(() => rekamMedisStore.openedRekamMedis);
watch(storedRMData, () => {
  setFormData();
});

const historyDialog = ref(false);
const historyData = ref<any[] | null>(null);
const historyPageIndex = ref(0);
const selectedFilter = ref("semua");

const filterOptions = ref([
  { name: "Semua", value: "semua" },
  { name: "RJ", value: "rj" },
  { name: "RI", value: "ri" },
  { name: "IGD", value: "igd" },
]);

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
      key: "pemeriksaan_gigi",
      dateFilter: selectedDate,
      sessionOrder: selectedSessionOrder,
    });

    if (response && response.payload && response.payload.length > 0) {
      historyData.value = response.payload;
    } else {
      historyData.value = null;
    }
  } catch (error) {
    console.error("Gagal mengambil data perbandingan untuk pemeriksaan gigi:", error);
    historyData.value = null;
  } finally {
    storeUtils.setLoading(false);
  }
};

const showDialogHistory = async () => {
  try {
    await fetchHistoryData();
    historyPageIndex.value = 0; 
  } finally {
    historyDialog.value = true;
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

const handleShowHistoryDetail = (historyData: any) => {
  if (!historyData) return;
  isHistoryDetail.value = true;
  const rawItems = historyData.odontogramItems || [];
  odontogramItemsForDetail.value = rawItems.map((item: any) => ({
    noGigi: item.noGigi,
    keadaanGigi: item.keadaanGigi || []
  }));
  detailDialog.value = true;
};
</script>

<template>
  <div>
    <CustomAccordion headerClass="bg-opensimrs-50" :initialState="initialState">
      <template #header>{{ header }}</template>
      <template #content>
        <div class="pt-5">
          <div v-if="method == 'form'" class="flex flex-col">
            <CustomButton @click="showDialogHistory" class="!rounded-md my-[10px] ml-auto" label="Riwayat Pemeriksaan"
              size="small" icon="PhClockCounterClockwise" />
            <hr class="mb-[30px]" />
          </div>
          <OdontogramInput ref="odontogramInputRef" :method="method" />
          <div v-if="method == 'form'">
            <div class="grid grid-cols-3 gap-x-[30px] gap-y-5 mt-[30px]">
              <CustomSelect 
                v-model="oklusiGigiUuid" 
                label="Oklusi" 
                placeHolder="Pilih Oklusi" 
                class="" 
                optionLabel="display" 
                optionValue="display" 
                :showFilter="true" 
                :options="listOklusi"
              />
              <CustomSelect v-model="torusPalatinus" label="Torus Palatinus" placeHolder="Pilih Torus Palatinus"
                optionLabel="tampilan" optionValue="code" :showFilter="false" :options="listTorusPalatinus" />
              <CustomSelect v-model="torusMandibularis" label="Torus Mandibularis" placeHolder="Pilih Torus Mandibularis"
                optionLabel="tampilan" optionValue="code" :showFilter="false" :options="listTorusMandibularis" />
              <CustomSelect v-model="palatum" label="Palatum" placeHolder="Pilih Palatum" optionLabel="tampilan"
                optionValue="code" :showFilter="false" :options="listPalatum" />
              <CustomSelect v-model="frenulumLabialis" label="Frenulum Labalis" placeHolder="Pilih Frenulum Labalis"
                :showFilter="false" :options="listFrenulumLabialisLingualis" optionLabel="tampilan"
                optionValue="tampilan" />
              <CustomSelect v-model="frenulumLingualis" label="Frenulum Lingualis" placeHolder="Pilih Frenulum Lingualis"
                :showFilter="false" :options="listFrenulumLabialisLingualis" optionLabel="tampilan"
                optionValue="tampilan" />
              <CustomSwitch v-model="diastema" label="Diastema" />
              <CustomTextArea v-if="diastema" v-model="diastemaKeterangan" label="Keterangan Diasterma"
                placeholder="Masukkan Keterangan Diasterma" height="h-10" />
              <CustomSwitch v-model="gigiAnomali" label="Gigi Anomali" />
              <CustomTextArea v-if="gigiAnomali" v-model="gigiAnomaliKet" label="Keterangan Gigi Anomali"
                placeholder="Masukkan Keterangan Gigi Anomali" height="h-10" />
              <div class="grid grid-cols-3 gap-4">
                <CustomInputNumber v-model="gigiDecayed" label="Jml. Gigi Decayed" :min="0" showButtons />
                <CustomInputNumber v-model="gigiMissing" label="Jml. Gigi Missing" :min="0" showButtons />
                <CustomInputNumber v-model="gigiFilled" label="Jml. Gigi Filled" :min="0" showButtons />
              </div>
              <CustomTextArea v-model="temuanLain" label="Temuan Lainnya" placeholder="Masukkan Temuan Lainnya"
                class="col-span-3" />
              <CustomTextArea v-model="ketTindakanGigi" label="Keterangan Tindakan Gigi"
                placeholder="Masukkan Keterangan Tindakan Gigi" class="col-span-3" />
            </div>
          </div>
          <div v-else class="py-5 flex flex-col gap-[19px]">
            <CustomInfoRow label="Oklusi" :value="oklusiGigiUuid" />
            <CustomInfoRow label="Torus Palatinus" :value="torusPalatinusDisplay" />
            <CustomInfoRow label="Torus Mandibularis" :value="torusMandibularisDisplay" />
            <CustomInfoRow label="Palatum" :value="palatumDisplay" />
            <CustomInfoRow label="Frenulum Labialis" :value="frenulumLabialis" />
            <CustomInfoRow label="Frenulum Lingualis" :value="frenulumLingualis" />
            <CustomInfoRow label="Diastema" :value="diastema ? 'Ya' : 'Tidak'" />
            <CustomInfoRow label="Gigi Anomali" :value="gigiAnomali ? 'Ya' : 'Tidak'" />
            <CustomInfoRow label="Jml. Gigi Decayed" :value="gigiDecayed?.toString()" />
            <CustomInfoRow label="Jml. Gigi Missing" :value="gigiMissing?.toString()" />
            <CustomInfoRow label="Jml. Gigi Filled" :value="gigiFilled?.toString()" />
            <CustomInfoRow label="Temuan Lainnya" :value="temuanLain ?? ''" />
            <CustomInfoRow label="Keterangan Tindakan Gigi" :value="ketTindakanGigi ?? ''" />
            <hr class="border-grey-200" />
            <CustomInfoRow label="Petugas Input" :value="petugas" />
            <CustomInfoRow label="Jam Input" :value="updatedAt ? `${epochToDate(updatedAt, 'time')}` : '-'" />
          </div>
        </div>
      </template>
      <template #footer>
        <div v-if="method == 'form'" class="flex items-end justify-end gap-3">
          <CustomButton @click="resetForm" label="Reset" textColor="text-grey-300" borderColor="border-2 border-grey-200"
            outlined />
          <CustomButton @click="onSubmit" label="Simpan" />
        </div>
        <div v-else class="flex justify-between">
          <CustomButton @click="showCurrentDetail" label="Detail" icon="DetailIcon" />
          <CustomButton @click="emit('editAsesmen')" label="Edit" />
        </div>
      </template>
    </CustomAccordion>

    <CustomDialog class="" v-model:visible="detailDialog" width="840px">
      <template #header>Detail Pemeriksaan Gigi - Odontogram</template>
      <template #body>
        <div class="pt-5">
          <OdontogramInput ref="odontogramDetailRef" method="detail-gigi" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton 
          v-if="!isHistoryDetail"
          @click="emit('editAsesmen')"
          label="Edit" />
        </div>
      </template>
    </CustomDialog>
    <CustomDialog class="" v-model:visible="historyDialog" width="80%">
      <template #header>Pemeriksaan Gigi</template>
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
            <HistoriOdontogram 
                :history="leftHistoryItem" 
                :listOklusi="listOklusi"
                @showDetail="handleShowHistoryDetail" 
            />
          </div>

          <div class="border border-opensimrs-300 mx-[15px]"></div>

          <div class="overflow-auto pl-4">
            <HistoriOdontogram 
                :history="rightHistoryItem" 
                :listOklusi="listOklusi"
                @showDetail="handleShowHistoryDetail" 
            />
          </div>
        </div>
      </template>
    </CustomDialog>
  </div>
</template>