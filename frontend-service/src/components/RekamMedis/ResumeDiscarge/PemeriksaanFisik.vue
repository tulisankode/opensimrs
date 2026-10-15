<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";

const props = defineProps({
  pemeriksaanFisikData: {
    type: Object as PropType<any>,
    default: () => {},
  },
});

const formatLabel = (key: string) => {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const pemeriksaanFisik = computed(() => {
  if (props.pemeriksaanFisikData) {
    return Object.entries(props.pemeriksaanFisikData).map(
      ([organ, keterangan]) => ({
        organ: formatLabel(organ),
        keterangan,
      })
    );
  } else return [];
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
    <template #header> Pemeriksaan Fisik </template>
    <template #content>
      <DataTable
        v-model:selection="selectedPemeriksaan"
        :value="pemeriksaanFisik"
        tableStyle="min-width: 50rem"
        stripedRows
        class="pt-5 text-xs"
      >
        <Column
          field="organ"
          header="Lokasi Fisik"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          header="Hasil Pemeriksaan"
          headerClass="bg-opensimrs-50"
          class="w-4/6"
        >
          <template #body="{ data }">
            {{ data.keterangan == "" ? "-" : data.keterangan }}
          </template>
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
