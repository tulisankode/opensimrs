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
    <mask
      id="mask0_1421_1611"
      style="mask-type: luminance"
      maskUnits="userSpaceOnUse"
      x="0"
      y="0"
      width="18"
      height="18"
    >
      <path
        d="M4 6.91667H1.5V1.5H16.5V6.91667H14"
        stroke="white"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M4 4H14V17.3333L11.5 15.4817L9 17.3333L6.5 15.4817L4 17.3333V4Z"
        fill="white"
        stroke="white"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M7.33331 9.83341H10.6666M8.99998 8.16675V11.5001"
        stroke="black"
        stroke-linecap="round"
      />
    </mask>
    <g mask="url(#mask0_1421_1611)">
      <path d="M-1 -1H19V19H-1V-1Z" class="fill-current"/>
    </g>
  </svg>
</template>
