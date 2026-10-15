<script lang="ts" setup>
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import GeneralIcon from "@/assets/icons/Avatar/general.svg";
import { PhCaretLeft, PhCaretRight, PhCalendarDots, PhClock, PhPaperPlaneTilt, PhPencilSimple, PhArrowBendUpLeft, PhX } from "@phosphor-icons/vue";
import { computed, onBeforeMount, ref, watch } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import HistoriCatatanPerawat from "@/components/RekamMedis/CatatanPerawat/HistoriCatatanPerawat.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { epochToDate } from "@/utils/Helpers";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import { useAuthStore } from "@/stores/auth";

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();
const authStore = useAuthStore();

const currentUserUuid = computed(() => (authStore as any).user?.uuid || "");

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

const emit = defineEmits(["edit", "editAsesmen"]);

const currentMethod = ref(props.method);
const modeChat = ref("Add");

const messages = ref<any[]>([]);
const petugasInput = ref<string>("-");
const updatedAt = ref<number | null>(null);

const schemaCatatanPerawat = computed(() =>
  yup.object({
    catatanPerawat: yup.string(),
  })
);

const {
  handleSubmit: handleSubmitCatatanPerawat,
  defineField: defineFieldCatatanPerawat,
  resetForm,
} = useForm({
  validationSchema: schemaCatatanPerawat,
});

const [catatanPerawat] = defineFieldCatatanPerawat("catatanPerawat");

const replyMessageRole = ref<string | null>(null);
const editMessageRole = ref<string | null>(null);
const editMessageIndex = ref<number | null>(null);
const targetMessageId = ref<string | null>(null);
const textLama = ref("");

const handleActionClick = (actionText: string, message: any, index: number) => {
  if (actionText === "Balas") {
    onReplyMessage(message);
  } else if (actionText === "Edit") {
    onEditMessage(message, index);
  }
};

const onEditMessage = (message: any, index: number) => {
  editMessageRole.value = message.role || message.name;
  catatanPerawat.value = message.message;
  editMessageIndex.value = index;
  targetMessageId.value = message._id || message.Id; 
  modeChat.value = "Edit";
};

const onReplyMessage = (message: any) => {
  replyMessageRole.value = message.role || message.name;
  modeChat.value = "Balas";
  textLama.value = message.message;
  catatanPerawat.value = "";
  targetMessageId.value = message._id || message.Id; 
};

const cancelMode = () => {
  modeChat.value = "Add";
  replyMessageRole.value = null;
  editMessageRole.value = null;
  editMessageIndex.value = null;
  textLama.value = "";
  targetMessageId.value = null;
  resetForm();
};
const onSubmitCatatanPerawat = handleSubmitCatatanPerawat(
  async (values: any) => {
    if (modeChat.value === "Edit" && targetMessageId.value) {
      try {
        storeUtils.setLoading(true);
        const payload: any = {
          chat_uuid: targetMessageId.value,
          message: values.catatanPerawat
        };

        if (editMessageIndex.value !== null && messages.value[editMessageIndex.value]) {
            const originalMsg = messages.value[editMessageIndex.value];
            if (originalMsg.reply) {
                payload.reply = typeof originalMsg.reply === 'object' 
                    ? (originalMsg.reply._id || originalMsg.reply.Id) 
                    : originalMsg.reply;
            }
        }
        const response = await rekamMedisStore.insertCatatanPerawat(payload); 

        if (response && response.payload) {
            await setFormData(); 
            resetForm();
        }
      } catch (error) {
        console.error("Gagal mengedit catatan", error);
      } finally {
        storeUtils.setLoading(false);
        cancelMode();
      }
    } else if (modeChat.value === "Add" || modeChat.value === "Balas") {
      try {
        storeUtils.setLoading(true);
        const payload: any = {
          sessionUuid: props.sessionUuid,
          message: values.catatanPerawat,
        };
        if (modeChat.value === "Balas" && targetMessageId.value) {
          payload.reply = targetMessageId.value;
        }
        const response = await rekamMedisStore.insertCatatan(payload);

        if (response && response.payload) {
          rekamMedisStore.setAsesmentRekamMedisData(response.payload);
          resetForm();
          await setFormData();
        }
      } catch (error) {
        console.error("Gagal mengirim/membalas catatan", error);
      } finally {
        storeUtils.setLoading(false);
        cancelMode();
      }
    }
  }
);

