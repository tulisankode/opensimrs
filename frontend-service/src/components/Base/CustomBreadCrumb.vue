<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";
import type { PropType } from "vue";

const props = defineProps({
  model: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  home: {
    type: Object,
    default: null,
  },
});
</script>

<template>
  <Breadcrumb
    :home="home"
    :model="model"
    class="flex p-0 font-semibold bg-transparent text-heading"
  >
    <template #item="{ item }">
      <div v-if="$slots.customItem">
        <slot name="customItem" :item="item" />
      </div>
      <div
        v-else
        class=""
        :class="{
          'text-opensimrs-300': item.home,
          'text-grey-400': !item.home,
        }"
      >
        {{ item.label }}
      </div>
    </template>
    <template #separator>
      <PhCaretRight class="text-grey-400" weight="bold" :size="24" />
    </template>
  </Breadcrumb>
</template>
