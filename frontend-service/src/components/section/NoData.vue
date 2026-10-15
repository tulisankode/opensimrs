<script setup lang="ts">
const props = defineProps({
  title: {
    type: String,
    default: "No data available",
  },
});
</script>

<template>
  <div
    class="flex flex-col h-full border-2 border-dashed rounded-lg border-grey-100"
  >
    <div class="m-auto">
      <img
        src="../../assets/icons/no-data-icon.svg"
        alt="no data"
        class="mx-auto"
      />
      <div class="text-grey-200">{{ title }}</div>
    </div>
  </div>
</template>
