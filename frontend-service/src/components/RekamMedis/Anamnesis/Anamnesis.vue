<script lang="ts" setup>
import { ref, onBeforeMount, computed, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import HistoriAnamnesis from "./HistoriAnamnesis.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { epochToDate } from "@/utils/Helpers";
import Checkbox from "primevue/checkbox";

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();

const props = defineProps({
  method: {
    type: String,
    default: "detail",
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

const isEditing = ref(props.method === "form");
const emit = defineEmits(["edit", "submit", "editAsesmen"]);

const anamnesisOption = ref([
  { name: "Auto Anamnesa" },
  { name: "Allo Anamnesa" },
]);

const riwayatPenyakitOption = ref([
  { name: "Hipertensi" },
  { name: "Penyakit Jantung" },
  { name: "Stroke" },
  { name: "TB Paru" },
  { name: "Diabetes Melitus" },
  { name: "Asma" },
  { name: "Lain-lain" },
  { name: "Tidak Ada" },
]);

const schema = toTypedSchema(
  yup.object({
    anamnesis: yup.string(),
    keluhanUtama: yup.string(),
    riwayatPenyakit: yup.string(),
    riwayatPengobatan: yup.string(),
    catatan: yup.string(),
    riwayatKeluarga: yup.array().of(yup.string()),
    pernahDirawat: yup.bool().default(false),
    petugas: yup.string().default("Super Admin"),
    updatedAt: yup.mixed(),
  })
);
const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});
const [anamnesis] = defineField("anamnesis");
const [keluhanUtama] = defineField("keluhanUtama");
const [riwayatPenyakit] = defineField("riwayatPenyakit");
const [riwayatPengobatan] = defineField("riwayatPengobatan");
const [catatan] = defineField("catatan");
const [riwayatKeluarga] = defineField("riwayatKeluarga");
const [pernahDirawat] = defineField("pernahDirawat");
const [petugas] = defineField("petugas");
const [updatedAt] = defineField("updatedAt");

const setFormData = () => {
  if (rekamMedisStore.openedRekamMedis.data.anamnesis) {
    const tempAnamnesis = rekamMedisStore.openedRekamMedis.data.anamnesis;
    const tempArrRiwayatKeluarga = tempAnamnesis.riwayatKeluarga
      ? tempAnamnesis.riwayatKeluarga.trim().split(",")
      : [];
    setValues({
      anamnesis: tempAnamnesis.anamnesis,
      keluhanUtama: tempAnamnesis.keluhanUtama,
      riwayatPenyakit: tempAnamnesis.riwayatPenyakit,
      riwayatPengobatan: tempAnamnesis.riwayatPengobatan,
      catatan: tempAnamnesis.catatan,
      riwayatKeluarga: tempArrRiwayatKeluarga,
      pernahDirawat: tempAnamnesis.pernahDirawat,
      petugas: tempAnamnesis.petugas,
      updatedAt: tempAnamnesis.updatedAt,
    });
  } else resetForm();
};

onBeforeMount(async () => {
  setFormData();
});

const storedRMData = computed(() => rekamMedisStore.openedRekamMedis);
watch(storedRMData, (newRM) => {
  setFormData();
});

const onSubmit = handleSubmit(async (values: any) => {
  try {
    storeUtils.setLoading(true);
    let tempRiwayatKeluarga = values.riwayatKeluarga || [];
    let tempStringRiwayatKeluarga = tempRiwayatKeluarga.join(", ");
    values.riwayatKeluarga = tempStringRiwayatKeluarga;
    delete values.updatedAt;
    const response = await rekamMedisStore.insertAssesment({
      sessionUuid: props.sessionUuid,
      rekamMedisUuid: props.rmUuid,
      isLatest: rekamMedisStore.openedRekamMedis.isLatest,
      key: "anamnesis",
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

const toggleEdit = () => {
  isEditing.value = true;
  emit("edit");
};

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

const fetchHistoryData = async () => {
  try {
    storeUtils.setLoading(true);
    const openedRekamMedis = rekamMedisStore.openedRekamMedis;

    const selectedDate = openedRekamMedis.dates?.find((d: { isSelected: any; }) => d.isSelected)?.date;
    const selectedSessionOrder = openedRekamMedis.sessions?.find((s: { isSelected: any; }) => s.isSelected)?.order;
    const response = await rekamMedisStore.getCompare({
      noPelayanan: props.patientData?.noPelayanan || props.patientData?.no_pelayanan,
      noRm: props.patientData?.patient?.noRm,
      key: "anamnesis",
      jenisKunjungan: selectedFilter.value === 'semua' ? '' : selectedFilter.value,
      dateFilter: selectedDate,
      sessionOrder: selectedSessionOrder,
    });

    if (response && response.payload) {
      historyData.value = response.payload;
      historyPageIndex.value = 0;
    } else {
      historyData.value = null;
    }
  } catch (error) {
    console.error("Gagal mengambil data compare:", error);
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

defineExpose({
  open,
  close,
});
</script>

<template>
  <CustomAccordion headerClass="bg-opensimrs-50" ref="accordion">
    <template #header>Anamnesis</template>
    <template #content>
      <div v-if="isEditing" class="flex flex-col">
        <CustomButton
          @click="showDialogCompare"
          class="!rounded-md my-[10px] ml-auto"
          label="Mode Compare"
          size="small"
          icon="LayoutIcon"
        />
        <hr class="mb-[30px]" />
      </div>
      <div v-if="isEditing" class="grid grid-cols-2 py-5 gap-x-8 gap-y-5">
        <CustomSelect
          v-model="anamnesis"
          label="Anamnesis"
          placeHolder="Pilih Anamnesis"
          :options="anamnesisOption"
          option-label="name"
          option-value="name"
        />
        <CustomTextfield
          v-model="keluhanUtama"
          label="Keluhan Utama"
          placeholder="Keluhan Utama"
        />
        <CustomTextfield
          v-model="riwayatPenyakit"
          label="Riwayat Penyakit"
          placeholder="Riwayat Penyakit"
        />
        <CustomTextfield
          v-model="riwayatPengobatan"
          label="Riwayat Pengobatan (Termasuk Obat Yang Sedang Dikonsumsi)"
          placeholder="Riwayat Pengobatan"
        />
        <div class="flex">
          <div class="basis-2/3">
            <div class="block font-semibold mb-[11px]">
              Riwayat Penyakit Keluarga
            </div>
            <div class="grid grid-flow-col grid-rows-4 gap-4">
              <div
                v-for="category of riwayatPenyakitOption"
                :key="category.name"
                class="flex items-center gap-2.5"
              >
                <Checkbox
                  v-model="riwayatKeluarga"
                  :inputId="category.name"
                  name="category"
                  :value="category.name"
                  :dt="{
                    checkedBackground: 'rgb(var(--opensimrs-300))',
                    checkedHoverBackground: 'rgb(var(--opensimrs-300))',
                    borderColor: '#98A2B3',
                  }"
                />
                <label
                  :for="category.name"
                  class="font-normal text-SM text-grey-400"
                  >{{ category.name }}</label
                >
              </div>
            </div>
          </div>
          <div class="basis-1/3">
            <CustomSwitch v-model="pernahDirawat" label="Pernah Dirawat" />
          </div>
        </div>
        <CustomTextArea
          v-model="catatan"
          label="Catatan"
          placeholder="Catatan"
        />
      </div>
      <div v-else class="py-5 flex flex-col gap-[19px]">
        <CustomInfoRow label="Anamnesis" :value="anamnesis" />
        <CustomInfoRow label="Keluhan Utama" :value="keluhanUtama" />
        <CustomInfoRow label="Riwayat Penyakit" :value="riwayatPenyakit" />
        <CustomInfoRow label="Riwayat Pengobatan" :value="riwayatPengobatan" />
        <CustomInfoRow label="Riwayat Penyakit Keluarga">
          <template #value>
            <span v-if="riwayatKeluarga?.length">
              <span v-for="(penyakit, index) in riwayatKeluarga" :key="index">
                {{ penyakit
                }}<span v-if="index < riwayatKeluarga.length - 1">, </span>
              </span>
            </span>
            <span v-else>Tidak ada riwayat penyakit keluarga</span>
          </template>
        </CustomInfoRow>
        <CustomInfoRow label="Pernah Dirawat" :value="pernahDirawat ? 'Ya' : 'Tidak'" />
        <CustomInfoRow label="Catatan" :value="catatan" />
        <hr class="border-grey-200" />
        <CustomInfoRow label="Petugas Input" :value="petugas" />
        <CustomInfoRow
            label="Jam Input"
            :value="`${epochToDate(updatedAt, 'time')}`"
          />
      </div>

      <CustomDialog
        class=""
        v-model:visible="compareDialog"
        width="80%"
        noScroll
      >
        <template #header>Anamnesis</template>
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
                <HistoriAnamnesis v-if="leftHistoryItem" :history="leftHistoryItem" />
                <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">Tidak ada riwayat.</div>

                <div v-if="rightHistoryItem" class="border border-opensimrs-300"></div>
                
                <HistoriAnamnesis v-if="rightHistoryItem" :history="rightHistoryItem" />
                <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">Tidak ada riwayat.</div>
              </div>
              </div>
            
            <div class="border border-opensimrs-300 mx-[15px]"></div>

            <div class="flex flex-col overflow-hidden">
              <div class="flex flex-col pb-1 overflow-auto gap-y-5 grow">
                <CustomSelect
                  v-model="anamnesis"
                  label="Anamnesis"
                  placeHolder="Pilih Anamnesis"
                  :options="anamnesisOption"
                  option-label="name"
                  option-value="name"
                />
                <CustomTextfield
                  v-model="keluhanUtama"
                  label="Keluhan Utama"
                  placeholder="Keluhan Utama"
                />
                <CustomTextfield
                  v-model="riwayatPenyakit"
                  label="Riwayat Penyakit"
                  placeholder="Riwayat Penyakit"
                />
                <CustomTextfield
                  v-model="riwayatPengobatan"
                  label="Riwayat Pengobatan (Termasuk Obat Yang Sedang Dikonsumsi)"
                  placeholder="Riwayat Pengobatan"
                />
                <div class="flex">
                  <div class="basis-2/3">
                    <div class="block font-semibold mb-[11px]">
                      Riwayat Penyakit Keluarga
                    </div>
                    <div class="grid grid-flow-col grid-rows-4 gap-4">
                      <div
                        v-for="category of riwayatPenyakitOption"
                        :key="category.name"
                        class="flex items-center gap-2.5"
                      >
                        <Checkbox
                          v-model="riwayatKeluarga"
                          :inputId="category.name"
                          name="category"
                          :value="category.name"
                          :dt="{
                            checkedBackground: 'rgb(var(--opensimrs-300))',
                            checkedHoverBackground: 'rgb(var(--opensimrs-300))',
                            borderColor: '#98A2B3',
                          }"
                        />
                        <label
                          :for="category.name"
                          class="font-normal text-SM text-grey-400"
                          >{{ category.name }}</label
                        >
                      </div>
                    </div>
                  </div>
                  <div class="basis-1/3">
                    <CustomSwitch
                      v-model="pernahDirawat"
                      label="Pernah Dirawat"
                    />
                  </div>
                </div>
                <CustomTextArea
                  v-model="catatan"
                  label="Catatan"
                  placeholder="Catatan"
                />
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex items-end justify-end gap-3">
            <CustomButton
              v-if="props.method == 'form'"
              @click="resetForm"
              label="Reset"
              textColor="text-grey-300"
              backgroundColor="bg-transparent"
              borderColor="border-2 border-grey-200"
            />
            <CustomButton v-if="isEditing" label="Simpan" @click="onSubmit" />
            <CustomButton
              v-if="!isEditing"
              label="Edit"
              @click="emit('editAsesmen')"
            />
          </div>
        </template>
      </CustomDialog>
    </template>
    <template #footer>
      <div class="flex items-end justify-end gap-3">
        <CustomButton
          v-if="isEditing"
          @click="resetForm"
          label="Reset"
          textColor="text-grey-300"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-grey-200"
        />
        <CustomButton v-if="isEditing" label="Simpan" @click="onSubmit" />
        <CustomButton v-else label="Edit" @click="emit('editAsesmen')" />
      </div>
    </template>
  </CustomAccordion>
</template>