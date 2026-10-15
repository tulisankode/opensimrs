<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { epochToDate, formatDate } from "@/utils/Helpers"; // Pastikan import helper
import { computed } from "vue";
import { PhCheckCircle } from "@phosphor-icons/vue";

const props = defineProps({
  history: {
    type: Object,
    default: null,
  },
});

const jenisKunjunganLabel = computed(() => {
  switch (props.history?.jenisKunjungan) {
    case 'rj': return 'Rawat Jalan';
    case 'ri': return 'Rawat Inap';
    case 'igd': return 'IGD';
    default: return null;
  }
});

const chipBgColor = computed(() => 'bg-white');
const chipTextColor = computed(() => 'text-grey-400');

// Helper untuk nilai boolean/null
const getBooleanValue = (val: boolean) => (val ? "Ya" : "Tidak");
const getValue = (val: any) => (val ? val : "-");

</script>

<template>
  <div v-if="history && history.data">
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
            v-if="history.session"
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
          <CustomInfoRow label="Kasus" :value="getValue(history.data.kasus)" type="vertical" />
          <CustomInfoRow label="Cara Datang" :value="getValue(history.data.caraDatang)" type="vertical" />
          <CustomInfoRow label="Kendaraan" :value="getValue(history.data.kendaraan)" type="vertical" />
          <CustomInfoRow label="Keadaan Umum" :value="getValue(history.data.keadaanUmum)" type="vertical" />
          <CustomInfoRow label="Asal Rujukan" :value="getValue(history.data.asalRujukan)" type="vertical" />
          
          <hr class="border-grey-200" />
          
          <CustomInfoRow label="Mata" :value="getValue(history.data.eye)" type="vertical" />
          <CustomInfoRow label="Motorik" :value="getValue(history.data.motorik)" type="vertical" />
          <CustomInfoRow label="Verbal" :value="getValue(history.data.verbal)" type="vertical" />
          <CustomInfoRow label="Glasglow Coma Scale (GCS) Score" :value="getValue(history.data.gcsScore)" type="vertical" />
          <CustomInfoRow label="GCS Kesimpulan" :value="getValue(history.data.gcsKesimpulan)" type="vertical" />
          
          <CustomInfoRow 
            label="Tekanan Darah" 
            :value="`${getValue(history.data.tekananDarahSistole)}/${getValue(history.data.tekananDarahDiastole)} mmHg`" 
            type="vertical" 
          />
          <CustomInfoRow label="Frekuensi Nafas" :value="`${getValue(history.data.frekuensiNafas)} x/mnt`" type="vertical" />
          <CustomInfoRow label="Frekuensi Nadi" :value="`${getValue(history.data.frekuensiNadi)} x/mnt`" type="vertical" />
          <CustomInfoRow label="Capillary Refill Time (CRT > 2 detik)" :value="getBooleanValue(history.data.crt)" type="vertical" />
          <CustomInfoRow label="Suhu" :value="`${getValue(history.data.suhu)} °C`" type="vertical" />
          <CustomInfoRow label="Blood Oxygen" :value="`${getValue(history.data.bloodOxygen)} %`" type="vertical" />
          
          <hr class="border-grey-200" />
          
          <CustomInfoRow label="Kesimpulan Triase" :value="getValue(history.data.kesimpulanTriase)" type="vertical" />
          
          <div
            class="h-10 w-[60px] border border-grey-200 rounded-md mt-auto flex"
            :style="{ backgroundColor: history.data.warnaTriase || '#FFFFFF' }"
          >
            <PhCheckCircle 
              :size="25" 
              weight="fill" 
              class="m-auto"
              :class="history.data.warnaTriase === '#FFFFFF' ? 'text-black' : 'text-white'"
            />
          </div>
          
          <hr class="border-grey-200" />
          
          <div class="flex justify-between">
            <CustomInfoRow label="Petugas Input" :value="getValue(history.data.petugas)" type="vertical" />
            <CustomInfoRow 
              label="Jam Input" 
              :value="history.data.updatedAt ? String(epochToDate(history.data.updatedAt, 'time')) : '-'" 
              type="vertical" 
              alignment="right" 
            />
          </div>
        </div>
      </template>
    </CustomAccordion>
  </div>
  <div v-else class="text-center text-grey-400">Tidak ada riwayat.</div>
</template>