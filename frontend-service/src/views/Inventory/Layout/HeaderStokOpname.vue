<script setup lang="ts">
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
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

const emit = defineEmits(["tambahStokOpname"]);
</script>

<template>
  <PageToolbar>
    <CustomButton icon="PhArrowClockwise" />
    <CustomBreadCrumb
      :home="{
        label: 'Stok Opname',
        home: true,
      }"
    />
    <CustomTextfield
      label="Pencarian  "
      placeholder="Cari No. Stok Opname / Nama Judul Stok Opname"
      prepend-icon="PhMagnifyingGlass"
    />
    <CustomButton icon="PhPlus" label="Stok Opname" @click="emit('tambahStokOpname')" />
  </PageToolbar>
</template>
