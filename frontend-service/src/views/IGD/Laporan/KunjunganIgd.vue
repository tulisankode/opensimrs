<script lang="ts" setup>
import { ref } from "vue";
import { epochToDate } from "@/utils/Helpers";

const props = defineProps({
  payload: {
    type: Array,
    default: () => [],
  },
});

const expandedRows = ref<any[]>([]);
</script>

<template>
  <DataTable
    :value="props.payload"
    responsiveLayout="scroll"
    dataKey="uuid" 
    v-model:expandedRows="expandedRows"
    scrollable
    scrollHeight="flex"
    class="p-datatable-sm"
  >
    <Column expander style="width: 2em" header-class="text-black bg-opensimrs-50" />
    <Column
      header="No" header-class="text-black bg-opensimrs-50"
      class="w-10 p-5 text-center text-black text-SM"
    >
      <template #body="{ index }">{{ index + 1 }}</template>
    </Column>
    <Column
      field="tanggal_daftar"
      header="Tgl. Registrasi"
      header-class="text-black bg-opensimrs-50 "
      class="text-black text-SM"
      style="min-width: 120px"
    >
      <template #body="{ data }">
        {{ epochToDate(data.tanggal_daftar, "dateTime") }}
      </template>
    </Column>
    <Column
      field="no_reg"
      header="No. Registrasi"
      header-class="text-black bg-opensimrs-50"
      class="text-black text-SM"
      style="min-width: 120px"
    />
    <Column
      field="patient.no_rm"
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
    />
    <Column
      field="practitioner.name"
      header="Dokter"
      header-class="text-black bg-opensimrs-50"
      class="text-SM"
      style="min-width: 100px"
    />

    <template #expansion="slotProps">
      <div class="p-3 -mx-2 -my-1.5 bg-opensimrs-75">
        <DataTable
          :value="[slotProps.data]"
          class="overflow-hidden rounded-lg bg-opensimrs-50"
        >
          <Column
            header="Jenis Kelamin"
            header-class="text-black bg-opensimrs-50"
            class="p-5 text-black text-SM"
            style="width: 100px"
          >
            <template #body="{ data }">
              {{ ['Male', 'Laki-laki'].includes(data.patient.gender) ? 'L' : ['Female', 'Perempuan'].includes(data.patient.gender) ? 'P' : '-' }}
            </template>
          </Column>
          <Column
            field="patient.birth_detail.birth_date"
            header="Tgl. Lahir"
            header-class="text-black bg-opensimrs-50"
            class="text-black text-SM"
          >
             <template #body="{ data }">
               {{ data.patient.birth_detail.birth_date.split('T')[0] }}
             </template>
          </Column>
          <Column
            header="Umur"
            header-class="text-black bg-opensimrs-50"
            class="text-black text-SM"
          >
            <template #body="{ data }">
              {{
                `${data.patient.birth_detail.age_year} Tahun ${data.patient.birth_detail.age_month} Bulan ${data.patient.birth_detail.age_day} Hari`
              }}
            </template>
          </Column>
          <Column
            field="patient.address.full_address"
            header="Alamat"
            header-class="text-black bg-opensimrs-50"
            class="text-black text-SM"
          />
          <Column
            field="kondisi_pasien_pulang" 
            header="Status Keluar"
            header-class="text-black bg-opensimrs-50"
            class="text-black text-SM"
          >
            <template #body="{ data }">
              <span v-if="data.kondisi_pasien_pulang === '359746009'">Stabil</span>
              <span v-else-if="data.kondisi_pasien_pulang === '162668006'">Tidak Stabil</span>
              <span v-else-if="data.kondisi_pasien_pulang === '268910001'">Perbaikan</span>
              <span v-else>{{ data.kondisi_pasien_pulang }}</span>
            </template>
          </Column>
          <Column
            field="status_pulang" 
            header="Kondisi Keluar"
            header-class="text-black bg-opensimrs-50"
            class="text-black text-SM"
          >
            <template #body="{ data }">
              <span v-if="data.status_pulang === 'home'">Pulang atas persetujuan dokter</span>
              <span v-else-if="data.status_pulang === 'aadvice'">Pulang atas permintaan sendiri</span>
              <span v-else-if="['other-hfc', 'other-hcf'].includes(data.status_pulang)">Dirujuk</span>
              <span v-else-if="data.status_pulang === 'exp-lt48h'">Meninggal &lt; 48 jam</span>
              <span v-else-if="data.status_pulang === 'exp-gt48h'">Meninggal &gt; 48 jam</span>
              <span v-else-if="data.status_pulang === 'oth'">Lain-lain</span>
              <span v-else>{{ data.status_pulang }}</span>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </DataTable>
</template>