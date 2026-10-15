<script lang="ts" setup>
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { computed, ref, watch } from "vue";
import sangatRingan from "@/assets/images/RekamMedis/AsesmenNyeri/1sangatRingan.svg";
import agakRingan from "@/assets/images/RekamMedis/AsesmenNyeri/2agakRingan.svg";
import lumayanRingan from "@/assets/images/RekamMedis/AsesmenNyeri/3lumayanRingan.svg";
import sedang from "@/assets/images/RekamMedis/AsesmenNyeri/4sedang.svg";
import sedangg from "@/assets/images/RekamMedis/AsesmenNyeri/5sedangg.svg";
import sedanggg from "@/assets/images/RekamMedis/AsesmenNyeri/6sedanggg.svg";
import berat from "@/assets/images/RekamMedis/AsesmenNyeri/7berat.svg";
import beratt from "@/assets/images/RekamMedis/AsesmenNyeri/8beratt.svg";
import berattt from "@/assets/images/RekamMedis/AsesmenNyeri/9berattt.svg";
import beratttt from "@/assets/images/RekamMedis/AsesmenNyeri/10beratttt.svg";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { onBeforeMount } from "vue";
import Scaler from "@/components/RekamMedis/AsesmenNyeri/Scaler.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import HistoriAsesmenNyeri from "@/components/RekamMedis/AsesmenNyeri/HistoriAsesmenNyeri.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { epochToDate } from "@/utils/Helpers";

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();

