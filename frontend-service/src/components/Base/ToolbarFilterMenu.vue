<script setup lang="ts">
import { provide, ref } from "vue";
import Popover from "primevue/popover";
import { compactToolbarKey, filterMenuKey } from "./toolbarContext";

defineProps({
  count: { type: Number, default: 0 },
});

const popup = ref<InstanceType<typeof Popover>>();
const opened = ref(false);
provide(compactToolbarKey, false);
provide(filterMenuKey, true);
</script>

<template>
  <button
    type="button"
    class="toolbar-filter-menu"
    :class="{ 'toolbar-filter-menu--active': count > 0 }"
    aria-haspopup="dialog"
    :aria-expanded="opened"
    @click="popup?.toggle($event)"
  >
    <span><slot name="label" /><span v-if="count"> ({{ count }})</span></span>
    <PhCaretDown :size="14" aria-hidden="true" />
  </button>
  <Popover ref="popup" @show="opened = true" @hide="opened = false">
    <div class="toolbar-filter-options">
      <slot />
    </div>
  </Popover>
</template>

<style scoped>
.toolbar-filter-menu {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  color: #475467;
  background: white;
  font-size: 12px;
  white-space: nowrap;
}

.toolbar-filter-menu--active {
  color: rgb(var(--opensimrs-400));
  border-color: rgb(var(--opensimrs-300));
  background: rgb(var(--opensimrs-50));
}

.toolbar-filter-menu:focus-visible {
  outline: 2px solid rgb(var(--opensimrs-400));
  outline-offset: 2px;
}

.toolbar-filter-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 180px;
  max-width: min(360px, calc(100vw - 48px));
  max-height: 320px;
  overflow-y: auto;
}

.toolbar-filter-options :deep(.toolbar-filter-option) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  width: 100%;
  margin: 0;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 12px;
  text-align: left;
  white-space: normal;
}

.toolbar-filter-options :deep(.toolbar-filter-option:hover),
.toolbar-filter-options :deep(.toolbar-filter-option[aria-checked='true']) {
  background: rgb(var(--opensimrs-50));
}
</style>
