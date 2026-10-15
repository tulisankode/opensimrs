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
    :viewBox="`0 0 20 20`"
    fill="none"
    :class="class"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18 10C18 10.5523 17.5523 11 17 11H11.5C11.2239 11 11 11.2239 11 11.5V17C11 17.5523 10.5523 18 10 18H8C7.44772 18 7 17.5523 7 17V11.5C7 11.2239 6.77614 11 6.5 11H1C0.447715 11 0 10.5523 0 10V8C0 7.44772 0.447715 7 1 7H6.5C6.77614 7 7 6.77614 7 6.5V1C7 0.447715 7.44772 0 8 0H10C10.5523 0 11 0.447715 11 1V2.5V6.5C11 6.77614 11.2239 7 11.5 7H17C17.5523 7 18 7.44772 18 8V10Z"
      class="fill-current"
    />
  </svg>
</template>
