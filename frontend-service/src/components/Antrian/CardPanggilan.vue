<script lang="ts" setup>
const props = defineProps({
  cardPanggilan: {
    default: Object
  },
});
</script>

<template>
  <Card
    style="width: full; overflow: hidden; height: full"
    pt:body:class="p-0 bg-opensimrs-50"
    pt:header:class="h-full max-h-full grow"
    pt:root:class="h-full"
  >
    <template #header class="grow">
      <div class="flex items-center justify-center py-3">
        <div
          class="font-bold text-[26.67px] leading-[27.78px] text-opensimrs-300"
        >
          {{ cardPanggilan.noAntri }}
        </div>
      </div>
    </template>
    <template #content>
      <div class="flex">
        <div
          class="rounded-r-lg w-[44.44px] h-[44.44px] flex items-center justify-center bg-opensimrs-300"
        >
          <PhCaretDoubleRight :size="14" color="white" />
        </div>
        <div class="w-full h-[44.44px] mx-3 flex flex-col justify-center">
          <div class="font-bold text-normal leading-[17.78px] flex">
            {{ cardPanggilan.namaPoli }}
          </div>
          <hr class="border-opensimrs-300 border-[0.56px]" />
          <div class="font-semibold text-SM leading-[17.78px] flex">
            {{ cardPanggilan.namaDokter }}
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
