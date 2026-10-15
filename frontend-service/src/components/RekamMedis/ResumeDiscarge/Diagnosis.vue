<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";

const props = defineProps({
  diagnosisData: {
    type: Array as PropType<any>,
    default: () => [],
  },
});

const diagnosis = computed(() => {
  props.diagnosisData.forEach((diagnosis: any) => {
    diagnosis.diagnosis = diagnosis.diagnosis.replace("~", `\n`);
  });
  return props.diagnosisData;
});

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
    <template #header> Diagnosis </template>
    <template #content>
      <DataTable
        v-model:selection="selectedPemeriksaan"
        :value="diagnosis"
        tableStyle="min-width: 50rem"
        stripedRows
        class="pt-5 text-xs"
      >
        <Column headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full font-semibold text-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{ slotProps.index + 1 }}
            </div>
          </template>
        </Column>
        <Column header="Nama Diagnosis" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <div v-html="data.diagnosis.replace(/\n/g, '<br>')"></div>
          </template>
        </Column>
        <Column
          field="tipe"
          header="Tipe Diagnosis"
          headerClass="bg-opensimrs-50"
        >
        </Column>
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
