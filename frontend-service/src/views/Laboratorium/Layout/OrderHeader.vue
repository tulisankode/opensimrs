<script setup lang="ts">
import { ref } from "vue";

import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";

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
  // activeTab: {
  //   type: String,
  //   required: true,
  // },
});

const selectedStatus = ref<any>();
const itemStatus = ref([
  { name: "Belum Lunas", code: "S1" },
  { name: "Batal Order", code: "S2" },
]);

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const searchPatientFilter = ref<string>("");

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

const selectedOrderType = ref<string>("");

const onSelectOrderType = (label: string) => {
  selectedOrderType.value = label;
  console.log(selectedOrderType, "selectedOrderType");
};

const emit = defineEmits(["order"]);

const resetFilter = () => {
  filters.forEach((filter) => {
    filter.value = [];
    selectedStatus.value = null;
  });
};
defineExpose({
  resetFilter,
});
</script>

<template>
  <PageToolbar>
    <CustomButton label="" icon="PhArrowClockwise" />
    <h1 class="toolbar-heading text-opensimrs-300">Order Lab</h1>
    <CustomTextfield
      v-model="searchPatientFilter"
      prependIcon="PhMagnifyingGlass"
      label="Pencarian"
      placeholder="Cari Nama / Alamat / No. RM"
    />
    <CustomSelect
      v-model="selectedStatus"
      :options="itemStatus"
      optionValue="code"
      optionLabel="name"
      :is-loading="false"
      label="Status"
      place-holder="Cari Status"
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
    <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Jenis order">
      <CustomButton
        @click="onSelectOrderType('')"
        label="Order"
        :outlined="selectedOrderType != ''"
        borderColor="border-opensimrs-300"
        :textColor="selectedOrderType != '' ? 'text-opensimrs-300' : 'text-white'"
        :backgroundColor="selectedOrderType != '' ? 'bg-transparent' : 'bg-opensimrs-300'"
        class="font-semibold"
      />
      <CustomButton
        @click="onSelectOrderType('Batal')"
        label="Batal"
        :outlined="selectedOrderType != 'Batal'"
        borderColor="border-opensimrs-300"
        :textColor="selectedOrderType != 'Batal' ? 'text-opensimrs-300' : 'text-white'"
        :backgroundColor="selectedOrderType != 'Batal' ? 'bg-transparent' : 'bg-opensimrs-300'"
        class="font-semibold"
      />
    </div>
    <slot name="header"></slot>
    <CustomButton icon="PhMagnifyingGlass" label="Cari" />
    <CustomButton
      label="Reset"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
    />
    <CustomButton @click="emit('order')" icon="PhPlus" label="Order" />
  </PageToolbar>
</template>
