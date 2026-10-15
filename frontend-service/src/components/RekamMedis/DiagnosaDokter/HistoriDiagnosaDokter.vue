<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import { epochToDate } from "@/utils/Helpers";
import { computed } from 'vue';
import type { PropType } from 'vue'; 
import { PhArrowElbowDownRight } from "@phosphor-icons/vue";
import CustomChip from "@/components/Base/CustomChip.vue";

interface DiagnosisItem {
  tipe: string;
  diagnosis: string;
  diferensial?: string;
  petugas: string;
  updatedAt: number;
}

interface HistoryObject {
  session: any;
  date: number;
  data: DiagnosisItem[];
  jenisKunjungan?: string;
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

const diagnosisData = computed(() => props.history?.data || []);

const primerDiagnosis = computed(() => {
  return diagnosisData.value.find(item => item.tipe === 'primer');
});

const sekunderDiagnosis = computed(() => {
  return diagnosisData.value.filter(item => item.tipe === 'sekunder');
});

const lastEntry = computed(() => {
    if (diagnosisData.value.length === 0) return null;
    return diagnosisData.value[diagnosisData.value.length - 1];
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
      <div v-if="diagnosisData.length > 0" class="py-5 flex flex-col gap-[10px]">
        
        <div v-if="primerDiagnosis">
          <CustomInfoRow 
            label="Primer" 
            :value="primerDiagnosis.diagnosis" 
            type="vertical" 
          />
          <div class="flex mt-2" v-if="primerDiagnosis.diferensial">
            <PhArrowElbowDownRight
              :size="20"
              weight="bold"
              class="my-auto mr-[5px] text-opensimrs-300"
            />
            <CustomInfoRow
              label="Diagnosis Diferensial"
              :value="primerDiagnosis.diferensial"
              type="vertical"
            />
          </div>
        </div>
        
        <div v-for="(sekunder, index) in sekunderDiagnosis" :key="index" class="mt-2">
           <CustomInfoRow 
            label="Sekunder" 
            :value="sekunder.diagnosis" 
            type="vertical" 
          />
          <div class="flex mt-2" v-if="sekunder.diferensial">
            <PhArrowElbowDownRight
              :size="20"
              weight="bold"
              class="my-auto mr-[5px] text-opensimrs-300"
            />
            <CustomInfoRow
              label="Diagnosis Diferensial"
              :value="sekunder.diferensial"
              type="vertical"
            />
          </div>
        </div>

        <hr class="border-grey-200 mt-4" />
          <div class="flex justify-between">
            <CustomInfoRow label="Petugas Input" :value="lastEntry?.petugas" type="vertical" />
            <CustomInfoRow
              label="Jam Input"
              :value="String(epochToDate(lastEntry?.updatedAt ?? 0, 'time'))"
              type="vertical"
              alignment="right"
            />
          </div>
      </div>
       <div v-else class="text-center py-5 text-grey-400">
        Tidak ada riwayat.
      </div>
    </template>
    </CustomAccordion>
  </div>
  <div v-else class="text-center p-4 text-grey-400">
    Tidak ada data riwayat.
  </div>
</template>