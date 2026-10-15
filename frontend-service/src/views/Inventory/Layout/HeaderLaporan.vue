<script setup lang="ts">
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import type { MenuItem } from "primevue/menuitem";
import { onMounted, ref, type PropType } from "vue";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
});

const noSupplier = ref<string>("");
</script>

<template>
  <PageToolbar>
    <CustomButton icon="PhArrowClockwise" />
    <CustomBreadCrumb
      :home="{
        label: 'Laporan',
        home: true,
      }"
      :model="dataBreadCrumb"
    />
    <CustomTextfield
      label="Pencarian "
      placeholder="Cari Nama Item"
      prepend-icon="PhMagnifyingGlass"
    />
    <CustomSelect label="Lokasi" place-holder="Pilih Jenis Stok" />
    <CustomDatePicker label="Tanggal mulai" class="toolbar-field--date" />
    <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
    <CustomDatePicker label="Tanggal selesai" class="toolbar-field--date" />
    <slot name="tabs"></slot>
    <CustomButton icon="PhMagnifyingGlass" label="Cari" />
    <CustomButton
      label="Reset"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
    />
  </PageToolbar>
</template>
