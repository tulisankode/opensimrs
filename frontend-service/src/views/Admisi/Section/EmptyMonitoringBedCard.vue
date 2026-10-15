<script setup lang="ts">
const props = defineProps({
  bedData: {
    type: Object,
    default: () => {},
  },
});
</script>

<template>
  <div
    class="rounded-[5px] h-[84px] px-[10px] py-[5px] border-dashed border-2 border-opensimrs-300 flex cursor-pointer"
  >
    <div class="flex m-auto text-XS text-opensimrs-300">
      <img
        src="../../../assets/icons/admisi/people-bed.svg"
        alt=""
        class="h-6 mr-[5px]"
      />
      <span class="leading-6">Bed {{ props.bedData.noBed }}</span>
      <span class="font-bold leading-6"> - KOSONG</span>
    </div>
  </div>
</template>
