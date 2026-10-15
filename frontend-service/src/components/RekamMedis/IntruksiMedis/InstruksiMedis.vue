<script lang="ts" setup>
import { computed, onBeforeMount, ref, watch } from "vue";
import { useForm } from "vee-validate";
import * as yup from "yup";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import GeneralIcon from "@/assets/icons/Avatar/general.svg";
import HistoriInstruksiMedis from "@/components/RekamMedis/IntruksiMedis/HistoriInstruksiMedis.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { epochToDate } from "@/utils/Helpers";
import { PhCaretLeft, PhCaretRight, PhCalendarDots, PhClock, PhPaperPlaneTilt } from "@phosphor-icons/vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();
const praktisiStore = usePraktisiStore();

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

const messages = ref<any[]>([]);
const petugasInput = ref<string>("-");
const updatedAt = ref<number | null>(null);

const schema = yup.object({
  instruksi: yup.string().required("Instruksi Medis tidak boleh kosong"),
  dokter: yup.mixed<any>().required("Dokter harus dipilih"),
});

const { errors, handleSubmit, resetForm, defineField } = useForm({
  validationSchema: schema,
});

const [instruksi] = defineField("instruksi");
const [dokter] = defineField("dokter");

const onSubmitInstruksiMedis = handleSubmit(async (values: any) => {
  try {
    storeUtils.setLoading(true);
    const response = await rekamMedisStore.insertInstruksi({
      sessionUuid: props.sessionUuid,
      message: values.instruksi,
      dokterName: values.dokter.pegawai.name,
    });
    if (response && response.payload) {
      rekamMedisStore.setAsesmentRekamMedisData(response.payload);
      resetForm();
      await setFormData();
    }
  } catch (error) {
    console.error("Failed to post data", error);
  } finally {
    storeUtils.setLoading(false);
  }
});

const listDpjp = ref<any[]>([]);
const fetchPraktisi = async () => {
  const responseDpjp = await praktisiStore.getApi({
    limit: 9999,
    non_doctor: false,
  });
  if (responseDpjp && responseDpjp.payload) {
    listDpjp.value = responseDpjp.payload.filter(
      (praktisi: any) => praktisi.isDoctor && praktisi.status
    );
  }
};

const setFormData = async () => {
  if (!props.sessionUuid) {
    messages.value = [];
    petugasInput.value = "-";
    updatedAt.value = null;
    resetForm();
    return;
  }

  try {
    const responseInstruksi = await rekamMedisStore.getInstruksi(
      props.sessionUuid
    );
    if (responseInstruksi && responseInstruksi.payload) {
      messages.value = responseInstruksi.payload.data || [];
      petugasInput.value = responseInstruksi.payload.petugas || "-";
      updatedAt.value = responseInstruksi.payload.updatedAt || null;
    } else {
      messages.value = [];
      petugasInput.value = "-";
      updatedAt.value = null;
    }
  } catch (error) {
     console.error("Gagal mengambil instruksi medis:", error);
     messages.value = [];
     petugasInput.value = "-";
     updatedAt.value = null;
  }
};


