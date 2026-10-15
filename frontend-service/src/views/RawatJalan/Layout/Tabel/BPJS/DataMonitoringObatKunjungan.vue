<script lang="ts" setup>
import { ref } from 'vue';


const itemsMonitoringObatKunjungan = ref([
  {
    noOrder: "0108124",
    namaObat: "Paracetamol",
    satuan:"tablet",
    jenisItem:"Obat",
    jenisPelayanan:"Rawat Jalan",
    dokter: "dr. Nama Dokter Sp.A",
  },
]);
</script>

<template>
    <DataTable
    v-if="itemsMonitoringObatKunjungan.length"
    :value="itemsMonitoringObatKunjungan"
    tableStyle="min-width: 50rem"
    scrollable
    scrollHeight="250px"
    :pt="{ headerRow: 'text-SM' }"
  >
    <Column field="no" headerClass="bg-opensimrs-50" header="No" class="w-[40px]">
      <template #body="slotProps">
        <div class="w-full text-center text-SM">
          {{ slotProps.index + 1 }}
        </div>
      </template>
    </Column>
    <Column
      field="no-order"
      header="No. Order"
      headerClass="bg-opensimrs-50"
      class="w-[100px]"
    >
      <template #body="slotProps">
        <div class="text-SM">
          <div>{{ slotProps.data.noOrder }}</div>
        </div>
      </template>
    </Column>
    <Column field="nama-obat" header="Nama Obat" headerClass="bg-opensimrs-50">
      <template #body="slotProps">
        <div class="text-SM">{{ slotProps.data.jenisPelayanan }}</div>
      </template>
    </Column>
    <Column field="satuan-racikan" header="Satuan/Bentuk Racikan" headerClass="bg-opensimrs-50" class="w-[150px]">
      <template #body="slotProps">
        <div class="text-SM">{{ slotProps.data.satuan }}</div>
      </template>
    </Column>
    <Column field="jenis-item" header="Jenis Item" headerClass="bg-opensimrs-50" class="w-[100px]">
      <template #body="slotProps">
          <div class="text-SM">{{ slotProps.data.jenisItem }}</div>
    
      </template>
    </Column>
    <Column
      field="jenis-pelayanan"
      header="Jenis Pelayanan"
      headerClass="bg-opensimrs-50"
      class="w-[160px]"
    >
      <template #body="slotProps">
        <div class="text-SM">{{ slotProps.data.jenisPelayanan }}</div>
      </template>
    </Column>
    <Column
      field="dokter"
      header="Dokter"
      headerClass="bg-opensimrs-50"
      class="w-[240px]"
    >
      <template #body="slotProps">
          <div class="text-SM">{{ slotProps.data.dokter }}</div>
        
      </template>
    </Column>
    
  </DataTable>
</template>