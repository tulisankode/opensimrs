<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";

const props = defineProps({
  tindakanData: {
    type: Array as PropType<any>,
    default: () => [],
  },
});

const tindakan = computed(() => props.tindakanData);

const selectedPemeriksaan = ref<any[]>([]);
const accordion = ref<HTMLCanvasElement | null>(null);
const open = () => {
  if (accordion.value) {
    (accordion.value as any).open();
  }
};
const close = () => {
  if (accordion.value) {
    (accordion.value as any).close();
  }
};
const printSelectedData = () => {
  return selectedPemeriksaan.value;
};

defineExpose({
  open,
  close,
  printSelectedData,
});
</script>

<template>
  <CustomAccordion
    initial-state="0"
    header-class="bg-opensimrs-50"
    ref="accordion"
  >
    <template #header> Tindakan </template>
    <template #content>
      <DataTable
        v-model:selection="selectedPemeriksaan"
        :value="tindakan"
        tableStyle="min-width: 50rem"
        stripedRows
        class="pt-5 text-xs"
      >
        <Column headerClass="bg-opensimrs-50" style="width: 50px">
          <template #header>
            <div class="w-full font-semibold text-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{ slotProps.index + 1 }}
            </div>
          </template>
        </Column>
        <Column
          field="namaTindakan"
          header="Nama Tindakan"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          body-class="text-center"
          selectionMode="multiple"
          headerClass="bg-opensimrs-50 w-[15rem]"
          class="custom-checkbox"
        >
          <template #header>
            <div class="font-semibold">Tampilkan Di Cetak Print</div>
          </template>
        </Column>
      </DataTable>
    </template>
  </CustomAccordion>
</template>
<style scoped>
/* Menggunakan ::v-deep untuk menargetkan elemen dalam shadow DOM */
:deep(.custom-checkbox .p-checkbox-checked .p-checkbox-box) {
  @apply border-opensimrs-300 bg-opensimrs-300;
}

:deep(.custom-checkbox .p-checkbox-checked .p-checkbox-box .p-checkbox-icon) {
  @apply text-white;
}
</style>
