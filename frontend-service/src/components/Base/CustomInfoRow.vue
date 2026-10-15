<script lang="ts" setup>
const props = defineProps({
  label: String,
  value: String,
  type: {
    type: String as () => "horizontal" | "vertical",
    default: "horizontal",
  },
  alignment: {
    type: String as () => "left" | "right",
    default: "left",
  },
});
</script>
<template>
  <div
    class="grid w-full text-normal"
    :class="[
      type == 'horizontal' ? 'grid-cols-12 gap-2.5' : 'grid-cols-1',
      alignment == 'right' ? 'text-right' : '',
    ]"
  >
    <div class="flex justify-between col-span-4 text-normal">
      <div class="font-semibold" :class="{ 'w-full': alignment == 'right' }">
        {{ label }}
      </div>
      <div v-if="type == 'horizontal'">:</div>
    </div>
    <div class="col-span-7">
      <slot name="value">
        {{ value }}
      </slot>
    </div>
  </div>
</template>
