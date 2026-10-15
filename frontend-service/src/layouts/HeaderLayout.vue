<script setup lang="ts">
import { ref } from "vue";
import Header from "@/components/section/Header.vue";
const renderBody = ref(false)

</script>

<template>
  <div>
    <Header  @selected-faskes="renderBody = true" />
    <div v-if="renderBody" class="absolute bottom-[52px] left-3 right-3 top-[82px]">
      <slot />
    </div>
  </div>
</template>