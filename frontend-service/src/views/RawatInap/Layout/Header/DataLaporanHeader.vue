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
  valuePraktisiFilter: {
    type: String,
    default: "",
  },
});

const emits= defineEmits(['update:valuePraktisiFilter','update:valueRMFilter', 'update:startedDateFilter','update:endedDateFilter','update:valueBulanFilter','search', 'reset','refreshPage'])
const valueStartDateFilter = ref<Date>(new Date());
const valueEndDateFilter = ref<Date>(new Date());
const valueRMFilter = ref<string>("");

const computedPraktisiFilter = computed({
  get() {
    return props.valuePraktisiFilter;
  },
  set(newValue) {
    emits("update:valuePraktisiFilter", newValue);
  },
});

const monthValue = computed({
  get() {
    return props.valueBulanFilter;
  },
  set(newValue) {
    emits("update:valueBulanFilter", newValue);
  },
});

const resetForm = () => {
  valueStartDateFilter.value = new Date();
  valueEndDateFilter.value = new Date();
  valueRMFilter.value = "";
  emits("update:valueBulanFilter", new Date());
}

defineExpose({
  resetForm
})
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
    <!-- Slot halaman (mis. filter Ruangan / Kelas / Dokter DPJP) -->
    <slot name="before-content"></slot>
    <template v-if="currentRouteName != 'rekap-tindakan-pasien'">
      <CustomDatePicker
        v-model="valueStartDateFilter"
        @update:model-value="
          $emit('update:startedDateFilter', valueStartDateFilter)
        "
        label="Tanggal mulai"
        class="toolbar-field--date"
        :max-date="valueEndDateFilter"
      />
      <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
      <CustomDatePicker
        v-model="valueEndDateFilter"
        @update:model-value="
          $emit('update:endedDateFilter', valueEndDateFilter)
        "
        label="Tanggal selesai"
        class="toolbar-field--date"
        :min-date="valueStartDateFilter"
      />
    </template>
    <CustomSelect
      v-if="currentRouteName === 'rekap-tindakan-pasien'"
      v-model="computedPraktisiFilter"
      label="Praktisi"
      optionLabel="pegawai.name"
      optionValue="uuid"
      place-holder="Semua"
      :options="praktisiPayload"
    />
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
