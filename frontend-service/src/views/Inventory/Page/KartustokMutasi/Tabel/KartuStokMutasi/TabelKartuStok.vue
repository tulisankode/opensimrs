<script lang="ts" setup>
import CustomChip from '@/components/Base/CustomChip.vue';


const props = defineProps({
    tabelData: {
    type: Array as () => Array<Record<string, any>>,
    default: () => []
  }
})
</script>

<template>
  <DataTable
    :value="tabelData"
    tableStyle="min-width: 50rem"
    scrollable
    class="-m-4"
    scrollHeight="240px"
    :pt="{ headerRow: 'text-SM' }"
  >
    <Column field="no" headerClass="bg-opensimrs-50" class="w-[50px]">
      <template #header>
        <div class="font-semibold">No</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="text-center text-SM">{{ slotProps.index + 1 }}</div>
        </div>
      </template>
    </Column>
    <Column field="namaItem" headerClass="bg-opensimrs-50" class="w-[800px]">
      <template #header>
        <div class="font-semibold">Nama Item</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="text-SM">{{ slotProps.data.namaItem }}</div>
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.kategoriItem"
            bgColor="bg-opensimrs-300"
            textColor="text-white"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.jenisStok"
            bgColor="bg-opensimrs-300"
            textColor="text-white"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.jenisItem"
            bgColor="bg-opensimrs-300"
            textColor="text-white"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
        </div>
      </template>
    </Column>
    <Column field="stok" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="w-full font-semibold text-center">Lokasi</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="text-center text-SM">{{ slotProps.data.lokasi}}</div>
        </div>
      </template>
    </Column>
    <Column field="satuanJual" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="w-full font-semibold text-center">Sisa Stok</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="text-center text-SM">{{ slotProps.data.sisaStok }}</div>
        </div>
      </template>
    </Column>
    <Column field="hargaDasar" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="w-full font-semibold text-center">Satuan</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="text-center text-SM">{{ slotProps.data.satuan }}</div>
        </div>
      </template>
    </Column>
  
  </DataTable>
</template>
