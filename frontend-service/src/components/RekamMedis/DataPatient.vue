<script setup lang="ts">
import { ref, computed } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import type { PropType } from "vue";
import { epochToDate, formatDate } from "@/utils/Helpers";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";

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

const showPatientData = ref(true);
const metaData = computed(() => rekamMedisStore.openedRekamMedis?.meta);
</script>

<template>
  <div class="text-XS">
    <Transition name="slide-fade">
      <div v-if="showPatientData">
        <div class="grid grid-cols-5 mb-[10px]">
          <div class="flex col-span-2">
            <div class="grid grid-cols-3 grow">
              <div class="mr-5">
                <div class="font-semibold underline mb-[5px] leading-5">
                  No. Registrasi
                </div>
                <div class="text-normal">{{ patientData?.noReg }}</div>
              </div>
              <div class="mr-5">
                <div class="font-semibold underline mb-[5px] leading-5">
                  Jenis Kelamin
                </div>
                <CustomChip
                  :showCheckedIcon="false"
                  :label="
                    patientData?.patient.gender == 'Male'
                      ? 'Laki-laki'
                      : 'Perempuan'
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
              <div>
                <div class="font-semibold underline mb-[5px] leading-5">
                  Tanggal Lahir
                </div>
                <div class="text-normal">
                  {{
                    formatDate(
                      new Date(patientData?.patient?.birthDetail?.birthDate)
                    )
                  }}
                  |
                  <span class="font-semibold text-opensimrs-300">
                    {{ patientData?.patient?.birthDetail?.ageYear }}Th
                    {{ patientData?.patient?.birthDetail?.ageMonth }}Bl
                    {{ patientData?.patient?.birthDetail?.ageDay }}Hr
                  </span>
                </div>
              </div>
            </div>
            <div class="mx-[45px] border-[1px] border-opensimrs-300"></div>
          </div>
          <div class="grid grid-cols-4 col-span-3">
            <div class="mr-5">
              <div class="font-semibold underline mb-[5px] leading-5">
                Tanggal Pelayanan
              </div>
              <div v-if="(rmType === 'rawat-inap' || rmType === 'igd') && patientData?.tanggalDirawat" class="text-normal">
                {{ epochToDate(patientData?.tanggalDirawat, "date") || '-' }}
                <span class="text-grey-400">
                  {{ epochToDate(patientData?.tanggalDirawat, "time") || '-' }}
                </span>
              </div>

              <div v-else-if="rmType === 'rawat-jalan' && patientData?.tanggalPeriksa" class="text-normal">
                {{ epochToDate(patientData?.tanggalPeriksa, "date") || '-' }}
                <span class="text-grey-400">
                  {{ epochToDate(patientData?.tanggalPeriksa, "time") || '-' }}
                </span>
              </div>
            </div>
            <!-- FIXME Belum Ada -->
            <div class="mr-5">
              <div class="font-semibold underline mb-[5px] leading-5">
                {{ rmType == 'rawat-inap' ? 'DPJP' : 'Dokter' }}
                <CustomChip
                  v-if="rmType == 'igd'"
                  :showCheckedIcon="false"
                  label="IGD"
                  customClass="h-5 ml-[5px]"
                />
                <!-- Rawat inap: ruang rawat (bukan poli) -->
                <CustomChip
                  v-else-if="rmType == 'rawat-inap'"
                  :showCheckedIcon="false"
                  :label="(patientData?.ruangan?.name || patientData?.monitoringRoom?.room?.name || patientData?.lokasi?.name || 'Rawat Inap').toUpperCase()"
                  customClass="h-5 ml-[5px]"
                />
                <CustomChip
                  v-else
                  :showCheckedIcon="false"
                  :label="(patientData?.lokasi?.name || patientData?.polyclinic?.name || 'Poli').toUpperCase()"
                  customClass="h-5 ml-[5px]"
                />
              </div>
              <div class="text-normal">
                  {{ patientData?.practitioner?.pegawai?.firstTitle || '' }}
                  {{ patientData?.practitioner?.pegawai?.nama || patientData?.practitioner?.pegawai?.name || '' }}
                  {{ patientData?.practitioner?.pegawai?.lastTitle || '' }}
              </div>
            </div>
            <!-- FIXME Belum Ada -->
            <div class="mr-5">
              <div class="font-semibold underline mb-[5px] leading-5">
              Asesmen Terakhir
            </div>
            <div v-if="metaData?.updatedAt" class="text-normal">
              {{ epochToDate(metaData.updatedAt, "date") }}
              <span class="text-grey-400">
                {{ epochToDate(metaData.updatedAt, "time") }}
              </span>
            </div>
            <div v-else class="text-normal">
              -
            </div>
            </div>
            <div class="mr-5">
              <div class="font-semibold underline mb-[5px] leading-5">
                Tagihan
                <CustomChip
                  :showCheckedIcon="false"
                  :label="
                    patientData?.paymentMethod == 1 ? 'TUNAI' : 'ASURANSI'
                  "
                  :bgColor="
                    patientData?.paymentMethod == 1
                      ? 'bg-opensimrs-50'
                      : 'bg-warning-50'
                  "
                  :textColor="
                    patientData?.paymentMethod == 1
                      ? 'text-opensimrs-300'
                      : 'text-warning-300'
                  "
                  :borderColor="
                    patientData?.paymentMethod == 1
                      ? 'border-opensimrs-300'
                      : 'border-warning-300'
                  "
                  customClass="h-5 ml-[5px]"
                />
              </div>
              <!-- FIXME Belum Ada -->
              <div class="text-normal">
                Rp. {{ (patientData?.serviceBill?.grandTotal || 0).toLocaleString('id-ID') }}
              </div>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-[5px]">
          <div class="bg-opensimrs-50 px-[15px] py-[10px] rounded-md">
            <div class="flex">
              <div class="grow">
                <div class="flex justify-between mb-[10px]">
                  <span class="font-semibold leading-5">T.Darah</span>
                  <span class="h-5 bg-white rounded-[4px] px-[5px] leading-5">
                    {{ summaryData?.tekananDarahSistole }}/{{
                      summaryData?.tekananDarahDiastole
                    }}
                    mmHg
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="font-semibold leading-5">Frek. Nadi</span>
                  <span class="h-5 bg-white rounded-[4px] px-[5px] leading-5">
                    {{ summaryData?.frekuensiNadi }} x/mnt
                  </span>
                </div>
              </div>
              <div class="mx-5 border-[1px] border-grey-100"></div>
              <div class="grow">
                <div class="flex justify-between mb-[10px]">
                  <span class="font-semibold leading-5">Frek. Nafas</span>
                  <span class="h-5 bg-white rounded-[4px] px-[5px] leading-5">
                    {{ summaryData?.frekuensiNafas }} x/mnt
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="font-semibold leading-5">Suhu</span>
                  <span class="h-5 bg-white rounded-[4px] px-[5px] leading-5">
                    {{ summaryData?.suhu }} °C
                  </span>
                </div>
              </div>
              <div class="mx-5 border-[1px] border-grey-100"></div>
              <div class="grow">
                <div class="flex justify-between mb-[10px]">
                  <span class="font-semibold leading-5">Berat</span>
                  <span class="h-5 bg-white rounded-[4px] px-[5px] leading-5">
                    {{ summaryData?.beratBadan }} Kg
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="font-semibold leading-5">Tinggi</span>
                  <span class="h-5 bg-white rounded-[4px] px-[5px] leading-5">
                    {{ summaryData?.tinggiBadan }} Cm
                  </span>
                </div>
              </div>
              <div class="mx-5 border-[1px] border-grey-100"></div>
              <div class="grow">
                <div class="flex justify-between mb-[10px]">
                  <span class="font-semibold leading-5">Skor GCS</span>
                  <span class="h-5 bg-white rounded-[4px] px-[5px] leading-5">
                    {{ summaryData?.gcsScore }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="font-semibold leading-5">Skala Nyeri</span>
                  <span class="h-5 bg-white rounded-[4px] px-[5px] leading-5">
                    {{ summaryData?.skalaNyeri }}
                  </span>
                </div>
              </div>
              <div class="mx-5 border-[1px] border-grey-100"></div>
              <div class="grow">
                <div class="flex justify-between mb-[10px]">
                  <span class="font-semibold leading-5">Alergi</span>
                  <span class="h-5 bg-white rounded-[4px] px-[5px] leading-5">
                    {{ summaryData?.namaAlergi }}
                  </span>
                </div>
                <!-- FIXME Kurang Data -->
                <div
                  v-if="rmType == 'igd' && summaryData?.warnaTriase != '-'"
                  class="font-semibold text-center h-5 leading-5 rounded-[50px] shadow-lg"
                  :class="[
                    summaryData?.warnaTriase == '#FFFFFF'
                      ? 'text-black'
                      : 'text-white',
                    `bg-[${summaryData?.warnaTriase}]`,
                  ]"
                  :style="{ backgroundColor: summaryData?.warnaTriase }"
                >
                  TRIASE
                </div>
              </div>
            </div>
          </div>
          <div class="bg-opensimrs-50 text-XS px-[15px] py-[10px] rounded-md">
            <div class="flex">
              <div class="mr-[10px]">
                <div class="flex mb-[10px]">
                  <span class="font-semibold leading-5">Keluhan</span>
                </div>
                <div class="flex">
                  <span class="font-semibold leading-5">Diagnosis Primer</span>
                </div>
              </div>
              <div class="grow">
                <div
                  class="mb-[10px] h-5 bg-white rounded-[4px] px-[5px] leading-5 w-full"
                >
                  {{ summaryData?.keluhanUtama }}
                </div>
                <div class="flex">
                  <div
                    class="h-5 bg-white rounded-[4px] px-[5px] leading-5 w-full mr-[10px]"
                  >
                    {{ summaryData?.diagnosisPrimer }}
                  </div>
                  <div
                    class="h-5 text-white bg-opensimrs-300 rounded-[4px] px-[5px] leading-5 min-w-max"
                  >
                    ICD 10
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <div
      class="flex justify-between"
      :class="[showPatientData ? 'mt-[10px]' : '']"
    >
      <div class="h-[1px] border border-grey-200 grow my-auto"></div>
      <div
        v-if="showPatientData"
        @click="showPatientData = false"
        class="flex text-white bg-opensimrs-300 py-[5px] px-[10px] rounded-[50px] cursor-pointer mx-[10px]"
      >
        <PhCaretDoubleUp :size="14" weight="bold" />
        <span class="mx-2"> Sembunyikan </span>
        <PhCaretDoubleUp :size="14" weight="bold" />
      </div>
      <div
        v-else
        @click="showPatientData = true"
        class="flex text-white bg-opensimrs-300 py-[5px] px-[10px] rounded-[50px] cursor-pointer mx-[10px]"
      >
        <PhCaretDoubleDown :size="14" weight="bold" />
        <span class="mx-2"> Tampilkan </span>
        <PhCaretDoubleDown :size="14" weight="bold" />
      </div>
      <div class="h-[1px] border border-grey-200 grow my-auto"></div>
    </div>
  </div>
</template>

<style>
.slide-fade-enter-active {
  transition: all 0.3s ease-in;
}

.slide-fade-leave-active {
  transition: all 0.3s ease-out;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}
</style>
