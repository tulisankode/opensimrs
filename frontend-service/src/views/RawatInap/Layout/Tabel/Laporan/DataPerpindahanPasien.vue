<script lang="ts" setup>
import CustomChip from "@/components/Base/CustomChip.vue";
import { PhArrowElbowDownRight } from "@phosphor-icons/vue";

const props = defineProps({
  payload: {
    type: Array as () => any[],
    default: () => [],
  },
});

// Helper untuk format nama dokter
const formatDoctorName = (pegawai: any) => {
  if (!pegawai) return "-";
  return `${pegawai.firstTitle || ""} ${pegawai.name || ""} ${pegawai.lastTitle || ""}`.trim();
};
</script>

<template>
  <DataTable
    :value="props.payload" 
    responsiveLayout="scroll"
    dataKey="id"
    scrollable
    stripedRows
    scrollHeight="flex"
    class="p-datatable-sm"
  >
    <Column
      header="No"
      header-class="text-black bg-opensimrs-50"
      class="w-10 p-5 text-center text-black text-SM"
    >
      <template #body="{ index }">
        {{ index + 1 }}
      </template>
    </Column>

    <Column
      header="Nama Pasien"
      header-class="text-black bg-opensimrs-50"
      class="text-black text-SM"
    >
      <template #body="{ data }">
        <div>
          <div class="font-bold">{{ data.rawatInap?.patient?.name ?? data.rawatInap?.name ?? "-" }}</div>
          <CustomChip
            :showCheckedIcon="false"
            :label="data.rawatInap?.noRm ?? '-'"
            bgColor="bg-opensimrs-300"
            textColor="text-white"
            customClass="h-4 pr-[6px] border-none mr-[5px]"
          />
        </div>
      </template>
    </Column>

    <Column
      header="Jenis Pelayanan"
      header-class="text-black bg-opensimrs-50 "
      class="text-black text-SM"
    >
        <template #body>
            Rawat Inap
        </template>
    </Column>

    <Column
      header="Penjamin"
      header-class="text-black bg-opensimrs-50"
      class="text-black text-SM"
    >
      <template #body="{ data }">
        <span v-if="data.rawatInap?.paymentMethod === 1">TUNAI</span>
         <span v-else>ASURANSI</span>
      </template>
    </Column>

    <Column
      header-class="text-black bg-opensimrs-50"
      class="text-black text-SM"
    >
      <template #header>
        <div class="flex font-semibold">
          <span>Dari Ruangan</span>
          <ArrowRightBrokenIcon :size="18" class="mx-1 text-opensimrs-300" />
          <span>Ke Ruangan</span>
        </div>
      </template>
      <template #body="{ data }">
        <div>
          <div>
            {{ data.originMonitoringRoom?.room?.name ?? "-" }} / 
            {{ data.originMonitoringRoom?.noBed ?? "-" }}
          </div>
          <div class="flex mt-[5px]">
            <PhArrowElbowDownRight
              :size="18"
              weight="bold"
              class="text-grey-300"
            />
            <span class="leading-6 ml-[5px]">
              {{ data.destinationMonitoringRoom?.room?.name ?? "-" }} /
              {{ data.destinationMonitoringRoom?.noBed ?? "-" }}
            </span>
          </div>
        </div>
      </template>
    </Column>

    <Column
      header-class="text-black bg-opensimrs-50"
      class="text-black text-SM"
    >
      <template #header>
        <div class="flex font-semibold">
          <span>Dari Kelas</span>
          <ArrowRightBrokenIcon :size="18" class="mx-1 text-opensimrs-300" />
          <span>Ke Kelas</span>
        </div>
      </template>
      <template #body="{ data }">
        <div>
          <div>
            {{ data.originMonitoringRoom?.room?.className ?? "-" }}
          </div>
          <div class="flex mt-[5px]">
            <PhArrowElbowDownRight
              :size="18"
              weight="bold"
              class="text-grey-300"
            />
             <span class="leading-6 ml-[5px]">
              {{ data.destinationMonitoringRoom?.room?.className ?? "-" }}
            </span>
          </div>
        </div>
      </template>
    </Column>

    <Column
      header="Dokter"
      header-class="text-black bg-opensimrs-50"
      class="text-SM"
    >
      <template #body="{ data }">
        {{ formatDoctorName(data.rawatInap?.practitioner?.pegawai) }}
      </template>
    </Column>
  </DataTable>
</template>