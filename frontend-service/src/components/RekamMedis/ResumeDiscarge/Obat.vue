<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import { useDoctorPrescriptionStore } from "@/stores/farmasi/DoctorPrescription";
import { watch } from "vue";

const props = defineProps({
  obatData: {
    type: Array as PropType<any>,
    default: () => [],
  },
});

// NOTE Store
const doctorPrescriptionStore = useDoctorPrescriptionStore();

const obat = computed(() => props.obatData);
const listOrder = ref<any[]>([]);

watch(
  () => obat.value,
  async (newValue) => {
    listOrder.value = [];
    if (newValue && newValue.length) {
      try {
        const promises = newValue.map(async (uuid: string) => {
          const responseDetail = await doctorPrescriptionStore.detailApi(uuid);
          if (responseDetail && responseDetail.payload) {
            return (responseDetail.payload.obatItems || []).map((obatData: any) => {
              return {
                itemMedis: { 
                    name: obatData.namaItem
                }, 
                medicationQty: obatData.totalObat,
                aturanPakai: obatData.aturanPakai,
                caraPakai: obatData.caraPakai,
                ...obatData,
                isTakeaway: responseDetail.payload.isTakeaway,
              };
            });

          }
          return [];
        });
        const allObatLists = await Promise.all(promises);
        listOrder.value = allObatLists.flat();

      } catch (error) {
        console.error("Gagal mengambil detail data obat:", error);
        listOrder.value = [];
      }
    }
  },
  { immediate: true }
);

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
    <template #header> Obat </template>
    <template #content>
      <DataTable
        v-model:selection="selectedPemeriksaan"
        :value="listOrder"
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
        <Column
          field="itemMedis.name"
          header="Nama Obat"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="medicationQty"
          header="Jumlah"
          headerClass="bg-opensimrs-50"
        >
        </Column>
        <Column
          field="aturanPakai"
          header="Aturan Pakai"
          headerClass="bg-opensimrs-50"
        >
        </Column>
        <Column
          field="caraPakai"
          header="Cara Pakai"
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
