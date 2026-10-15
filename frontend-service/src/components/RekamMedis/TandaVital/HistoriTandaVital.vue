<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue"; 
import { epochToDate, formatDate } from "@/utils/Helpers";
import { computed } from 'vue';
import type { PropType } from 'vue';

interface TandaVitalData {
  updatedAt: number;
  kriteriaPemantauan?: string;
  waktuAsesmen?: number;
  frekuensiNafas?: number;
  frekuensiNadi?: number;
  suhu?: number;
  crt?: boolean;
  bloodOxygen?: number;
  gulaDarah?: number;
  oksigenTambahan?: boolean;
  tekananDarahSistole?: number;
  tekananDarahDiastole?: number;
  respirasiAnak?: string;
  kardiovaskulerAnak?: string;
  keadaanUmum?: string;
  petugas?: string;
  createdAt: number;
}

interface TandaVitalHistory {
  session: any;
  date: number;
  jenisKunjungan: string;
  data: TandaVitalData;
}

const props = defineProps({
  history: {
    type: Object as PropType<TandaVitalHistory | null>,
    default: null,
  },
  layout: {
    type: String as PropType<"accordion" | "flat">,
    default: "accordion",
  },
});

const jenisKunjunganLabel = computed(() => {
  if (!props.history?.jenisKunjungan) return null;
  switch (props.history.jenisKunjungan) {
    case 'rj':
      return 'Rawat Jalan';
    case 'ri':
      return 'Rawat Inap';
    case 'igd':
      return 'IGD';
    default:
      return null
  }
});

const chipBgColor = computed(() => {
      return 'bg-white';
});

const chipTextColor = computed(() => {
      return 'text-grey-400';
});

const getValue = (value: any) => value ?? "-";

const getBooleanValue = (value?: boolean) => {
  if (value === undefined || value === null) return "-";
  return value ? "Ya" : "Tidak";
};

const tekananDarah = computed(() => {
  if (props.history?.data.tekananDarahSistole && props.history?.data.tekananDarahDiastole) {
    return `${props.history.data.tekananDarahSistole} / ${props.history.data.tekananDarahDiastole} mmHg`;
  }
  return "-";
});
</script>

