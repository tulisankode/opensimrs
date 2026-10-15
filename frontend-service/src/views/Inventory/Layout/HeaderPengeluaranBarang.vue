<script setup lang="ts">
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
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
        label: 'Pengeluaran  Barang',
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
    <slot name="tabs"></slot>
    <CustomButton
      v-if="pageType == 'pengeluaran-unit'"
      @click="
        pageType == 'pengeluaran-unit'
          ? emit('tambahPengeluaran')
          : ''
      "
      icon="PhPlus"
      label="Pengeluaran"
    />
  </PageToolbar>
</template>
