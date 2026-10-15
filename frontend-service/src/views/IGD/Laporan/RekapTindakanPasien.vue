<script lang="ts" setup>
const props = defineProps({
  payload: {
    type: Array,
    default: () => [],
  },
});
</script>

<template>
  <DataTable
    :value="props.payload"
    tableStyle="min-width: 50rem"
    scrollable
    scrollHeight="flex"
    :pt="{ headerRow: 'text-SM' }"
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
    >
    </Column>
    <Column
      field="total"
      header="Jumlah"
      headerClass="bg-opensimrs-50"
      class="w-[100px] text-SM"
    >
    </Column>
  </DataTable>
</template>
