<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import catatanPerawat01 from "@/assets/icons/Avatar/catatanPerawat01.svg";
import catatanPerawatAnda from "@/assets/icons/Avatar/catatanPerawatAnda.svg";
import { epochToDate } from "@/utils/Helpers";
import { PhCalendarDots, PhClock } from "@phosphor-icons/vue";
import { computed } from 'vue';
import type { PropType } from 'vue';
import CustomChip from "@/components/Base/CustomChip.vue";

interface Message {
  _id: string;
  message: string;
  name: string;
  user_uuid: string;
  time: number;
}

interface HistoryObject {
  session: any;
  date: number;
  data: Message[];
  petugas: string;
  waktuInput?: number;
  jenisKunjungan?: string;
}

const props = defineProps({
  history: {
    type: Object as PropType<HistoryObject | null>,
    default: null,
  },
  currentUserUuid: {
    type: String,
    default: "",
  },
});

const jenisKunjunganLabel = computed(() => {
  switch (props.history?.jenisKunjungan) {
    case 'rj':
      return 'Rawat Jalan';
    case 'ri':
      return 'Rawat Inap';
    case 'igd':
      return 'IGD';
    default:
      return null;
  }
});
const chipBgColor = computed(() => {
      return 'bg-white';
});

const chipTextColor = computed(() => {
      return 'text-grey-400';
});

const petugasInput = computed(() => {
  return props.history?.petugas || 'N/A';
});

const jamInput = computed(() => {
  if (props.history?.waktuInput) {
    return String(epochToDate(props.history.waktuInput, 'time'));
  }
  if (props.history?.data && props.history.data.length > 0) {
    return String(epochToDate(props.history.data[props.history.data.length - 1].time, 'time'));
  }
  return 'N/A';
});

</script>

<template>
  <div v-if="history">
    <CustomAccordion headerClass="bg-opensimrs-50" initialState="0">
      <template #header>
        <span class="shrink-0 text-sm mr-2 mt-1">
          {{ epochToDate(history.date, 'date') || "Data Riwayat" }}
        </span>
        <div class="flex flex-wrap">
          <CustomChip
                v-if="jenisKunjunganLabel"
                :label="jenisKunjunganLabel"
                :bgColor="chipBgColor"
                :textColor="chipTextColor"
                customClass="h-5 px-2 text-xs font-semibold border-none shrink-0 mt-1"
                :showCheckedIcon="false"
            />
          <CustomChip
              v-if="history.session && jenisKunjunganLabel !== 'Rawat Jalan'"
              :label="`Sesi ${history.session}`"
              bgColor="bg-blue-200"
              textColor="text-blue-800"
              customClass="h-5 px-2 text-xs font-semibold border-none shrink-0 mt-1"
              :showCheckedIcon="false"
            />
        </div>
      </template>
      <template #content>
        <div v-if="history.data && history.data.length > 0" class="py-5 flex flex-col gap-[10px]">
          <div
            v-for="(message, index) in history.data"
            :key="message._id || index"
            class="flex items-start gap-2.5"
            :class="{ 'flex-row-reverse': message.user_uuid === currentUserUuid }"
          >
            <img :src="message.user_uuid === currentUserUuid ? catatanPerawatAnda : catatanPerawat01" alt="Avatar" />
            <div class="space-y-2.5">
              <div class="flex items-center w-full gap-5">
                <div class="font-semibold text-opensimrs-300 text-SM">
                  {{ message.user_uuid === currentUserUuid ? 'Anda' : message.name }}
                </div>
                <div class="flex gap-2.5 font-medium text-SM text-grey-400">
                  <div class="flex items-center gap-[2px]">
                    <PhCalendarDots :size="12" weight="fill" />
                    {{ epochToDate(message.time, 'date') }}
                  </div>
                  <div class="flex items-center gap-[2px]">
                    <PhClock :size="12" weight="fill" />
                    {{ epochToDate(message.time, 'time') }}
                  </div>
                </div>
              </div>
              <div
                :class="[
                  message.user_uuid === currentUserUuid
                    ? 'rounded-tl-[10px] rounded-br-[10px] rounded-bl-[10px]'
                    : 'rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px]',
                  'min-h-[45px] bg-opensimrs-50 px-4 text-SM font-normal flex items-center',
                ]"
              >
                {{ message.message }}
              </div>
            </div>
          </div>

          <hr class="border-grey-200" />
          <div class="flex justify-between">
            <CustomInfoRow
              label="Petugas Input"
              :value="petugasInput"
              type="vertical"
            />
            <CustomInfoRow
              label="Jam Input"
              :value="jamInput"
              type="vertical"
              alignment="right"
            />
          </div>
        </div>
        <div v-else class="py-5 text-center text-grey-400">
          Tidak ada data catatan perawat pada tanggal ini.
        </div>
      </template>
    </CustomAccordion>
  </div>
</template>