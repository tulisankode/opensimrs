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


const emit = defineEmits(["tambahSupplier", "update:valueNoSupplier"]);

const noSupplier = ref<string>("");

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
        label: 'Datamaster',
        home: true,
      }"
      :model="dataBreadCrumb"
    />
    <CustomTextfield
      v-model="noSupplier"
      prependIcon="PhMagnifyingGlass"
      label="Cari Supplier"
      placeholder="Cari Nama Supplier"
      @update:model-value="$emit('update:valueNoSupplier', noSupplier)"
    />
    <slot name="tabs"></slot>
    <CustomButton
      @click="emit('tambahSupplier')"
      icon="PhPlus"
      label="Data"
    />
  </PageToolbar>
</template>
