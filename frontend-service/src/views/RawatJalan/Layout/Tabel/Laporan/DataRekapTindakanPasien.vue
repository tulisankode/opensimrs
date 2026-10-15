<script lang="ts" setup>
import NoData from "@/components/section/NoData.vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import { ref } from "vue";

const props = defineProps({
  rekapTindakanPasienData: {
    type: Array as () => Array<any>,
    required: true,
  },
});
const expandedRows = ref<any[]>([]);
</script>

<template>
  <DataTable
    v-if="rekapTindakanPasienData.length"
    :value="rekapTindakanPasienData"
    responsiveLayout="scroll"
    dataKey="id"
    :expandedRows="expandedRows"
    scrollable
    scrollHeight="flex"
    class="p-datatable-sm"
  >
    <Column field="no" headerClass="bg-opensimrs-50" header="No" class="w-[10px]">
      <template #body="slotProps">
        <div class="text-SM">
          {{ slotProps.index + 1 }}
        </div>
      </template>
    </Column>

    <Column
      field="namaTindakan"
      header="Tindakan"
      headerClass="bg-opensimrs-50"
      class="w-[100px] text-SM"
    />

    <Column
      field="total"
      header="Jumlah"
      headerClass="bg-opensimrs-50"
      class="w-[100px] text-SM"
    />
  </DataTable>
  <NoData v-else />
</template>