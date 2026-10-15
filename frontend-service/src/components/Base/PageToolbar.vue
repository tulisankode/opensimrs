<script setup lang="ts">
import { provide } from "vue";
import { compactToolbarKey } from "./toolbarContext";

provide(compactToolbarKey, true);
</script>

<template>
  <div class="page-toolbar" role="group" aria-label="Pencarian dan filter">
    <slot name="header" />
    <slot name="content" />
    <slot />
  </div>
</template>

<style scoped>
.page-toolbar {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  padding: 12px 14px;
  border-bottom: 1px solid #e4e7ec;
  overflow-x: auto;
  white-space: nowrap;
}

.page-toolbar :deep(.toolbar-layout) {
  display: contents;
}

.page-toolbar :deep(.toolbar-item) {
  flex: 0 0 auto;
  width: auto;
  margin: 0;
}

.page-toolbar :deep(.toolbar-heading),
.page-toolbar :deep(.p-breadcrumb) {
  flex: 0 0 auto;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.page-toolbar :deep(.toolbar-action) {
  order: 2;
}

.page-toolbar :deep(.toolbar-field) {
  /* Boleh menyusut sampai 130px agar baris yang padat tetap muat tanpa gulir horizontal. */
  flex: 1 1 160px;
  width: 180px;
  min-width: 130px;
  max-width: 280px;
  margin: 0;
}

.page-toolbar :deep(.toolbar-field--date) {
  flex: 0 0 140px;
  width: 140px;
  min-width: 140px;
}

.page-toolbar :deep(.toolbar-field input) {
  min-width: 0;
  width: 100%;
}

.page-toolbar :deep(.toolbar-field .p-inputtext),
.page-toolbar :deep(.toolbar-field .p-select),
.page-toolbar :deep(.toolbar-field .p-multiselect),
.page-toolbar :deep(.p-button) {
  height: 36px;
  border-radius: 6px;
  font-size: 12px;
}

.page-toolbar :deep(.p-button) {
  flex-shrink: 0;
  width: auto;
  margin: 0;
  padding: 0 10px;
}

.page-toolbar :deep(.p-button-label),
.page-toolbar :deep(.p-select-label),
.page-toolbar :deep(.p-multiselect-label) {
  font-size: 12px;
}

.page-toolbar :deep(.p-select-label),
.page-toolbar :deep(.p-multiselect-label) {
  align-self: center;
  padding: 6px 10px;
}

.page-toolbar :deep(.p-select-dropdown),
.page-toolbar :deep(.p-multiselect-dropdown) {
  width: 26px;
}

.page-toolbar :deep(.toolbar-icon) {
  flex: 0 0 36px;
  width: 36px;
  padding: 0;
}

.page-toolbar :deep(.toolbar-field .p-inputgroupaddon) {
  min-width: 32px;
  padding: 0 6px;
}

.page-toolbar :deep(.toolbar-field .p-inputgroupaddon svg),
.page-toolbar :deep(.toolbar-field .p-inputicon svg) {
  width: 18px;
  height: 18px;
}

.page-toolbar :deep(.toolbar-field .p-inputgroup > .p-select) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
</style>
