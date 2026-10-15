<script setup lang="ts">
import { ref } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import MedicalRecord from "@/views/MedicalRecord/MedicalRecord.vue";

const medicalRecord = ref<typeof MedicalRecord>();
const openDialogRM = () => {
  medicalRecord.value?.showDialogRM();
};

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
      <div class="pt-3">
        <div class="flex flex-row mt-">
          <div class="basis-1/4">
            <p class="text-xs font-bold underline underline-offset-2">
              Keluhan Utama
            </p>
            <p>Sakit Mata</p>
            <div class="flex flex-wrap mt-1">
              <p
                class="text-xs font-bold underline underline-offset-2 mt-[10px]"
              >
                DPJP
              </p>
              <CustomChip
                :showCheckedIcon="false"
                label="Poli Syaraf"
                customClass="h-5 pr-[5px] ml-[15px] mt-2 "
              />
            </div>
            <p>dr. Anji Sp. M</p>
          </div>
          <div class="bg-mediumGrey-300 w-[1px] h-[85px] mr-[20px]"></div>
          <div class="mr-[180px]">
            <p class="text-xs font-bold underline underline-offset-2">
              Diagnosa Primer
            </p>
            <p class="">H10.9 Conjuctivitis</p>
            <p class="text-xs font-bold underline underline-offset-2 mt-[10px]">
              Diagnosa Sekunder
            </p>
            <p class="">-</p>
          </div>
          <div class="grid grid-cols-2 gap-40">
            <div>
              <p class="text-xs font-bold underline underline-offset-2">
                Diagnosa Sekunder
              </p>
              <p class="">-</p>
            </div>
            <div>
              <p class="text-xs font-bold underline underline-offset-2">
                Diagnosa Sekunder
              </p>
              <p class="">-</p>
            </div>
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
  <MedicalRecord ref="medicalRecord" :patientData="{}" />
</template>
