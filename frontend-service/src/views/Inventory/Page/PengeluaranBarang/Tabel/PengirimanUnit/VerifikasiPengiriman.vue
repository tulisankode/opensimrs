<script lang="ts" setup>
import CustomChip from "@/components/Base/CustomChip.vue";
import NoData from "@/components/section/NoData.vue";
import { ref, watch } from "vue";

const props = defineProps({
  verifikasiData: {
    type: Object as () => Record<string, any> | null,  // Izinkan null sebagai nilai default
    default: null,
  },

});

const emit = defineEmits(['row-clicked']);  // Define emit event


  
const selectedVerifikasiPermintaan= ref<any[]>([]);;
const verifikasiPermintaans = ref<any[]>([]);;


watch(
  () => props.verifikasiData,
  (newPermintaanData) => {
    if (Array.isArray(newPermintaanData)) {
      verifikasiPermintaans.value = newPermintaanData
    }
  },
  { immediate: true }
);


const handleRowClick = (rowData:any) => {
  emit('row-clicked', rowData.data);
  console.log(rowData.data)
};

</script>

<template>
  <!-- {{ verifikasiData}} -->
  <DataTable
    v-if="verifikasiPermintaans.length"
    v-model:selection="selectedVerifikasiPermintaan"
    :value="verifikasiPermintaans"
    @row-click="handleRowClick"
    tableStyle="min-width: 50rem"
    scrollable
    scrollHeight="240px"
    class="-m-4"
    :pt="{ headerRow: 'text-SM' }"
  >
    <Column field="tanggal" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="font-semibold">Tanggal</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="text-SM">{{ slotProps.data.tglPermintaan }}</div>
        </div>
      </template>
    </Column>

    <Column field="noPembelian" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="font-semibold">No. Pengeluaran</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="text-SM">{{ slotProps.data.noPengeluaran }}</div>
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.kategori"
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
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.isCito ? 'CITO' : slotProps.data.isCito"
            bgColor="bg-danger-300"
            textColor="text-white"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
        </div>
      </template>
    </Column>

    <Column field="supplier" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="w-full font-semibold">Tujuan Permintaan</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="font-bold text-SM">{{ slotProps.data.tujuanPermintaan }}</div>
        </div>
      </template>
    </Column>
    
    <Column field="petugas" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="font-semibold">Petugas</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="text-SM">{{ slotProps.data.petugasVerifikasi }}</div>
        </div>
      </template>
    </Column>

    <Column field="status" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="w-full font-semibold text-center">Status</div>
      </template>
      <template #body="slotProps">
        <div class="text-center">
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.status"
            bgColor="bg-aqua-300"
            textColor="text-white"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
        </div>
      </template>
    </Column>
  </DataTable>
  <NoData v-else />


  <!-- <div class="mt-8">
    {{ pengajuanPembelians }}
  </div> -->
</template>
