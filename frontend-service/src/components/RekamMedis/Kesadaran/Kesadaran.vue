<script lang="ts" setup>
import { ref, onBeforeMount, computed, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { epochToDate } from "@/utils/Helpers";

// Import gambar mata
import spontanMeresponOn from "@/assets/images/RekamMedis/Kesadaran/spontanMeresponOn.svg";
import spontanMeresponOff from "@/assets/images/RekamMedis/Kesadaran/spontanMeresponOff.svg";
import responSuaraOn from "@/assets/images/RekamMedis/Kesadaran/responSuaraOn.svg";
import responSuaraOff from "@/assets/images/RekamMedis/Kesadaran/responSuaraOff.svg";
import responNyeriOn from "@/assets/images/RekamMedis/Kesadaran/responNyeriOn.svg";
import responNyeriOff from "@/assets/images/RekamMedis/Kesadaran/responNyeriOff.svg";
import mataTidakResponOn from "@/assets/images/RekamMedis/Kesadaran/mataTidakResponOn.svg";
import mataTidakResponOff from "@/assets/images/RekamMedis/Kesadaran/mataTidakResponOff.svg";

// Import gambar motorik
import mengikutiPerintahOn from "@/assets/images/RekamMedis/Kesadaran/mengikutiPerintahOn.svg";
import mengikutiPerintahOff from "@/assets/images/RekamMedis/Kesadaran/mengikutiPerintahOff.svg";
import melokalisirNyeriOn from "@/assets/images/RekamMedis/Kesadaran/melokalisirNyeriOn.svg";
import melokalisirNyeriOff from "@/assets/images/RekamMedis/Kesadaran/melokalisirNyeriOff.svg";
import fleksiNormalOn from "@/assets/images/RekamMedis/Kesadaran/fleksiNormalOn.svg";
import fleksiNormalOff from "@/assets/images/RekamMedis/Kesadaran/fleksiNormalOff.svg";
import fleksiAbnormalOn from "@/assets/images/RekamMedis/Kesadaran/fleksiAbnormalOn.svg";
import fleksiAbnormalOff from "@/assets/images/RekamMedis/Kesadaran/fleksiAbnormalOff.svg";
import ekstensiAbnormalOn from "@/assets/images/RekamMedis/Kesadaran/ekstensiAbnormalOn.svg";
import ekstensiAbnormalOff from "@/assets/images/RekamMedis/Kesadaran/ekstensiAbnormalOff.svg";
import motorikTidakResponOn from "@/assets/images/RekamMedis/Kesadaran/motorikTidakResponOn.svg";
import motorikTidakResponOff from "@/assets/images/RekamMedis/Kesadaran/motorikTidakResponOff.svg";

// Import gambar verbal
import orientasiBaikOn from "@/assets/images/RekamMedis/Kesadaran/orientasiBaikOn.svg";
import orientasiBaikOff from "@/assets/images/RekamMedis/Kesadaran/orientasiBaikOff.svg";
import bingungBerbicaraOn from "@/assets/images/RekamMedis/Kesadaran/bingungBerbicaraOn.svg";
import bingungBerbicaraOff from "@/assets/images/RekamMedis/Kesadaran/bingungBerbicaraOff.svg";
import tidakJelasOn from "@/assets/images/RekamMedis/Kesadaran/tidakJelasOn.svg";
import tidakJelasOff from "@/assets/images/RekamMedis/Kesadaran/tidakJelasOff.svg";
import mengerangOn from "@/assets/images/RekamMedis/Kesadaran/mengerangOn.svg";
import mengerangOff from "@/assets/images/RekamMedis/Kesadaran/mengerangOff.svg";
import verbalTidakResponOn from "@/assets/images/RekamMedis/Kesadaran/verbalTidakResponOn.svg";
import verbalTidakResponOff from "@/assets/images/RekamMedis/Kesadaran/verbalTidakResponOff.svg";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import HistoriKesadaran from "@/components/RekamMedis/Kesadaran/HistoriKesadaran.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { PhBuildings } from "@phosphor-icons/vue";

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

const schema = toTypedSchema(
  yup.object({
    eye: yup.number(),
    motorik: yup.number(),
    verbal: yup.number(),
    gcsScore: yup.number(),
    gcsKesimpulan: yup.string(),
    petugas: yup.string().default("Super Admin"),
    updatedAt: yup.mixed(),
  })
);
const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});
const [eye] = defineField("eye");
const [motorik] = defineField("motorik");
const [verbal] = defineField("verbal");
const [gcsScore] = defineField("gcsScore");
const [gcsKesimpulan] = defineField("gcsKesimpulan");
const [petugas] = defineField("petugas");
const [updatedAt] = defineField("updatedAt");