const props = defineProps({
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

const emit = defineEmits(["edit", "editAsesmen"]);
const currentMethod = ref(props.method);

const handleImageClick = (id: number) => {
  skalaNyeri.value = id;
};

const schemaAsesmenNyeri = computed(() =>
  toTypedSchema(
    yup.object({
      skalaNyeri: yup.number(),
      catatan: yup.string(),
      petugas: yup.string().default("Super Admin"),
      updatedAt: yup.mixed(),
    })
  )
);

const {
  resetForm,
  handleSubmit: handleSubmitAsesmenNyeri,
  defineField: defineFieldAsesmenNyeri,
  setValues,
} = useForm({
  validationSchema: schemaAsesmenNyeri,
});

const [skalaNyeri] = defineFieldAsesmenNyeri("skalaNyeri");
const [catatan] = defineFieldAsesmenNyeri("catatan");
const [petugas] = defineFieldAsesmenNyeri("petugas");
const [updatedAt] = defineFieldAsesmenNyeri("updatedAt");

const onSubmitAsesmenNyeri = handleSubmitAsesmenNyeri(async (values: any) => {
  try {
    storeUtils.setLoading(true);
    delete values.updatedAt;
    const response = await rekamMedisStore.insertAssesment({
      sessionUuid: props.sessionUuid,
      rekamMedisUuid: props.rmUuid,
      isLatest: rekamMedisStore.openedRekamMedis.isLatest,
      key: "asesmen_nyeri",
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

const onEditClick = () => {
  currentMethod.value = "form";
};

const imagePengkajianNyeri = ref([
  { id: 1, value: sangatRingan },
  { id: 2, value: agakRingan },
  { id: 3, value: lumayanRingan },
  { id: 4, value: sedang },
  { id: 5, value: sedangg },
  { id: 6, value: sedanggg },
  { id: 7, value: berat },
  { id: 8, value: beratt },
  { id: 9, value: berattt },
  { id: 10, value: beratttt },
]);

const getStringSkalaNyeri = () => {
  if (skalaNyeri.value! >= 1 && skalaNyeri.value! <= 3) {
    return `${skalaNyeri.value} (Ringan)`;
  } else if (skalaNyeri.value! >= 4 && skalaNyeri.value! <= 6) {
    return `${skalaNyeri.value} (Sedang)`;
  } else if (skalaNyeri.value! >= 7 && skalaNyeri.value! <= 10) {
    return `${skalaNyeri.value} (Berat)`;
  }
};

const setFormData = () => {
  if (rekamMedisStore.openedRekamMedis.data.asesmenNyeri) {
    const tempAsesmenNyeri = rekamMedisStore.openedRekamMedis.data.asesmenNyeri;
    setValues({
      skalaNyeri: tempAsesmenNyeri.skalaNyeri,
      catatan: tempAsesmenNyeri.catatan,
      petugas: tempAsesmenNyeri.petugas,
      updatedAt: tempAsesmenNyeri.updatedAt,
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
      key: "asesmen_nyeri",
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
    <template #header> Asesmen Nyeri</template>
    <template #content>
      <div v-if="currentMethod == 'form'" class="flex flex-col">
        <CustomButton
          @click="showDialogCompare"
          class="!rounded-md my-[10px] ml-auto"
          label="Mode Compare"
          size="small"
          icon="LayoutIcon"
        />
        <hr class="mb-[30px]" />
      </div>
      <div
        v-if="currentMethod == 'form'"
        class="grid grid-cols-2 py-5 gap-[30px] gap-y-5"
      >
        <div class="flex flex-col">
          <div class="font-semibold text-normal">Pilih Pengkajian Nyeri</div>
          <div
            class="grid grid-cols-10 gap-1.5 py-3 justify-items-between gap-y-4"
          >
            <div
              v-for="(image, index) in imagePengkajianNyeri"
              :key="image.id"
              :class="[
                'w-16 p-1 flex items-center justify-center cursor-pointer bg-[#E4E7EC] rounded-lg',
                { 'border-4 border-opensimrs-300': image.id === skalaNyeri },
              ]"
              @click="handleImageClick(image.id)"
            >
              <img
                :src="image.value"
                :alt="'Image ' + image.id"
                class="w-full h-auto"
              />
            </div>
          </div>
          <Scaler />
          <div
            class="grid grid-cols-3 text-center border-y-2 border-[#D9DCE1] mt-2.5 p-2"
          >
            <div class="font-semibold text-normal">
              1-3 = <span class="text-success-300">Ringan</span>
            </div>
            <div class="font-semibold text-normal">
              4-6 = <span class="text-warning-300">Sedang</span>
            </div>
            <div class="font-semibold text-normal">
              7-10 = <span class="text-danger-300">Berat</span>
            </div>
          </div>
        </div>
        <div class="">
          <CustomTextfield
            label="Catatan"
            placeholder="Masukkan Catatan"
            v-model:modelValue="catatan"
          />
        </div>
      </div>
      <div
        v-if="currentMethod == 'detail'"
        class="py-5 flex flex-col gap-[19px]"
      >
        <CustomInfoRow
          label="Pengkajian Nyeri"
          :value="getStringSkalaNyeri()"
        />
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
        <template #header>Asesmen Nyeri</template>
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
                <HistoriAsesmenNyeri v-if="leftHistoryItem" :history="leftHistoryItem" />
                <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">Tidak ada riwayat.</div>

                <div v-if="rightHistoryItem" class="border border-opensimrs-300"></div>
                
                <HistoriAsesmenNyeri v-if="rightHistoryItem" :history="rightHistoryItem" />
                <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">Tidak ada riwayat.</div>
              </div>
            </div>
            <div class="border border-opensimrs-300 mx-[15px]"></div>
            <div class="flex flex-col overflow-hidden">
              <div class="flex flex-col pb-1 overflow-auto gap-y-5 grow">
                <div class="flex flex-col">
                  <div class="font-semibold text-normal">
                    Pilih Pengkajian Nyeri
                  </div>
                  <div
                    class="grid grid-cols-10 gap-1.5 py-3 justify-items-between gap-y-4"
                  >
                    <div
                      v-for="(image, index) in imagePengkajianNyeri"
                      :key="image.id"
                      :class="[
                        'w-16 p-1 flex items-center justify-center cursor-pointer bg-[#E4E7EC] rounded-lg',
                        {
                          'border-4 border-opensimrs-300':
                            image.id === skalaNyeri,
                        },
                      ]"
                      @click="handleImageClick(image.id)"
                    >
                      <img
                        :src="image.value"
                        :alt="'Image ' + image.id"
                        class="w-full h-auto"
                      />
                    </div>
                  </div>
                  <Scaler />
                  <div
                    class="grid grid-cols-3 text-center border-y-2 border-[#D9DCE1] mt-2.5 p-2"
                  >
                    <div class="font-semibold text-normal">
                      1-3 = <span class="text-success-300">Ringan</span>
                    </div>
                    <div class="font-semibold text-normal">
                      4-6 = <span class="text-warning-300">Sedang</span>
                    </div>
                    <div class="font-semibold text-normal">
                      7-10 = <span class="text-danger-300">Berat</span>
                    </div>
                  </div>
                </div>
                <CustomTextfield
                  label="Catatan"
                  placeholder="Masukkan Catatan"
                  v-model:modelValue="catatan"
                />
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex items-end justify-end gap-3">
            <CustomButton
              v-if="currentMethod == 'form'"
              @click="resetForm"
              label="Reset"
              textColor="text-grey-300"
              backgroundColor="bg-transparent"
              borderColor="border-2 border-grey-200"
            />
            <CustomButton
              v-if="currentMethod == 'form'"
              label="Simpan"
              @click="onSubmitAsesmenNyeri"
            />
            <CustomButton
              v-if="currentMethod == 'detail'"
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
          v-if="currentMethod == 'form'"
          @click="resetForm"
          label="Reset"
          textColor="text-[#9DA4B1]"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-[#9DA4B1]"
        />
        <CustomButton
          v-if="currentMethod == 'form'"
          label="Simpan"
          @click="onSubmitAsesmenNyeri"
        />
        <CustomButton
          v-if="currentMethod == 'detail'"
          label="Edit"
          @click="emit('editAsesmen')"
        />
      </div>
    </template>
  </CustomAccordion>
</template>