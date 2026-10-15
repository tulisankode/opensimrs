<script setup lang="ts">
import { ref, computed } from "vue";

import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import { defaultStartDate } from "../useRekapLaporan";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  selectOption: {
    type: Array,
    default: () => [],
  },
  selectOptionSecond: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "update:selectedFilter",
  "update:selectedFilterSecond",
  "reload-data",
  "update:valueSearch",
  "search",
  "reset",
  "update:startDateFilter",
  "update:endDateFilter",
]);

const pageLabel = computed(() => {
  return props.pageType === "jumlah-kunjungan"
    ? "Jumlah Kunjungan Berdasarkan Status Rawat"
    : props.pageType === "rekapitulasi-tindakan"
    ? "Rekapitulasi Tindakan"
    : props.pageType === "rekapitulasi-pemeriksaan"
    ? "Rekapitulasi Pemeriksaan Lab"
    : props.pageType === "rekapitulasi-pendapatan"
    ? "Rekapitulasi Pendapatan"
    : props.pageType === "rekapitulasi-diagnosis"
    ? "Rekapitulasi Diagnosis berdasarkan Umur Pasien"
    : "";
});

const startDateFilter = ref<Date>(defaultStartDate());
const endDateFilter = ref<Date>(new Date());
const valueSearch = ref();
const valueSelectedFilter = ref();
const valueSelectedFilterSecond = ref();

const resetForm = () => {
  valueSelectedFilterSecond.value = "";
  valueSelectedFilter.value = "";
  startDateFilter.value = defaultStartDate();
  endDateFilter.value = new Date();
  valueSearch.value = "";
};

defineExpose({
  resetForm,
});
</script>
<template>
  <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
  <PageToolbar>
    <CustomButton icon="PhArrowClockwise" @click="emit('reload-data')" />
    <h1 class="toolbar-heading text-opensimrs-300">
      {{ pageLabel }}
    </h1>
    <CustomTextfield
      v-model="valueSearch"
      v-if="
        [
          'jumlah-kunjungan',
          'rekapitulasi-tindakan',
          'rekapitulasi-pemeriksaan',
        ].includes(pageType)
      "
      prependIcon="PhMagnifyingGlass"
      :label="
        props.pageType === 'jumlah-kunjungan'
          ? 'Cari Dokter'
          : 'Cari Tindakan'
      "
      :placeholder="
        props.pageType === 'jumlah-kunjungan'
          ? 'Cari Nama Dokter'
          : 'Cari Nama Tindakan'
      "
      @update:modelValue="$emit('update:valueSearch', valueSearch)"
      @keydown.enter="$emit('search')"
    />
    <CustomSelect
      v-model="valueSelectedFilter"
      :label="
        props.pageType === 'rekapitulasi-pendapatan'
          ? 'Penjamin'
          : 'Jenis Kunjungan'
      "
      :placeHolder="
        props.pageType === 'rekapitulasi-pendapatan'
          ? 'Pilih Penjamin'
          : 'Pilih Jenis Kunjungan'
      "
      :options="props.selectOption"
      optionValue="uuid"
      optionLabel="name"
      @update:modelValue="
        $emit('update:selectedFilter', valueSelectedFilter)
      "
    />
    <CustomSelect
      v-model="valueSelectedFilterSecond"
      :label="
        props.pageType === 'rekapitulasi-pendapatan'
          ? 'Jenis Kunjungan'
          : props.pageType === 'rekapitulasi-diagnosis'
          ? 'Jenis Kelamin'
          : 'Metode Bayar'
      "
      :placeHolder="
        props.pageType === 'rekapitulasi-pendapatan'
          ? 'Pilih Jenis Kunjungan'
          : props.pageType === 'rekapitulasi-diagnosis'
          ? 'Pilih Jenis Kelamin'
          : 'Pilih Metode Bayar'
      "
      :options="props.selectOptionSecond"
      :optionValue="
        props.pageType === 'rekapitulasi-diagnosis' ? 'value' : 'uuid'
      "
      :optionLabel="
        props.pageType === 'rekapitulasi-diagnosis' ? 'label' : 'name'
      "
      @update:modelValue="
        $emit('update:selectedFilterSecond', valueSelectedFilterSecond)
      "
    />
    <CustomDatePicker
      v-model="startDateFilter"
      label="Tanggal mulai"
      class="toolbar-field--date"
      @update:modelValue="
        $emit('update:startDateFilter', startDateFilter)
      "
    />
    <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
    <CustomDatePicker
      v-model="endDateFilter"
      label="Tanggal selesai"
      class="toolbar-field--date"
      @update:modelValue="$emit('update:endDateFilter', endDateFilter)"
    />
    <CustomButton
      icon="PhMagnifyingGlass"
      label="Cari"
      @click="$emit('search')"
    />
    <CustomButton
      label="Reset"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
      @click="$emit('reset')"
    />
  </PageToolbar>
</template>
