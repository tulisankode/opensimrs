<script setup lang="ts">
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import RekamMedisOrderLab from "../RekamMedisOrderLab.vue";
import { computed, ref, type PropType } from "vue";
import type { MenuItem } from "primevue/menuitem";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  formType: {
    type: String,
    default: "",
  },
  isDetail: {
    type: Boolean,
    required: false,
  },
  openedPatientData: {
    type: Object as PropType<any>,
    required: true,
  },
});

// Sebelumnya MedicalRecord dibuka dengan patientData kosong → hanya backdrop abu-abu
const rekamMedisOrderLab = ref<InstanceType<typeof RekamMedisOrderLab> | null>(null);
const openDialogRM = () => rekamMedisOrderLab.value?.buka(props.openedPatientData);

const submitForm = () => {
  console.log("Submited Patient Identity Form");
};

defineExpose({
  submitForm,
});
</script>

<template>
  <CustomAccordion :openWithHeader="false" initial-state="0">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div class="flex">
          <p class="leading-10 text-bold text-heading">Asesmen Medis</p>
        </div>
        <div class="mr-4">
          <CustomButton
            @click="openDialogRM"
            label="Detail Rekam Medis"
          ></CustomButton>
        </div>
      </div>
    </template>
    <template #content>
      <div class="grid grid-cols-3 gap-4">
        <div class="basis-1/4">
          <p class="text-xs font-bold underline underline-offset-2">
            Unit Asal
          </p>
          <p>{{ openedPatientData.lokasi?.name }}</p>
          <p class="text-xs font-bold underline underline-offset-2 mt-[10px]">
            Maternitas
            <span> </span>
          </p>
          <p>{{ openedPatientData.pasienMaternitas ? "Iya" : "Tidak" }}</p>
          <p class="text-xs font-bold underline underline-offset-2 mt-[10px]">
            Catatan
            <span> </span>
          </p>
          <p>{{ openedPatientData.catatan }}</p>
        </div>

        <div>
          <div class="flex">
            <p class="mr-2 text-xs font-bold underline underline-offset-2">
              Dokter Pengirim
            </p>
            <CustomChip
              :showCheckedIcon="false"
              :label="openedPatientData.pelayanan"
              customClass="h-5 pr-[5px] mr-[5px]"
            />
                <CustomChip v-if="openedPatientData.isMcu" :showCheckedIcon="false" label="MCU" bgColor="bg-warning-50" textColor="text-warning-300" borderColor="border-warning-300" customClass="h-5 pr-[5px] mr-[5px]" />
          </div>
          <p class="">
            {{ openedPatientData.dokterPengirim?.pegawai?.firstTitle }}
            {{ openedPatientData.dokterPengirim?.pegawai?.name }}
            {{ openedPatientData.dokterPengirim?.pegawai?.lastTitle }}
          </p>
          <p class="text-xs font-bold underline underline-offset-2 mt-[10px]">
            Keluhan Utama
          </p>
          <p class="">{{ openedPatientData.keluhanUtama || "-" }}</p>
          <p class="text-xs font-bold underline underline-offset-2 mt-[10px]">
            Alergi
          </p>
          <p class="">Tidak Ada</p>
        </div>
        <div class="flex mr-[80px]">
          <div class="bg-mediumGrey-300 w-[1px] h-[135px] mr-[20px]"></div>
          <div class="">
            <p class="text-xs font-bold underline underline-offset-2">
              Diagnosa Sekunder
            </p>
            <p class="">{{ openedPatientData.diagnosis || "-" }}</p>
            <p class="text-xs font-bold underline underline-offset-2 mt-[10px]">
              Diagnosa Sekunder
            </p>
            <p class="">-</p>
          </div>
        </div>
      </div>
    </template>
    <template #collapseIcon>
      <CustomButton
        icon="PhCaretUp"
        backgroundColor="bg-transparent"
        textColor="text-opensimrs-300"
      />
    </template>
    <template #expandIcon>
      <CustomButton
        icon="PhCaretDown"
        backgroundColor="bg-transparent"
        textColor="text-opensimrs-300"
      />
    </template>
  </CustomAccordion>
  <RekamMedisOrderLab ref="rekamMedisOrderLab" />
</template>
