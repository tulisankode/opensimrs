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

const emit = defineEmits(["tambahPengeluaran"]);

const noPermintaan = ref<string>("");

// onMounted(() => {
//   console.log(props.dataBreadCrumb)
//   console.log("`page", props.pageType);
// })
</script>

<template>
  <PageToolbar>
    <CustomButton icon="PhArrowClockwise" />
    <CustomBreadCrumb
      :home="{
        label: 'Penerimaan  Barang',
        home: true,
      }"
      :model="dataBreadCrumb"
    />
    <CustomTextfield
      v-model="noPermintaan"
      prependIcon="PhMagnifyingGlass"
      label="Pencarian"
      placeholder="Cari Nama Pasien"
    />
    <CustomSelect
      v-if="dataBreadCrumb[0].label === 'Penerimaan Retur Unit'"
      label="Alasan Retur"
    />
    <slot name="tabs"></slot>
    <template v-if="dataBreadCrumb[0].label === 'Penerimaan Retur Unit'">
      <CustomButton icon="PhMagnifyingGlass" label="Cari" />
      <CustomButton
        label="Reset"
        outlined
        borderColor="border-opensimrs-300"
        textColor="text-opensimrs-300"
      />
    </template>
  </PageToolbar>
</template>