onBeforeMount(() => {
  setFormData();
  fetchPraktisi();
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
      key: "instruksi_medis",
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


const currentHistoryItem = computed(() => {
  if (!historyData.value || !historyData.value[historyPageIndex.value]) return null;
  return historyData.value[historyPageIndex.value];
});

const canGoToPrevious = computed(() => historyPageIndex.value > 0);
const canGoToNext = computed(() => {
  if (!historyData.value) return false;
  return historyPageIndex.value + 1 < historyData.value.length;
});

const previousHistory = () => {
  if (canGoToPrevious.value) {
    historyPageIndex.value--;
  }
};

const nextHistory = () => {
  if (canGoToNext.value) {
    historyPageIndex.value++;
  }
};

const accordion = ref<HTMLCanvasElement | null>(null);
const open = () => { if (accordion.value) (accordion.value as any).open(); };
const close = () => { if (accordion.value) (accordion.value as any).close(); };

defineExpose({ open, close });
</script>

<template>
  <CustomAccordion headerClass="bg-opensimrs-50" ref="accordion">
    <template #header>Instruksi Medis</template>
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
      <div class="flex flex-col pt-5 gap-2.5">
        <div
          v-for="(message, index) in messages"
          :key="index"
          :class="{ 'justify-end': message.isMe }"
          class="flex items-start gap-2.5"
        >
          <img
            :src="GeneralIcon"
            alt="Avatar"
            :class="message.isMe ? 'order-2' : ''"
          />
          <div class="flex flex-col gap-2.5">
            <div class="flex w-full gap-5">
              <div class="font-semibold text-opensimrs-300 text-SM">
                {{ message.isMe ? 'Anda' : message.name }} ({{ message.dokterName }})
              </div>
              <div class="flex gap-2.5 font-medium text-SM text-grey-400">
                <div class="flex items-center gap-[2px]">
                  <PhCalendarDots :size="12" weight="fill" />
                  {{ epochToDate(message.time, "date") }}
                </div>
                <div class="flex items-center gap-[2px]">
                  <PhClock :size="12" weight="fill" />
                  {{ epochToDate(message.time, "time") }}
                </div>
              </div>
            </div>
            <div
              :class="
                message.isMe
                  ? 'rounded-tl-[10px] rounded-br-[10px] rounded-bl-[10px]'
                  : 'rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px]'
              "
              class="min-h-[45px] bg-opensimrs-50 flex items-center px-4 text-SM font-normal"
            >
              {{ message.message }}
            </div>
          </div>
        </div>
        <hr class="border-grey-200 my-2.5" />
        <div v-if="isEditing" class="flex gap-[30px]">
          <CustomSelect
            label="Dokter Pemberi Instruksi"
            v-model="dokter"
            place-holder="Pilih Dokter Pemberi Instruksi"
            :options="listDpjp"
            option-label="pegawai.name"
            option-value=""
            :invalid="!!errors.dokter"
            :invalidMessage="errors.dokter"
          />
          <div class="flex flex-col grow gap-2.5">
            <CustomTextArea
              v-model="instruksi"
              label="Instruksi Medis"
              placeholder="Ketik Instruksi..."
              :invalid="!!errors.instruksi"
              :invalidMessage="errors.instruksi"
            />
            <CustomButton
              :full="true"
              class="w-full"
              @click="onSubmitInstruksiMedis"
            >
              <div class="flex items-center justify-center gap-2">
                <PhPaperPlaneTilt :size="20" weight="fill" />
                <div>Kirim Instruksi</div>
              </div>
            </CustomButton>
          </div>
        </div>
        
        <div v-if="!isEditing" class="flex flex-col gap-[19px] py-2">
          <CustomInfoRow label="Petugas Input" :value="petugasInput" />
          <CustomInfoRow label="Jam Input" :value="String(epochToDate(updatedAt ?? 0, 'time'))" />
        </div>
      </div>

      <CustomDialog
        class=""
        v-model:visible="compareDialog"
        width="80%"
        noScroll
      >
        <template #header>Instruksi Medis</template>
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
                  <CustomButton @click="previousHistory" :disabled="!canGoToPrevious" class="!rounded-md mr-[10px]" size="small">
                    <PhCaretLeft :size="16" />
                  </CustomButton>
                  <CustomButton @click="nextHistory" :disabled="!canGoToNext" class="!rounded-md" size="small">
                    <PhCaretRight :size="16" />
                  </CustomButton>
                </div>
              </div>
               <div>
                <HistoriInstruksiMedis v-if="currentHistoryItem" :history="currentHistoryItem" />
                <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">Tidak ada riwayat.</div>
              </div>
            </div>

            <div class="border border-opensimrs-300 mx-[15px]"></div>

            <div class="flex flex-col overflow-hidden">
              <div class="flex flex-col pb-1 overflow-auto gap-y-5 grow">
                <div
                  v-for="(message, index) in messages"
                  :key="index"
                  :class="{ 'justify-end': message.isMe }"
                  class="flex items-start gap-2.5"
                >
                  <img :src="GeneralIcon" alt="Avatar" :class="message.isMe ? 'order-2' : ''"/>
                  <div class="flex flex-col gap-2.5 w-full">
                    <div class="flex w-full gap-5">
                      <div class="font-semibold text-opensimrs-300 text-SM">
                        {{ message.isMe ? 'Anda' : message.name }} ({{ message.dokterName }})
                      </div>
                      <div class="flex gap-2.5 font-medium text-SM text-grey-400">
                        <div class="flex items-center gap-[2px]">
                          <PhCalendarDots :size="12" weight="fill" />
                          {{ epochToDate(message.time, "date") }}
                        </div>
                        <div class="flex items-center gap-[2px]">
                          <PhClock :size="12" weight="fill" />
                          {{ epochToDate(message.time, "time") }}
                        </div>
                      </div>
                    </div>
                    <div :class="message.isMe ? 'rounded-tl-[10px] rounded-br-[10px] rounded-bl-[10px]' : 'rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px]'"
                      class="min-h-[45px] bg-opensimrs-50 flex items-center px-4 text-SM font-normal"
                    >
                      {{ message.message }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="pt-2.5">
                <hr class="border-grey-200 my-2.5" />
                <div v-if="isEditing" class="grid grid-cols-2 gap-[30px]">
                  <CustomSelect
                    label="Dokter Pemberi Instruksi"
                    v-model="dokter"
                    place-holder="Pilih Dokter Pemberi Instruksi"
                    :options="listDpjp"
                    option-label="pegawai.name"
                    option-value=""
                    :invalid="!!errors.dokter"
                    :invalidMessage="errors.dokter"
                  />
                  <div class="flex flex-col grow gap-2.5">
                    <CustomTextArea
                      v-model="instruksi"
                      label="Instruksi Medis"
                      placeholder="Ketik Instruksi..."
                      :invalid="!!errors.instruksi"
                      :invalidMessage="errors.instruksi"
                    />
                    <CustomButton
                      :full="true"
                      class="w-full"
                      @click="onSubmitInstruksiMedis"
                    >
                      <div class="flex items-center justify-center gap-2">
                        <PhPaperPlaneTilt :size="20" weight="fill" />
                        <div>Kirim Instruksi</div>
                      </div>
                    </CustomButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template #footer>
           <div class="flex items-end justify-end gap-3">
            <CustomButton v-if="isEditing" label="Reset" @click="resetForm" textColor="text-grey-300" backgroundColor="bg-transparent" borderColor="border-2 border-grey-200" />
            <CustomButton v-if="isEditing" label="Simpan" @click="onSubmitInstruksiMedis" />
            <CustomButton v-if="!isEditing" label="Edit" @click="emit('editAsesmen')" />
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
          <CustomButton v-if="isEditing" label="Simpan" @click="onSubmitInstruksiMedis" />
          <CustomButton v-else label="Edit" @click="emit('editAsesmen')" />
        </div>
      </template>
  </CustomAccordion>
</template>