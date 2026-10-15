<script setup lang="ts">
const props = defineProps({
  class: {
    type: String,
    default: "text-black",
  },
  size: {
    type: Number,
    default: 20,
  },
});
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="`0 0 18 19`"
    fill="none"
    :class="class"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15.0068 9.02609L10.5046 13.5283M15.0068 9.02609L10.5046 4.52385M15.0068 9.02609L7.12793 9.02609M3.00088 9.02609L4.87681 9.02609"
      stroke="currentColor"
      stroke-width="1.50074"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
