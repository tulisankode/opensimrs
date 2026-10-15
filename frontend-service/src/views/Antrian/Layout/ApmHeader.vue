<script setup lang="ts">
import { ref, type PropType } from "vue";

import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";

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

// !SECTION

const selectedPaymentMethod = ref<string[]>([]);
const onPaymentMethodSelect = (label: string) => {
  if (selectedPaymentMethod.value.includes(label)) {
    selectedPaymentMethod.value = selectedPaymentMethod.value.filter(
      (item) => item != label
    );
  } else {
    selectedPaymentMethod.value.push(label);
  }
};

const filters = [selectedPaymentMethod];

const resetFilter = () => {
  filters.forEach((filter) => {
    filter.value = [];
  });
};
defineExpose({
  resetFilter,
});
</script>

<template>
  <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
  <PageToolbar>
    <CustomButton label="" icon="PhArrowClockwise" />
    <h1 class="toolbar-heading text-opensimrs-300">APM</h1>
    <CustomTextfield
      v-if="search"
      :label="`Cari APM`"
      prependIcon="PhMagnifyingGlass"
      :placeholder="`Cari Nama APM`"
    >
    </CustomTextfield>
    <CustomButton
      icon="PhMagnifyingGlass"
      label="Cari"
    />
    <CustomButton
      label="Reset"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
    />
    <slot name="header"></slot>
  </PageToolbar>
</template>
