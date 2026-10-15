<script lang="ts" setup>
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import type { MenuItem } from "primevue/menuitem";
import { ref, type PropType, computed } from "vue";

const props = defineProps({
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  currentRouteName: {
    type: String,
  },
  praktisiPayload: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  valueBulanFilter: {
    type: Date as PropType<Date | null>,
    default: null,
  },
});




const emits = defineEmits([
  'update:valueRMFilter', 'update:selectedDokterDPJP','update:startedDateFilter','update:endedDateFilter','update:valueBulanFilter','search', 'reset','refreshPage'
])

const valueStartDateFilter = ref<Date>(new Date());
const valueEndDateFilter = ref<Date>(new Date());
const valueRMFilter = ref<string>("");
const valueDokterDPJPFilter = ref<string>("");
const monthValue = computed({
  get() {
    return props.valueBulanFilter;
  },
  set(newValue) {
    emits("update:valueBulanFilter", newValue); 
  },
});

const valueBulanFilter = ref<Date | null>(null); 
const resetForm = () => {
  valueStartDateFilter.value = new Date();
  valueEndDateFilter.value = new Date();
  valueRMFilter.value = "";
  valueDokterDPJPFilter.value = "";
  emits("update:valueBulanFilter", new Date());
}

defineExpose({
  resetForm,
});
</script>

<template>
  <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
  <PageToolbar>
    <CustomButton icon="PhArrowClockwise" @click="$emit('refreshPage')"/>
    <CustomBreadCrumb
      :home="{
        label: 'Laporan',
        home: true,
      }"
      :model="dataBreadCrumb"
    />
    <CustomTextfield
      v-model="valueRMFilter"
      @update:model-value="$emit('update:valueRMFilter', valueRMFilter)"
      prependIcon="PhMagnifyingGlass"
      label="Pencarian"
      :placeholder="currentRouteName === 'rekap-tindakan-pasien'
      ? 'Cari Nama Tindakan'
      : 'Cari Nama / Alamat / No. RM'"
      @keydown.enter="$emit('search')"
    />
    <!-- Slot halaman (mis. filter Poliklinik / Dokter DPJP / Praktisi) -->
    <slot name="before-content"></slot>
    <CustomSelect
      v-if="currentRouteName === 'kunjungan-rawat-jalan'"
      v-model="valueDokterDPJPFilter"
      label="Dokter DPJP"
      optionLabel="pegawai.name"
      optionValue="uuid"
      :options="praktisiPayload"
      place-holder="Cari Dokter"
      @update:model-value="
        $emit('update:selectedDokterDPJP', valueDokterDPJPFilter)
      "
    />
    <template
      v-if="
        currentRouteName === 'kunjungan-rawat-jalan' ||
        currentRouteName === 'pembatalan-poli'
      "
    >
      <CustomDatePicker
        v-model="valueStartDateFilter"
        label="Tanggal mulai"
        class="toolbar-field--date"
        @update:model-value="
          $emit('update:startedDateFilter', valueStartDateFilter)
        "
        :max-date="valueEndDateFilter"
      />
      <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
      <CustomDatePicker
        v-model="valueEndDateFilter"
        label="Tanggal selesai"
        class="toolbar-field--date"
        @update:model-value="
          $emit('update:endedDateFilter', valueEndDateFilter)
        "
        :min-date="valueStartDateFilter"
      />
    </template>
    <CustomDatePicker
      v-if="currentRouteName === 'rekap-tindakan-pasien'"
      v-model="monthValue"
      dateFormat="mm-yy"
      view="month"
      label="Bulan"
      place-holder="Pilih Bulan"
      class="toolbar-field--date"
      :max-date="new Date()"
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
