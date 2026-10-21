<script lang="ts" setup>
import NoData from "@/components/section/NoData.vue";
import { epochToDate } from "@/utils/Helpers";
import { ref } from "vue";

const props = defineProps({
  kunjunganData: {
    type: Array as () => Array<any>,
    required: true,
  },
});


const expandedRows = ref<any[]>([]);
</script>

<template>
  <!-- {{ kunjunganData }} -->
  <DataTable
  v-if="kunjunganData.length"
    v-model:expandedRows="expandedRows"
    :value="kunjunganData"
    tableStyle="min-width: 50rem"
    scrollable
    scrollHeight="flex"
    :pt="{ headerRow: 'text-SM' }"
  >
    <Column
      expander
      style="width: 40px"
      header-class="text-black bg-opensimrs-50"
    />
    <Column
      field="no"
      header="No."
      header-class="text-black bg-opensimrs-50"
      style="width: 40px"
    >
      <template #body="{ index }">{{ index + 1 }}</template>
    </Column>
    <Column
      field="tglDaftar"
      header="Tgl. Registrasi"
      header-class="text-black bg-opensimrs-50"
    >
      <template #body="{ data }">
        {{ epochToDate(data.tanggalDaftar, "dateTime") }}
      </template>
    </Column>
    <Column
      field="noReg"
      header="No. Registrasi"
      header-class="text-black bg-opensimrs-50"
    ></Column>
    <Column
      field="patient.noRm"
      header="No. RM"
      header-class="text-black bg-opensimrs-50"
    ></Column>
    <Column
      field="patient.name"
      header="Nama Pasien"
      header-class="text-black bg-opensimrs-50"
    ></Column>
    <Column
      field="polyclinic.name"
      header="Poli"
      header-class="text-black bg-opensimrs-50"
    ></Column>
    <Column
      field="practitioner.name"
      header="Dokter"
      header-class="text-black bg-opensimrs-50"
    ></Column>
    <template #expansion="slotProps">
      <div class="p-3 -mx-3 -my-1.5 bg-opensimrs-75">
        <DataTable
          :value="[slotProps.data]"
          class="overflow-hidden rounded-lg bg-opensimrs-50"
          :pt="{ headerRow: 'text-SM' }"
        >
          <Column
            field="gender"
            header="Jenis Kelamin"
            header-class="text-black bg-opensimrs-50"
          >
            <template #body="{ data }">
              {{ ['Male', 'Laki-laki'].includes(data.patient.gender) ? 'L' : ['Female', 'Perempuan'].includes(data.patient.gender) ? 'P' : '-' }}
            </template>
          </Column>
          <Column
            field="patient.birthDetail.birthDate"
            header="Tgl. Lahir"
            header-class="text-black bg-opensimrs-50"
          ></Column>
          <Column
            field="patient.birthDetail.birthDate"
            header="Umur"
            header-class="text-black bg-opensimrs-50"
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
          />
          <Column
            field="patient.identity"
            header="Jenis ID"
            header-class="text-black bg-opensimrs-50"
          ></Column>
          <Column
            field="patient.noIdentity"
            header="No. Identitas"
            header-class="text-black bg-opensimrs-50"
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
              <span v-else-if="['other-hfc', 'other-hcf'].includes(data.statusPulang)">Dirujuk</span>
              <span v-else-if="data.statusPulang === 'exp-lt48h'">Meninggal &lt; 48 jam</span>
              <span v-else-if="data.statusPulang === 'exp-gt48h'">Meninggal &gt; 48 jam</span>
              <span v-else-if="data.statusPulang === 'oth'">Lain-lain</span>
              <span v-else>{{ data.statusPulang }}</span>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </DataTable>

  <NoData v-else/>
</template>
