<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import { epochToDate } from "@/utils/Helpers";
import { computed, type PropType } from 'vue';
import CustomChip from "@/components/Base/CustomChip.vue";

interface AsuhanData {
  diagnosaPerawat: string;
  petugas: string;
  updatedAt: number;
  
}

interface HistoryObject {
  session: any;
  date: number;
  data: AsuhanData;
  jenisKunjungan?: 'rj' | 'ri' | 'igd';
}

const props = defineProps({
  history: {
    type: Object as PropType<HistoryObject | null>,
    default: null,
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
</script>

<template>
  <div v-if="history">
    <CustomAccordion headerClass="bg-opensimrs-50" :initialState="'0'">
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
        <div v-if="history.data" class="py-5 flex flex-col gap-[19px]">
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm text-grey-400">Diagnosis Perawat</label>
            <div
              class="prose max-w-none text-sm text-grey-500"
              v-html="history.data.diagnosaPerawat"
            ></div>
          </div>
          <hr class="border-grey-200" />
          <div class="flex justify-between">
            <CustomInfoRow
              label="Petugas Input"
              :value="history.data.petugas"
              type="vertical"
            />
            <CustomInfoRow
              label="Jam Input"
              :value="String(epochToDate(history.data.updatedAt, 'time'))"
              type="vertical"
              alignment="right"
            />
          </div>
        </div>
        <div v-else class="text-center py-5 text-grey-400">
          Tidak ada data riwayat.
        </div>
      </template>
    </CustomAccordion>
  </div>
</template>