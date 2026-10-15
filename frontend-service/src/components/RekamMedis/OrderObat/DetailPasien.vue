<script setup lang="ts">
import type { PropType } from "vue";
import { formatDate } from "@/utils/Helpers";
import CustomChip from "@/components/Base/CustomChip.vue";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";

// NOTE Store
const rekamMedisStore = useRekamMedisStore();

const props = defineProps({
  rmType: {
    type: String,
    default: "rawat-jalan",
  },
  patientData: {
    type: Object,
  },
  summaryData: {
    type: Object as PropType<any>,
  },
});
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex gap-12">
      <div class="flex flex-col gap-1">
        <div class="font-semibold underline text-XS">Jenis Kelamin</div>
        <CustomChip
          :showCheckedIcon="false"
          :label="
            patientData?.patient.gender == 'Male' ? 'Laki-laki' : 'Perempuan'
          "
          :bgColor="
            patientData?.patient.gender == 'Male'
              ? 'bg-male-75'
              : 'bg-female-75'
          "
          :textColor="
            patientData?.patient.gender == 'Male'
              ? 'text-male-300'
              : 'text-female-300'
          "
          customClass="h-5 pr-[6px] border-none mr-[5px]"
        />
      </div>
      <div class="flex flex-col items-start gap-1">
        <div class="w-full font-semibold underline text-XS">Tanggal Lahir</div>
        <div class="flex items-center text-normal">
          {{ formatDate(new Date(patientData?.patient.birthDetail.birthDate)) }}
          |
          <span class="font-semibold text-opensimrs-300">
            {{ patientData?.patient.birthDetail.ageYear }}Th
            {{ patientData?.patient.birthDetail.ageMonth }}Bl
            {{ patientData?.patient.birthDetail.ageDay }}Hr
          </span>
        </div>
      </div>
    </div>

    <!-- Kotak Kedua -->
    <div class="rounded-md bg-opensimrs-50">
      <!-- Padding dalem -->
      <div class="px-2.5 py-2">
        <div class="flex gap-4 border-b border-grey-100 py-2.5">
          <!-- T.Darah -->
          <div class="flex w-1/3 gap-2">
            <div class="font-semibold text-XS">T.Darah</div>
            <div class="font-normal text-XS rounded-[4px] bg-white px-[5px]">
              {{
                rekamMedisStore.openedRekamMedis.summary.tekananDarahSistole
              }}/{{
                rekamMedisStore.openedRekamMedis.summary.tekananDarahDiastole
              }}
              mmHg
            </div>
          </div>
          <!-- Frek nadi -->
          <div class="flex w-1/3 gap-2">
            <div class="font-semibold text-XS">Frek.Nadi</div>
            <div class="font-normal text-XS rounded-[4px] bg-white px-[5px]">
              {{ rekamMedisStore.openedRekamMedis.summary.frekuensiNadi }} x/mnt
            </div>
          </div>
          <div class="flex w-1/3 gap-2">
            <div class="font-semibold text-XS">Frek. Nafas</div>
            <div class="font-normal text-XS rounded-[4px] bg-white px-[5px]">
              {{ rekamMedisStore.openedRekamMedis.summary.frekuensiNafas }}
              x/mnt
            </div>
          </div>
        </div>

        <div class="flex gap-4 border-b border-grey-100 py-2.5">
          <!-- Frek nadi -->
          <div class="flex w-1/3 gap-2">
            <div class="font-semibold text-XS">Suhu</div>
            <div class="font-normal text-XS rounded-[4px] bg-white px-[5px]">
              {{ rekamMedisStore.openedRekamMedis.summary.suhu }} °C
            </div>
          </div>
          <!-- T.Darah -->
          <div class="flex w-1/3 gap-2">
            <div class="font-semibold text-XS">Berat</div>
            <div class="font-normal text-XS rounded-[4px] bg-white px-[5px]">
              {{ rekamMedisStore.openedRekamMedis.summary.beratBadan }} Kg
            </div>
          </div>
          <!-- Frek nadi -->
          <div class="flex w-1/3 gap-2">
            <div class="font-semibold text-XS">Tinggi</div>
            <div class="font-normal text-XS rounded-[4px] bg-white px-[5px]">
              {{ rekamMedisStore.openedRekamMedis.summary.tinggiBadan }} cm
            </div>
          </div>
        </div>

        <div class="flex gap-4 border-b border-grey-100 py-2.5">
          <!-- T.Darah -->
          <div class="flex w-1/3 gap-2">
            <div class="font-semibold text-XS">Skor CGS</div>
            <div class="font-normal text-XS rounded-[4px] bg-white px-[5px]">
              {{ rekamMedisStore.openedRekamMedis.summary.gcsScore }}
            </div>
          </div>
          <!-- Frek nadi -->
          <div class="flex w-1/3 gap-2">
            <div class="font-semibold text-XS">Skala Nyeri</div>
            <div class="font-normal text-XS rounded-[4px] bg-white px-[5px]">
              {{ rekamMedisStore.openedRekamMedis.summary.skalaNyeri }}
            </div>
          </div>
          <div class="flex w-1/3 gap-2">
            <div class="font-semibold text-XS">Alergi</div>
            <div class="font-normal text-XS rounded-[4px] bg-white px-[5px]">
              {{ rekamMedisStore.openedRekamMedis.summary.namaAlergi }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Kotak Ketiga -->
    <div class="rounded-md bg-opensimrs-50 px-2.5 py-2 flex flex-col gap-2">
      <div class="flex flex-col gap-1">
        <div class="font-semibold text-XS">Keluhan</div>
        <div class="font-normal bg-white text-SM rounded-[4px] px-1">
          {{ rekamMedisStore.openedRekamMedis.summary.keluhanUtama }}
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <div class="font-semibold text-XS">Diagnosa Primer</div>
        <div class="font-normal bg-white text-SM rounded-[4px] px-1">
          {{ rekamMedisStore.openedRekamMedis.summary.diagnosisPrimer }}
        </div>
      </div>
    </div>
    <hr class="border-grey-200" />
  </div>
</template>
