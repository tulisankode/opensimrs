<script lang="ts" setup>
import { ref } from "vue";
import { epochToDate } from "@/utils/Helpers"; 

const props = defineProps({
  payload: {
    type: Array as () => any[],
    default: () => [],
  },
});

const expandedRows = ref<any[]>([]);
</script>

<template>
  <DataTable
    :value="props.payload"
    responsiveLayout="scroll"
    dataKey="id"
    :expandedRows="expandedRows"
    scrollable
    stripedRows
    scrollHeight="flex"
    class="p-datatable-sm"
  >
    <Column expander style="width: 2em" header-class="text-black bg-opensimrs-50" />

    <Column
      header="No"
      header-class="text-black bg-opensimrs-50"
      class="w-10 p-5 text-center text-black text-SM"
    >
      <template #body="{ index }">{{ index + 1 }}</template>
    </Column>

    <Column
      header="Tgl. Registrasi"
      header-class="text-black bg-opensimrs-50"
      class="text-black text-SM"
      style="min-width: 120px"
    >
      <template #body="{ data }">
        {{ epochToDate(data?.tanggalDaftar, "dateTime") }}
      </template>
    </Column>

    <Column
      header="No. Registrasi"
      header-class="text-black bg-opensimrs-50"
      class="text-black text-SM"
      style="min-width: 120px"
    >
      <template #body="{ data }">{{ data?.noReg }}</template>
    </Column>

    <Column
      header="No. RM"
      header-class="text-black bg-opensimrs-50"
      class="text-black text-SM"
      style="min-width: 120px"
    >
      <template #body="{ data }">{{ data?.patient?.noRm }}</template>
    </Column>

    <Column
      header="Nama Pasien"
      header-class="text-black bg-opensimrs-50"
      class="text-SM"
      style="min-width: 100px"
    >
      <template #body="{ data }">{{ data?.patient?.name }}</template>
    </Column>

    <Column
      header="Ruangan"
      header-class="text-black bg-opensimrs-50"
      class="text-SM"
      style="min-width: 100px"
    >
       <template #body="{ data }">{{ data?.monitoringRoom?.room?.name ?? data?.ruangan?.name ?? '-' }}</template>
    </Column>

    <Column
      header="Dokter DPJP"
      header-class="text-black bg-opensimrs-50"
      class="text-SM"
      style="min-width: 100px"
    >
       <template #body="{ data }">{{ data?.practitioner?.pegawai?.name ?? '-' }}</template>
    </Column>

    <Column
      header="Tgl. Batal"
      header-class="text-black bg-opensimrs-50"
      class="text-SM"
      style="min-width: 100px"
    >
        <template #body="{ data }">
            {{ epochToDate(data?.deletedAt, "dateTime") }}
        </template>
    </Column>

    <template #expansion="slotProps">
      <div class="p-3 -mx-2 -my-1.5 bg-opensimrs-75">
        <DataTable
          :value="[slotProps.data]"
          class="overflow-hidden rounded-lg bg-opensimrs-50"
        >
          <Column
            header="Kelas"
            header-class="text-black bg-opensimrs-50"
            class="p-5 text-black text-SM"
            style="width: 300px"
          >
             <template #body="{ data }">{{ data?.monitoringRoom?.room?.className ?? data?.ruangan?.className ?? '-' }}</template>
          </Column>
          <Column
            header="No. Bed"
            header-class="text-black bg-opensimrs-50"
            class="p-5 text-black text-SM"
            style="width: 300px"
          >
             <template #body="{ data }">{{ data?.monitoringRoom?.noBed ?? '-' }}</template>
          </Column>
          <Column
            header="Petugas"
            header-class="text-black bg-opensimrs-50"
            class="p-5 text-black text-SM"
            style="width: 300px"
          >
             <template #body="{ data }">{{ data?.petugas ?? '-' }}</template>
          </Column>
          <Column
            header="Alasan Batal"
            header-class="text-black bg-opensimrs-50"
            class="text-black text-SM"
          >
             <template #body="{ data }">{{ data?.alasanBatal ?? '-' }}</template>
          </Column>
        </DataTable>
      </div>
    </template>
  </DataTable>
</template>