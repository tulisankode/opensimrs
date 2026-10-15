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
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clip-path="url(#clip0_1670_1958)">
      <path d="M4.9 8.1V4.9H15.1V8.1H4.9Z" class="fill-current" />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M3 0C1.34315 0 0 1.34315 0 3V17C0 18.6569 1.34315 20 3 20H17C18.6569 20 20 18.6569 20 17V3C20 1.34315 18.6569 0 17 0H3ZM4.5 3.1C3.7268 3.1 3.1 3.7268 3.1 4.5V8.5C3.1 9.2732 3.7268 9.9 4.5 9.9H15.5C16.2732 9.9 16.9 9.2732 16.9 8.5V4.5C16.9 3.7268 16.2732 3.1 15.5 3.1H4.5ZM3.1 13C3.1 12.5029 3.50294 12.1 4 12.1H16C16.4971 12.1 16.9 12.5029 16.9 13C16.9 13.4971 16.4971 13.9 16 13.9H4C3.50294 13.9 3.1 13.4971 3.1 13ZM4 15.1C3.50294 15.1 3.1 15.5029 3.1 16C3.1 16.4971 3.50294 16.9 4 16.9H10C10.4971 16.9 10.9 16.4971 10.9 16C10.9 15.5029 10.4971 15.1 10 15.1H4Z"
        class="fill-current"
      />
    </g>
    <defs>
      <clipPath id="clip0_1670_1958">
        <rect width="20" height="20" fill="white" />
      </clipPath>
    </defs>
  </svg>
</template>
