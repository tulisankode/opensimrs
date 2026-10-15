<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import { epochToDate } from "@/utils/Helpers";
import { computed } from "vue";
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
        <div class="py-5 flex flex-col gap-[10px]">
          <CustomInfoRow label="Pemicu Alergi" :value="history.data.pemicuAlergi" type="vertical" />
          <CustomInfoRow label="Nama / Jenis Alergi" :value="history.data.namaAlergi" type="vertical" />
          <CustomInfoRow label="Reaksi" :value="history.data.reaksiAlergi" type="vertical" />
          <CustomInfoRow label="Tingkat Keparahan" :value="history.data.tingkatKeparahanAlergi" type="vertical" />
          <CustomInfoRow label="Efek Samping" :value="history.data.efekSampingAlergi" type="vertical" />
          <CustomInfoRow label="Tanggal Kejadian"
            :value="String(epochToDate(history.data.tanggalKejadianAlergi, 'date'))" type="vertical" />
          <hr class="border-grey-200" />
          <div class="flex justify-between">
            <CustomInfoRow label="Petugas Input" :value="history.data.petugas" type="vertical" />
            <CustomInfoRow label="Jam Input" :value="String(epochToDate(history.data.updatedAt, 'time'))"
              type="vertical" alignment="right" />
          </div>
        </div>
      </template>
    </CustomAccordion>
  </div>
  <div v-else class="text-center text-grey-400">Tidak ada riwayat.</div>
</template>