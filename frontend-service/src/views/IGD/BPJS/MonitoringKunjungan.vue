<script lang="ts" setup>
import CustomChip from "@/components/Base/CustomChip.vue";
import { ref } from "vue";

const itemsMonitoringKunjungan = ref([
  {
    noPendaftaran: "00-00-00",
    name: "Nama Pasien Lengkap",
    tipeDiagnosa: "Diagnosa",
    BPJSClass: "Kelas 3",
    no_SEP: "1234567891234567",
    tanggalAktivasiBPJS: "01-01-2024 08:00",
    noRujukan: "123456",
    tglDischarge: "01-01-2024",
    jamDischarge: "10:00",
  },
  {
    noPendaftaran: "00-00-00",
    name: "Nama Pasien Lengkap",
    tipeDiagnosa: "Diagnosa",
    BPJSClass: "Kelas 1",
    no_SEP: "1234567891234567",
    tanggalAktivasiBPJS: "01-01-2024 08:00",
    noRujukan: "123456",
    tglDischarge: "02-01-2024",
    jamDischarge: "09:00",
  },
  {
    noPendaftaran: "00-00-00",
    name: "Nama Pasien Lengkap",
    tipeDiagnosa: "Diagnosa",
    BPJSClass: "Kelas 1",
    no_SEP: "1234567891234567",
    tanggalAktivasiBPJS: "01-01-2024 08:00",
    noRujukan: "123456",
    tglDischarge: "02-01-2024",
    jamDischarge: "09:00",
  },
  {
    noPendaftaran: "00-00-00",
    name: "Nama Pasien Lengkap",
    tipeDiagnosa: "Diagnosa",
    BPJSClass: "Kelas 1",
    no_SEP: "1234567891234567",
    tanggalAktivasiBPJS: "01-01-2024 08:00",
    noRujukan: "123456",
    tglDischarge: "02-01-2024",
    jamDischarge: "09:00",
  },
  {
    noPendaftaran: "00-00-00",
    name: "Nama Pasien Lengkap",
    tipeDiagnosa: "Diagnosa",
    BPJSClass: "Kelas 1",
    no_SEP: "1234567891234567",
    tanggalAktivasiBPJS: "01-01-2024 08:00",
    noRujukan: "123456",
    tglDischarge: "02-01-2024",
    jamDischarge: "09:00",
  },
]);
</script>

<template>
    <DataTable
      v-if="itemsMonitoringKunjungan.length"
      :value="itemsMonitoringKunjungan"
      tableStyle="min-width: 50rem"
      scrollable
      scrollHeight="flex"
      :pt="{ headerRow: 'text-SM' }"
    >
      <Column
        field="no"
        headerClass="bg-opensimrs-50"
        header="No"
        class="w-[40px]"
      >
        <template #body="slotProps">
          <div class="w-full text-center text-SM">
            {{ slotProps.index + 1 }}
          </div>
        </template>
      </Column>
      <Column
        field="pasien"
        header="Pasien"
        headerClass="bg-opensimrs-50"
        class="w-1/2"
      >
        <template #body="slotProps">
          <div class="text-SM">
            <div class="font-semibold">{{ slotProps.data.name }}</div>
            <CustomChip
              :showCheckedIcon="false"
              :label="slotProps.data.noPendaftaran"
              bgColor="bg-opensimrs-300"
              textColor="text-white"
              customClass="h-5 pr-[6px] border-none mr-[5px]"
            />
          </div>
        </template>
      </Column>
     
      <Column field="diagnosa" header="Diagnosa" headerClass="bg-opensimrs-50">
        <template #body="slotProps">
          <div class="text-SM">{{ slotProps.data.tipeDiagnosa }}</div>
        </template>
      </Column>
      <Column field="bpjs" header="BPJS" headerClass="bg-opensimrs-50">
        <template #body="slotProps">
          <div class="flex flex-col gap-1.5">
            <div>
              <CustomChip
                :showCheckedIcon="false"
                :label="slotProps.data.BPJSClass"
                bgColor="bg-warning-300"
                textColor="text-white"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
            </div>

            <div class="text-SM">SEP {{ slotProps.data.no_SEP }}</div>
            <div class="text-SM">
              {{ slotProps.data.tglDischarge }}
              {{ slotProps.data.jamDischarge }}
            </div>
          </div>
        </template>
      </Column>
      <Column
        field="no-rujukan"
        header="No. Rujukan"
        headerClass="bg-opensimrs-50"
        class="w-[120px]"
      >
        <template #body="slotProps">
          <div class="text-SM">RUJ.{{ slotProps.data.noRujukan }}</div>
        </template>
      </Column>
      <Column
        field="tgl-discharge-pelayanan"
        header="Tgl. Discharge Pelayanan"
        headerClass="bg-opensimrs-50"
        class="w-[120px]"
      >
        <template #body="slotProps">
          <div class="text-SM">
            <div>{{ slotProps.data.tglDischarge }}</div>
            <div>{{ slotProps.data.jamDischarge }}</div>
          </div>
        </template>
      </Column>
    </DataTable>
</template>