<template>
  <div v-if="layout === 'accordion' && history && history.data">
    <CustomAccordion headerClass="bg-opensimrs-50" :initialState="'0'">
      <template #header>
        <span class="shrink-0 text-sm mr-2 mt-1">
          {{ epochToDate(history.date, "date") || "Data Riwayat" }}
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
            label="Kriteria Pemantauan"
            :value="getValue(history.data.kriteriaPemantauan)"
            type="vertical"
          />
          <CustomInfoRow
            label="Tgl. Asesmen"
            :value="
              history.data.waktuAsesmen
                ? formatDate(epochToDate(history.data.waktuAsesmen) as Date)
                : '-'
            "
            type="vertical"
          />
          <CustomInfoRow
            label="Jam Asesmen"
            :value="
              history.data.waktuAsesmen
                ? String(epochToDate(history.data.waktuAsesmen, 'time'))
                : '-'
            "
            type="vertical"
          />
          <CustomInfoRow
            label="Frekuensi Napas"
            :value="`${getValue(history.data.frekuensiNafas)} x/mnt`"
            type="vertical"
          />
          <CustomInfoRow
            label="Frekuensi Nadi"
            :value="`${getValue(history.data.frekuensiNadi)} x/mnt`"
            type="vertical"
          />
          <CustomInfoRow
            label="Suhu"
            :value="`${getValue(history.data.suhu)} °C`"
            type="vertical"
          />
          <CustomInfoRow
            label="Capilarry Refill Time ( CRT > 2 Detik )"
            :value="getBooleanValue(history.data.crt)"
            type="vertical"
          />
          <CustomInfoRow
            label="Blood Oxygen"
            :value="`${getValue(history.data.bloodOxygen)} %`"
            type="vertical"
          />
          <CustomInfoRow
            label="Gula Darah"
            :value="`${getValue(history.data.gulaDarah)} mg/dL`"
            type="vertical"
          />
          <CustomInfoRow
            label="Oksigen Tambahan"
            :value="getBooleanValue(history.data.oksigenTambahan)"
            type="vertical"
          />
          <CustomInfoRow
            label="Tekanan Darah"
            :value="tekananDarah"
            type="vertical"
          />
          <CustomInfoRow
            label="Respirasi Anak"
            :value="getValue(history.data.respirasiAnak)"
            type="vertical"
          />
          <CustomInfoRow
            label="Kardiovaskuler Anak"
            :value="getValue(history.data.kardiovaskulerAnak)"
            type="vertical"
          />
          <CustomInfoRow
            label="Keadaan Umum"
            :value="getValue(history.data.keadaanUmum)"
            type="vertical"
          />
          <hr class="border-grey-200" />
          <div class="flex justify-between">
            <CustomInfoRow
              label="Petugas Input"
              :value="getValue(history.data.petugas)"
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

  <div
    v-else-if="layout === 'flat' && history && history.data"
  >
    <CustomAccordion headerClass="bg-opensimrs-50" :initialState="'0'">
      <template #header>
        <span class="text-MD font-semibold">Tanda Vital</span>
      </template>
      <template #content>
        <div class="grid grid-cols-3 gap-x-6 gap-y-5 py-5">
          <CustomInfoRow
            label="Kriteria Pemantauan"
            :value="getValue(history.data.kriteriaPemantauan)"
            type="vertical"
          />
          <CustomInfoRow
            label="Tgl. Asesmen"
            :value="
              history.data.waktuAsesmen
                ? formatDate(epochToDate(history.data.waktuAsesmen) as Date)
                : '-'
            "
            type="vertical"
          />
          <CustomInfoRow
            label="Jam Asesmen"
            :value="
              history.data.waktuAsesmen
                ? String(epochToDate(history.data.waktuAsesmen, 'time'))
                : '-'
            "
            type="vertical"
          />
          <CustomInfoRow
            label="Frekuensi Napas"
            :value="`${getValue(history.data.frekuensiNafas)} x/mnt`"
            type="vertical"
          />
          <CustomInfoRow
            label="Frekuensi Nadi"
            :value="`${getValue(history.data.frekuensiNadi)} x/mnt`"
            type="vertical"
          />
          <CustomInfoRow
            label="Suhu"
            :value="`${getValue(history.data.suhu)} °C`"
            type="vertical"
          />
          <CustomInfoRow
            label="Capilarry Refill Time ( CRT > 2 Detik )"
            :value="getBooleanValue(history.data.crt)"
            type="vertical"
          />
          <CustomInfoRow
            label="Blood Oxygen"
            :value="`${getValue(history.data.bloodOxygen)} %`"
            type="vertical"
          />
          <CustomInfoRow
            label="Gula Darah"
            :value="`${getValue(history.data.gulaDarah)} mg/dL`"
            type="vertical"
          />
          <CustomInfoRow
            label="Oksigen Tambahan"
            :value="getBooleanValue(history.data.oksigenTambahan)"
            type="vertical"
          />
          <CustomInfoRow
            label="Tekanan Darah"
            :value="tekananDarah"
            type="vertical"
          />
          <CustomInfoRow
            label="Respirasi Anak"
            :value="getValue(history.data.respirasiAnak)"
            type="vertical"
          />
          <CustomInfoRow
            label="Kardiovaskuler Anak"
            :value="getValue(history.data.kardiovaskulerAnak)"
            type="vertical"
          />
          <CustomInfoRow
            label="Keadaan Umum"
            :value="getValue(history.data.keadaanUmum)"
            type="vertical"
          />
        </div>

        <hr class="border-grey-200 my-5" />
        <div class="flex justify-between pb-5">
          <CustomInfoRow
            label="Petugas Input"
            :value="getValue(history.data.petugas)"
            type="vertical"
          />
          <CustomInfoRow
            label="Jam Input"
            :value="String(epochToDate(history.data.updatedAt, 'time'))"
            type="vertical"
            alignment="right"
          />
        </div>
      </template>
    </CustomAccordion>
  </div>
</template>