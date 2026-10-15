<script lang="ts" setup>
import NoData from "@/components/section/NoData.vue";
import { ref } from "vue";
import { epochToDate } from "@/utils/Helpers"; 

const props = defineProps({
  pembatalanPoliData: {
    type: Array as () => Array<any>,
    required: true,
  },
});

const expandedRows = ref<any[]>([]);
</script>

<template>
  <!-- {{ pembatalanPoliData }} -->
  <DataTable
  v-if="pembatalanPoliData.length"
    :value="pembatalanPoliData"
    responsiveLayout="scroll"
    dataKey="id"
    :expandedRows="expandedRows"
    scrollable
    scrollHeight="flex"
    class="p-datatable-sm"
  >
    <Column expander style="width: 2em" header-class="text-black bg-opensimrs-50">
    </Column>
    <Column
      field="no"
      header="No."
      header-class="text-black bg-opensimrs-50"
      class="text-black text-SM"
      style="width: 40px"
    >
      <template #body="{ index }">{{ index + 1 }}</template>
    </Column>
    <Column
      field="tanggalDaftar"
      header="Tgl. Registrasi"
      header-class="text-black bg-opensimrs-50 "
      class="text-black text-SM"
      style="min-width: 120px"
    >
      <template #body="{ data }">
        {{ epochToDate(data.tanggalDaftar, 'dateTime') }}
      </template>
    </Column> 
    <Column
      field="noReg"
      header="No. Registrasi"
      header-class="text-black bg-opensimrs-50"
      class="text-black text-SM"
      style="min-width: 120px"
    />
    <Column
      field="patient.noRm"
      header="No. RM"
      header-class="text-black bg-opensimrs-50"
      class="text-black text-SM"
      style="min-width: 120px"
    />
    <Column
      field="patient.name"
      header="Nama Pasien"
      header-class="text-black bg-opensimrs-50"
      class="text-SM"
      style="min-width: 100px"
    >
    </Column>
    <Column
      field="polyclinic.name"
      header="Poli"
      header-class="text-black bg-opensimrs-50"
      class="text-SM"
      style="min-width: 100px"
    >
    </Column>
    <Column
      field="practitioner.name"
      header="Dokter"
      header-class="text-black bg-opensimrs-50"
      class="text-SM"
      style="min-width: 100px"
    >
    </Column>
    <Column
      field="deletedAt"
      header="Tgl. Batal"
      header-class="text-black bg-opensimrs-50"
      class="text-SM"
      style="min-width: 100px"
    >
    <template #body="{ data }">
        {{ epochToDate(data.deletedAt, 'dateTime') }}
      </template>
    </Column>

    <template #expansion="slotProps">
      <div class="p-3 -mx-2 -my-1.5 bg-opensimrs-75">
        <DataTable
          :value="[slotProps.data]"
          class="overflow-hidden rounded-lg bg-opensimrs-50"
        >
          <Column
            field="petugas"
            header="Petugas"
            header-class="text-black bg-opensimrs-50"
            class="p-5 text-black text-SM"
            style="width: 300px"
          ></Column>
          <Column
            field="alasanBatal"
            header="Alasan Batal"
            header-class="text-black bg-opensimrs-50"
            class="text-black text-SM"
          ></Column>
          
        </DataTable>
      </div>
    </template>
  </DataTable>
  <NoData v-else/>
</template>
