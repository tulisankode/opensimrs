<script setup lang="ts">
import { ref, computed, watch } from "vue";

import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
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
  activeTab: {
    type: String,
    required: true,
  },
});

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const searchPatientFilter = ref<string>("");

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


const selectedFilters = ref<string[]>([]);

const resetFilter = () => {
  selectedFilters.value = [];
};

// Watch for activeTab changes to reset selected filters
watch(
  () => props.activeTab,
  () => {
    resetFilter();
  }
);

defineExpose({
  resetFilter,
});
</script>

<template>
  <PageToolbar>
    <CustomButton label="" icon="PhArrowClockwise" />
    <h1 class="toolbar-heading text-opensimrs-300">Hasil Pemeriksaan</h1>
    <CustomTextfield
      v-model="searchPatientFilter"
      prependIcon="PhMagnifyingGlass"
      label="Pencarian"
      placeholder="Cari Nama, Alamat, No.RM"
    />
    <CustomDatePicker
      v-model="startDateFilter"
      label="Tanggal mulai"
      class="toolbar-field--date"
    />
    <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
    <CustomDatePicker
      v-model="endDateFilter"
      label="Tanggal selesai"
      class="toolbar-field--date"
    />
    <ToolbarFilterMenu :count="selectedPaymentMethod.length">
      <template #label>Pembayaran</template>
      <CustomChip
        label="TUNAI"
        :isSelected="selectedPaymentMethod.includes('TUNAI')"
        @selected="onPaymentMethodSelect"
      />
      <CustomChip
        label="ASURANSI"
        :isSelected="selectedPaymentMethod.includes('ASURANSI')"
        @selected="onPaymentMethodSelect"
      />
    </ToolbarFilterMenu>
    <slot name="header"></slot>
    <CustomButton icon="PhMagnifyingGlass" label="Cari" />
    <CustomButton
      @click="resetFilter"
      label="Reset"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
    />
  </PageToolbar>
</template>
