<script setup lang="ts">
import { onMounted, ref, watch, type PropType } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { utilsStore } from "@/stores/utils";
import { dateToEpoch, epochToDate } from "@/utils/Helpers";

const props = defineProps({
  method: {
    type: String,
    default: "form",
  },
  initialState: {
    type: String,
    default: "0",
  },
  uuidRawatInap: {
    type: String as PropType<string | undefined>,
    default: undefined,
  },
});

const products = ref<any[]>([]);
const rekamMedisStore = useRekamMedisStore();
const storeUtils = utilsStore();

const fetchHistory = async () => {
  if (!props.uuidRawatInap) {
    products.value = [];
    return;
  }
  
  try {
    storeUtils.setLoading(true);
    const response = await rekamMedisStore.getPerpindahanHistory(
      props.uuidRawatInap
    );

    if (response && response.payload) {
      products.value = response.payload.map((item: any) => {
        return {
          uuid: item.uuid,
          asalBed: `${item.originMonitoringRoom?.bedLokasi?.name ?? '-'} - ${item.originMonitoringRoom?.room?.name ?? '-'}`,
          dipindahKe: `${item.destinationMonitoringRoom?.bedLokasi?.name ?? '-'} - ${item.destinationMonitoringRoom?.room?.name ?? '-'}`,
          waktuPindah: item.waktuPindah,
          keterangan: item.keterangan,
          petugas: item.petugas
        };
      });
    } else {
      products.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch perpindahan history:", error);
    products.value = [];
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(() => {
  fetchHistory();
});

watch(
  () => props.uuidRawatInap,
  (newUuid) => {
    fetchHistory();
  }
);
</script>

<template>
  <CustomAccordion :initial-state="initialState" header-class="bg-opensimrs-50">
    <template #header> Riwayat Perpindahan Bed & Ruangan </template>
    <template #content>
      <DataTable
        :value="products"
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
          field="asalBed"
          header="Asal Bed"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="dipindahKe"
          header="Dipindah ke"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          header="Waktu Pindah"
          headerClass="bg-opensimrs-50"
        >
          <template #body="{ data }">
            {{ epochToDate(data.waktuPindah, 'time') }}
          </template>
        </Column>
        <Column
          field="keterangan"
          header="Keterangan"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="petugas"
          header="Petugas"
          headerClass="bg-opensimrs-50"
        ></Column>
      </DataTable>
    </template>
  </CustomAccordion>
</template>