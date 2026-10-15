<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import { epochToDate } from "@/utils/Helpers";
import { computed } from 'vue';
import type { PropType } from 'vue';
import CustomChip from "@/components/Base/CustomChip.vue";

interface KesadaranHistoryItem {
  session: any;
  data: any;
  date: number;
  eye: number;
  motorik: number;
  verbal: number;
  gcsScore: number;
  gcsKesimpulan: string;
  petugas: string;
  jenisKunjungan?: 'rj' | 'ri' | 'igd';
}

const props = defineProps({
  history: {
    type: Object as PropType<KesadaranHistoryItem | null>,
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

const kesadaranLabels = {
  eye: [
    "Spontan merespon",
    "Ada respon dengan rangsang suara",
    "Ada respon dengan rangsang nyeri",
    "Tidak ada respon",
  ],
  motorik: [
    "Mengikuti perintah",
    "Melokalisir nyeri",
    "Fleksi normal",
    "Fleksi abnormal",
    "Ekstensi abnormal",
    "Tidak ada respon",
  ],
  verbal: [
    "Orientasi baik",
    "Bingung berbicara",
    "Kata-kata tidak jelas",
    "Suara tanpa arti (mengarang)",
    "Tidak ada respon",
  ],
};

const eyeLabel = computed(() => {
  if (!props.history || !props.history.data.eye) return "-";
  return kesadaranLabels.eye[props.history.data.eye - 1] || "-";
});

const motorikLabel = computed(() => {
  if (!props.history || !props.history.data.motorik) return "-";
  return kesadaranLabels.motorik[props.history.data.motorik - 1] || "-";
});

const verbalLabel = computed(() => {
  if (!props.history || !props.history.data.verbal) return "-";
  return kesadaranLabels.verbal[props.history.data.verbal - 1] || "-";
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
        <div class="py-5 flex flex-col gap-[19px]">
          <CustomInfoRow label="Mata" :value="eyeLabel" type="vertical" />
          <CustomInfoRow label="Motorik" :value="motorikLabel" type="vertical" />
          <CustomInfoRow label="Verbal" :value="verbalLabel" type="vertical" />
          <CustomInfoRow label="Kesimpulan GCS" :value="history.data.gcsKesimpulan" type="vertical" />
          <CustomInfoRow label="Score GCS" :value="history.data.gcsScore ? `GCS ${history.data.gcsScore}` : ''" type="vertical" />
          <hr class="border-grey-200" />
          <div class="flex justify-between">
            <CustomInfoRow label="Petugas Input" :value="history.data.petugas" type="vertical" />
            <CustomInfoRow
              label="Jam Input"
              :value="String(epochToDate(history.data.updatedAt, 'time'))"
              type="vertical"
              alignment="right"
            />
          </div>
        </div>
      </template>
    </CustomAccordion>
  </div>
</template>