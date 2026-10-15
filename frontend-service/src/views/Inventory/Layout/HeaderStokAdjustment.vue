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
        label: 'Stock Adjustment',
        home: true,
      }"
    />
    <CustomTextfield
      label="Pencarian "
      placeholder="Cari Nama Item"
      prepend-icon="PhMagnifyingGlass"
    />
    <CustomSelect label="Kategori" place-holder="Pilih Kategori" />
    <CustomSelect label="Jenis Stok" place-holder="Pilih Jenis Stok" />
    <CustomSelect label="Jenis Item" place-holder="Pilih Jenis Item" />
    <CustomSelect label="Lokasi Stok" place-holder="Pilih Lokasi Stok" />
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
