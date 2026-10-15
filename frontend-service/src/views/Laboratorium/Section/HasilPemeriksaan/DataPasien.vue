<script setup lang="ts">
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
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

const formatDate = (dateString: string) => {
  if (!dateString) return "";

  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const date = new Date(dateString);
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
};

</script>

<template>
  <CustomAccordion :openWithHeader="false" initial-state="0">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div class="flex">
          <p class="leading-10 text-bold text-heading">Data Pasien</p>
          <CustomButton class="ml-4">{{
            openedPatientData.noOrder
          }}</CustomButton>
          <CustomChip
            :showCheckedIcon="false"
            :label="openedPatientData.paymentMethod == 1 ? 'TUNAI' : 'ASURANSI'"
            :bgColor="
              openedPatientData.paymentMethod == 1
                ? 'bg-opensimrs-50'
                : 'bg-warning-50'
            "
            :textColor="
              openedPatientData.paymentMethod == 1
                ? 'text-opensimrs-300'
                : 'text-warning-300'
            "
            :borderColor="
              openedPatientData.paymentMethod == 1
                ? 'border-opensimrs-300'
                : 'border-warning-300'
            "
            customClass=" h-6 mt-2 ml-4"
          />
        </div>
      </div>
    </template>
    <template #content>
      <div class="pt-5">
        <div class="grid grid-cols-3 gap-4">
          <div class="basis-1/4">
            <p class="font-bold text-MD">
              {{ openedPatientData.patient?.name }}
            </p>
            <p>{{ openedPatientData.noreg }}</p>
            <CustomButton class="w-24 h-5 text-sm">{{
              openedPatientData.noRm
            }}</CustomButton>
            <CustomChip
              :showCheckedIcon="false"
              :label="
                openedPatientData.patient?.gender == 'Female'
                  ? 'Perempuan'
                  : 'Laki-laki'
              "
              :bgColor="
                openedPatientData.patient?.gender == 'Female'
                  ? 'bg-female-75'
                  : 'bg-male-75'
              "
              :textColor="
                openedPatientData.patient?.gender == 'Female'
                  ? 'text-female-300'
                  : 'text-male-300'
              "
              customClass="h-5 pr-[6px] border-none mr-[5px] ml-2"
            />
          </div>
          <div class="flex">
            <div class="bg-mediumGrey-300 w-[1px] h-[85px] mr-[20px]"></div>
            <div class="mt-[20px] mr-[40px]">
              <p class="text-xs font-bold underline underline-offset-2">
                Tgl. Lahir
              </p>
              <p class="">
                {{
                  formatDate(openedPatientData.patient?.birthDetail?.birthDate)
                }}
              </p>
            </div>
          </div>
          <div class="mt-[20px] mr-[40px]">
            <p class="text-xs font-bold underline underline-offset-2">Umur</p>
            <p class="">
              {{ openedPatientData.patient?.birthDetail?.ageYear }}Th
              {{ openedPatientData.patient?.birthDetail?.ageMonth }}Bln
              {{ openedPatientData.patient?.birthDetail?.ageDay }}Hr
            </p>
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
</template>
