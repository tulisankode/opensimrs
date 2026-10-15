<script setup lang="ts">
import CustomChip from "@/components/Base/CustomChip.vue";
const props = defineProps({
  monitoringBed: {
    default: Object
  },
});
</script>
<template>
  <Card style="width: full; overflow: hidden;" pt:body:class="px-2.5 bg-opensimrs-50 h-[80px] py-0 flex justify-center min-h-[80px]">

    <template #content>
      <div class="flex flex-col justify-between">
        <div class="flex items-center gap-2 text-opensimrs-300">
          <img src="../../assets/icons/fa6-solid_bed-pulse.svg" />
          <div class="text-xs font-normal leading-5">
            Bed {{ monitoringBed.nomorBed }} -
            <span class="text-xs font-bold leading-5">RM {{ monitoringBed.nomorRM }}</span>
          </div>
        </div>
        <div class="flex items-center">
          <div class="text-sm font-medium leading-5">{{ monitoringBed.namaPasien }}</div>
        </div>
        <div
          class="flex items-center gap-2 text-sm font-normal leading-5 mt-[3px]"
        >
          <CustomChip
            :label="monitoringBed.gender"
            text-color="text-male-300"
            borderColor="border-transparent"
            :showCheckedIcon="false"
            customClass="font-semibold flex h-4 border-2 rounded-full text-[8px] leading-5 bg-male-75"
          />
          <CustomChip
            :label="monitoringBed.asuransi"
            border-color="border-warning-300"
            text-color="text-warning-300"
            :showCheckedIcon="false"
            customClass="font-semibold flex h-4 border-2 rounded-full text-[8px] leading-5 bg-warning-50"
          />
        </div>
      </div>
    </template>
  </Card>
</template>
