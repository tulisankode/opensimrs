<script lang="ts" setup>
import { epochToDate } from "@/utils/Helpers";
import { ref } from "vue";

const props = defineProps({
  payload: {
    type: Array,
    default: () => [],
  },
});

const expandedRows = ref<any[]>([]);
</script>

<template>
  <!-- {{ payload }} -->
  <DataTable
    :value="payload"
    responsiveLayout="scroll"
    dataKey="id"
    :expandedRows="expandedRows"
    scrollable
    stripedRows
    scrollHeight="flex"
    class="p-datatable-sm"
  >
    <Column expander style="width: 2em" header-class="text-black bg-opensimrs-50">
    </Column>
    <Column
      field="id"
      header="No"
      header-class="text-black bg-opensimrs-50"
      class="w-10 p-5 text-center text-black text-SM"
    >
      <template #body="{ index }">{{ index + 1 }}</template>
    </Column>
    <Column
      field="tglRegistrasi"
      header="Tgl. Registrasi"
      header-class="text-black bg-opensimrs-50 "
      class="text-black text-SM"
      style="min-width: 120px"
    >
      <template #body="{ data }">
        {{ epochToDate(data.tanggalDaftar, "dateTime") }}
      </template>
    </Column>
    <Column
      field="noRegistrasi"
      header="No. Registrasi"
      header-class="text-black bg-opensimrs-50"
      class="text-black text-SM"
      style="min-width: 120px"
    >
      <template #body="{ data }">
        {{ data.noReg }}
      </template>
    </Column>
    <Column
      field="noRM"
      header="No. RM"
      header-class="text-black bg-opensimrs-50"
      class="text-black text-SM"
      style="min-width: 120px"
    >
      <template #body="{ data }">
        {{ data.patient.noRm }}
      </template>
    </Column>
    <Column
      field="namaPasien"
      header="Nama Pasien"
      header-class="text-black bg-opensimrs-50"
      class="text-SM"
      style="min-width: 100px"
    >
      <template #body="{ data }">
        {{ data.patient.name }}
      </template>
    </Column>
    <Column
      field="ruangan"
      header="Ruangan"
      header-class="text-black bg-opensimrs-50"
      class="text-SM"
      style="min-width: 100px"
    >
      <template #body="{ data }">
        {{ data.monitoringRoom?.room?.name ?? "-" }}
      </template>
    </Column>
    <Column
      field="dokter"
      header="Dokter"
      header-class="text-black bg-opensimrs-50"
      class="text-SM"
      style="min-width: 100px"
    >
      <template #body="{ data }">
        {{ data.practitioner?.pegawai?.name }}
      </template>
    </Column>

    <template #expansion="slotProps">
      <div class="p-3 -mx-2 -my-1.5 bg-opensimrs-75">
        <DataTable
          :value="[slotProps.data]"
          class="overflow-hidden rounded-lg bg-opensimrs-50"
        >
          <Column
            field="jenisKelamin"
            header="Jenis Kelamin"
            header-class="text-black bg-opensimrs-50"
            class="p-5 text-black text-SM"
            style="width: 100px"
          >
            <template #body="{ data }">
              {{ data.patient.gender == "Male" ? "L" : "P" }}
            </template>
          </Column>
          <Column
            field="patient.birthDetail.birthDate"
            header="Tgl. Lahir"
            header-class="text-black bg-opensimrs-50"
            class="text-black text-SM"
          >
            <template #body="{ data }">
              {{ data.patient.birthDetail.birthDate.substring(0, 10) }}
            </template>
          </Column>
          <Column
            field="patient.birthDetail.birthDate"
            header="Umur"
            header-class="text-black bg-opensimrs-50"
            class="text-black text-SM"
          >
            <template #body="{ data }">
              {{
                `${data.patient.birthDetail.ageYear} Tahun ${data.patient.birthDetail.ageMonth} Bulan ${data.patient.birthDetail.ageDay} Hari`
              }}
            </template>
          </Column>
          <Column
            field="patient.address.fullAddress"
            header="Alamat"
            header-class="text-black bg-opensimrs-50"
            class="text-black text-SM"
          ></Column>
          <Column
            field="kondisiPasienPulang" 
            header="Status Keluar Pasien"
            header-class="text-black bg-opensimrs-50"
            class="text-black text-SM"
          >
            <template #body="{ data }">
              <span v-if="data.kondisiPasienPulang === '359746009'">Stabil</span>
              <span v-else-if="data.kondisiPasienPulang === '162668006'">Tidak Stabil</span>
              <span v-else-if="data.kondisiPasienPulang === '268910001'">Perbaikan</span>
              <span v-else>{{ data.kondisiPasienPulang }}</span>
            </template>
          </Column>
          <Column
            field="statusPulang" 
            header="Kondisi Keluar"
            header-class="text-black bg-opensimrs-50"
            class="text-black text-SM"
          >
            <template #body="{ data }">
              <span v-if="data.statusPulang === 'home'">Pulang atas persetujuan dokter</span>
              <span v-else-if="data.statusPulang === 'aadvice'">Pulang atas permintaan sendiri</span>
              <span v-else-if="data.statusPulang === 'other-hcf'">Dirujuk</span>
              <span v-else-if="data.statusPulang === 'exp-lt48h'">Meninggal &lt; 48 jam</span>
              <span v-else-if="data.statusPulang === 'exp-gt48h'">Meninggal &gt; 48 jam</span>
              <span v-else-if="data.statusPulang === 'oth'">Lain-lain</span>
              <span v-else>{{ data.statusPulang }}</span>
            </template>
          </Column>
          <Column
            field="noBed"
            header="No. Bed"
            header-class="text-black bg-opensimrs-50"
            class="text-black text-SM"
          >
            <template #body="{ data }">
              {{ data.monitoringRoom?.noBed ?? "-" }}
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </DataTable>
</template>