const setFormData = async () => {
  if (!props.sessionUuid) {
    messages.value = [];
    petugasInput.value = "-";
    updatedAt.value = null;
    resetForm();
    return;
  }
  try {
    const responseCatatan = await rekamMedisStore.getCatatan(props.sessionUuid);
    if (responseCatatan && responseCatatan.payload) {
      const rawData = responseCatatan.payload.data || [];
      const msgMap = new Map(rawData.map((m: any) => [m._id, m]));
      messages.value = rawData.map((m: any) => {
         let replyData = null;
         
         if (m.reply) {
            if (typeof m.reply === 'object') {
               replyData = m.reply;
            } 
            else if (typeof m.reply === 'string') {
               const found = msgMap.get(m.reply);
               if (found) replyData = found;
            }
         }
         
         return { ...m, replyData };
      });

      petugasInput.value = responseCatatan.payload.petugas || "-";
      updatedAt.value = responseCatatan.payload.updatedAt || null;
      
    } else {
      messages.value = [];
      petugasInput.value = "-";
      updatedAt.value = null;
    }
  } catch (error) {
    console.error("Gagal mengambil catatan perawat:", error);
    messages.value = [];
    petugasInput.value = "-";
    updatedAt.value = null;
  }
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
      key: "catatan_perawat",
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
    <template #header>Catatan Perawat</template>
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

      <div class="pt-5 space-y-6"> 
        <div
          v-for="(message, index) in messages"
          :key="index"
          class="flex flex-col gap-1"
          :class="{ 'items-end': message.isMe, 'items-start': !message.isMe }"
        >
          <div class="flex gap-2.5 max-w-[80%]" :class="{ 'flex-row-reverse': message.isMe }">
            <img :src="GeneralIcon" alt="Avatar" class="w-8 h-8 rounded-full" />
            
            <div class="space-y-1 w-full"> <div class="flex items-center gap-5" :class="{ 'justify-end': message.isMe }">
                <div class="font-semibold text-opensimrs-300 text-SM">
                  {{ message.isMe ? "Anda" : message.name }}
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
                :class="[
                  message.isMe
                    ? 'rounded-tl-[10px] rounded-br-[10px] rounded-bl-[10px]'
                    : 'rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px]',
                  'min-h-[45px] bg-opensimrs-50 px-3 py-3 text-SM font-normal flex flex-col gap-2 min-w-[200px]',
                ]"
              >
                <div 
                  v-if="message.replyData" 
                  class="bg-white border border-opensimrs-300 rounded-[5px] p-2 w-full text-left shadow-sm"
                >
                  <div class="font-bold text-opensimrs-300 text-xs mb-1">
                      {{ message.replyData.name }}
                  </div>
                  <hr class="border-grey-200 mb-1"/>
                  <div class="text-grey-500 text-xs line-clamp-2">
                      {{ message.replyData.message }}
                  </div>
                </div>

                <div class="text-left break-words">
                  {{ message.message }}
                </div>
              </div>

            </div>
          </div>

          <div v-if="currentMethod === 'form'" class="flex gap-4 mt-1 px-11" :class="{ 'flex-row-reverse': message.isMe }">
            <button 
              v-if="message.isMe"
              @click="handleActionClick('Edit', message, index)"
              class="flex items-center gap-1 text-opensimrs-300 hover:text-opensimrs-500 text-xs font-medium transition-colors"
            >
              <PhPencilSimple :size="14" weight="bold" />
              Edit
            </button>

            <button 
              @click="handleActionClick('Balas', message, index)"
              class="flex items-center gap-1 text-opensimrs-300 hover:text-opensimrs-500 text-xs font-medium transition-colors"
            >
              <PhArrowBendUpLeft :size="14" weight="bold" />
              Balas
            </button>
          </div>
        </div>
        
        <div v-if="currentMethod == 'form'">
            <hr class="border-grey-200 my-5" />
            
            <div class="space-y-2.5">
                <div v-if="modeChat !== 'Add'" class="flex">
                  <div class="bg-mint-500 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-medium animate-fade-in">
                    <span v-if="modeChat === 'Balas'">
                      Membalas {{ replyMessageRole || 'Pesan' }}
                    </span>
                    <span v-else-if="modeChat === 'Edit'">
                      Sedang Mengedit Pesan
                    </span>
                    
                    <button @click="cancelMode" class="hover:bg-white/20 rounded-full p-0.5 transition-colors">
                      <PhX :size="12" weight="bold" />
                    </button>
                  </div>
                </div>

                <CustomTextArea
                    v-model="catatanPerawat"
                    label="Catatan Antar Perawat"
                    placeholder="Ketik Catatan..."
                />
                <CustomButton
                    :full="true"
                    icon="PhPaperPlaneTilt"
                    :label="modeChat === 'Edit' ? 'Simpan Perubahan' : 'Kirim Catatan'"
                    @click="onSubmitCatatanPerawat"
                />
            </div>
        </div>
        
        <div v-if="currentMethod === 'detail'" class="flex flex-col gap-[19px] py-2">
          <hr class="border-grey-200 my-2.5" />
          <CustomInfoRow label="Petugas Input" :value="petugasInput" />
          <CustomInfoRow label="Jam Input" :value="updatedAt ? String(epochToDate(updatedAt, 'time')) : '-'" />
        </div>
      </div>

      <CustomDialog class="" v-model:visible="compareDialog" width="80%" noScroll>
        <template #header>
          <div class="flex items-center gap-4">
            <span class="text-lg">Catatan Perawat</span>
          </div>
        </template>

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
                  >
                    <PhCaretLeft :size="16" />
                  </CustomButton>
                  <CustomButton 
                    @click="nextHistory" 
                    :disabled="!canGoToNext" 
                    class="!rounded-md" 
                    size="small"
                  >
                    <PhCaretRight :size="16" />
                  </CustomButton>
                </div>
              </div>
              
              <div>
                <HistoriCatatanPerawat
                  v-if="currentHistoryItem"
                  :history="currentHistoryItem"
                  :currentUserUuid="currentUserUuid" 
                />
                <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">
                  Tidak ada riwayat.
                </div>
              </div>
            </div>

            <div class="border border-opensimrs-300 mx-[15px]"></div>

            <div class="flex flex-col overflow-hidden">
              <div class="flex flex-col pb-1 overflow-auto gap-y-5 grow pr-2">
                <div
                  v-for="(message, index) in messages"
                  :key="index"
                  class="flex flex-col gap-1"
                  :class="{ 'items-end': message.isMe, 'items-start': !message.isMe }"
                >
                  <div class="flex gap-2.5 max-w-[90%]" :class="{ 'flex-row-reverse': message.isMe }">
                    <img :src="GeneralIcon" alt="Avatar" class="w-8 h-8 rounded-full" />
                    
                    <div class="space-y-1 w-full"> 
                      <div class="flex items-center gap-5" :class="{ 'justify-end': message.isMe }">
                        <div class="font-semibold text-opensimrs-300 text-SM">
                          {{ message.isMe ? "Anda" : message.name }}
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
                        :class="[
                          message.isMe
                            ? 'rounded-tl-[10px] rounded-br-[10px] rounded-bl-[10px]'
                            : 'rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px]',
                          'min-h-[45px] bg-opensimrs-50 px-3 py-3 text-SM font-normal flex flex-col gap-2 min-w-[200px]',
                        ]"
                      >
                        <div 
                          v-if="message.replyData" 
                          class="bg-white border border-opensimrs-300 rounded-[5px] p-2 w-full text-left shadow-sm"
                        >
                          <div class="font-bold text-opensimrs-300 text-xs mb-1">
                              {{ message.replyData.name }}
                          </div>
                          <hr class="border-grey-200 mb-1"/>
                          <div class="text-grey-500 text-xs line-clamp-2">
                              {{ message.replyData.message }}
                          </div>
                        </div>

                        <div class="text-left break-words">
                          {{ message.message }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="flex gap-4 mt-1 px-11" :class="{ 'flex-row-reverse': message.isMe }">
                    <button 
                      v-if="message.isMe"
                      @click="handleActionClick('Edit', message, index)"
                      class="flex items-center gap-1 text-opensimrs-300 hover:text-opensimrs-500 text-xs font-medium transition-colors"
                    >
                      <PhPencilSimple :size="14" weight="bold" />
                      Edit
                    </button>

                    <button 
                      @click="handleActionClick('Balas', message, index)"
                      class="flex items-center gap-1 text-opensimrs-300 hover:text-opensimrs-500 text-xs font-medium transition-colors"
                    >
                      <PhArrowBendUpLeft :size="14" weight="bold" />
                      Balas
                    </button>
                  </div>
                </div>
              </div>

              <div class="pt-2.5 mt-auto">
                <hr class="border-grey-200 my-2.5" />
                
                <div v-if="modeChat !== 'Add'" class="flex mb-2">
                  <div class="bg-mint-500 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-medium animate-fade-in">
                    <span v-if="modeChat === 'Balas'">
                      Membalas {{ replyMessageRole || 'Pesan' }}
                    </span>
                    <span v-else-if="modeChat === 'Edit'">
                      Sedang Mengedit Pesan
                    </span>
                    
                    <button @click="cancelMode" class="hover:bg-white/20 rounded-full p-0.5 transition-colors">
                      <PhX :size="12" weight="bold" />
                    </button>
                  </div>
                </div>

                <div class="flex flex-col gap-2.5">
                  <CustomTextArea
                    v-model="catatanPerawat"
                    label="Catatan Antar Perawat"
                    placeholder="Ketik Catatan..."
                  />
                  <CustomButton
                    :full="true"
                    icon="PhPaperPlaneTilt"
                    :label="modeChat === 'Edit' ? 'Simpan Perubahan' : 'Kirim Catatan'"
                    @click="onSubmitCatatanPerawat"
                  />
                </div>
              </div>
            </div>
          </div>
        </template>
      </CustomDialog>
    </template>
    
    <template #footer>
      </template>
  </CustomAccordion>
</template>