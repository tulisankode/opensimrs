<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { computed, ref, onBeforeMount, type PropType, watch, onMounted } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import HistoriAlergi from "./HistoriAlergi.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { dateToEpoch, epochToDate } from "@/utils/Helpers";

interface AlergiForm {
  isAlergi: boolean;
  pemicuAlergi: string;
  namaAlergi: string;
  reaksiAlergi: string;
  tingkatKeparahanAlergi: string;
  efekSampingAlergi: string;
  tanggalKejadianAlergi: number | Date;
}

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();

const emit = defineEmits(["edit", "submitAsesmen", "editAsesmen"]);

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

const currentMethod = ref(props.method);

const schemaAlergi = computed(() =>
  toTypedSchema(
    yup.object({
      isAlergi: yup.bool().default(true),
      pemicuAlergi: yup.string(),
      namaAlergi: yup.string(),
      reaksiAlergi: yup.string(),
      tingkatKeparahanAlergi: yup.string(),
      efekSampingAlergi: yup.string(),
      tanggalKejadianAlergi: yup.date(),
      petugas: yup.string().default("Super Admin"),
      updatedAt: yup.mixed(),
    })
  )
);

const {
  handleSubmit: handleSubmitAlergi,
  defineField: defineFieldAlergi,
  resetForm,
  setValues,
} = useForm({
  validationSchema: schemaAlergi,
});

const listPemicuAlergi = ref([
  "Obat",
  "Makanan",
  "Lingkungan",
  "Airbone",
  "Sengatan Serangga",
  "Lateks / Zat lain yang disentuh",
]);

const [pemicuAlergi] = defineFieldAlergi("pemicuAlergi");
const [namaAlergi] = defineFieldAlergi("namaAlergi");
const [reaksiAlergi] = defineFieldAlergi("reaksiAlergi");
const [tingkatKeparahanAlergi] = defineFieldAlergi("tingkatKeparahanAlergi");
const [efekSampingAlergi] = defineFieldAlergi("efekSampingAlergi");
const [tanggalKejadianAlergi] = defineFieldAlergi("tanggalKejadianAlergi");
const [petugas] = defineFieldAlergi("petugas");
const [updatedAt] = defineFieldAlergi("updatedAt");

const onSubmitFormAlergi = handleSubmitAlergi((values: any) => {
  postFormAlergi(values);
});

