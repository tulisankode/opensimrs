<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import { epochToDate } from "@/utils/Helpers";
import { computed } from 'vue';
import CustomChip from "@/components/Base/CustomChip.vue";

const props = defineProps({
  history: {
    type: Object,
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

const getStringSkalaNyeri = computed(() => {
  if (!props.history || typeof props.history.data.skalaNyeri === 'undefined') {
    return '';
  }
  const skala = props.history.data.skalaNyeri;
  if (skala >= 1 && skala <= 3) {
    return `3 (Ringan)`;
  } else if (skala >= 4 && skala <= 6) {
    return `5 (Sedang)`;
  } else if (skala >= 7 && skala <= 10) {
    return `8 (Berat)`;
  }
  return `${skala}`;
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
          <CustomInfoRow
            label="Pengkajian Nyeri"
            :value="getStringSkalaNyeri"
            type="vertical"
          />
          <CustomInfoRow
            label="Catatan"
            :value="history.data.catatan"
            type="vertical"
          />
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
      </template>
    </CustomAccordion>
  </div>
</template>