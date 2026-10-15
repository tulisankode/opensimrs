<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import { epochToDate } from "@/utils/Helpers";
import { type PropType, computed, ref } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";

const props = defineProps({
  history: {
    type: Object as PropType<any>,
    default: null,
  },
});

const listFundus = ref([
  { code: "1090009", tampilan: "Tingkat kekeruhan iris mata belum penuh" },
  { code: "34071009", tampilan: "Tingkat kekeruhan iris mata penuh" },
]);
const listShadowTest = ref([
  { code: "10828004", tampilan: "Tingkat kekeruhan iris mata belum penuh" },
  { code: "260385009", tampilan: "Tingkat kekeruhan iris mata penuh" },
]);
const listPemeriksaanLanjutan = ref([
  { code: "422256009", tampilan: "Counts fingers - distance vision" },
  { code: "260295004", tampilan: "Sees hand movements" },
  { code: "260296003", tampilan: "Light perception" },
  { code: "63063006", tampilan: "Visual acuity, no light perception" },
]);

const getFundusText = (code: string) => {
  if (!code) return "-";
  return listFundus.value.find((item: { code: string; }) => item.code === code)?.tampilan || code;
};
const getShadowTestText = (code: string) => {
  if (!code) return "-";
  return listShadowTest.value.find((item: { code: string; }) => item.code === code)?.tampilan || code;
};
const getPemeriksaanLanjutanText = (code: string) => {
  if (!code) return "-";
  return listPemeriksaanLanjutan.value.find((item: { code: string; }) => item.code === code)?.tampilan || code;
};

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
          <div class="font-semibold text-opensimrs-300 text-normal mb-[15px]">
            Tajam Penglihatan menggunakan Tes Uncorrected Snelled Chart
          </div>
          <CustomInfoRow
            label="Pemeriksaan Visus Kanan"
            :value="`${history.data.odVisusDenominator ?? '-'} / ${history.data.odVisusNumerator ?? '-'}`"
            type="vertical"
          />
          <hr class="border-opensimrs-300" />
          <CustomInfoRow
            label="Pemeriksaan Visus Kiri"
            :value="`${history.data.osVisusDenominator ?? '-'} / ${history.data.osVisusNumerator ?? '-'}`"
            type="vertical"
          />
          <hr class="-mx-4 border-grey-200 mt-[10px]" />

          <div class="font-semibold text-opensimrs-300 text-normal my-[15px]">
            Katarak
          </div>
          <CustomInfoRow
            label="Pemeriksaan Pinhole Kanan"
            :value="history.data.odHasilPinhole || '-'"
            type="vertical"
          />
          <CustomInfoRow
            label="Pemeriksaan Segment Anterior (Pupil) Kanan"
            :value="history.data.odPupilIsKatarak ? 'Curiga Katarak' : history.data.odSnomed || 'Kelainan Mata Lainnya'"
            type="vertical"
          />
          <hr class="border-opensimrs-300" />
          <CustomInfoRow
            label="Pemeriksaan Pinhole Kiri"
            :value="history.data.osHasilPinhole || '-'"
            type="vertical"
          />
          <CustomInfoRow
            label="Pemeriksaan Segment Anterior (Pupil) Kiri"
            :value="history.data.osPupilIsKatarak ? 'Curiga Katarak' : history.data.osSnomed || 'Kelainan Mata Lainnya'"
            type="vertical"
          />
          <hr class="-mx-4 border-grey-200 mt-[10px]" />

          <div class="font-semibold text-opensimrs-300 text-normal my-[15px]">
            Pemeriksaan dengan Oftalmoskop/Shadow test
          </div>
          <CustomInfoRow
            label="Pemeriksaan Reflek Fundus Kanan"
            :value="getFundusText(history.data.odFundus)"
            type="vertical"
          />
          <CustomInfoRow
            label="Pemeriksaan Shadow Test Kanan"
            :value="getShadowTestText(history.data.odShadowTest)"
            type="vertical"
          />
          <hr class="border-opensimrs-300" />
          <CustomInfoRow
            label="Pemeriksaan Reflek Fundus Kiri"
            :value="getFundusText(history.data.osFundus)"
            type="vertical"
          />
          <CustomInfoRow
            label="Pemeriksaan Shadow Test Kiri"
            :value="getShadowTestText(history.data.osShadowTest)"
            type="vertical"
          />
          <hr class="-mx-4 border-grey-200 mt-[10px]" />

          <div class="font-semibold text-opensimrs-300 text-normal my-[15px]">
            Kelainan Refraksi Mata Jauh
          </div>
          <div class="font-semibold underline text-normal">Mata Kanan</div>
          <div class="grid grid-cols-3 gap-y-[19px] mt-2">
            <CustomInfoRow label="Sph" :value="history.data.odSphJauh ?? '-'" type="vertical" />
            <CustomInfoRow label="Cyl" :value="history.data.odCyl ?? '-'" type="vertical" />
            <CustomInfoRow label="Axis" :value="history.data.odAxis ?? '-'" type="vertical" />
          </div>
          <div class="grid grid-cols-2 mt-2">
            <CustomInfoRow label="Visus Tajam" :value="`${history.data.odVisusTajamDenominator ?? '-'} / ${history.data.odVisusTajamNumerator ?? '-'}`" />
            <CustomInfoRow label="Hasil" :value="history.data.odHasilVisusTajam ?? '-'" />
          </div>
          <div class="font-semibold underline text-normal mt-4">Mata Kiri</div>
          <div class="grid grid-cols-3 gap-y-[19px] mt-2">
            <CustomInfoRow label="Sph" :value="history.data.osSphJauh ?? '-'" type="vertical" />
            <CustomInfoRow label="Cyl" :value="history.data.osCyl ?? '-'" type="vertical" />
            <CustomInfoRow label="Axis" :value="history.data.osAxis ?? '-'" type="vertical" />
          </div>
          <div class="grid grid-cols-2 mt-2">
            <CustomInfoRow label="Visus Tajam" :value="`${history.data.osVisusTajamDenominator ?? '-'} / ${history.data.osVisusTajamNumerator ?? '-'}`" />
            <CustomInfoRow label="Hasil" :value="history.data.osHasilVisusTajam ?? '-'" />
          </div>
          <hr class="-mx-4 border-grey-200 mt-[10px]" />

          <div class="font-semibold text-opensimrs-300 text-normal my-[15px]">
            Pemeriksaan Lanjutan (Jika Buta)
          </div>
          <CustomInfoRow
            label="Pemeriksaan Lanjutan Kanan"
            :value="getPemeriksaanLanjutanText(history.data.odPemeriksaanLanjutan)"
            type="vertical"
          />
          <hr class="border-opensimrs-300" />
          <CustomInfoRow
            label="Pemeriksaan Lanjutan Kiri"
            :value="getPemeriksaanLanjutanText(history.data.osPemeriksaanLanjutan)"
            type="vertical"
          />
          <hr class="-mx-4 border-grey-200 mt-[10px]" />

          <div class="font-semibold text-opensimrs-300 text-normal my-[15px]">
            Kelainan Refraksi Mata Dekat
          </div>
          <div class="font-semibold underline text-normal">Mata Kanan</div>
          <CustomInfoRow
            label="Koreksi Lensa addisi (Sph +)"
            :value="history.data.odSphDekat ?? '-'"
            type="vertical"
          />
          <CustomInfoRow
            label="Dicurigai Glaukoma"
            :value="history.data.odHasilGlaukoma || '-'"
            type="vertical"
          />
          <CustomInfoRow
            label="Dicurigai Retinopati"
            :value="history.data.odIsRetinopati ? 'Suspek Retinopati' : 'Normal'"
            type="vertical"
          />
          <div class="font-semibold underline text-normal mt-4">Mata Kiri</div>
          <CustomInfoRow
            label="Koreksi Lensa addisi (Sph +)"
            :value="history.data.osSphDekat ?? '-'"
            type="vertical"
          />
          <CustomInfoRow
            label="Dicurigai Glaukoma"
            :value="history.data.osHasilGlaukoma || '-'"
            type="vertical"
          />
          <CustomInfoRow
            label="Dicurigai Retinopati"
            :value="history.data.osIsRetinopati ? 'Suspek Retinopati' : 'Normal'"
            type="vertical"
          />

          <hr class="border-grey-200 mt-4" />
          <div class="flex justify-between">
            <CustomInfoRow
              label="Petugas Input"
              :value="history.data.petugas || '-'"
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