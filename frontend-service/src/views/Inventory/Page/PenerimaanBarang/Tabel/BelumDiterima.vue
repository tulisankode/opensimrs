<script lang="ts" setup>
import CustomChip from "@/components/Base/CustomChip.vue";
import NoData from "@/components/section/NoData.vue";
import { ref, watch } from "vue";

const props = defineProps({
  belumDiterimaData: {
    type: Object as () => Record<string, any> | null,  // Izinkan null sebagai nilai default
    default: null,
  },

});

const emit = defineEmits(['row-clicked']);  // Define emit event


  
const selectedBelumDiterima = ref<any[]>([]);
const belumDiterimas = ref<any[]>([]);


watch(
  () => props.belumDiterimaData,
  (newBelumDiterimaData) => {
     if (Array.isArray(newBelumDiterimaData)) {
      // Jika returData adalah array, langsung assign ke pengajuanReturs tanpa memetakan ulang
      belumDiterimas.value = newBelumDiterimaData;
    } 
  },
  { immediate: true }
);

const handleRowClick = (rowData:any) => {
  emit('row-clicked', rowData.data);
  console.log(rowData.data)
};


interface PengajuanPembelian {
  tanggalPembelian: string;
  noPembelian: string;
  kategoriItem: string;
  jenisItem: string;
  jenisStok: string;
  supplier: string;
  petugasPembuatPO: string;
  status: string;
  originalData: Record<string, any>;
}
  
const selectedPengajuanPembelian = ref([]);
const pengajuanPembelians = ref<PengajuanPembelian[]>([]);

// watch(
//   () => props.pembelianData,
//   (newPembelianData) => {
//     if (newPembelianData) {
//       // Mengambil data asli dan mengecualikan properti yang diambil
//       const {
//         tanggalPembelian,
//         noPembelian,
//         kategoriItem,
//         jenisItem,
//         jenisStok,
//         supplier,
//         petugasPembuatPO,
//         status,
//         ...originalData // Mengambil sisa properti sebagai originalData
//       } = newPembelianData;

//       // Format data sesuai kebutuhan
//       const formattedData: PengajuanPembelian = {
//         tanggalPembelian: new Date(tanggalPembelian).toLocaleDateString(),
//         noPembelian,
//         kategoriItem,
//         jenisItem,
//         jenisStok,
//         supplier,
//         petugasPembuatPO,
//         status,
//         originalData, // Menyimpan data asli tanpa properti yang sudah diambil
//       };

//       // Tambahkan data ke dalam array pengajuanPembelians
//       pengajuanPembelians.value.push(formattedData);
//     }
//   },
//   { immediate: true } 
// );
</script>

<template>
  <!-- {{ pembelianData }} -->
  <DataTable
    v-if="belumDiterimas.length"
    v-model:selection="selectedBelumDiterima"
    :value="belumDiterimas"
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
          <div class="text-SM">{{ slotProps.data.tanggalPembelian }}</div>
        </div>
      </template>
    </Column>

    <Column field="noPembelian" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="font-semibold">No. Pembelian</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="text-SM">{{ slotProps.data.noPembelian }}</div>
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

    <Column field="supplier" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="w-full font-semibold">Supplier</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="font-bold text-SM">{{ slotProps.data.supplier }}</div>
        </div>
      </template>
    </Column>
    
  <Column field="petugas" headerClass="bg-opensimrs-50">
  <template #header>
    <div class="font-semibold">Petugas</div>
  </template>
  <template #body="slotProps">
    <div>
      <div class="text-SM">{{ slotProps.data.petugasPembelian }}</div>
      <div class="text-SM">{{ slotProps.data.petugasPembuatPO }}</div>
    </div> <!-- Closing the div for `slotProps.data.petugasPembelian` and `slotProps.data.petugasPembuatPO` -->
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
            bgColor="bg-grey-300"
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

  <NoData v-else />
  <div class="mt-8">
    {{ pengajuanPembelians }}
  </div>
</template>
