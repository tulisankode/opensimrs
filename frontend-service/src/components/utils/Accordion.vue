<script setup lang="ts">
import { PhCaretDown, PhCaretUp } from "@phosphor-icons/vue";
import { ref } from "vue";

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  icon: {
    type: String,
  },
});

const isOpen = ref(false);
const toggle = () => {
  isOpen.value = !isOpen.value;
};
const getSVG = (svg: string) => {
  const imgUrl = new URL(
    `../../assets/icons/sidebar-icon/${svg}.svg`,
    import.meta.url
  ).href;
  return imgUrl;
};
</script>

<template>
  <div>
    <div
      @click="toggle"
      class="flex justify-between font-bold m-[10px] my-[20px]"
    >
      <div class="flex">
        <component
          v-if="icon"
          :is="icon"
          :size="16"
          class="text-white"
        />
        <div class="ml-[10px]">{{ props.title }}</div>
      </div>
      <PhCaretUp v-if="isOpen" :size="20" class="my-auto" />
      <PhCaretDown v-else :size="20" class="my-auto" />
    </div>
    <div v-show="isOpen" class="">
      <slot></slot>
    </div>
  </div>
</template>
