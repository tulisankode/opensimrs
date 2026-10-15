<script setup lang="ts">
import CustomChip from "@/components/Base/CustomChip.vue";
</script>

<template>
  <div
    class="h-20 rounded-lg bg-opensimrs-50 px-5 py-[5px] text-SM flex justify-between"
  >
    <div class="my-auto">
      <div class="font-bold">
        <span class="mr-[5px]">IGD</span>
        <CustomChip
          customClass="h-[15px]"
          textColor="text-opensimrs-300"
          borderColor="border-opensimrs-300"
          label="TUNAI"
          :showCheckedIcon="false"
        />
      </div>
      <div class="flex text-grey-400">
        <img src="../../../assets/icons/Doctor.svg" alt="" />
        <span class="leading-6 ml-[3px]">dr. Contoh Dokter</span>
      </div>
      <div class="grid grid-cols-[56px_32px_120px]">
        <span class="">Tanggal</span>
        <PhArrowRight
          :size="18"
          class="my-auto text-success-300"
          weight="bold"
        />
        <span class="">2024-6-12 09:00</span>
      </div>
    </div>
    <div class="flex">
      <CustomChip
        customClass="h-[24px]"
        textColor="text-success-300"
        textSize="text-SM"
        bgColor="bg-success-50"
        :outlined="false"
        label="Lunas"
        class="my-auto"
        :showCheckedIcon="false"
      />
    </div>
  </div>
</template>