const postFormAlergi = async (values: AlergiForm | null) => {
  try {
    storeUtils.setLoading(true);
    let tempData;
    if (values) {
      tempData = values;
      tempData.tanggalKejadianAlergi = dateToEpoch(
        tempData.tanggalKejadianAlergi as Date
      );
    delete (tempData as any).updatedAt;
    } else {
      tempData = {
        isAlergi: false,
        pemicuAlergi: "",
        namaAlergi: "",
        reaksiAlergi: "",
        tingkatKeparahanAlergi: "",
        efekSampingAlergi: "",
        tanggalKejadianAlergi: dateToEpoch(new Date()),
      };
    }
    const response = await rekamMedisStore.insertAssesment({
      sessionUuid: props.sessionUuid,
      rekamMedisUuid: props.rmUuid,
      isLatest: rekamMedisStore.openedRekamMedis.isLatest,
      key: "alergi",
      data: tempData,
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
  if (rekamMedisStore.openedRekamMedis.data.alergi) {
    const tempAlergi = rekamMedisStore.openedRekamMedis.data.alergi;
    setValues({
      isAlergi: tempAlergi.isAlergi,
      pemicuAlergi: tempAlergi.pemicuAlergi,
      namaAlergi: tempAlergi.namaAlergi,
      reaksiAlergi: tempAlergi.reaksiAlergi,
      tingkatKeparahanAlergi: tempAlergi.tingkatKeparahanAlergi,
      efekSampingAlergi: tempAlergi.efekSampingAlergi,
      tanggalKejadianAlergi: new Date(
        (tempAlergi.tanggalKejadianAlergi as number) * 1000
      ),
      petugas: tempAlergi.petugas,
      updatedAt: tempAlergi.updatedAt,
    });
  } else resetForm();
};

onBeforeMount(() => {
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
      key: "alergi",
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
    <template #header>Alergi</template>
    <template #content>
      <div v-if="currentMethod === 'form'" class="flex flex-col">
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
        v-if="currentMethod === 'form'"
        class="grid grid-cols-2 gap-[30px] py-3"
      >
        <CustomSelect
          label="Pemicu Alergi"
          placeHolder="Masukkan Pemicu Alergi"
          v-model="pemicuAlergi"
          :options="listPemicuAlergi"
          optionValue=""
          optionLabel=""
          :isLoading="false"
          :invalid="false"
          invalidMessage="Wajib diisi"
          customSelectClass="border-[#C7CBD2]"
        />
        <CustomTextfield
          label="Nama/Jenis Alergi"
          placeholder="Masukkan Nama Alergi"
          v-model:modelValue="namaAlergi"
        />
        <CustomTextfield
          label="Reaksi"
          placeholder="Masukkan Reaksi"
          v-model:modelValue="reaksiAlergi"
        />
        <CustomTextfield
          label="Tingkat Keparahan"
          placeholder="Masukkan Tingkat Keparahan"
          v-model:modelValue="tingkatKeparahanAlergi"
        />
        <CustomTextfield
          label="Efek Samping"
          placeholder="Masukkan Efek Samping"
          v-model:modelValue="efekSampingAlergi"
        />
        <CustomDatePicker
          v-model="tanggalKejadianAlergi"
          label="Tanggal Kejadian"
        />
      </div>

      <div
        v-if="currentMethod === 'detail'"
        class="py-5 flex flex-col gap-[19px]"
      >
        <CustomInfoRow label="Pemicu Alergi" :value="pemicuAlergi" />
        <CustomInfoRow label="Nama / Jenis Alergi" :value="namaAlergi" />
        <CustomInfoRow label="Reaksi" :value="reaksiAlergi" />
        <CustomInfoRow
          label="Tingkat Keparahan"
          :value="tingkatKeparahanAlergi"
        />
        <CustomInfoRow label="Efek Sampinga" :value="efekSampingAlergi" />
        <CustomInfoRow
          label="Tanggal Kejadian"
          :value="tanggalKejadianAlergi ? `${String(tanggalKejadianAlergi.getDate()).padStart(2, '0')} - ${String(tanggalKejadianAlergi.getMonth() + 1).padStart(2, '0')} - ${tanggalKejadianAlergi.getFullYear()}` : '-'"
        />
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
        width="1380px"
        noScroll
      >
        <template #header>Alergi</template>
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
                <HistoriAlergi v-if="leftHistoryItem" :history="leftHistoryItem" />
                <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">Tidak ada riwayat.</div>

                <div v-if="rightHistoryItem" class="border border-opensimrs-300"></div>
                
                <HistoriAlergi v-if="rightHistoryItem" :history="rightHistoryItem" />
                <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">Tidak ada riwayat.</div>
              </div>
            </div>
            <div class="border border-opensimrs-300 mx-[15px]"></div>
            <div class="flex flex-col overflow-hidden">
              <div class="flex flex-col pb-1 overflow-auto gap-y-5 grow">
                <CustomSelect
                  label="Pemicu Alergi"
                  placeHolder="Masukkan Pemicu Alergi"
                  v-model="pemicuAlergi"
                  :options="listPemicuAlergi"
                  optionValue=""
                  optionLabel=""
                  :isLoading="false"
                  :invalid="false"
                  invalidMessage="Wajib diisi"
                  customSelectClass="border-[#C7CBD2]"
                />
                <CustomTextfield
                  label="Nama/Jenis Alergi"
                  placeholder="Masukkan Nama Alergi"
                  v-model:modelValue="namaAlergi"
                />
                <CustomTextfield
                  label="Reaksi"
                  placeholder="Masukkan Reaksi"
                  v-model:modelValue="reaksiAlergi"
                />
                <CustomTextfield
                  label="Tingkat Keparahan"
                  placeholder="Masukkan Tingkat Keparahan"
                  v-model:modelValue="tingkatKeparahanAlergi"
                />
                <CustomTextfield
                  label="Efek Samping"
                  placeholder="Masukkan Efek Samping"
                  v-model:modelValue="efekSampingAlergi"
                />
                <CustomDatePicker
                  v-model="tanggalKejadianAlergi"
                  label="Tanggal Kejadian"
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
            <CustomButton
              v-if="currentMethod === 'form'"
              label="Tidak Ada Alergi"
              textColor="text-opensimrs-300"
              backgroundColor="bg-transparent"
              borderColor="border-2 border-opensimrs-300"
            />
            <CustomButton
              v-if="currentMethod === 'form'"
              label="Simpan"
              @click="onSubmitFormAlergi"
            />
            <CustomButton
              v-if="currentMethod === 'detail'"
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
          v-if="props.method == 'form'"
          @click="resetForm"
          label="Reset"
          textColor="text-grey-300"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-grey-200"
        />
        <CustomButton
          v-if="currentMethod === 'form'"
          @click="postFormAlergi(null)"
          label="Tidak Ada Alergi"
          textColor="text-opensimrs-300"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-opensimrs-300"
        />
        <CustomButton
          v-if="currentMethod === 'form'"
          @click="onSubmitFormAlergi"
          label="Simpan"
        />
        <CustomButton
          v-if="currentMethod === 'detail'"
          @click="emit('editAsesmen')"
          label="Edit"
        />
      </div>
    </template>
  </CustomAccordion>
</template>