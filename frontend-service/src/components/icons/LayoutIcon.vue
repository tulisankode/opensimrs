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
    :class="class"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clip-path="url(#clip0_1306_855)">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M2.5 4.16667C2.5 3.72464 2.67559 3.30072 2.98816 2.98816C3.30072 2.67559 3.72464 2.5 4.16667 2.5H9.16667V17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V4.16667ZM10.8333 17.5H15.8333C16.2754 17.5 16.6993 17.3244 17.0118 17.0118C17.3244 16.6993 17.5 16.2754 17.5 15.8333V10.8333H10.8333V17.5ZM10.8333 9.16667H17.5V4.16667C17.5 3.72464 17.3244 3.30072 17.0118 2.98816C16.6993 2.67559 16.2754 2.5 15.8333 2.5H10.8333V9.16667Z"
        class="fill-current"
      />
    </g>
    <defs>
      <clipPath id="clip0_1306_855">
        <rect width="20" height="20" fill="white" />
      </clipPath>
    </defs>
  </svg>
</template>
