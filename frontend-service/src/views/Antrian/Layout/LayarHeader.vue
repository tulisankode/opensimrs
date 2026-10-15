<script setup lang="ts">
import { ref, type PropType } from "vue";

import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useDebounceFn } from "@vueuse/core";

const props = defineProps({
  title: {
    type: String,
    default: "Title",
  },
  filter: {
    type: Boolean,
    default: true,
  },
  search: {
    type: Boolean,
    default: true,
  },
});

const searchQuery = ref("");

const emit = defineEmits(["search", "reset", "daftar"]);

const performSearch = () => {
  emit("search", searchQuery.value, selectedPaymentMethod.value);
};

const debouncedSearch = useDebounceFn(performSearch, 500);

const selectedPaymentMethod = ref<string[]>([]);
const onPaymentMethodSelect = (label: string) => {
  if (selectedPaymentMethod.value.includes(label)) {
    selectedPaymentMethod.value = selectedPaymentMethod.value.filter(
      (item) => item != label
    );
  } else {
    selectedPaymentMethod.value.push(label);
  }

  // Trigger auto-search dengan debounce ketika chip dipilih
  debouncedSearch();
};

const filters = [selectedPaymentMethod];

const resetFilter = () => {
  filters.forEach((filter) => {
    filter.value = [];
  });

  searchQuery.value = "";

  emit("reset");
};
</script>

<template>
  <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
  <PageToolbar>
    <CustomButton
      label=""
      icon="PhArrowClockwise"
      @click="resetFilter"
      title="refresh"
    />
    <h1 class="toolbar-heading text-opensimrs-300">Layar</h1>
    <CustomTextfield
      v-if="search"
      :label="`Cari Layar`"
      prependIcon="PhMagnifyingGlass"
      :placeholder="`Cari Nama Layar`"
      v-model="searchQuery"
      @keydown.enter="performSearch"
    >
    </CustomTextfield>
    <ToolbarFilterMenu :count="selectedPaymentMethod.length">
      <template #label>Status</template>
      <CustomChip
        label="Aktif"
        :isSelected="selectedPaymentMethod.includes('AKTIF')"
        @selected="onPaymentMethodSelect"
      />
      <CustomChip
        label="NON-AKTIF"
        :isSelected="selectedPaymentMethod.includes('NON-AKTIF')"
        @selected="onPaymentMethodSelect"
      />
    </ToolbarFilterMenu>
    <CustomButton
      icon="PhMagnifyingGlass"
      label="Cari"
      @click="performSearch"
    />
    <CustomButton
      label="Reset"
      @click="resetFilter"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
    />
    <slot name="header"></slot>
  </PageToolbar>
</template>