const onSubmit = handleSubmit(async (values: any) => {
  try {
    storeUtils.setLoading(true);
    delete values.updatedAt;
    const response = await rekamMedisStore.insertAssesment({
      sessionUuid: props.sessionUuid,
      rekamMedisUuid: props.rmUuid,
      isLatest: rekamMedisStore.openedRekamMedis.isLatest,
      key: "kesadaran",
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
  if (rekamMedisStore.openedRekamMedis.data.kesadaran) {
    const tempKesadaran = rekamMedisStore.openedRekamMedis.data.kesadaran;
    setValues({
      eye: tempKesadaran.eye,
      motorik: tempKesadaran.motorik,
      verbal: tempKesadaran.verbal,
      gcsScore: tempKesadaran.gcsScore,
      gcsKesimpulan: tempKesadaran.kesimpulan,
      petugas: tempKesadaran.petugas,
      updatedAt: tempKesadaran.updatedAt,
    });
    countKesimpulan();
  } else resetForm();
};

onBeforeMount(async () => {
  setFormData();
});

const storedRMData = computed(() => rekamMedisStore.openedRekamMedis);
watch(storedRMData, (newRM) => {
  setFormData();
});

const toggleEdit = () => {
  isEditing.value = true;
  emit("edit");
};

const lastClicked = ref<{
  categoryIndex: number;
  responseIndex: number;
} | null>(null);

const opsiKesadaran = [
  {
    title: "Mata (Respon Membuka Mata)",
    selected: eye,
    response: [
      {
        label: "Spontan merespon",
        defaultImage: spontanMeresponOff,
        selectedImage: spontanMeresponOn,
      },
      {
        label: "Ada respon dengan rangsang suara",
        defaultImage: responSuaraOff,
        selectedImage: responSuaraOn,
      },
      {
        label: "Ada respon dengan rangsang nyeri",
        defaultImage: responNyeriOff,
        selectedImage: responNyeriOn,
      },
      {
        label: "Tidak ada respon",
        defaultImage: mataTidakResponOff,
        selectedImage: mataTidakResponOn,
      },
    ],
  },
  {
    title: "Motorik (Respon Gerak)",
    selected: motorik,
    response: [
      {
        label: "Mengikuti perintah",
        defaultImage: mengikutiPerintahOff,
        selectedImage: mengikutiPerintahOn,
      },
      {
        label: "Melokalisir nyeri",
        defaultImage: melokalisirNyeriOff,
        selectedImage: melokalisirNyeriOn,
      },
      {
        label: "Fleksi normal",
        defaultImage: fleksiNormalOff,
        selectedImage: fleksiNormalOn,
      },
      {
        label: "Fleksi abnormal",
        defaultImage: fleksiAbnormalOff,
        selectedImage: fleksiAbnormalOn,
      },
      {
        label: "Ekstensi abnormal",
        defaultImage: ekstensiAbnormalOff,
        selectedImage: ekstensiAbnormalOn,
      },
      {
        label: "Tidak ada respon",
        defaultImage: motorikTidakResponOff,
        selectedImage: motorikTidakResponOn,
      },
    ],
  },
  {
    title: "Verbal (Respon Verbal)",
    selected: verbal,
    response: [
      {
        label: "Orientasi baik",
        defaultImage: orientasiBaikOff,
        selectedImage: orientasiBaikOn,
      },
      {
        label: "Bingung berbicara",
        defaultImage: bingungBerbicaraOff,
        selectedImage: bingungBerbicaraOn,
      },
      {
        label: "Kata-kata tidak jelas",
        defaultImage: tidakJelasOff,
        selectedImage: tidakJelasOn,
      },
      {
        label: "Suara tanpa arti (mengarang)",
        defaultImage: mengerangOff,
        selectedImage: mengerangOn,
      },
      {
        label: "Tidak ada respon",
        defaultImage: verbalTidakResponOff,
        selectedImage: verbalTidakResponOn,
      },
    ],
  },
];

const selectOption = (categoryIndex: number, responseIndex: number) => {
  opsiKesadaran[categoryIndex].selected.value = responseIndex + 1;
  lastClicked.value = { categoryIndex, responseIndex };
  countKesimpulan();
};

const getImageSrc = (categoryIndex: number, responseIndex: number) => {
  return opsiKesadaran[categoryIndex].selected.value === responseIndex + 1
    ? opsiKesadaran[categoryIndex].response[responseIndex].selectedImage
    : opsiKesadaran[categoryIndex].response[responseIndex].defaultImage;
};

const kesimpulanOption = ref([
  { name: "Sakit sedang" },
  { name: "Sakit Ringan" },
  { name: "Sakit Berat" },
]);
const getLabelFromValue = (value: any, responses: Array<{ label: string }>) => {
  if (value > 0 && value <= responses.length) {
    return responses[value - 1]?.label || "Tidak Diketahui";
  }
  return "Tidak Diketahui";
};


const countKesimpulan = () => {
  if (eye.value && motorik.value && verbal.value) {
    gcsKesimpulan.value = "";
    let totalSkor = eye.value + motorik.value + verbal.value;
    gcsScore.value = totalSkor;

    if (totalSkor >= 14) {
      gcsKesimpulan.value = "Compos Mentis";
    } else if (totalSkor >= 12) {
      gcsKesimpulan.value = "Apatis";
    } else if (totalSkor >= 10) {
      gcsKesimpulan.value = "Delirium";
    } else if (totalSkor >= 7) {
      gcsKesimpulan.value = "Somnolence";
    } else if (totalSkor >= 5) {
      gcsKesimpulan.value = "Sopor";
    } else if (totalSkor === 4) {
      gcsKesimpulan.value = "Semi-coma";
    } else if (totalSkor === 3) {
      gcsKesimpulan.value = "Coma";
    }
  }
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
      key: "kesadaran",
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
    <template #header>Kesadaran</template>
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
      <div v-if="isEditing" class="grid grid-cols-2 gap-6 pt-5">
        <div
          v-for="(option, categoryIndex) in opsiKesadaran"
          :key="categoryIndex"
        >
          <div class="flex flex-col gap-5">
            <div class="font-semibold text-md">{{ option.title }}</div>
            <div
              :class="{
                'grid grid-cols-4': option.title.includes('Mata'),
                'grid grid-cols-6': option.title.includes('Motorik'),
                'grid grid-cols-5': option.title.includes('Verbal'),
              }"
            >
              <div
                v-for="(response, responseIndex) in option.response"
                :key="responseIndex"
              >
                <div
                  class="flex flex-col gap-2.5 items-center text-center justify-center cursor-pointer"
                  @click="selectOption(categoryIndex, responseIndex)"
                >
                  <img
                    :src="getImageSrc(categoryIndex, responseIndex)"
                    alt="Response Image"
                  />
                  <div class="font-normal text-SM">{{ response.label }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-[3fr_1fr] gap-x-[30px]">
          <CustomTextfield
            v-model="gcsKesimpulan"
            label="Kesimpulan GCS"
            placeholder="Pilih Kesimpulan GCS"
            readOnly
          />
          <CustomTextfield
            :model-value="gcsScore ? `GCS ${gcsScore}` : ''"
            label="Score GCS"
            placeholder="Score GCS"
            readOnly
          />
        </div>
      </div>
      <div v-if="!isEditing" class="py-5 flex flex-col gap-[19px]">
        <CustomInfoRow
          label="Mata"
          :value="getLabelFromValue(eye, opsiKesadaran[0].response)"
        />
        <CustomInfoRow
          label="Motorik"
          :value="getLabelFromValue(motorik, opsiKesadaran[1].response)"
        />
        <CustomInfoRow
          label="Verbal"
          :value="getLabelFromValue(verbal, opsiKesadaran[2].response)"
        />
        <CustomInfoRow label="Kesimpulan GCS" :value="gcsKesimpulan" />
        <CustomInfoRow label="Score GCS" :value="gcsScore ? `GCS ${gcsScore}` : ''" />
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
        <template #header>Kesadaran</template>
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
                <HistoriKesadaran v-if="leftHistoryItem" :history="leftHistoryItem" />
                <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">Tidak ada riwayat.</div>

                <div v-if="rightHistoryItem" class="border border-opensimrs-300"></div>
                
                <HistoriKesadaran v-if="rightHistoryItem" :history="rightHistoryItem" />
                <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">Tidak ada riwayat.</div>
              </div>
            </div>
            <div class="border border-opensimrs-300 mx-[15px]"></div>
            <div class="flex flex-col overflow-hidden">
              <div class="flex flex-col pb-1 overflow-auto gap-y-5 grow">
                <div
                  v-for="(option, categoryIndex) in opsiKesadaran"
                  :key="categoryIndex"
                >
                  <div class="flex flex-col gap-5">
                    <div class="font-semibold text-md">{{ option.title }}</div>
                    <div
                      :class="{
                        'grid grid-cols-4': option.title.includes('Mata'),
                        'grid grid-cols-6': option.title.includes('Motorik'),
                        'grid grid-cols-5': option.title.includes('Verbal'),
                      }"
                    >
                      <div
                        v-for="(response, responseIndex) in option.response"
                        :key="responseIndex"
                      >
                        <div
                          class="flex flex-col gap-2.5 items-center text-center justify-center cursor-pointer"
                          @click="selectOption(categoryIndex, responseIndex)"
                        >
                          <img
                            :src="getImageSrc(categoryIndex, responseIndex)"
                            alt="Response Image"
                          />
                          <div class="font-normal text-SM">
                            {{ response.label }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-[3fr_1fr] gap-x-4 mt-5">
                   <CustomTextfield
                    v-model="gcsKesimpulan"
                    label="Kesimpulan GCS"
                    placeholder="Pilih Kesimpulan GCS"
                    readOnly
                  />
                   <CustomTextfield
                    :model-value="gcsScore ? `GCS ${gcsScore}` : ''"
                    label="Score GCS"
                    placeholder="Score GCS"
                    readOnly
                  />
                </div>
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex items-end justify-end gap-3">
            <CustomButton
              v-if="isEditing"
              label="Reset"
              @click="resetForm"
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
          textColor="text-[#9DA4B1]"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-[#9DA4B1]"
        />
        <CustomButton v-if="isEditing" label="Simpan" @click="onSubmit" />
        <CustomButton v-else label="Edit" @click="emit('editAsesmen')" />
      </div>
    </template>
  </CustomAccordion>
</template>